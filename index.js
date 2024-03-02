const {EventEmitter} = require('events');
const StdLib = require('@doctormckay/stdlib');
const SteamID = require('steamid');
const {LoginSession, EAuthTokenPlatformType, EAuthSessionGuardType} = require('steam-session');
const Util = require('util');
const xml2js = require('xml2js');

const Helpers = require('./components/helpers.js');
const Package = require('./package.json');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

Util.inherits(SteamCommunity, EventEmitter);

module.exports = SteamCommunity;

SteamCommunity.SteamID = SteamID;
SteamCommunity.EConfirmationType = require('./resources/EConfirmationType.js');
SteamCommunity.EResult = require('./resources/EResult.js');
SteamCommunity.ESharedFileType = require('./resources/ESharedFileType.js');
SteamCommunity.EFriendRelationship = require('./resources/EFriendRelationship.js');

/**
 *
 * @param {object} [options]
 * @param {number} [options.timeout=50000] -  The time in milliseconds that SteamCommunity will wait for HTTP requests to complete.
 * @param {string} [options.localAddress] - The local IP address that SteamCommunity will use for its HTTP requests.
 * @param {string} [options.httpProxy] - A string containing the URI of an HTTP proxy to use for all requests, e.g. `http://user:pass@1.2.3.4:8888`
 * @param {object} [options.defaultHttpHeaders] - An object containing some headers to send for every HTTP request
 * @constructor
 */
function SteamCommunity(options) {
	options = options || {};

	this.packageName = Package.name;
	this.packageVersion = Package.version;

	this._jar = new StdLib.HTTP.CookieJar();
	this._captchaGid = -1;
	this._httpRequestID = 0;

	let defaultHeaders = {
		'user-agent': USER_AGENT
	};

	// Apply the user's custom default headers
	for (let i in (options.defaultHttpHeaders || {})) {
		// Make sure all header names are lower case to avoid conflicts
		defaultHeaders[i.toLowerCase()] = options.defaultHttpHeaders[i];
	}

	this._httpClient = new StdLib.HTTP.HttpClient({
		httpAgent: options.httpProxy ? StdLib.HTTP.getProxyAgent(false, options.httpProxy) : null,
		httpsAgent: options.httpProxy ? StdLib.HTTP.getProxyAgent(true, options.httpProxy) : null,
		localAddress: options.localAddress,
		defaultHeaders,
		defaultTimeout: options.timeout || 50000,
		cookieJar: this._jar,
		gzip: true
	});

	this._options = options;

	// English
	this._setCookie('Steam_Language=english');

	// UTC
	this._setCookie('timezoneOffset=0,0');
}

/**
 * @param {object} details
 * @param {string} details.accountName
 * @param {string} details.password
 * @param {string} [details.authCode]
 * @param {string} [details.twoFactorCode]
 * @param {string} [details.authTokenPlatformType] - A value from steam-session's EAuthTokenPlatformType enum. Defaults to MobileApp.
 * @return Promise<{cookies: string[], sessionID: string, refreshToken: string}>
 */
