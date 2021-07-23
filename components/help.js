const SteamCommunity = require('../index.js');

const Helpers = require('./helpers.js');

const HELP_SITE_DOMAIN = 'https://help.steampowered.com';

/**
 * Restore a previously removed steam package from your steam account.
 * @param {int|string} packageID
 * @param {function} callback
 */
SteamCommunity.prototype.restorePackage = function(packageID, callback) {
	this.httpRequestPost({
		uri: HELP_SITE_DOMAIN + '/wizard/AjaxDoPackageRestore',
		form: {
			packageid: packageID,
			sessionid: this.getSessionID(HELP_SITE_DOMAIN),
			wizard_ajax: 1
		},
		json: true
	}, wizardAjaxHandler(callback));
};

/**
 * Remove a steam package from your steam account.
 * @param {int|string} packageID
 * @param {function} callback
 */
SteamCommunity.prototype.removePackage = function(packageID, callback) {
	this.httpRequestPost({
		uri: HELP_SITE_DOMAIN + '/wizard/AjaxDoPackageRemove',
		form: {
			packageid: packageID,
			sessionid: this.getSessionID(HELP_SITE_DOMAIN),
			wizard_ajax: 1
		},
		json: true
	}, wizardAjaxHandler(callback));
};

/**
 * Returns a handler for wizard ajax HTTP requests.
 * @param {function} callback
 * @returns {(function(*=, *, *): void)|*}
 */
function wizardAjaxHandler(callback) {
	return (err, res, body) => {
		if (!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if (!body.success) {
			callback(body.errorMsg ? new Error(body.errorMsg) : Helpers.eresultError(body.success));
			return;
		}

		callback(null);
	};
}
