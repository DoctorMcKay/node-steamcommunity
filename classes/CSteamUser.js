var SteamCommunity = require('../index.js');
var SteamID = require('steamid');
var xml2js = require('xml2js');

SteamCommunity.prototype.getSteamUser = function(id, callback) {
	if(typeof id !== 'string' && !(typeof id === 'object' && id.__proto__ === SteamID.prototype)) {
		throw new Error("id parameter should be a user URL string or a SteamID object");
	}
	
	if(typeof id === 'object' && (id.universe != SteamID.Universe.PUBLIC || id.type != SteamID.Type.INDIVIDUAL)) {
		throw new Error("SteamID must stand for an individual account in the public universe");
	}
	
	var self = this;
	this.request("http://steamcommunity.com/" + (typeof id === 'string' ? "id/" + id : "profiles/" + id.toString()) + "/?xml=1", function(err, response, body) {
		if(self._checkHttpError(err, response, callback)) {
			return;
		}
		
		if(self._checkCommunityError(body, callback)) {
			return;
		}
		
		xml2js.parseString(body, function(err, result) {
			if(err || (!result.response && !result.profile)) {
				callback(err || new Error("No valid response"));
				return;
			}
			
			if(result.response && result.response.error && result.response.error.length) {
				callback(new Error(result.response.error[0]));
				return;
			}
			
			// Try and find custom URL from redirect
			var customurl = null;
			if(response.request.redirects && response.request.redirects.length) {
				var match = response.request.redirects[0].redirectUri.match(/https?:\/\/steamcommunity\.com\/id\/([^/])+\/\?xml=1/);
				if(match) {
					customurl = match[1];
				}
			}
			
			callback(null, new CSteamUser(self, result.profile, customurl));
		});
	});
};

function CSteamUser(community, userData, customurl) {
	this._community = community;
	
	this.steamID = new SteamID(userData.steamID64[0]);
	this.name = userData.steamID[0];
	this.onlineState = userData.onlineState[0];
	this.stateMessage = userData.stateMessage[0];
	this.privacyState = userData.privacyState[0];
	this.visibilityState = userData.visibilityState[0];
	this.avatarHash = userData.avatarIcon[0].match(/([0-9a-f]+)\.[a-z]+$/)[1];
	this.vacBanned = !!userData.vacBanned[0];
	this.tradeBanState = userData.tradeBanState[0];
	this.isLimitedAccount = !!userData.isLimitedAccount[0];
	this.customURL = userData.customURL ? userData.customURL[0] : customurl;
	
	if(this.visibilityState == 3) {
		this.memberSince = new Date(userData.memberSince[0].replace(/(\d{1,2})(st|nd|th)/, "$1"));
		this.location = userData.location[0] || null;
		this.realName = userData.realname[0] || null;
		this.summary = userData.summary[0] || null;
	} else {
		this.memberSince = null;
		this.location = null;
		this.realName = null;
		this.summary = null;
	}
	
	// Maybe handle mostPlayedGames?
	
	this.groups = null;
	this.primaryGroup = null;
	
	var self = this;
	if(userData.groups && userData.groups[0] && userData.groups[0].group) {
		this.groups = userData.groups[0].group.map(function(group) {
			if(group['$'] && group['$'].isPrimary) {
				self.primaryGroup = new SteamID(group.groupID64[0]);
			}
			
			return new SteamID(group.groupID64[0]);
		});
	}
}

CSteamUser.getAvatarURL = function(hash, size, protocol) {
	size = size || '';
	protocol = protocol || 'http://';
	
	var url = protocol + "steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/" + hash.substring(0, 2) + "/" + hash;
	if(size == 'full' || size == 'medium') {
		return url + "_" + size + ".jpg";
	} else {
		return url + ".jpg";
	}
};

CSteamUser.prototype.getAvatarURL = function(size, protocol) {
	return CSteamUser.getAvatarURL(this.avatarHash, size, protocol);
};

CSteamUser.prototype.addFriend = function(callback) {
	var self = this;
	this._community.request.post('https://steamcommunity.com/actions/AddFriendAjax', {"form": {"accept_invite": 0, "sessionID": this._community.getSessionID(), "steamid": this.steamID.toString()}}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(self._community._checkHttpError(err, response, callback)) {
			return;
		}
		
		var json;
		try {
			json = JSON.parse(body);
		} catch(e) {
			callback(e);
			return;
		}
		
		if(json.success) {
			callback(null);
		} else {
			callback(new Error("Unknown error"));
		}
	});
};

CSteamUser.prototype.acceptFriendRequest = function(callback) {
	var self = this;
	this._community.request.post('https://steamcommunity.com/actions/AddFriendAjax', {"form": {"accept_invite": 1, "sessionID": this._community.getSessionID(), "steamid": this.steamID.toString()}}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(self._community._checkHttpError(err, response, callback)) {
			return;
		}
		
		callback(null);
	});
};

CSteamUser.prototype.removeFriend = function(callback) {
	var self = this;
	this._community.request.post('https://steamcommunity.com/actions/RemoveFriendAjax', {"form": {"sessionID": this._community.getSessionID(), "steamid": this.steamID.toString()}}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(self._community._checkHttpError(err, response, callback)) {
			return;
		}
		
		callback(null);
	});
};

CSteamUser.prototype.blockCommunication = function(callback) {
	var self = this;
	this._community.request.post('https://steamcommunity.com/actions/BlockUserAjax', {"form": {"sessionID": this._community.getSessionID(), "steamid": this.steamID.toString()}}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(self._community._checkHttpError(err, response, callback)) {
			return;
		}
		
		callback(null);
	});
};

CSteamUser.prototype.unblockCommunication = function(callback) {
	var form = {"action": "unignore"};
	form['friends[' + this.steamID.toString() + ']'] = 1;
	
	this._community._myProfile('friends/blocked/', form, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		callback(null);
	});
};

CSteamUser.prototype.comment = function(message, callback) {
	this._community.request.post('https://steamcommunity.com/comment/Profile/post/' + this.steamID.toString() + '/-1/', {"form": {
		"comment": message,
		"count": 6,
		"sessionid": this._community.getSessionID()
	}}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode != 200) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		var json;
		try {
			json = JSON.parse(body);
		} catch(e) {
			callback(e);
			return;
		}
		
		if(json.success) {
			callback(null);
		} else if(json.error) {
			callback(new Error(json.error));
		} else {
			callback(new Error("Unknown error"));
		}
	});
};
