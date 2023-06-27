const {EventEmitter} = require('events');
const {hex2b64} = require('node-bignumber');
const Request = require('request');
const {Key: RSA} = require('node-bignumber');
const StdLib = require('@doctormckay/stdlib');
const SteamID = require('steamid');
const {CookieJar} = require('tough-cookie');
const Util = require('util');

const Helpers = require('./components/helpers.js');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36';

Util.inherits(SteamCommunity, EventEmitter);

module.exports = SteamCommunity;

SteamCommunity.SteamID = SteamID;
SteamCommunity.EConfirmationType = require('./resources/EConfirmationType.js');
SteamCommunity.EResult = require('./resources/EResult.js');
SteamCommunity.ESharedFileType = require('./resources/ESharedFileType.js');
SteamCommunity.EFriendRelationship = require('./resources/EFriendRelationship.js');


function SteamCommunity(options) {
	options = options || {};

	this._jar = new CookieJar();
	this._captchaGid = -1;
	this._httpRequestID = 0;

	let defaults = {
		jar: this._jar,
		timeout: options.timeout || 50000,
		gzip: true,
		headers: {
			'User-Agent': options.userAgent || USER_AGENT
		}
	};

	this._options = options;

	if (options.localAddress) {
		defaults.localAddress = options.localAddress;
	}

	this.request = options.request || Request.defaults({forever: true}); // "forever" indicates that we want a keep-alive agent
	this.request = this.request.defaults(defaults);

	// English
	this._setCookie('Steam_Language=english');

	// UTC
	this._setCookie('timezoneOffset=0,0');
}

SteamCommunity.prototype.login = function(details, callback) {
	if (!details.accountName || !details.password) {
		throw new Error('Missing either accountName or password to login; both are needed');
	}

	let callbackArgs = ['sessionID', 'cookies', 'steamguard', 'oauthToken'];
	return StdLib.Promises.callbackPromise(callbackArgs, callback, false, (resolve, reject) => {
		if (details.steamguard) {
			let parts = details.steamguard.split('||');
			this._setCookie(`steamMachineAuth${parts[0]}=${encodeURIComponent(parts[1])}`, true);
		}

		let disableMobile = typeof details.disableMobile == 'undefined' ? true : details.disableMobile;

		// Delete the cache
		delete this._profileURL;

		// headers required to convince steam that we're logging in from a mobile device so that we can get the oAuth data
		let mobileHeaders = {};
		if (!disableMobile) {
			mobileHeaders = {
				'X-Requested-With': 'com.valvesoftware.android.steam.community',
				Referer: 'https://steamcommunity.com/mobilelogin?oauth_client_id=DE45CD61&oauth_scope=read_profile%20write_profile%20read_client%20write_client',
				'User-Agent': this._options.mobileUserAgent || details.mobileUserAgent || 'Mozilla/5.0 (Linux; U; Android 4.1.1; en-us; Google Nexus 4 - 4.1.1 - API 16 - 768x1280 Build/JRO03S) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
				Accept: 'text/javascript, text/html, application/xml, text/xml, */*'
			};

			this._setCookie('mobileClientVersion=0 (2.1.3)');
			this._setCookie('mobileClient=android');
		} else {
			mobileHeaders = {Referer: 'https://steamcommunity.com/login'};
		}

		const deleteMobileCookies = () => {
			this._setCookie('mobileClientVersion=; max-age=0');
			this._setCookie('mobileClient=; max-age=0');
		};

		this.httpRequestPost('https://steamcommunity.com/login/getrsakey/', {
			form: {username: details.accountName},
			headers: mobileHeaders,
			json: true
		}, (err, response, body) => {
			// Remove the mobile cookies
			if (err) {
				deleteMobileCookies();
				return reject(err);
			}

			if (!body.publickey_mod || !body.publickey_exp) {
				deleteMobileCookies();
				return reject(new Error('Invalid RSA key received'));
			}

			let key = new RSA();
			key.setPublic(body.publickey_mod, body.publickey_exp);

			let formObj = {
				captcha_text: details.captcha || '',
				captchagid: this._captchaGid,
				emailauth: details.authCode || '',
				emailsteamid: '',
				password: hex2b64(key.encrypt(details.password)),
				remember_login: 'true',
				rsatimestamp: body.timestamp,
				twofactorcode: details.twoFactorCode || '',
				username: details.accountName,
				loginfriendlyname: '',
				donotcache: Date.now()
			};

			if (!disableMobile) {
				formObj.oauth_client_id = 'DE45CD61';
				formObj.oauth_scope = 'read_profile write_profile read_client write_client';
				formObj.loginfriendlyname = '#login_emailauth_friendlyname_mobile';
			}

			this.httpRequestPost({
				uri: 'https://steamcommunity.com/login/dologin/',
				json: true,
				form: formObj,
				headers: mobileHeaders
			}, (err, response, body) => {
				deleteMobileCookies();

				if (err) {
					return reject(err);
				}

				let error;
				if (!body.success && body.emailauth_needed) {
					// Steam Guard (email)
					error = new Error('SteamGuard');
					error.emaildomain = body.emaildomain;

					return reject(error);
				} else if (!body.success && body.requires_twofactor) {
					// Steam Guard (app)
					return reject(new Error('SteamGuardMobile'));
				} else if (!body.success && body.captcha_needed && body.message.match(/Please verify your humanity/)) {
					error = new Error('CAPTCHA');
					error.captchaurl = 'https://steamcommunity.com/login/rendercaptcha/?gid=' + body.captcha_gid;

					this._captchaGid = body.captcha_gid;

				callback(error);
			} else if (!body.success) {
				callback(new Error(body.message || 'Unknown error'));
			} else {
				var sessionID = generateSessionID();
				var oAuth = {};
				self._setCookie(Request.cookie('sessionid=' + sessionID));

					let cookies = this._jar.getCookieStringSync('https://steamcommunity.com').split(';').map(cookie => cookie.trim());

					if (!disableMobile && body.oauth) {
						oAuth = JSON.parse(body.oauth);
						this.steamID = new SteamID(oAuth.steamid);
						this.oAuthToken = oAuth.oauth_token;
					} else {
						for (let i = 0; i < cookies.length; i++) {
							let parts = cookies[i].split('=');
							if (parts[0] == 'steamLogin') {
								this.steamID = new SteamID(decodeURIComponent(parts[1]).split('||')[0]);
								break;
							}
						}

						this.oAuthToken = null;
					}

					// Find the Steam Guard cookie
					let steamguard = null;
					for (let i = 0; i < cookies.length; i++) {
						let parts = cookies[i].split('=');
						if (parts[0] == 'steamMachineAuth' + this.steamID) {
							steamguard = this.steamID.toString() + '||' + decodeURIComponent(parts[1]);
							break;
						}
					}

					// Call setCookies to propagate our cookies to the other domains
					this.setCookies(cookies);

					return resolve({
						sessionID,
						cookies,
						steamguard,
						oauthToken: disableMobile ? null : oAuth.oauth_token
					});
				}
			}, 'steamcommunity');
		}, 'steamcommunity');
	});
};

