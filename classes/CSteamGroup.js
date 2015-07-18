var SteamCommunity = require('../index.js');
var SteamID = require('steamid');
var xml2js = require('xml2js');

SteamCommunity.prototype.getSteamGroup = function(id, callback) {
	if(typeof id !== 'string' && !(typeof id === 'object' && id.__proto__ === SteamID.prototype)) {
		throw new Error("id parameter should be a group URL string or a SteamID object");
	}
	
	if(typeof id === 'object' && (id.universe != SteamID.Universe.PUBLIC || id.type != SteamID.Type.CLAN)) {
		throw new Error("SteamID must stand for a clan account in the public universe");
	}
	
	var self = this;
	this.request("https://steamcommunity.com/" + (typeof id === 'string' ? "groups/" + id : "gid/" + id.toString()) + "/memberslistxml/?xml=1", function(err, response, body) {
		if(self._checkHttpError(err, response, callback)) {
			return;
		}
		
		if(self._checkCommunityError(body, callback)) {
			return;
		}
		
		xml2js.parseString(body, function(err, result) {
			if(err) {
				callback(err);
				return;
			}
			
			callback(null, new CSteamGroup(self, result.memberList));
		});
	});
};

function CSteamGroup(community, groupData) {
	this._community = community;
	
	this.steamID = new SteamID(groupData.groupID64[0]);
	this.name = groupData.groupDetails[0].groupName[0];
	this.url = groupData.groupDetails[0].groupURL[0];
	this.headline = groupData.groupDetails[0].headline[0];
	this.summary = groupData.groupDetails[0].summary[0];
	this.avatarHash = groupData.groupDetails[0].avatarIcon[0].match(/([0-9a-f]+)\.jpg$/)[1];
	this.members = parseInt(groupData.groupDetails[0].memberCount[0], 10);
	this.membersInChat = parseInt(groupData.groupDetails[0].membersInChat[0], 10);
	this.membersInGame = parseInt(groupData.groupDetails[0].membersInGame[0], 10);
	this.membersOnline = parseInt(groupData.groupDetails[0].membersOnline[0], 10);
}

CSteamGroup.prototype.getAvatarURL = function(size, protocol) {
	size = size || '';
	protocol = protocol || 'http://';
	
	var url = protocol + "steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/" + this.avatarHash.substring(0, 2) + "/" + this.avatarHash;
	if(size == 'full' || size == 'medium') {
		return url + "_" + size + ".jpg";
	} else {
		return url + ".jpg";
	}
};

CSteamGroup.prototype.getMembers = function(callback, members, link) {
	members = members || [];
	link = link || "http://steamcommunity.com/gid/" + this.steamID.toString() + "/memberslistxml/?xml=1";
	
	var self = this;
	this._community.request(link, function(err, response, body) {
		if(self._checkHttpError(err, response, callback)) {
			return;
		}
		
		xml2js.parseString(body, function(err, result) {
			if(err) {
				callback(err);
				return;
			}
			
			members = members.concat(result.memberList.members[0].steamID64.map(function(steamID) {
				return new SteamID(steamID);
			}));
			
			if(result.memberList.nextPageLink) {
				self.getMembers(callback, members, result.memberList.nextPageLink[0]);
			} else {
				callback(null, members);
			}
		});
	});
};

CSteamGroup.prototype.join = function(callback) {
	var form = {
		"action": "join",
		"sessionID": this._community.getSessionID()
	};
	
	var self = this;
	this._community.request.post("https://steamcommunity.com/gid/" + this.steamID.toString(), {"form": form}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		if(self._community._checkCommunityError(body, callback)) {
			return;
		}
		
		callback(null);
	});
};

CSteamGroup.prototype.leave = function(callback) {
	var form = {
		"sessionID": this._community.getSessionID(),
		"action": "leaveGroup",
		"groupId": this.steamID.toString()
	};
	
	var self = this;
	this._community._myProfile("home_process", form, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		if(self._community._checkCommunityError(body, callback)) {
			return;
		}
		
		callback(null);
	});
};

