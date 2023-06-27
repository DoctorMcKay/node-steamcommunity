const StdLib = require('@doctormckay/stdlib');
// eslint-disable-next-line no-unused-vars
const {HttpResponse} = require('@doctormckay/stdlib/http');

const SteamCommunity = require('../index.js');

const HELP_SITE_DOMAIN = 'https://help.steampowered.com';

/**
 * Restore a previously removed steam package from your steam account.
 * @param {int|string} packageID
 * @param {function} [callback]
 * @return Promise<void>
 */
SteamCommunity.prototype.restorePackage = function(packageID, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'POST',
			url: `${HELP_SITE_DOMAIN}/wizard/AjaxDoPackageRestore`,
			form: {
				packageid: packageID,
				sessionid: this.getSessionID(HELP_SITE_DOMAIN),
				wizard_ajax: 1
			},
			source: 'steamcommunity'
		});

		wizardAjaxHandler(result, resolve, reject);
	});
};

/**
 * Remove a steam package from your steam account.
 * @param {int|string} packageID
 * @param {function} callback
 */
SteamCommunity.prototype.removePackage = function(packageID, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'POST',
			url: `${HELP_SITE_DOMAIN}/wizard/AjaxDoPackageRemove`,
			form: {
				packageid: packageID,
				sessionid: this.getSessionID(HELP_SITE_DOMAIN),
				wizard_ajax: 1
			},
			source: 'steamcommunity'
		});

		wizardAjaxHandler(result, resolve, reject);
	});
};

/**
 *
 * @param {HttpResponse} result
 * @param {function} resolve
 * @param {function} reject
 */
function wizardAjaxHandler(result, resolve, reject) {
	if (!result.jsonBody || !result.jsonBody.success) {
		return reject(new Error((result.jsonBody || {}).errorMsg || 'Unexpected error'));
	}

	resolve();
}