SteamCommunity.prototype.login = function(details) {
	if (typeof details.accountName != 'string' || typeof details.password != 'string') {
		throw new Error('You must provide your accountName and password to login to steamcommunity.com');
	}

	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		let platformType = details.authTokenPlatformType || EAuthTokenPlatformType.MobileApp;
		let session = new LoginSession(platformType, {
			httpProxy: this._options.httpProxy
		});

		session.on('authenticated', async () => {
			try {
				let cookies = await session.getWebCookies();
				this.setCookies(cookies);

				if (platformType == EAuthTokenPlatformType.MobileApp) {
					this.setMobileAppAccessToken(session.accessToken);
				}

				// TODO set refresh token for session keep-alive

				let sessionID = this.getSessionID();
				if (!cookies.some(c => c.startsWith('sessionid='))) {
					// make sure that the sessionid we return is in the cookies list we return
					cookies.push(`sessionid=${sessionID}`);
				}

				resolve({
					cookies,
					sessionID,
					refreshToken: session.refreshToken
				});
			} catch (ex) {
				reject(ex);
			}
		});

		session.on('timeout', () => {
			// This really shouldn't happen
			reject(new Error('Login attempt timed out'));
		});
		session.on('error', reject);

		try {
			let startResult = await session.startWithCredentials({
				accountName: details.accountName,
				password: details.password,
				steamGuardCode: details.twoFactorCode || details.authCode
			});

			if (!startResult.actionRequired) {
				return; // 'authenticated' should get emitted soon
			}

			session.cancelLoginAttempt();

			if (startResult.validActions.some(a => a.type == EAuthSessionGuardType.EmailCode)) {
				return reject(new Error('SteamGuard'));
			}

			if (startResult.validActions.some(a => a.type == EAuthSessionGuardType.DeviceCode)) {
				return reject(new Error('SteamGuardMobile'));
			}

			let validActions = startResult.validActions.map(a => a.type).join(', ');
			return reject(new Error(`Unexpected guard action(s) ${validActions}`));
		} catch (ex) {
			reject(ex);
		}
	});
};

/**
 * Get a token that can be used to log onto Steam using steam-user.
 * @param {function} [callback]
 * @return Promise<{steamID: SteamID, accountName: string, webLogonToken: string}>
 */
SteamCommunity.prototype.getClientLogonToken = function(callback) {
	return StdLib.Promises.callbackPromise(null, callback, false, async (resolve, reject) => {
		let {jsonBody} = await this.httpRequest({
			method: 'GET',
			url: 'https://steamcommunity.com/chat/clientjstoken',
			source: 'steamcommunity'
		});

		if (!jsonBody.logged_in) {
			let e = new Error('Not Logged In');
			this._notifySessionExpired(e);
			return reject(e);
		}

		if (!jsonBody.steamid || !jsonBody.account_name || !jsonBody.token) {
			return reject(new Error('Malformed response'));
		}

		resolve({
			steamID: new SteamID(jsonBody.steamid),
			accountName: jsonBody.account_name,
			webLogonToken: jsonBody.token
		});
	});
};

/**
 * Sets a single cookie in our cookie jar.
 * @param {string} cookie
 * @private
 */
SteamCommunity.prototype._setCookie = function(cookie) {
	this._jar.add(cookie, 'steamcommunity.com');
	this._jar.add(cookie, 'store.steampowered.com');
	this._jar.add(cookie, 'help.steampowered.com');
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

		this._setCookie(cookie);
	});

	// The account we're logged in as might have changed, so verify that our mobile access token (if any) is still valid
	// for this account.
	this._verifyMobileAccessToken();
};

SteamCommunity.prototype.getSessionID = function(domain = 'steamcommunity.com') {
	let sessionIdCookie = this._jar.cookies
		.filter(c => c.domain == domain)
		.find(c => c.name == 'sessionid');
	if (sessionIdCookie) {
		return sessionIdCookie.content;
	}

	// No cookie found? Generate a new session id
	let sessionID = require('crypto').randomBytes(12).toString('hex');
	this._setCookie(`sessionid=${sessionID}`);
	return sessionID;
};

/**
 * @param {string} pin
 * @param {function} [callback]
 * @return Promise<void>
 */
SteamCommunity.prototype.parentalUnlock = function(pin, callback) {
	let sessionID = this.getSessionID();

	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let {jsonBody} = await this.httpRequest({
			method: 'POST',
			url: 'https://steamcommunity.com/parental/ajaxunlock',
			form: {
				pin: pin,
				sessionid: sessionID
			},
			source: 'steamcommunity'
		});

		if (!jsonBody || typeof jsonBody.success !== 'boolean') {
			return reject('Invalid response');
		}

		if (!jsonBody.success) {
			switch (jsonBody.eresult) {
				case SteamCommunity.EResult.AccessDenied:
					return reject('Incorrect PIN');

				case SteamCommunity.EResult.LimitExceeded:
					return reject('Too many invalid PIN attempts');

				default:
					return reject('Error ' + jsonBody.eresult);
			}
		}

		resolve();
	});
};

