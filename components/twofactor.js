var SteamTotp = require('steam-totp');
var SteamCommunity = require('../index.js');

var ETwoFactorTokenType = {
	"None": 0,                  // No token-based two-factor authentication
	"ValveMobileApp": 1,        // Tokens generated using Valve's special charset (5 digits, alphanumeric)
	"ThirdParty": 2             // Tokens generated using literally everyone else's standard charset (6 digits, numeric). This is disabled.
};

function validateCookies(community) {
	// copy steamcommunity cookies to steampowered
	if (community._jar.getCookies("https://store.steampowered.com").length == 0) {
		var cookies = community._jar.getCookies("https://steamcommunity.com");
		if (cookies.length == 0)
			return false;

		for (var i in cookies) {
			var cookie = cookies[i];
			var c = String(cookie);
			c.domain = "store.steampowered.com";
			community._jar.setCookie(c, "https://store.steampowered.com");
		}
	}

	return true;
}

SteamCommunity.prototype.validatePhoneNumber = function (nr, callback) {
	var self = this;

	if (!validateCookies(this))
		return callback(new Error("invalid cookies"));

	self.request.get({
		"uri": "https://store.steampowered.com/phone/validate",
		"qs": {
			"phoneNumber": nr,
		},
		json: true,
	}, function(err, response, body) {
		if (err)
			return callback(err);

		if (self._checkHttpError(err, response, callback))
			return;

		callback(body.success ? null : new Error("invalid phone number"));
	});
}

SteamCommunity.prototype.addPhoneNumber = function(nr, callback) {
	var self = this;

	if (!validateCookies(this))
		return callback(new Error("Invalid cookies"));

	self.request.get({
		"url": "https://store.steampowered.com/phone/add_ajaxop",
		"qs": {
			"op": "get_phone_number",
			"input": nr,
			"sessionID": self.getSessionID(),
			"confirmed": 0,
		},
		"json": true
	}, function(err, response, body) {
		if (err)
			return callback(err);

		if (self._checkHttpError(err, response, callback))
			return;

		if (!body.success)
			return callback(new Error(body.errorText));

		callback(body.state == "get_sms_code" ? null : new Error(body.errorText));
	});
}

SteamCommunity.prototype.verifyPhoneNumber = function(code, callback) {
	var self = this;

	if (!validateCookies(this))
		return callback(new Error("Invalid cookies"));

	self.request.get({
		"uri": "https://store.steampowered.com//phone/add_ajaxop",
		"qs": {
			"op": "get_sms_code",
			"input": parseInt(code, 10),
			"sessionID": self.getSessionID(),
			"confirmed": 0,
		},
		"json": true
	}, function(err, response, body) {
		if (err)
			return callback(err);

		if (self._checkHttpError(err, response, callback))
			return;

		if (!body.success)
			return callback(body.errorText);

		callback(body.state == "done" ? null : body.errorText);
	});
}

SteamCommunity.prototype.enableTwoFactor = function(callback) {
	var self = this;

	this.getWebApiOauthToken(function(err, token) {
		if(err) {
			callback(err);
			return;
		}

		self.request.post({
			"uri": "https://api.steampowered.com/ITwoFactorService/AddAuthenticator/v1/",
			"form": {
				"steamid": self.steamID.getSteamID64(),
				"access_token": token,
				"authenticator_time": Math.floor(Date.now() / 1000),
				"authenticator_type": ETwoFactorTokenType.ValveMobileApp,
				"device_identifier": SteamTotp.getDeviceID(self.steamID),
				"sms_phone_id": "1"
			},
			"json": true
		}, function(err, response, body) {
			if(self._checkHttpError(err, response, callback)) {
				return;
			}

			if(!body.response) {
				callback(new Error("Malformed response"));
				return;
			}

			if(body.response.status != 1) {
				var error = new Error("Error " + body.response.status);
				error.eresult = body.response.status;
				callback(error);
				return;
			}

			callback(null, body.response);
		});
	});
};

SteamCommunity.prototype.finalizeTwoFactor = function(secret, activationCode, callback) {
	var attemptsLeft = 30;
	var diff = 0;

	var self = this;
	this.getWebApiOauthToken(function(err, token) {
		if(err) {
			callback(err);
			return;
		}

		finalize(token);
	});

	function finalize(token) {
		var code = SteamTotp.generateAuthCode(secret, diff);

		self.request.post({
			"uri": "https://api.steampowered.com/ITwoFactorService/FinalizeAddAuthenticator/v1/",
			"form": {
				"steamid": self.steamID.getSteamID64(),
				"access_token": token,
				"authenticator_code": code,
				"authenticator_time": Math.floor(Date.now() / 1000),
				"activation_code": activationCode
			},
			"json": true
		}, function(err, response, body) {
			if(self._checkHttpError(err, response, callback)) {
				return;
			}

			if(!body.response) {
				callback(new Error("Malformed response"));
				return;
			}

			body = body.response;

			if(body.server_time) {
				diff = body.server_time - Math.floor(Date.now() / 1000);
			}

			if(body.status == 89) {
				callback(new Error("Invalid activation code"));
			} else if(body.want_more) {
				attemptsLeft--;
				diff += 30;

				finalize(token);
			} else if(!body.success) {
				callback(new Error("Error " + body.status));
			} else {
				callback(null);
			}
		});
	}
};

SteamCommunity.prototype.disableTwoFactor = function(revocationCode, callback) {
	var self = this;

	this.getWebApiOauthToken(function(err, token) {
		if(err) {
			callback(err);
			return;
		}

		self.request.post({
			"uri": "https://api.steampowered.com/ITwoFactorService/RemoveAuthenticator/v1/",
			"form": {
				"steamid": self.steamID.getSteamID64(),
				"access_token": token,
				"revocation_code": revocationCode,
				"steamguard_scheme": 1
			},
			"json": true
		}, function(err, response, body) {
			if(self._checkHttpError(err, response, callback)) {
				return;
			}

			if(!body.response) {
				callback(new Error("Malformed response"));
				return;
			}

			if(!body.response.success) {
				callback(new Error("Request failed"));
				return;
			}

			if(body.response.status == 1) {
				callback(null);
				return;
			}

			var error = new Error("Cannot remove authenticator (" + body.response.status + ")");
			error.eresult = body.response.status;
			callback(error);
		});
	});
};
