const {chrome} = require('@doctormckay/user-agents');
const Request = require('request');
const SteamID = require('steamid');

const Helpers = require('./components/helpers.js');

require('util').inherits(SteamCommunity, require('events').EventEmitter);

module.exports = SteamCommunity;

SteamCommunity.SteamID = SteamID;
SteamCommunity.ConfirmationType = require('./resources/EConfirmationType.js');
SteamCommunity.EResult = require('./resources/EResult.js');
SteamCommunity.ESharedFileType = require('./resources/ESharedFileType.js');
SteamCommunity.EFriendRelationship = require('./resources/EFriendRelationship.js');


function SteamCommunity(options) {
	options = options || {};

	this._jar = Request.jar();
	this._captchaGid = -1;
	this._httpRequestID = 0;
	this.chatState = SteamCommunity.ChatState.Offline;

	var defaults = {
		"jar": this._jar,
		"timeout": options.timeout || 50000,
		"gzip": true,
		"headers": {
			"User-Agent": options.userAgent || chrome()
		}
	};

	if (typeof options == "string") {
		options = {
			localAddress: options
		};
	}
	this._options = options;

	if (options.localAddress) {
		defaults.localAddress = options.localAddress;
	}

	this.request = options.request || Request.defaults({"forever": true}); // "forever" indicates that we want a keep-alive agent
	this.request = this.request.defaults(defaults);

	// English
	this._setCookie(Request.cookie('Steam_Language=english'));

	// UTC
	this._setCookie(Request.cookie('timezoneOffset=0,0'));
}

SteamCommunity.prototype.login = function(details, callback) {
	if (!details.accountName || !details.password) {
		throw new Error("Missing either accountName or password to login; both are needed");
	}

	// Delete the cache
	delete this._profileURL;

	// default disableMobile to true
	let logOnOptions = Object.assign({}, details);
	logOnOptions.disableMobile = details.disableMobile !== false;

	this._modernLogin(logOnOptions).then(({sessionID, cookies, steamguard, mobileAccessToken}) => {
		this.setCookies(cookies);

		if (mobileAccessToken) {
			this.setMobileAppAccessToken(mobileAccessToken);
		}

		callback(null, sessionID, cookies, steamguard, null);
	}).catch(err => callback(err));
};

/**
 * @deprecated
 * @param {string} steamguard
 * @param {string} token
 * @param {function} callback
 */
SteamCommunity.prototype.oAuthLogin = function(steamguard, token, callback) {
	steamguard = steamguard.split('||');
	var steamID = new SteamID(steamguard[0]);

	var self = this;
	this.httpRequestPost({
		"uri": "https://api.steampowered.com/IMobileAuthService/GetWGToken/v1/",
		"form": {
			"access_token": token
		},
		"json": true
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if(!body.response || !body.response.token || !body.response.token_secure) {
			callback(new Error("Malformed response"));
			return;
		}

		var cookies = [
			'steamLogin=' + encodeURIComponent(steamID.getSteamID64() + '||' + body.response.token),
			'steamLoginSecure=' + encodeURIComponent(steamID.getSteamID64() + '||' + body.response.token_secure),
			'steamMachineAuth' + steamID.getSteamID64() + '=' + steamguard[1],
			'sessionid=' + self.getSessionID()
		];

		self.setCookies(cookies);
		callback(null, self.getSessionID(), cookies);
	}, "steamcommunity");
};

/**
 * Get a token that can be used to log onto Steam using steam-user.
 * @param {function} callback
 */
SteamCommunity.prototype.getClientLogonToken = function(callback) {
	this.httpRequestGet({
		"uri": "https://steamcommunity.com/chat/clientjstoken",
		"json": true
	}, (err, res, body) => {
		if (err || res.statusCode != 200) {
			callback(err ? err : new Error('HTTP error ' + res.statusCode));
			return;
		}

		if (!body.logged_in) {
			let e = new Error('Not Logged In');
			callback(e);
			this._notifySessionExpired(e);
			return;
		}

		if (!body.steamid || !body.account_name || !body.token) {
			callback(new Error('Malformed response'));
			return;
		}

		callback(null, {
			"steamID": new SteamID(body.steamid),
			"accountName": body.account_name,
			"webLogonToken": body.token
		});
	});
};

