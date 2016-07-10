var SteamCommunity = require('../index.js');
var SteamID = require('steamid');
var CEconItem = require('../classes/CEconItem.js');
var Helpers = require('./helpers.js');

SteamCommunity.prototype.addFriend = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/AddFriendAjax",
		"form": {
			"accept_invite": 0,
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if(body.success) {
			callback(null);
		} else {
			callback(new Error("Unknown error"));
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.acceptFriendRequest = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/AddFriendAjax",
		"form": {
			"accept_invite": 1,
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		callback(err || null);
	}, "steamcommunity");
};

SteamCommunity.prototype.removeFriend = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/RemoveFriendAjax",
		"form": {
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		callback(err || null);
	}, "steamcommunity");
};

SteamCommunity.prototype.blockCommunication = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/BlockUserAjax",
		"form": {
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		callback(err || null);
	}, "steamcommunity");
};

SteamCommunity.prototype.unblockCommunication = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var form = {"action": "unignore"};
	form['friends[' + userID.toString() + ']'] = 1;

	this._myProfile('friends/blocked/', form, function(err, response, body) {
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

SteamCommunity.prototype.postUserComment = function(userID, message, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/comment/Profile/post/" + userID.toString() + "/-1",
		"form": {
			"comment": message,
			"count": 6,
			"sessionid": this.getSessionID()
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if(body.success) {
			callback(null);
		} else if(body.error) {
			callback(new Error(body.error));
		} else {
			callback(new Error("Unknown error"));
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.inviteUserToGroup = function(userID, groupID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/GroupInvite",
		"form": {
			"group": groupID.toString(),
			"invitee": userID.toString(),
			"json": 1,
			"sessionID": this.getSessionID(),
			"type": "groupInvite"
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if(body.results == 'OK') {
			callback(null);
		} else if(body.results) {
			callback(new Error(body.results));
		} else {
			callback(new Error("Unknown error"));
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.getUserAliases = function(userID, callback) {
	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	this.httpRequestGet({
		"uri": "https://steamcommunity.com/profiles/" + userID.getSteamID64() + "/ajaxaliases",
		"json": true
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if (typeof body !== 'object') {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, body.map(function(entry) {
			entry.timechanged = Helpers.decodeSteamTime(entry.timechanged);
			return entry;
		}));
	}, "steamcommunity");
};

SteamCommunity.prototype.getUserInventoryContexts = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	if(typeof userID === 'function') {
		callback = userID;
		userID = this.steamID;
	}

	if(!userID) {
		callback(new Error("No SteamID specified and not logged in"));
		return;
	}

	var self = this;
	this.httpRequest("https://steamcommunity.com/profiles/" + userID.getSteamID64() + "/inventory/", function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		var match = body.match(/var g_rgAppContextData = ([^\n]+);\r?\n/);
		if(!match) {
			callback(new Error("Malformed response"));
			return;
		}

		var data;
		try {
			data = JSON.parse(match[1]);
		} catch(e) {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, data);
	}, "steamcommunity");
};

SteamCommunity.prototype.getUserInventory = function(userID, appID, contextID, tradableOnly, callback) {
	var self = this;

	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var endpoint = "/profiles/" + userID.getSteamID64();
	get([], []);

	function get(inventory, currency, start) {
		self.httpRequest({
			"uri": "https://steamcommunity.com" + endpoint + "/inventory/json/" + appID + "/" + contextID,
			"qs": {
				"start": start,
				"trading": tradableOnly ? 1 : undefined
			},
			"json": true
		}, function(err, response, body) {
			if (err) {
				callback(err);
				return;
			}

			if(!body || !body.success || !body.rgInventory || !body.rgDescriptions || !body.rgCurrency) {
				if(body) {
					callback(new Error(body.Error || "Malformed response"));
				} else {
					callback(new Error("Malformed response"));
				}
				
				return;
			}

			var i;
			for(i in body.rgInventory) {
				if(!body.rgInventory.hasOwnProperty(i)) {
					continue;
				}

				inventory.push(new CEconItem(body.rgInventory[i], body.rgDescriptions, contextID));
			}

			for(i in body.rgCurrency) {
				if(!body.rgCurrency.hasOwnProperty(i)) {
					continue;
				}

				currency.push(new CEconItem(body.rgInventory[i], body.rgDescriptions, contextID));
			}

			if(body.more) {
				var match = response.request.uri.href.match(/\/(profiles|id)\/([^\/]+)\//);
				if(match) {
					endpoint = "/" + match[1] + "/" + match[2];
				}

				get(inventory, currency, body.more_start);
			} else {
				callback(null, inventory, currency);
			}
		}, "steamcommunity");
	}
};