/**
 * Get a token that can be used to log onto Steam using steam-user.
 * @param {function} callback
 */
SteamCommunity.prototype.getClientLogonToken = function(callback) {
	this.httpRequestGet({
		uri: 'https://steamcommunity.com/chat/clientjstoken',
		json: true
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
			steamID: new SteamID(body.steamid),
			accountName: body.account_name,
			webLogonToken: body.token
		});
	});
};

/**
 * Sets a single cookie in our cookie jar.
 * @param {string} cookie
 * @param {boolean} [secure=false]
 * @private
 */
SteamCommunity.prototype._setCookie = function(cookie, secure) {
	let protocol = secure ? 'https' : 'http';

	this._jar.setCookieSync(cookie, `${protocol}://steamcommunity.com`);
	this._jar.setCookieSync(cookie, `${protocol}://store.steampowered.com`);
	this._jar.setCookieSync(cookie, `${protocol}://help.steampowered.com`);
};

/**
 * Set one or more cookies in this SteamCommunity's cookie jar.
 * @param {string|string[]} cookies
 */
SteamCommunity.prototype.setCookies = function(cookies) {
	if (!Array.isArray(cookies)) {
		cookies = [cookies];
	}

	cookies.forEach((cookie) => {
		let cookieName = cookie.match(/(.+)=/)[1];
		if (cookieName == 'steamLogin' || cookieName == 'steamLoginSecure') {
			this.steamID = new SteamID(cookie.match(/=(\d+)/)[1]);
		}

		this._setCookie(cookie, !!(cookieName.match(/^steamMachineAuth/) || cookieName.match(/Secure$/)));
	});

	// The account we're logged in as might have changed, so verify that our mobile access token (if any) is still valid
	// for this account.
	this._verifyMobileAccessToken();
};

SteamCommunity.prototype.getSessionID = function() {
	let sessionIdCookie = this._jar.getCookiesSync('http://steamcommunity.com').find(cookie => cookie.key == 'sessionid');
	if (sessionIdCookie) {
		return sessionIdCookie.value;
	}

	// Generate a new session id
	let sessionID = require('crypto').randomBytes(12).toString('hex');
	this._setCookie(`sessionid=${sessionID}`);
	return sessionID;
};

SteamCommunity.prototype.parentalUnlock = function(pin, callback) {
	let sessionID = this.getSessionID();

	this.httpRequestPost('https://steamcommunity.com/parental/ajaxunlock', {
		json: true,
		form: {
			pin: pin,
			sessionid: sessionID
		}
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if (!body || typeof body.success !== 'boolean') {
			callback('Invalid response');
			return;
		}

		if (!body.success) {
			switch (body.eresult) {
				case SteamCommunity.EResult.AccessDenied:
					callback('Incorrect PIN');
					break;

				case SteamCommunity.EResult.LimitExceeded:
					callback('Too many invalid PIN attempts');
					break;

				default:
					callback('Error ' + body.eresult);
			}

			return;
		}

		callback();
	}, 'steamcommunity');
};