SteamCommunity.prototype._setCookie = function(cookie, secure) {
	var protocol = secure ? "https" : "http";
	cookie.secure = !!secure;

	if (cookie.domain) {
		this._jar.setCookie(cookie.clone(), protocol + '://' + cookie.domain);
	} else {
		this._jar.setCookie(cookie.clone(), protocol + "://steamcommunity.com");
		this._jar.setCookie(cookie.clone(), protocol + "://store.steampowered.com");
		this._jar.setCookie(cookie.clone(), protocol + "://help.steampowered.com");
	}
};

SteamCommunity.prototype.setCookies = function(cookies) {
	cookies.forEach((cookie) => {
		var cookieName = cookie.trim().split('=')[0];
		if (cookieName == 'steamLogin' || cookieName == 'steamLoginSecure') {
			this.steamID = new SteamID(cookie.match(/steamLogin(Secure)?=(\d+)/)[2]);
		}

		this._setCookie(Request.cookie(cookie), !!(cookieName.match(/^steamMachineAuth/) || cookieName.match(/Secure$/)));
	});

	// The account we're logged in as might have changed, so verify that our mobile access token (if any) is still valid
	// for this account.
	this._verifyMobileAccessToken();
};

SteamCommunity.prototype.getSessionID = function(host = "http://steamcommunity.com") {
	var cookies = this._jar.getCookieString(host).split(';');
	for(var i = 0; i < cookies.length; i++) {
		var match = cookies[i].trim().match(/([^=]+)=(.+)/);
		if(match[1] == 'sessionid') {
			return decodeURIComponent(match[2]);
		}
	}

	var sessionID = generateSessionID();
	this._setCookie(Request.cookie('sessionid=' + sessionID));
	return sessionID;
};

function generateSessionID() {
	return require('crypto').randomBytes(12).toString('hex');
}

SteamCommunity.prototype.parentalUnlock = function(pin, callback) {
	var self = this;
	var sessionID = self.getSessionID();

	this.httpRequestPost("https://steamcommunity.com/parental/ajaxunlock", {
		"json": true,
		"form": {
			"pin": pin,
			"sessionid": sessionID
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if (!body || typeof body.success !== 'boolean') {
			callback("Invalid response");
			return;
		}

		if (!body.success) {
			switch (body.eresult) {
				case 15:
					callback("Incorrect PIN");
					break;

				case 25:
					callback("Too many invalid PIN attempts");
					break;

				default:
					callback("Error " + body.eresult);
			}

			return;
		}

		callback();
	}.bind(this), "steamcommunity");
};

SteamCommunity.prototype.getNotifications = function(callback) {
	var self = this;
	this.httpRequestGet({
		"uri": "https://steamcommunity.com/actions/GetNotificationCounts",
		"json": true
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if (!body || !body.notifications) {
			callback(new Error("Malformed response"));
			return;
		}

		var notifications = {
			"trades": body.notifications[1] || 0,
			"gameTurns": body.notifications[2] || 0,
			"moderatorMessages": body.notifications[3] || 0,
			"comments": body.notifications[4] || 0,
			"items": body.notifications[5] || 0,
			"invites": body.notifications[6] || 0,
			// dunno about 7
			"gifts": body.notifications[8] || 0,
			"chat": body.notifications[9] || 0,
			"helpRequestReplies": body.notifications[10] || 0,
			"accountAlerts": body.notifications[11] || 0
		};

		callback(null, notifications);
	}, "steamcommunity");
};

SteamCommunity.prototype.resetItemNotifications = function(callback) {
	var self = this;
	this.httpRequestGet("https://steamcommunity.com/my/inventory", function(err, response, body) {
		if(!callback) {
			return;
		}

		callback(err || null);
	}, "steamcommunity");
};

SteamCommunity.prototype.loggedIn = function(callback) {
	this.httpRequestGet({
		"uri": "https://steamcommunity.com/my",
		"followRedirect": false,
		"checkHttpError": false
	}, function(err, response, body) {
		if(err || (response.statusCode != 302 && response.statusCode != 403)) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}

		if(response.statusCode == 403) {
			callback(null, true, true);
			return;
		}

		callback(null, !!response.headers.location.match(/steamcommunity\.com(\/(id|profiles)\/[^\/]+)\/?/), false);
	}, "steamcommunity");
};

