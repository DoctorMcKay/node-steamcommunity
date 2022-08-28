const {Key: RSA, hex2b64} = require('node-bignumber');

const SteamCommunity = require('../index.js');

const Helpers = require('./helpers.js');
const Protos = require('../protobufs/generated/_load.js');

const EPlatformType = require('../resources/EPlatformType.js');

const API_HEADERS = {
	origin: 'https://steamcommunity.com',
	referer: 'https://steamcommunity.com/',
	accept: 'application/json, text/plain, */*'
};

SteamCommunity.prototype.loginNew = function(details, callback) {
	if (!details.accountName || !details.password) {
		callback(new Error('Missing either accountName or password to login; both are needed'));
		return;
	}

	// TODO figure out email steam guard cookies

	let exec = async () => {
		this.emit('debug', 'login: retrieving rsa public key');

		let rsaKeyResponse = await this._loginApiReq('GET', 'GetPasswordRSAPublicKey', {account_name: details.accountName});
		let {publickey_mod: mod, publickey_exp: exp, timestamp} = rsaKeyResponse;
		if (!mod || !exp) {
			throw new Error('Invalid RSA key received');
		}

		let key = new RSA();
		key.setPublic(mod, exp);

		this.emit('debug', 'login: beginning auth session with credentials');

		let startSessionResponse = await this._loginApiReq('POST', 'BeginAuthSessionViaCredentials', {
			device_friendly_name: SteamCommunity.USER_AGENT,
			account_name: details.accountName,
			encrypted_password: hex2b64(key.encrypt(details.password)), // dunno why valve is sending this as a base64 string and not bytes...
			encryption_timestamp: timestamp,
			remember_login: true,
			platform_type: EPlatformType.Win64,
			persistence: 1,
			website_id: 'Community'
		});

		let {client_id: clientId, request_id: reqId, interval, steamid} = startSessionResponse;

		this.emit('debug', `login: auth session client id ${clientId}, request id ${reqId.toString('hex')}, interval ${interval}, steamid ${steamid}`);

		for (let i = 0; i < startSessionResponse.allowed_confirmations.length; i++) {
			/** @var {Proto_CAuthentication_AllowedConfirmation} conf */
			let conf = startSessionResponse.allowed_confirmations[i];
			switch (conf.confirmation_type) {
				case 2:
					// Email code required
					if (details.authCode) {
						this.emit('debug', 'login: using steam guard email code');
						await this._loginApiReq('POST', 'UpdateAuthSessionWithSteamGuardCode', {
							client_id: clientId,
							steamid,
							code: details.authCode,
							code_type: 2
						});

						break;
					} else {
						let err = new Error('SteamGuard');
						err.emaildomain = conf.associated_message;
						throw err;
					}

				case 3:
					// TOTP code required
					if (details.twoFactorCode) {
						this.emit('debug', 'login: using steam guard totp code');
						await this._loginApiReq('POST', 'UpdateAuthSessionWithSteamGuardCode', {
							client_id: clientId,
							steamid,
							code: details.twoFactorCode,
							code_type: 3
						});

						break;
					} else {
						throw new Error('SteamGuardMobile');
					}
			}
		}

		// Start polling now, I guess. For now let's only poll for maximum 15 seconds.
		let pollStartTime = Date.now();
		while (Date.now() - pollStartTime < 15000) {
			this.emit('debug', `login: polling auth session status using client id ${clientId}`);
			let pollRes = await this._loginApiReq('POST', 'PollAuthSessionStatus', {
				client_id: clientId,
				request_id: reqId
			});

			let {new_client_id: newClientId, refresh_token: refreshToken, access_token: accessToken} = pollRes;
			// This behavior is a guess and is unconfirmed
			if (newClientId) {
				this.emit('debug', `login: got new client id ${newClientId}`);
				clientId = newClientId;
			}

			if (refreshToken) {
				// Access token doesn't seem to be used for anything that I can see right now
				let finalizeResponse = await new Promise((resolve, reject) => {
					this.emit('debug', 'login: finalizing login using refresh token');
					this.httpRequestPost({
						uri: 'https://login.steampowered.com/jwt/finalizelogin',
						form: {
							nonce: refreshToken,
							sessionid: this.getSessionID(), // the cookie won't actually get sent since this is a different domain, but that matches official behavior
							redir: 'https://steamcommunity.com/login/home/?goto='
						},
						headers: API_HEADERS,
						json: true
					}, (err, res, body) => {
						if (err) {
							return reject(err);
						}

						if (res.statusCode != 200) {
							return reject(new Error('HTTP error ' + res.statusCode));
						}

						if (!body.transfer_info) {
							return reject(new Error('Malformed login response'));
						}

						return resolve(body);
					});
				});

				let transfers = finalizeResponse.transfer_info.map(({url, params}) => new Promise((resolve, reject) => {
					this.emit('debug', `login: transferring login result using url ${url}`);
					this.httpRequestPost({
						uri: url,
						form: {
							steamID: steamid,
							...params
						}
					}, (err, res) => {
						if (err) {
							return reject(err);
						}

						if (!res.headers || !res.headers['set-cookie']) {
							return reject(new Error('No Set-Cookie header in result'));
						}

						let loginCookie = res.headers['set-cookie'].find(c => c.startsWith('steamLoginSecure='));
						if (!loginCookie) {
							return reject(new Error('No steamLoginSecure cookie in result'));
						}

						resolve(loginCookie.split(';')[0].trim());
					});
				}));

				let txResult = await Promise.any(transfers);
				this.setCookies([txResult]); // this should already be set, but just make sure. this also sets our steamID property
				return {cookies: [txResult], steamID: steamid};
			}

			// No refresh token received
			await new Promise(resolve => setTimeout(resolve, interval * 1000));
		}

		// Polling timed out
		throw new Error('Login attempt timed out');
	};

	exec().then(result => callback(null, result)).catch(err => callback(err));
}