CSteamGroup.prototype.postAnnouncement = function(headline, content, callback) {
	var form = {
		"sessionID": this._community.getSessionID(),
		"action": "post",
		"headline": headline,
		"body": content
	};
	
	this._community.request.post("https://steamcommunity.com/gid/" + this.steamID.toString() + "/announcements", {"form": form}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		if(self._community._checkCommunityError(body, callback)) {
			return;
		}
		
		callback(null);
	});
};

CSteamGroup.prototype.scheduleEvent = function(name, type, description, time, server, callback) {
	// Event types: ChatEvent - Chat, OtherEvent - A lil somethin somethin, PartyEvent - Party!, MeetingEvent - Important meeting, SpecialCauseEvent - Special cause (charity ball?), MusicAndArtsEvent - Music or Art type thing, SportsEvent - Sporting endeavor, TripEvent - Out of town excursion
	// Passing a number for type will make it a game event for that appid
	
	if(typeof server === 'function') {
		callback = server;
		server = {"ip": "", "password": ""};
	} else if(typeof server === 'string') {
		server = {"ip": server, "password": ""};
	} else {
		server = {"ip": "", "password": ""};
	}
	
	var form = {
		"sessionid": this._community.getSessionID(),
		"action": "newEvent",
		"tzOffset": new Date().getTimezoneOffset() * -60,
		"name": name,
		"type": (typeof type === 'number' || !isNaN(parseInt(type, 10)) ? "GameEvent" : type),
		"appID": (typeof type === 'number' || !isNaN(parseInt(type, 10)) ? type : ''),
		"serverIP": server.ip,
		"serverPassword": server.password,
		"notes": description,
		"eventQuickTime": "now"
	};
	
	if(time === null) {
		form.startDate = 'MM/DD/YY';
		form.startHour = '12';
		form.startMinute = '00';
		form.startAMPM = 'PM';
		form.timeChoice = 'quick';
	} else {
		form.startDate = (time.getMonth() + 1 < 10 ? '0' : '') + (time.getMonth() + 1) + '/' + (time.getDate() < 10 ? '0' : '') + time.getDate() + '/' + time.getFullYear().toString().substring(2);
		form.startHour = (time.getHours() === 0 ? '12' : (time.getHours() > 12 ? time.getHours() - 12 : time.getHours()));
		form.startMinute = (time.getMinutes() < 10 ? '0' : '') + time.getMinutes();
		form.startAMPM = (time.getHours() <= 12 ? 'AM' : 'PM');
		form.timeChoice = 'specific';
	}
	
	var self = this;
	this._community.request.post("https://steamcommunity.com/gid/" + this.steamID.toString() + "/eventEdit", {"form": form}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		if(self._community._checkCommunityError(body, callback)) {
			return;
		}
		
		callback(null);
	});
};

CSteamGroup.prototype.setPlayerOfTheWeek = function(steamID, callback) {
	var form = {
		"xml": 1,
		"action": "potw",
		"memberId": steamID.getSteam3RenderedID(),
		"sessionid": this._community.getSessionID()
	};
	
	var self = this;
	this._community.request.post("https://steamcommunity.com/gid/" + this.steamID.toString() + "/potwEdit", {"form": form}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode != 200) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		xml2js.parseString(body, function(err, results) {
			if(err) {
				callback(err);
				return;
			}
			
			if(results.response.results[0] == 'OK') {
				callback(null, new SteamID(results.response.oldPOTW[0]), new SteamID(results.response.newPOTW[0]));
			} else {
				callback(new Error(results.response.results[0]));
			}
		});
	});
};

CSteamGroup.prototype.kick = function(steamID, callback) {
	var form = {
		"sessionID": this._community.getSessionID(),
		"action": "kick",
		"memberId": steamID.toString(),
		"queryString": ""
	};
	
	var self = this;
	this._community.request.post("https://steamcommunity.com/gid/" + this.steamID.toString() + "/membersManage", {"form": form}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		if(self._community._checkCommunityError(body, callback)) {
			return;
		}
		
		callback(null);
	});
};