SteamCommunity.prototype.getTradeURL = function(callback) {
	this._myProfile("tradeoffers/privacy", null, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		var match = body.match(/https?:\/\/(www.)?steamcommunity.com\/tradeoffer\/new\/?\?partner=\d+(&|&amp;)token=([a-zA-Z0-9-_]+)/);
		if (match) {
			var token = match[3];
			callback(null, match[0], token);
		} else {
			callback(new Error("Malformed response"));
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.changeTradeURL = function(callback) {
	this._myProfile("tradeoffers/newtradeurl", {"sessionid": this.getSessionID()}, (err, response, body) => {
		if (!callback) {
			return;
		}

		if (!body || typeof body !== "string" || body.length < 3 || body.indexOf('"') !== 0) {
			callback(new Error("Malformed response"));
			return;
		}

		var newToken = body.replace(/"/g, ''); //"t1o2k3e4n" => t1o2k3e4n
		callback(null, "https://steamcommunity.com/tradeoffer/new/?partner=" + this.steamID.accountid + "&token=" + newToken, newToken);
	}, "steamcommunity");
};

/**
 * Clear your profile name (alias) history.
 * @param {function} callback
 */
SteamCommunity.prototype.clearPersonaNameHistory = function(callback) {
	this._myProfile("ajaxclearaliashistory/", {"sessionid": this.getSessionID()}, (err, res, body) => {
		if (!callback) {
			return;
		}

		if (err) {
			return callback(err);
		}

		if (res.statusCode != 200) {
			return callback(new Error("HTTP error " + res.statusCode));
		}

		try {
			body = JSON.parse(body);
			callback(Helpers.eresultError(body.success));
		} catch (ex) {
			return callback(new Error("Malformed response"));
		}
	});
};

SteamCommunity.prototype._myProfile = function(endpoint, form, callback) {
	var self = this;

	if (this._profileURL) {
		completeRequest(this._profileURL);
	} else {
		this.httpRequest("https://steamcommunity.com/my", {"followRedirect": false}, function(err, response, body) {
			if(err || response.statusCode != 302) {
				callback(err || "HTTP error " + response.statusCode);
				return;
			}

			var match = response.headers.location.match(/steamcommunity\.com(\/(id|profiles)\/[^\/]+)\/?/);
			if(!match) {
				callback(new Error("Can't get profile URL"));
				return;
			}

			self._profileURL = match[1];
			setTimeout(function () {
				delete self._profileURL; // delete the cache
			}, 60000).unref();

			completeRequest(match[1]);
		}, "steamcommunity");
	}

	function completeRequest(url) {
		var options = endpoint.endpoint ? endpoint : {};
		options.uri = "https://steamcommunity.com" + url + "/" + (endpoint.endpoint || endpoint);

		if (form) {
			options.method = "POST";
			options.form = form;
			options.followAllRedirects = true;
		} else if (!options.method) {
			options.method = "GET";
		}

		self.httpRequest(options, callback, "steamcommunity");
	}
};

/**
 * Returns an object whose keys are 64-bit SteamIDs, and whose values are values from the EFriendRelationship enum.
 * Therefore, you can deduce your friends or blocked list from this object.
 * @param {function} callback
 */
SteamCommunity.prototype.getFriendsList = function(callback) {
	this.httpRequestGet({
		"uri": "https://steamcommunity.com/textfilter/ajaxgetfriendslist",
		"json": true
	}, (err, res, body) => {
		if (err) {
			callback(err ? err : new Error('HTTP error ' + res.statusCode));
			return;
		}

		if (body.success != 1) {
			callback(Helpers.eresultError(body.success));
			return;
		}

		if (!body.friendslist || !body.friendslist.friends) {
			callback(new Error('Malformed response'));
			return;
		}

		const friends = {};
		body.friendslist.friends.forEach(friend => (friends[friend.ulfriendid] = friend.efriendrelationship));
		callback(null, friends);
	});
};

require('./components/login.js');
require('./components/http.js');
require('./components/chat.js');
require('./components/profile.js');
require('./components/market.js');
require('./components/groups.js');
require('./components/users.js');
require('./components/sharedfiles.js');
require('./components/inventoryhistory.js');
require('./components/webapi.js');
require('./components/twofactor.js');
require('./components/confirmations.js');
require('./components/help.js');
require('./classes/CMarketItem.js');
require('./classes/CMarketSearchResult.js');
require('./classes/CSteamGroup.js');
require('./classes/CSteamSharedFile.js');
require('./classes/CSteamUser.js');

/**
 @callback SteamCommunity~genericErrorCallback
 @param {Error|null} err - An Error object on failure, or null on success
 */
