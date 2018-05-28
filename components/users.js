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

/**
 * Get the background URL of user's profile.
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {function} callback
 */
SteamCommunity.prototype.getProfileBackground = function(userID, callback) {
	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}
	
	var self = this;
	this.httpRequest("http://steamcommunity.com/profiles/" + userID.getSteamID64(), function (err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		var $ = Cheerio.load(body);
		
		if ($('body').hasClass('has_profile_background')) {
			var backgroundUrl = $('div.profile_background_image_content').css('background-image');
			var matcher = backgroundUrl.match(/\(([^)]+)\)/);

			if (matcher.length != 2 || !matcher[1].length) {
				callback(new Error("Unknown error occurred"));
			} else {
				callback(null, matcher[1]);
			}
		} else {
			callback("User does not have a background image");
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.getUserInventoryContexts = function(userID, callback) {
	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	if (typeof userID === 'function') {
		callback = userID;
		userID = this.steamID;
	}

	if (!userID) {
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
		if (!match) {
			var errorMessage = "Malformed response";

			if(body.match(/0 items in their inventory\./)){
				callback(null, {});
				return;
			}else if(body.match(/inventory is currently private\./)){
				errorMessage = "Private inventory";
			}else if(body.match(/profile\_private\_info/)){
				errorMessage = "Private profile";
			}

			callback(new Error(errorMessage));
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

/**
 * Get the contents of a user's inventory context.
 * @deprecated Use getUserInventoryContents instead
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param {function} callback
 */
SteamCommunity.prototype.getUserInventory = function(userID, appID, contextID, tradableOnly, callback) {
	var self = this;

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var endpoint = "/profiles/" + userID.getSteamID64();
	get([], []);

	function get(inventory, currency, start) {
		self.httpRequest({
			"uri": "https://steamcommunity.com" + endpoint + "/inventory/json/" + appID + "/" + contextID,
			"headers": {
				"Referer": "https://steamcommunity.com" + endpoint + "/inventory"
			},
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

			if (!body || !body.success || !body.rgInventory || !body.rgDescriptions || !body.rgCurrency) {
				if (body) {
					callback(new Error(body.Error || "Malformed response"));
				} else {
					callback(new Error("Malformed response"));
				}

				return;
			}

			var i;
			for (i in body.rgInventory) {
				if (!body.rgInventory.hasOwnProperty(i)) {
					continue;
				}

				inventory.push(new CEconItem(body.rgInventory[i], body.rgDescriptions, contextID));
			}

			for (i in body.rgCurrency) {
				if (!body.rgCurrency.hasOwnProperty(i)) {
					continue;
				}

				currency.push(new CEconItem(body.rgInventory[i], body.rgDescriptions, contextID));
			}

			if (body.more) {
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

/**
 * Get the contents of a user's inventory context.
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param {string} [language] - The language of item descriptions to return. Omit for default (which may either be English or your account's chosen language)
 * @param {function} callback
 */
SteamCommunity.prototype.getUserInventoryContents = function(userID, appID, contextID, tradableOnly, language, callback) {
	var self = this;

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	if (typeof language === 'function') {
		callback = language;
		language = "english";
	}

	var pos = 1;
	get([], []);

	function get(inventory, currency, start) {
		self.httpRequest({
			"uri": "https://steamcommunity.com/inventory/" + userID.getSteamID64() + "/" + appID + "/" + contextID,
			"headers": {
				"Referer": "https://steamcommunity.com/profiles/" + userID.getSteamID64() + "/inventory"
			},
			"qs": {
				"l": language, // Default language
				"count": 5000, // Max items per 'page'
				"start_assetid": start
			},
			"json": true
		}, function(err, response, body) {
			if (err) {
				if (err.message == "HTTP error 403" && body === null) {
					// 403 with a body of "null" means the inventory/profile is private.
					if (self.steamID && userID.getSteamID64() == self.steamID.getSteamID64()) {
						// We can never get private profile error for our own inventory!
						self._notifySessionExpired(err);
					}
					
					callback(new Error("This profile is private."));
					return;
				}

				if (err.message == "HTTP error 500" && body && body.error) {
					err = new Error(body.error);

					var match = body.error.match(/^(.+) \((\d+)\)$/);
					if (match) {
						err.message = match[1];
						err.eresult = match[2];
						callback(err);
						return;
					}
				}

				callback(err);
				return;
			}

			if (body && body.success && body.total_inventory_count === 0) {
				// Empty inventory
				callback(null, [], [], 0);
				return;
			}

			if (!body || !body.success || !body.assets || !body.descriptions) {
				if (body) {
					// Dunno if the error/Error property even exists on this new endpoint
					callback(new Error(body.error || body.Error || "Malformed response"));
				} else {
					callback(new Error("Malformed response"));
				}
				
				return;
			}

			for (var i = 0; i < body.assets.length; i++) {
				var description = getDescription(body.descriptions, body.assets[i].classid, body.assets[i].instanceid);
				
				if (!tradableOnly || (description && description.tradable)) {
					body.assets[i].pos = pos++;
					(body.assets[i].currencyid ? currency : inventory).push(new CEconItem(body.assets[i], description, contextID));
				}
			}

			if (body.more_items) {
				get(inventory, currency, body.last_assetid);
			} else {
				callback(null, inventory, currency, body.total_inventory_count);
			}
		}, "steamcommunity");
	}

	// A bit of optimization; objects are hash tables so it's more efficient to look up by key than to iterate an array
	var quickDescriptionLookup = {};

	function getDescription(descriptions, classID, instanceID) {
		var key = classID + '_' + (instanceID || '0'); // instanceID can be undefined, in which case it's 0.

		if (quickDescriptionLookup[key]) {
			return quickDescriptionLookup[key];
		}

		for (var i = 0; i < descriptions.length; i++) {
			quickDescriptionLookup[descriptions[i].classid + '_' + (descriptions[i].instanceid || '0')] = descriptions[i];
		}
		
		return quickDescriptionLookup[key];
	}
};
