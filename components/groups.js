var SteamCommunity = require('../index.js');
var SteamID = require('steamid');
var xml2js = require('xml2js');
var Cheerio = require('cheerio');

SteamCommunity.prototype.getGroupMembers = function(gid, callback, members, link, addresses, addressIdx) {
	members = members || [];

	if (!link) {
		if (typeof gid !== 'string') {
			// It's a SteamID object
			link = "http://steamcommunity.com/gid/" + gid.toString() + "/memberslistxml/?xml=1";
		} else {
			try {
				var sid = new SteamID(gid);
				if (sid.type == SteamID.Type.CLAN && sid.isValid()) {
					link = "http://steamcommunity.com/gid/" + sid.getSteamID64() + "/memberslistxml/?xml=1";
				} else {
					throw new Error("Doesn't particularly matter what this message is");
				}
			} catch (e) {
				link = "http://steamcommunity.com/groups/" + gid + "/memberslistxml/?xml=1";
			}
		}
	}

	addressIdx = addressIdx || 0;

	var options = {};
	options.uri = link;

	if(addresses) {
		if(addressIdx >= addresses.length) {
			addressIdx = 0;
		}

		options.localAddress = addresses[addressIdx];
	}

	var self = this;
	this.request(options, function(err, response, body) {
		if (self._checkHttpError(err, response, callback)) {
			return;
		}

		xml2js.parseString(body, function(err, result) {
			if (err) {
				callback(err);
				return;
			}

			members = members.concat(result.memberList.members[0].steamID64.map(function(steamID) {
				return new SteamID(steamID);
			}));

			if (result.memberList.nextPageLink) {
				addressIdx++;
				self.getGroupMembers(gid, callback, members, result.memberList.nextPageLink[0], addresses, addressIdx);
			} else {
				callback(null, members);
			}
		});
	});
};

SteamCommunity.prototype.getGroupMembersEx = function(gid, addresses, callback) {
	this.getGroupMembers(gid, callback, null, null, addresses, 0);
};

SteamCommunity.prototype.joinGroup = function(gid, callback) {
	if(typeof gid === 'string') {
		gid = new SteamID(gid);
	}

	var self = this;
	this.request.post({
		"uri": "https://steamcommunity.com/gid/" + gid.getSteamID64(),
		"form": {
			"action": "join",
			"sessionID": this.getSessionID()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}

		if(self._checkCommunityError(body, callback)) {
			return;
		}

		callback(null);
	});
};

SteamCommunity.prototype.leaveGroup = function(gid, callback) {
	if(typeof gid === 'string') {
		gid = new SteamID(gid);
	}

	var self = this;
	this._myProfile("home_process", {
		"sessionID": this.getSessionID(),
		"action": "leaveGroup",
		"groupId": gid.getSteamID64()
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}

		if(self._checkCommunityError(body, callback)) {
			return;
		}

		callback(null);
	});
};

SteamCommunity.prototype.postGroupAnnouncement = function(gid, headline, content, callback) {
	if(typeof gid === 'string') {
		gid = new SteamID(gid);
	}

	var self = this;
	this.request.post({
		"uri": "https://steamcommunity.com/gid/" + gid.getSteamID64() + "/announcements",
		"form": {
			"sessionID": this.getSessionID(),
			"action": "post",
			"headline": headline,
			"body": content
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}

		if(self._checkCommunityError(body, callback)) {
			return;
		}

		callback(null);
	})
};

SteamCommunity.prototype.scheduleGroupEvent = function(gid, name, type, description, time, server, callback) {
	if(typeof gid === 'string') {
		gid = new SteamID(gid);
	}

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
		"sessionid": this.getSessionID(),
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
	this.request.post({
		"uri": "https://steamcommunity.com/gid/" + this.steamID.toString() + "/eventEdit",
		"form": form
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}

		if(self._checkCommunityError(body, callback)) {
			return;
		}

		callback(null);
	});
};

SteamCommunity.prototype.setGroupPlayerOfTheWeek = function(gid, steamID, callback) {
	if(typeof gid === 'string') {
		gid = new SteamID(gid);
	}

	if(typeof steamID === 'string') {
		steamID = new SteamID(steamID);
	}

	var self = this;
	this.request.post({
		"uri": "https://steamcommunity.com/gid/" + gid.getSteamID64() + "/potwEdit",
		"form": {
			"xml": 1,
			"action": "potw",
			"memberId": steamID.getSteam3RenderedID(),
			"sessionid": this.getSessionID()
		}
	}, function(err, response, body) {
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

SteamCommunity.prototype.kickGroupMember = function(gid, steamID, callback) {
	if(typeof gid === 'string') {
		gid = new SteamID(gid);
	}

	if(typeof steamID === 'string') {
		steamID = new SteamID(steamID);
	}

	var self = this;
	this.request.post({
		"uri": "https://steamcommunity.com/gid/" + gid.getSteamID64() + "/membersManage",
		"form": {
			"sessionID": this.getSessionID(),
			"action": "kick",
			"memberId": steamID.getSteamID64(),
			"queryString": ""
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}

		if(self._checkCommunityError(body, callback)) {
			return;
		}

		callback(null);
	});
};

SteamCommunity.prototype.getGroupHistory = function(gid, page, callback) {
	if(typeof gid === 'string') {
		gid = new SteamID(gid);
	}

	if(typeof page === 'function') {
		callback = page;
		page = 1;
	}

	var self = this;
	this.request("https://steamcommunity.com/gid/" + gid.getSteamID64() + "/history?p=" + page, function(err, response, body) {
		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		if(self._checkCommunityError(body, callback)) {
			return;
		}

		var $ = Cheerio.load(body);
		var output = {};

		var paging = $('.group_paging p').text();
		var match = paging.match(/(\d+) - (\d+) of (\d+)/);

		if(match) {
			output.first = parseInt(match[1], 10);
			output.last = parseInt(match[2], 10);
			output.total = parseInt(match[3], 10);
		}

		output.items = [];
		var currentYear = (new Date()).getFullYear();
		var lastDate = Date.now();

		Array.prototype.forEach.call($('.historyItem, .historyItemb'), function(item) {
			var data = {};

			var $item = $(item);
			data.type = $item.find('.historyShort').text().replace(/ /g, '');

			var users = $item.find('.whiteLink[data-miniprofile]');
			var sid;
			if(users[0]) {
				sid = new SteamID();
				sid.universe = SteamID.Universe.PUBLIC;
				sid.type = SteamID.Type.INDIVIDUAL;
				sid.instance = SteamID.Instance.DESKTOP;
				sid.accountid = $(users[0]).data('miniprofile');
				data.user = sid;
			}

			if(users[1]) {
				sid = new SteamID();
				sid.universe = SteamID.Universe.PUBLIC;
				sid.type = SteamID.Type.INDIVIDUAL;
				sid.instance = SteamID.Instance.DESKTOP;
				sid.accountid = $(users[0]).data('miniprofile');
				data.actor = sid;
			}

			// Figure out the date. Of course there's no year, because Valve
			var dateParts = $item.find('.historyDate').text().split('@');
			var date = dateParts[0].trim().replace(/(st|nd|th)$/, '').trim() + ', ' + currentYear;
			var time = dateParts[1].trim().replace(/(am|pm)/, ' $1');

			date = new Date(date + ' ' + time + ' UTC');

			// If this date is in the future, or it's later than the previous one, decrement the year
			if(date.getTime() > lastDate) {
				date.setFullYear(date.getFullYear() - 1);
			}

			data.date = date;

			output.items.push(data);
		});

		callback(null, output);
	});
};