SteamCommunity.prototype._loginApiReq = function(httpMethod, apiMethod, inputData) {
	let httpReqOptions = {
		method: httpMethod,
		uri: `https://api.steampowered.com/IAuthenticationService/${apiMethod}/v1`,
		headers: API_HEADERS,
		encoding: null
	};

	if (inputData) {
		// We don't *have* to send data as protobufs; service APIs accept data as input_json or just as standard get/post
		// arguments, and they'll send back json too if we do this. But the official Valve implementation uses protobufs,
		// and we want to match that as closely as possible.
		let proto = Protos[`CAuthentication_${apiMethod}_Request`];
		let inputBuffer = proto.encode(inputData).finish();
		httpReqOptions[httpMethod == 'GET' ? 'qs' : 'form'] = {input_protobuf_encoded: inputBuffer.toString('base64')};
	}

	return new Promise((resolve, reject) => {
		this.httpRequest(httpReqOptions, (err, res, body) => {
			if (err) {
				return reject(err);
			}

			if (res.headers['x-eresult'] && res.headers['x-eresult'] != 1) {
				return reject(
					res.headers['x-error_message']
						? new Error(res.headers['x-error_message'])
						: Helpers.eresultError(res.headers['x-eresult'])
				);
			}

			let proto = Protos[`CAuthentication_${apiMethod}_Response`];
			let decodedBody = proto.decode(body);
			let objNoDefaults = proto.toObject(decodedBody, {longs: String});
			let objWithDefaults = proto.toObject(decodedBody, {defaults: true, longs: String});

			return resolve(replaceDefaults(objNoDefaults, objWithDefaults));

			function replaceDefaults(noDefaults, withDefaults) {
				if (Array.isArray(withDefaults)) {
					return withDefaults.map((val, idx) => replaceDefaults(noDefaults[idx], val));
				}

				for (let i in withDefaults) {
					if (!withDefaults.hasOwnProperty(i)) {
						continue;
					}

					if (withDefaults[i] && typeof withDefaults[i] === 'object' && !Buffer.isBuffer(withDefaults[i])) {
						// Covers both object and array cases, both of which will work
						// Won't replace empty arrays, but that's desired behavior
						withDefaults[i] = replaceDefaults(noDefaults[i], withDefaults[i]);
					} else if (typeof noDefaults[i] === 'undefined' && isReplaceableDefaultValue(withDefaults[i])) {
						withDefaults[i] = null;
					}
				}

				return withDefaults;
			}

			function isReplaceableDefaultValue(val) {
				if (Buffer.isBuffer(val) && val.length == 0) {
					// empty buffer is replaceable
					return true;
				}

				if (Array.isArray(val)) {
					// empty array is not replaceable (empty repeated fields)
					return false;
				}

				if (val === '0') {
					// Zero as a string is replaceable (64-bit integer)
					return true;
				}

				// Anything falsy is true
				return !val;
			}
		});
	})
};
