const {chrome} = require('@doctormckay/user-agents');

const SteamCommunity = require('../index.js');

/**
 * @typedef LogOnDetails
 * @property {string} accountName
 * @property {string} password
 * @property {string} [steamguard]
 * @property {string} [authCode]
 * @property {string} [twoFactorCode]
 * @property {boolean} disableMobile
 */

/**
 * @typedef LogOnResponse
 * @property {string} sessionID
 * @property {string[]} cookies
 * @property {string} steamguard
 * @property {string} [mobileAccessToken]
 */

/**
 *
 * @param {LogOnDetails} logOnDetails
 * @returns {Promise<LogOnResponse>}
 * @private
 */
SteamCommunity.prototype._modernLogin = function(logOnDetails) {
	return new Promise(async (resolve, reject) => {
		if (!isNodeVersionNewEnough()) {
			return reject(new Error(`Node.js version is too old! Need >=12.22.0 or later, got ${process.versions.node}.`));
		}

		if (this._options.request) {
			return reject(new Error('SteamCommunity.login() is incompatible with node-steamcommunity v3\'s usage of \'request\'. If you need to specify a custom \'request\' instance (e.g. when using a proxy), use https://www.npmjs.com/package/steam-session directly to log onto Steam.'));
		}

		// Import this here so we don't cause problems on old Node versions if this code path isn't taken.
		const {LoginSession, EAuthTokenPlatformType, EAuthSessionGuardType} = require('steam-session');

		let session = new LoginSession(
			logOnDetails.disableMobile
				? EAuthTokenPlatformType.WebBrowser
				: EAuthTokenPlatformType.MobileApp,
			{
				localAddress: this._options.localAddress,
				userAgent: this._options.userAgent || chrome()
			}
		);

		session.on('authenticated', async () => {
			try {
				let webCookies = await session.getWebCookies();
				let sessionIdCookie = webCookies.find(c => c.startsWith('sessionid='));
				resolve({
					sessionID: sessionIdCookie.split('=')[1].split(';')[0].trim(),
					cookies: webCookies,
					steamguard: session.steamGuardMachineToken,
					mobileAccessToken: logOnDetails.disableMobile ? null : session.accessToken
				});
			} catch (ex) {
				reject(ex);
			}
		});

		session.on('error', (err) => {
			reject(err);
		});

		try {
			let startResult = await session.startWithCredentials({
				accountName: logOnDetails.accountName,
				password: logOnDetails.password,
				steamGuardMachineToken: logOnDetails.steamguard,
				steamGuardCode: logOnDetails.authCode || logOnDetails.twoFactorCode
			});

			if (startResult.actionRequired) {
				// Cannot continue with login, need something from the user
				session.cancelLoginAttempt();

				let emailMfaAction = startResult.validActions.find(action => action.type == EAuthSessionGuardType.EmailCode);
				if (emailMfaAction) {
					let err = new Error('SteamGuard');
					err.emaildomain = emailMfaAction.detail;
					return reject(err);
				}

				return reject(new Error('SteamGuardMobile'));
			}
		} catch (ex) {
			return reject(ex);
		}
	});
};

function isNodeVersionNewEnough() {
	let [major, minor] = process.versions.node.split('.');

	if (major < 12) {
		return false;
	}

	if (major == 12 && minor < 22) {
		return false;
	}

	return true;
}
