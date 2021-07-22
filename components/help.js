const SteamCommunity = require('../index.js');

const Helpers = require('./helpers.js');

/**
 * Restore a previously removed steam package from your steam account.
 * @param {int|string} packageID
 * @param {function} callback
 */
SteamCommunity.prototype.restorePackage = function(packageID, callback) {
	this.httpRequestPost({
		"uri": "https://help.steampowered.com/wizard/AjaxDoPackageRestore",
		"form": {
			"packageid": packageID,
			"sessionid": this.getSessionID('https://help.steampowered.com'),
			"wizard_ajax": 1
		},
		"json": true
	}, (err, res, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (!body.success) {
			callback(body.errorMsg ? new Error(body.errorMsg) : Helpers.eresultError(body.success));
			return;
		}

		callback(null);
	});
};

/**
 * Remove a steam package from your steam account.
 * @param {int|string} packageID
 * @param {function} callback
 */
SteamCommunity.prototype.removePackage = function(packageID, callback) {
	this.httpRequestPost({
		"uri": "https://help.steampowered.com/wizard/AjaxDoPackageRemove",
		"form": {
			"packageid": packageID,
			"sessionid": this.getSessionID('https://help.steampowered.com'),
			"wizard_ajax": 1
		},
		"json": true
	}, (err, res, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (!body.success) {
			callback(body.errorMsg ? new Error(body.errorMsg) : Helpers.eresultError(body.success));
			return;
		}

		callback(null);
	});
};
