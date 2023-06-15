var SteamTotp = require('steam-totp');
var SteamCommunity = require('../index.js');

var ETwoFactorTokenType = {
	None: 0,                  // No token-based two-factor authentication
	ValveMobileApp: 1,        // Tokens generated using Valve's special charset (5 digits, alphanumeric)
	ThirdParty: 2             // Tokens generated using literally everyone else's standard charset (6 digits, numeric). This is disabled.
};

SteamCommunity.prototype.enableTwoFactor = function(callback) {
	this._verifyMobileAccessToken();

	if (!this.mobileAccessToken) {
		callback(new Error('No mobile access token available. Provide one by calling setMobileAppAccessToken()'));
		return;
	}

	this.httpRequestPost({
		uri: "https://api.steampowered.com/ITwoFactorService/AddAuthenticator/v1/?access_token=" + this.mobileAccessToken,
		// TODO: Send this as protobuf to more closely mimic official app behavior
		form: {
			steamid: this.steamID.getSteamID64(),
			authenticator_time: Math.floor(Date.now() / 1000),
			authenticator_type: ETwoFactorTokenType.ValveMobileApp,
			device_identifier: SteamTotp.getDeviceID(this.steamID),
			sms_phone_id: '1'
		},
		json: true
	}, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (!body.response) {
			callback(new Error('Malformed response'));
			return;
		}

		if (body.response.status != 1) {
			var error = new Error('Error ' + body.response.status);
			error.eresult = body.response.status;
			callback(error);
			return;
		}

		callback(null, body.response);
	}, 'steamcommunity');
};

SteamCommunity.prototype.finalizeTwoFactor = function(secret, activationCode, callback) {
	this._verifyMobileAccessToken();

	if (!this.mobileAccessToken) {
		callback(new Error('No mobile access token available. Provide one by calling setMobileAppAccessToken()'));
		return;
	}

	let attemptsLeft = 30;
	let diff = 0;

	let finalize = () => {
		let code = SteamTotp.generateAuthCode(secret, diff);

		this.httpRequestPost({
			uri: 'https://api.steampowered.com/ITwoFactorService/FinalizeAddAuthenticator/v1/?access_token=' + this.mobileAccessToken,
			form: {
				steamid: this.steamID.getSteamID64(),
				authenticator_code: code,
				authenticator_time: Math.floor(Date.now() / 1000),
				activation_code: activationCode
			},
			json: true
		}, function(err, response, body) {
			if (err) {
				callback(err);
				return;
			}

			if (!body.response) {
				callback(new Error('Malformed response'));
				return;
			}

			body = body.response;

			if (body.server_time) {
				diff = body.server_time - Math.floor(Date.now() / 1000);
			}

			if (body.status == 89) {
				callback(new Error('Invalid activation code'));
			} else if(body.want_more) {
				attemptsLeft--;
				diff += 30;

				finalize();
			} else if(!body.success) {
				callback(new Error('Error ' + body.status));
			} else {
				callback(null);
			}
		}, 'steamcommunity');
	}

	SteamTotp.getTimeOffset(function(err, offset, latency) {
		if (err) {
			callback(err);
			return;
		}

		diff = offset;
		finalize();
	});
};

SteamCommunity.prototype.disableTwoFactor = function(revocationCode, callback) {
	this._verifyMobileAccessToken();

	if (!this.mobileAccessToken) {
		callback(new Error('No mobile access token available. Provide one by calling setMobileAppAccessToken()'));
		return;
	}

	this.httpRequestPost({
		uri: 'https://api.steampowered.com/ITwoFactorService/RemoveAuthenticator/v1/?access_token=' + this.mobileAccessToken,
		form: {
			steamid: this.steamID.getSteamID64(),
			revocation_code: revocationCode,
			steamguard_scheme: 1
		},
		json: true
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if (!body.response) {
			callback(new Error('Malformed response'));
			return;
		}

		if (!body.response.success) {
			callback(new Error('Request failed'));
			return;
		}

		// success = true means it worked
		callback(null);
	}, 'steamcommunity');
};
