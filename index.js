var Request = require('request');
var RSA = require('node-bignumber').Key;
var hex2b64 = require('node-bignumber').hex2b64;
var SteamID = require('steamid');

const USER_AGENT = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36";

require('util').inherits(SteamCommunity, require('events').EventEmitter);

module.exports = SteamCommunity;

SteamCommunity.SteamID = SteamID;
SteamCommunity.ConfirmationType = {
	// 1 is unknown, possibly "Invalid"
	"Trade": 2,
	"MarketListing": 3
	// 4 is opt-out or other like account confirmation?
};

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
			"User-Agent": options.userAgent || USER_AGENT
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

	this.request = options.request || Request.defaults();
	this.request = this.request.defaults(defaults);

	// English
	this._setCookie(Request.cookie('Steam_Language=english'));

	// UTC
	this._setCookie(Request.cookie('timezoneOffset=0,0'));
}

SteamCommunity.prototype.login = function(details, callback) {
	if(details.steamguard) {
		var parts = details.steamguard.split('||');
		this._setCookie(Request.cookie('steamMachineAuth' + parts[0] + '=' + encodeURIComponent(parts[1])), true);
	}
	
	var self = this;

	// Delete the cache
	delete self._profileURL;

	// headers required to convince steam that we're logging in from a mobile device so that we can get the oAuth data
	var mobileHeaders = {
		"X-Requested-With": "com.valvesoftware.android.steam.community",
		"Referer": "https://steamcommunity.com/mobilelogin?oauth_client_id=DE45CD61&oauth_scope=read_profile%20write_profile%20read_client%20write_client",
		"User-Agent": "Mozilla/5.0 (Linux; U; Android 4.1.1; en-us; Google Nexus 4 - 4.1.1 - API 16 - 768x1280 Build/JRO03S) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30",
		"Accept": "text/javascript, text/html, application/xml, text/xml, */*"
	};

	this._setCookie(Request.cookie("mobileClientVersion=0 (2.1.3)"));
	this._setCookie(Request.cookie("mobileClient=android"));
	
	this.httpRequestPost("https://steamcommunity.com/login/getrsakey/", {
		"form": {"username": details.accountName},
		"headers": mobileHeaders,
		"json": true
	}, function(err, response, body) {
		// Remove the mobile cookies
		if (err) {
			deleteMobileCookies();
			callback(err);
			return;
		}

		if(!body.publickey_mod || !body.publickey_exp) {
			deleteMobileCookies();
			callback(new Error("Invalid RSA key received"));
			return;
		}
		
		var key = new RSA();
		key.setPublic(body.publickey_mod, body.publickey_exp);
		
		self.httpRequestPost({
			"uri": "https://steamcommunity.com/login/dologin/",
			"json": true,
			"form": {
				"captcha_text": details.captcha || "",
				"captchagid": self._captchaGid,
				"emailauth": details.authCode || "",
				"emailsteamid": "",
				"password": hex2b64(key.encrypt(details.password)),
				"remember_login": "true",
				"rsatimestamp": body.timestamp,
				"twofactorcode": details.twoFactorCode || "",
				"username": details.accountName,
				"oauth_client_id": "DE45CD61",
				"oauth_scope": "read_profile write_profile read_client write_client",
				"loginfriendlyname": "#login_emailauth_friendlyname_mobile",
				"donotcache": Date.now()
			},
			"headers": mobileHeaders
		}, function(err, response, body) {
			deleteMobileCookies();

			if (err) {
				callback(err);
				return;
			}

			var error;
			if(!body.success && body.emailauth_needed) {
				// Steam Guard (email)
				error = new Error("SteamGuard");
				error.emaildomain = body.emaildomain;
				
				callback(error);
			} else if(!body.success && body.requires_twofactor) {
				// Steam Guard (app)
				callback(new Error("SteamGuardMobile"));
			} else if(!body.success && body.captcha_needed && body.message.match(/Please verify your humanity/)) {
				error = new Error("CAPTCHA");
				error.captchaurl = "https://steamcommunity.com/login/rendercaptcha/?gid=" + body.captcha_gid;
				
				self._captchaGid = body.captcha_gid;
				
				callback(error);
			} else if(!body.success) {
				callback(new Error(body.message || "Unknown error"));
			} else if(!body.oauth) {
				callback(new Error("Malformed response"));
			} else {
				var sessionID = generateSessionID();
				var oAuth = JSON.parse( body.oauth );
				self._setCookie(Request.cookie('sessionid=' + sessionID));
				
				self.steamID = new SteamID(oAuth.steamid);
				self.oAuthToken = oAuth.oauth_token;

				var cookies = self._jar.getCookieString("https://steamcommunity.com").split(';').map(function(cookie) {
					return cookie.trim();
				});
				
				// Find the Steam Guard cookie
				var steamguard = null;
				for(var i = 0; i < cookies.length; i++) {
					var parts = cookies[i].split('=');
					if(parts[0] == 'steamMachineAuth' + self.steamID) {
						steamguard = self.steamID.toString() + '||' + decodeURIComponent(parts[1]);
						break;
					}
				}

				self.setCookies(cookies);
				
				callback(null, sessionID, cookies, steamguard, oAuth.oauth_token);
			}
		}, "steamcommunity");
	}, "steamcommunity");

	function deleteMobileCookies() {
		var cookie = Request.cookie('mobileClientVersion=');
		cookie.expires = new Date(0);
		self._setCookie(cookie);

		cookie = Request.cookie('mobileClient=');
		cookie.expires = new Date(0);
		self._setCookie(cookie);
	}
};

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