/**
 * @param {function} [callback]
 * @return Promise<object>
 */
SteamCommunity.prototype.getNotifications = function(callback) {
	return StdLib.Promises.callbackPromise(null, callback, false, async (resolve, reject) => {
		let {jsonBody} = await this.httpRequest({
			method: 'GET',
			url: 'https://steamcommunity.com/actions/GetNotificationCounts',
			source: 'steamcommunity'
		});

		if (!jsonBody || !jsonBody.notifications) {
			return reject(new Error('Malformed response'));
		}

		let notifications = {
			trades: jsonBody.notifications[1] || 0,
			gameTurns: jsonBody.notifications[2] || 0,
			moderatorMessages: jsonBody.notifications[3] || 0,
			comments: jsonBody.notifications[4] || 0,
			items: jsonBody.notifications[5] || 0,
			invites: jsonBody.notifications[6] || 0,
			// dunno about 7
			gifts: jsonBody.notifications[8] || 0,
			chat: jsonBody.notifications[9] || 0,
			helpRequestReplies: jsonBody.notifications[10] || 0,
			accountAlerts: jsonBody.notifications[11] || 0
		};

		resolve(notifications);
	});
};

/**
 * @param {function} [callback]
 * @return Promise<void>
 */
SteamCommunity.prototype.resetItemNotifications = function(callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		await this.httpRequest({
			method: 'GET',
			url: 'https://steamcommunity.com/my/inventory',
			source: 'steamcommunity'
		});

		resolve();
	});
};

/**
 * @param {function} [callback]
 * @return Promise<{loggedIn: boolean, familyView: boolean}>
 */
SteamCommunity.prototype.loggedIn = function(callback) {
	return StdLib.Promises.callbackPromise(['loggedIn', 'familyView'], callback, false, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'GET',
			url: 'https://steamcommunity.com/my',
			followRedirect: false,
			checkHttpError: false,
			source: 'steamcommunity'
		});

		if (result.statusCode != 302 && result.statusCode != 403) {
			return reject(new Error(`HTTP error ${result.statusCode}`));
		}

		if (result.statusCode == 403) {
			// TODO check response body to see if this is an akamai block
			return resolve({
				loggedIn: true,
				familyView: true
			});
		}

		return resolve({
			loggedIn: !!result.headers.location.match(/steamcommunity\.com(\/(id|profiles)\/[^/]+)\/?/),
			familyView: false
		});
	});
};

/**
 * @param {function} [callback]
 * @return Promise<{url: string, token: string}>
 */
SteamCommunity.prototype.getTradeURL = function(callback) {
	return StdLib.Promises.callbackPromise(['url', 'token'], callback, false, async (resolve, reject) => {
		let {textBody} = await this._myProfile('tradeoffers/privacy');

		let match = textBody.match(/https?:\/\/(www.)?steamcommunity.com\/tradeoffer\/new\/?\?partner=\d+(&|&amp;)token=([a-zA-Z0-9-_]+)/);
		if (!match) {
			return reject(new Error('Malformed response'));
		}

		let token = match[3];
		resolve({
			url: match[0],
			token
		});
	});
};

/**
 * @param [callback]
 * @return Promise<{url: string, token: string}>
 */
