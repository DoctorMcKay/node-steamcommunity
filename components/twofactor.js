const StdLib = require('@doctormckay/stdlib');
const SteamTotp = require('steam-totp');

const SteamCommunity = require('../index.js');
const Helpers = require('./helpers.js');

const ETwoFactorTokenType = {
	None: 0,                  // No token-based two-factor authentication
	ValveMobileApp: 1,        // Tokens generated using Valve's special charset (5 digits, alphanumeric)
	ThirdParty: 2             // Tokens generated using literally everyone else's standard charset (6 digits, numeric). This is disabled on the backend.
};

/**
 * @param {function} [callback]
 * @return {Promise<object>}
 */
SteamCommunity.prototype.enableTwoFactor = function(callback) {
	return StdLib.Promises.callbackPromise(null, callback, false, async (resolve, reject) => {
		this._verifyMobileAccessToken();

		if (!this.mobileAccessToken) {
			return reject(new Error('No mobile access token available. Provide one by calling setMobileAppAccessToken()'));
		}

		let {jsonBody} = await this.httpRequest({
			method: 'POST',
			url: `https://api.steampowered.com/ITwoFactorService/AddAuthenticator/v1/?access_token=${this.mobileAccessToken}`,
			// TODO: Send this as protobuf to more closely mimic official app behavior
			form: {
				steamid: this.steamID.getSteamID64(),
				authenticator_time: Math.floor(Date.now() / 1000),
				authenticator_type: ETwoFactorTokenType.ValveMobileApp,
				device_identifier: SteamTotp.getDeviceID(this.steamID),
				sms_phone_id: '1'
			},
			source: 'steamcommunity'
		});


		if (!jsonBody.response) {
			return reject(new Error('Malformed response'));
		}

		if (jsonBody.response.status != 1) {
			let error = new Error(`Error ${jsonBody.response.status}`);
			error.eresult = jsonBody.response.status;
			return reject(error);
		}

		resolve(jsonBody.response);
	});
};

/**
 * @param {string} secret
 * @param {string} activationCode
 * @param {function} [callback]
 * @return Promise<void>
 */
SteamCommunity.prototype.finalizeTwoFactor = function(secret, activationCode, callback) {
	return StdLib.Promises.callbackPromise(null, callback, false, async (resolve, reject) => {
		this._verifyMobileAccessToken();

		if (!this.mobileAccessToken) {
			return reject(new Error('No mobile access token available. Provide one by calling setMobileAppAccessToken()'));
		}

		let attemptsLeft = 30;
		let diff = 0;

		await new Promise((resolve, reject) => {
			SteamTotp.getTimeOffset(function(err, offset, latency) {
				if (err) {
					return reject(err);
				}

				diff = offset;
				resolve();
			});
		});

		let finalize = async () => {
			let code = SteamTotp.generateAuthCode(secret, diff);

			let {jsonBody} = this.httpRequest({
				method: 'POST',
				url: `https://api.steampowered.com/ITwoFactorService/FinalizeAddAuthenticator/v1/?access_token=${this.mobileAccessToken}`,
				form: {
					steamid: this.steamID.getSteamID64(),
					authenticator_code: code,
					authenticator_time: Math.floor(Date.now() / 1000),
					activation_code: activationCode
				},
				source: 'steamcommunity'
			});

			if (!jsonBody.response) {
				return reject(new Error('Malformed response'));
			}

			jsonBody = jsonBody.response;

			if (jsonBody.server_time) {
				diff = jsonBody.server_time - Math.floor(Date.now() / 1000);
			}

			if (jsonBody.status == SteamCommunity.EResult.TwoFactorActivationCodeMismatch) {
				return reject(new Error('Invalid activation code'));
			} else if (jsonBody.want_more) {
				if (--attemptsLeft <= 0) {
					// We made more than 30 attempts, something must be wrong
					return reject(Helpers.eresultError(SteamCommunity.EResult.Fail));
				}
				diff += 30;

				finalize();
			} else if (!jsonBody.success) {
				return reject(new Error(`Error ${jsonBody.status}`));
			} else {
				resolve();
			}
		};

		finalize();
	});
};

/**
 * @param {string} revocationCode
 * @param {function} [callback]
 * @return Promise<void>
 */
SteamCommunity.prototype.disableTwoFactor = function(revocationCode, callback) {
	return StdLib.Promises.callbackPromise(null, callback, false, async (resolve, reject) => {
		this._verifyMobileAccessToken();

		if (!this.mobileAccessToken) {
			callback(new Error('No mobile access token available. Provide one by calling setMobileAppAccessToken()'));
			return;
		}

		let {jsonBody} = await this.httpRequest({
			method: 'POST',
			url: `https://api.steampowered.com/ITwoFactorService/RemoveAuthenticator/v1/?access_token=${this.mobileAccessToken}`,
			form: {
				steamid: this.steamID.getSteamID64(),
				revocation_code: revocationCode,
				steamguard_scheme: 1
			},
			source: 'steamcommunity'
		});

		if (!jsonBody.response) {
			return reject(new Error('Malformed response'));
		}

		if (!jsonBody.response.success) {
			return reject(new Error('Request failed'));
		}

		// success = true means it worked
		resolve();
	});
};