SteamCommunity.prototype._setCookie = function(cookie, secure) {
	var protocol = secure ? "https" : "http";
	cookie.secure = !!secure;

	this._jar.setCookie(cookie.clone(), protocol + "://steamcommunity.com");
	this._jar.setCookie(cookie.clone(), protocol + "://store.steampowered.com");
	this._jar.setCookie(cookie.clone(), protocol + "://help.steampowered.com");
};

SteamCommunity.prototype.setCookies = function(cookies) {
	var self = this;
	cookies.forEach(function(cookie) {
		var cookieName = cookie.match(/(.+)=/)[1];
		if(cookieName == 'steamLogin') {
			self.steamID = new SteamID(cookie.match(/=(\d+)/)[1]);
		}

		self._setCookie(Request.cookie(cookie), !!(cookieName.match(/^steamMachineAuth/) || cookieName.match(/Secure$/)));
	});
};

SteamCommunity.prototype.getSessionID = function() {
	var cookies = this._jar.getCookieString("http://steamcommunity.com").split(';');
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

	this.httpRequestPost("https://steamcommunity.com/parental/ajaxunlock", {
		"json": true,
		"form": {
			"pin": pin
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if (err) {
			callback(err);
			return;
		}
		
		if(!body || typeof body.success !== 'boolean') {
			callback("Invalid response");
			return;
		}
		
		if(!body.success) {
			callback("Incorrect PIN");
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
			}, 60000);

			completeRequest(match[1]);
		}, "steamcommunity");
	}

	function completeRequest(url) {
		var options = {
			"uri": "https://steamcommunity.com" + url + "/" + endpoint,
			"method": "GET"
		};

		if (form) {
			options.method = "POST";
			options.form = form;
		}

		self.httpRequest(options, callback, "steamcommunity");
	}
};

require('./components/http.js');
require('./components/chat.js');
require('./components/profile.js');
require('./components/market.js');
require('./components/groups.js');
require('./components/users.js');
require('./components/inventoryhistory.js');
require('./components/webapi.js');
require('./components/twofactor.js');
require('./components/confirmations.js');
require('./classes/CMarketItem.js');
require('./classes/CMarketSearchResult.js');
require('./classes/CSteamGroup.js');
require('./classes/CSteamUser.js');

/**
 @callback SteamCommunity~genericErrorCallback
 @param {Error|null} err - An Error object on failure, or null on success
 */