const SteamTotp = require('steam-totp');

const SteamCommunity = require('../index.js');
const Helpers = require('./helpers.js');

const ETwoFactorTokenType = {
	None: 0,                  // No token-based two-factor authentication
	ValveMobileApp: 1,        // Tokens generated using Valve's special charset (5 digits, alphanumeric)
	ThirdParty: 2             // Tokens generated using literally everyone else's standard charset (6 digits, numeric). This is disabled.
};

SteamCommunity.prototype.enableTwoFactor = function(callback) {
	if (!this.oAuthToken) {
		return callback(new Error('enableTwoFactor can only be used when logged on via steamcommunity\'s `login` method without the `disableMobile` option.'));
	}

	this.httpRequestPost({
		uri: 'https://api.steampowered.com/ITwoFactorService/AddAuthenticator/v1/',
		form: {
			steamid: this.steamID.getSteamID64(),
			access_token: this.oAuthToken,
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

		let err2 = Helpers.eresultError(body.response.status);
		if (err2) {
			return callback(err2);
		}

		callback(null, body.response);
	}, 'steamcommunity');
};

SteamCommunity.prototype.finalizeTwoFactor = function(secret, activationCode, callback) {
	if (!this.oAuthToken) {
		return callback(new Error('finalizeTwoFactor can only be used when logged on via steamcommunity\'s `login` method without the `disableMobile` option.'));
	}

	let attemptsLeft = 30;
	let diff = 0;

	const finalize = () => {
		let code = SteamTotp.generateAuthCode(secret, diff);

		this.httpRequestPost({
			uri: 'https://api.steampowered.com/ITwoFactorService/FinalizeAddAuthenticator/v1/',
			form: {
				steamid: this.steamID.getSteamID64(),
				access_token: this.oAuthToken,
				authenticator_code: code,
				authenticator_time: Math.floor(Date.now() / 1000),
				activation_code: activationCode
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

			body = body.response;

			if (body.server_time) {
				diff = body.server_time - Math.floor(Date.now() / 1000);
			}

			if (body.status == SteamCommunity.EResult.TwoFactorActivationCodeMismatch) {
				callback(new Error('Invalid activation code'));
			} else if (body.want_more) {
				attemptsLeft--;
				diff += 30;

				finalize();
			} else if (!body.success) {
				callback(Helpers.eresultError(body.status));
			} else {
				callback(null);
			}
		}, 'steamcommunity');
	}

	SteamTotp.getTimeOffset((err, offset, latency) => {
		if (err) {
			callback(err);
			return;
		}

		diff = offset;
		finalize();
	});
};

SteamCommunity.prototype.disableTwoFactor = function(revocationCode, callback) {
	if (!this.oAuthToken) {
		return callback(new Error('disableTwoFactor can only be used when logged on via steamcommunity\'s `login` method without the `disableMobile` option.'));
	}

	this.httpRequestPost({
		uri: 'https://api.steampowered.com/ITwoFactorService/RemoveAuthenticator/v1/',
		form: {
			steamid: this.steamID.getSteamID64(),
			access_token: this.oAuthToken,
			revocation_code: revocationCode,
			steamguard_scheme: 1
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

		if (!body.response.success) {
			callback(new Error('Request failed'));
			return;
		}

		// success = true means it worked
		callback(null);
	}, 'steamcommunity');
};
