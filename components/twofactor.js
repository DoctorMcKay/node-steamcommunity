var SteamCommunity = require('../index.js');

// TODO: Add authenticator

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
