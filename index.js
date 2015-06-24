var Request = require('request');
var RSA = require('node-bignumber').Key;
var hex2b64 = require('node-bignumber').hex2b64;
var SteamID = require('steamid');

require('util').inherits(SteamCommunity, require('events').EventEmitter);

module.exports = SteamCommunity;

SteamCommunity.SteamID = SteamID;

function SteamCommunity() {
	this._jar = Request.jar();
	this.request = Request.defaults({"jar": this._jar});
	this.chatState = SteamCommunity.ChatState.Offline;
}

SteamCommunity.prototype.login = function(details, callback) {
	if(details.steamguard) {
		var parts = details.steamguard.split('||');
		this._jar.setCookie(Request.cookie('steamMachineAuth' + parts[0] + '=' + encodeURIComponent(parts[1])), 'https://steamcommunity.com');
	}
	
	var self = this;
	this.request.post("https://steamcommunity.com/login/getrsakey/", {"form": {"username": details.accountName}}, function(err, response, body) {
		if(err) {
			callback(err);
			return;
		}
		
		var json;
		try {
			json = JSON.parse(body);
		} catch(e) {
			callback(e);
			return;
		}
		
		var key = new RSA();
		key.setPublic(json.publickey_mod, json.publickey_exp);
		
		var form = {
			"captcha_text": "",
			"captchagid": -1,
			"emailauth": details.authCode || "",
			"emailsteamid": "",
			"loginfriendlyname": "",
			"password": hex2b64(key.encrypt(details.password)),
			"remember_login": "true",
			"rsatimestamp": json.timestamp,
			"twofactorcode": "",
			"username": details.accountName
		};
		
		self.request.post({
			"uri": "https://steamcommunity.com/login/dologin/",
			"json": true,
			"form": form
		}, function(err, response, body) {
			if(err) {
				callback(err);
				return;
			}
			
			if(!body.success && body.emailauth_needed) {
				callback("Please provide the authorization code sent to your address at " + body.emaildomain);
			} else if(!body.success) {
				callback(body.message || "Unknown error");
			} else {
				var sessionID = generateSessionID();
				self._jar.setCookie(Request.cookie('sessionid=' + sessionID), 'http://steamcommunity.com');
				
				self.steamID = new SteamID(body.transfer_parameters.steamid);
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
				
				callback(null, sessionID, cookies, steamguard);
			}
		});
	});
};

SteamCommunity.prototype.setCookies = function(cookies) {
	var self = this;
	cookies.forEach(function(cookie) {
		var cookieName = cookie.match(/(.+)=/)[1];
		if(cookieName == 'steamLogin') {
			self.steamID = new SteamID(cookie.match(/=(\d+)/)[1]);
		}
		
		self._jar.setCookie(Request.cookie(cookie), (cookieName.match(/^steamMachineAuth/) || cookieName.match(/Secure$/) ? "https://" : "http://") + "steamcommunity.com");
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
	this._jar.setCookie(Request.cookie('sessionid=' + sessionID), "http://steamcommunity.com");
	return sessionID;
};

function generateSessionID() {
	return Math.floor(Math.random() * 1000000000);
};

SteamCommunity.prototype.getWebApiKey = function(domain, callback) {
	var self = this;
	this.request("https://steamcommunity.com/dev/apikey", function(err, response, body) {
		if(err || response.statusCode != 200) {
			return callback(err.message || "HTTP error " + response.statusCode);
		}
		
		if(body.match(/<h2>Access Denied<\/h2>/)) {
			return callback("Access Denied");
		}
		
		var match = body.match(/<p>Key: ([0-9A-F]+)<\/p>/);
		if(match) {
			// We already have an API key registered
			callback(null, match[1]);
		} else {
			// We need to register a new API key
			self.request.post('https://steamcommunity.com/dev/registerkey', {
				"form": {
					"domain": domain,
					"agreeToTerms": "agreed",
					"sessionid": self.getSessionID(),
					"Submit": "Register"
				}
			}, function(err, response, body) {
				if(err || response.statusCode >= 400) {
					return callback(err.message || "HTTP error " + response.statusCode);
				}
				
				self.getWebApiKey(domain, callback);
			});
		}
	});
};

SteamCommunity.prototype.parentalUnlock = function(pin, callback) {
	this.request.post("https://steamcommunity.com/parental/ajaxunlock", {
		"json": true,
		"form": {
			"pin": pin
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode != 200) {
			return callback(err.message || "HTTP error " + response.statusCode);
		}
		
		if(!body || typeof body.success !== 'boolean') {
			return callback("Invalid response");
		}
		
		if(!body.success) {
			return callback("Incorrect PIN");
		}
		
		callback();
	}.bind(this));
};

SteamCommunity.prototype.getNotifications = function(callback) {
	this.request.get("https://steamcommunity.com/actions/RefreshNotificationArea", function(err, response, body) {
		if(err || response.statusCode != 200) {
			return callback(err.message || "HTTP error " + response.statusCode);
		}
		
		var notifications = {
			"comments": 0,
			"items": 0,
			"invites": 0,
			"gifts": 0,
			"chat": 0,
			"trades": 0
		};
		
		var items = {
			"comments": /(\d+) new comments?/,
			"items": /(\d+) new items? in your inventory/,
			"invites": /(\d+) new invites?/,
			"gifts": /(\d+) new gifts?/,
			"chat": /(\d+) unread chat messages?/,
			"trades": /(\d+) new trade notifications?/
		};
		
		var match;
		for(var i in items) {
			if(match = body.match(items[i])) {
				notifications[i] = parseInt(match[1], 10);
			}
		}
		
		callback(null, notifications);
	});
};

SteamCommunity.prototype.resetItemNotifications = function(callback) {
	this.request.get("https://steamcommunity.com/my/inventory", function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode != 200) {
			callback(err.message || "HTTP error " + response.statusCode);
		} else {
			callback();
		}
	});
};

SteamCommunity.prototype._checkCommunityError = function(html, callback) {
	if(html.match(/<h1>Sorry!<\/h1>/)) {
		var match = html.match(/<h3>(.+)<\/h3>/);
		callback(match ? match[1] : "Unknown error occurred");
		return true;
	}
	
	return false;
};

SteamCommunity.prototype._myProfile = function(endpoint, form, callback) {
	var self = this;
	this.request("https://steamcommunity.com/my", {"followRedirect": false}, function(err, response, body) {
		if(err || response.statusCode != 302) {
			callback(err || "HTTP error " + response.statusCode);
			return;
		}
		
		var match = response.headers.location.match(/steamcommunity\.com(\/(id|profiles)\/[^\/]+)\/?/);
		if(!match) {
			callback("Can't get profile URL");
			return;
		}
		
		(form ? self.request.post : self.request)("https://steamcommunity.com" + match[1] + "/" + endpoint, form ? {"form": form} : {}, callback);
	});
};

require('./classes/CSteamGroup.js');
require('./classes/CSteamUser.js');
require('./components/chat.js');