SteamCommunity.prototype.getNotifications = function(callback) {
	this.httpRequestGet({
		uri: 'https://steamcommunity.com/actions/GetNotificationCounts',
		json: true
	}, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (!body || !body.notifications) {
			callback(new Error('Malformed response'));
			return;
		}

		let notifications = {
			trades: body.notifications[1] || 0,
			gameTurns: body.notifications[2] || 0,
			moderatorMessages: body.notifications[3] || 0,
			comments: body.notifications[4] || 0,
			items: body.notifications[5] || 0,
			invites: body.notifications[6] || 0,
			// dunno about 7
			gifts: body.notifications[8] || 0,
			chat: body.notifications[9] || 0,
			helpRequestReplies: body.notifications[10] || 0,
			accountAlerts: body.notifications[11] || 0
		};

		callback(null, notifications);
	}, 'steamcommunity');
};

SteamCommunity.prototype.resetItemNotifications = function(callback) {
	this.httpRequestGet('https://steamcommunity.com/my/inventory', (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.loggedIn = function(callback) {
	this.httpRequestGet({
		uri: 'https://steamcommunity.com/my',
		followRedirect: false,
		checkHttpError: false
	}, (err, response, body) => {
		if (err || (response.statusCode != 302 && response.statusCode != 403)) {
			callback(err || new Error('HTTP error ' + response.statusCode));
			return;
		}

		if (response.statusCode == 403) {
			callback(null, true, true);
			return;
		}

		callback(null, !!response.headers.location.match(/steamcommunity\.com(\/(id|profiles)\/[^/]+)\/?/), false);
	}, 'steamcommunity');
};

SteamCommunity.prototype.getTradeURL = function(callback) {
	this._myProfile('tradeoffers/privacy', null, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		let match = body.match(/https?:\/\/(www.)?steamcommunity.com\/tradeoffer\/new\/?\?partner=\d+(&|&amp;)token=([a-zA-Z0-9-_]+)/);
		if (match) {
			let token = match[3];
			callback(null, match[0], token);
		} else {
			callback(new Error('Malformed response'));
		}
	}, 'steamcommunity');
};

SteamCommunity.prototype.changeTradeURL = function(callback) {
	this._myProfile('tradeoffers/newtradeurl', {sessionid: this.getSessionID()}, (err, response, body) => {
		if (!callback) {
			return;
		}

		if (!body || typeof body !== 'string' || body.length < 3 || body.indexOf('"') !== 0) {
			callback(new Error('Malformed response'));
			return;
		}

		let newToken = body.replace(/"/g, ''); //"t1o2k3e4n" => t1o2k3e4n
		callback(null, 'https://steamcommunity.com/tradeoffer/new/?partner=' + this.steamID.accountid + '&token=' + newToken, newToken);
	}, 'steamcommunity');
};

/**
 * Clear your profile name (alias) history.
 * @param {function} callback
 */
SteamCommunity.prototype.clearPersonaNameHistory = function(callback) {
	this._myProfile('ajaxclearaliashistory/', {sessionid: this.getSessionID()}, (err, res, body) => {
		if (!callback) {
			return;
		}

		if (err) {
			return callback(err);
		}

		if (res.statusCode != 200) {
			return callback(new Error('HTTP error ' + res.statusCode));
		}

		try {
			body = JSON.parse(body);
			callback(Helpers.eresultError(body.success));
		} catch (ex) {
			return callback(new Error('Malformed response'));
		}
	});
};

SteamCommunity.prototype._myProfile = function(endpoint, form, callback) {
	const completeRequest = (url) => {
		let options = endpoint.endpoint ? endpoint : {};
		options.uri = 'https://steamcommunity.com' + url + '/' + (endpoint.endpoint || endpoint);

		if (form) {
			options.method = 'POST';
			options.form = form;
			options.followAllRedirects = true;
		} else if (!options.method) {
			options.method = 'GET';
		}

		this.httpRequest(options, callback, 'steamcommunity');
	};

	if (this._profileURL) {
		completeRequest(this._profileURL);
	} else {
		this.httpRequest('https://steamcommunity.com/my', {followRedirect: false}, (err, response, body) => {
			if (err || response.statusCode != 302) {
				callback(err || 'HTTP error ' + response.statusCode);
				return;
			}

			let match = response.headers.location.match(/steamcommunity\.com(\/(id|profiles)\/[^/]+)\/?/);
			if (!match) {
				callback(new Error('Can\'t get profile URL'));
				return;
			}

			this._profileURL = match[1];
			setTimeout(() => {
				delete this._profileURL; // delete the cache
			}, 60000).unref();

			completeRequest(match[1]);
		}, 'steamcommunity');
	}
};

/**
 * Returns an object whose keys are 64-bit SteamIDs, and whose values are values from the EFriendRelationship enum.
 * Therefore, you can deduce your friends or blocked list from this object.
 * @param {function} callback
 */
SteamCommunity.prototype.getFriendsList = function(callback) {
	this.httpRequestGet({
		uri: 'https://steamcommunity.com/textfilter/ajaxgetfriendslist',
		json: true
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

require('./components/http.js');
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