SteamCommunity.prototype.changeTradeURL = function(callback) {
	return StdLib.Promises.callbackPromise(['url', 'token'], callback, true, async (resolve, reject) => {
		let {textBody} = await this._myProfile('tradeoffers/newtradeurl', {sessionid: this.getSessionID()});

		if (!textBody || typeof textBody !== 'string' || textBody.length < 3 || textBody.indexOf('"') !== 0) {
			return reject(new Error('Malformed response'));
		}

		let newToken = textBody.replace(/"/g, ''); //"t1o2k3e4n" => t1o2k3e4n
		resolve({
			url: `https://steamcommunity.com/tradeoffer/new/?partner=${this.steamID.accountid}&token=${newToken}`,
			token: newToken
		});
	});
};

/**
 * Clear your profile name (alias) history.
 * @param {function} [callback]
 * @return Promise<void>
 */
SteamCommunity.prototype.clearPersonaNameHistory = function(callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let {statusCode, textBody} = await this._myProfile('ajaxclearaliashistory/', {sessionid: this.getSessionID()});

		if (statusCode != 200) {
			return reject(new Error(`HTTP error ${statusCode}`));
		}

		try {
			let body = JSON.parse(textBody);
			let err = Helpers.eresultError(body.success);
			return err ? reject(err) : resolve();
		} catch (ex) {
			return reject(new Error('Malformed response'));
		}
	});
};

/**
 * Returns an object whose keys are 64-bit SteamIDs, and whose values are values from the EFriendRelationship enum.
 * Therefore, you can deduce your friends or blocked list from this object.
 * @param {function} [callback]
 * @return Promise<object[]>
 */
SteamCommunity.prototype.getFriendsList = function(callback) {
	return StdLib.Promises.callbackPromise(['friends'], callback, false, async (resolve, reject) => {
		let {jsonBody} = await this.httpRequest({
			method: 'GET',
			url: 'https://steamcommunity.com/textfilter/ajaxgetfriendslist',
			source: 'steamcommunity'
		});

		if (jsonBody.success != SteamCommunity.EResult.OK) {
			return reject(Helpers.eresultError(jsonBody.success));
		}

		if (!jsonBody.friendslist || !jsonBody.friendslist.friends) {
			return reject(new Error('Malformed response'));
		}

		const friends = {};
		jsonBody.friendslist.friends.forEach(friend => (friends[friend.ulfriendid] = friend.efriendrelationship));
		resolve({friends});
	});
};

/**
 * @param {string} url
 * @return Promise<{vanityURL: string, steamID: SteamID}>
 * @private
 */
SteamCommunity.prototype._resolveVanityURL = async function(url) {
	// Precede url param if only the vanity was provided
	if (!url.includes('steamcommunity.com')) {
		url = `https://steamcommunity.com/id/${url}`;
	}

	// Make request to get XML data
	let {textBody} = await this._httpRequest({
		method: 'GET',
		url,
		source: 'steamcommunity'
	});

	return await new Promise((resolve, reject) => {
		// Parse XML data returned from Steam into an object
		new xml2js.Parser().parseString(textBody, (err, parsed) => {
			if (err) {
				return reject(new Error('Couldn\'t parse XML response'));
			}

			if (parsed.response && parsed.response.error) {
				return reject(new Error('Couldn\'t find Steam ID'));
			}

			let steamID64 = parsed.profile.steamID64[0];
			let vanityURL = parsed.profile.customURL[0];

			resolve({
				vanityURL,
				steamID: new SteamID(steamID64)
			});
		});
	});
};

require('./components/http.js');
require('./components/profile.js');
require('./components/market.js');
require('./components/groups.js');
require('./components/users.js');
require('./components/sharedfiles.js');
require('./components/webapi.js');
require('./components/twofactor.js');
require('./components/confirmations.js');
require('./components/discussions.js');
require('./components/help.js');
require('./classes/CMarketItem.js');
require('./classes/CMarketSearchResult.js');
require('./classes/CSteamDiscussion.js');
require('./classes/CSteamGroup.js');
require('./classes/CSteamSharedFile.js');
require('./classes/CSteamUser.js');

/**
 @callback SteamCommunity~genericErrorCallback
 @param {Error|null} err - An Error object on failure, or null on success
 */
