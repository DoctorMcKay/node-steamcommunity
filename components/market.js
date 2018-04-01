var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');

/**
 * Get a list of all apps on the market
 * @param {function} callback - First argument is null|Error, second is an object of appid => name
 */
SteamCommunity.prototype.getMarketApps = function(callback) {
	var self = this;
	this.httpRequest('https://steamcommunity.com/market/', function (err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		var $ = Cheerio.load(body);
		if ($('.market_search_game_button_group')) {
			let apps = {};
			$('.market_search_game_button_group a.game_button').each(function (i, element) {
				var e = Cheerio.load(element);
				var name = e('.game_button_game_name').text().trim();
				var url = element.attribs.href;
				var appid = url.substr(url.indexOf('=') + 1);
				apps[appid] = name;
			});
			callback(null, apps);
		} else {
			callback(new Error("Malformed response"));
		}
	}, "steamcommunity");
};

/**
 * Check if an item is eligible to be turned into gems and if so, get its gem value
 * @param {int} appid
 * @param {int|string} assetid
 * @param {function} callback
 */
SteamCommunity.prototype.getGemValue = function(appid, assetid, callback) {
	this._myProfile({
		"endpoint": "ajaxgetgoovalue/",
		"qs": {
			"sessionid": this.getSessionID(),
			"appid": appid,
			"contextid": 6,
			"assetid": assetid
		},
		"checkHttpError": false,
		"json": true
	}, null, (err, res, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (body.success && body.success != SteamCommunity.EResult.OK) {
			let err = new Error(body.message || SteamCommunity.EResult[body.success]);
			err.eresult = err.code = body.success;
			callback(err);
			return;
		}

		if (!body.goo_value || !body.strTitle) {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, {"promptTitle": body.strTitle, "gemValue": parseInt(body.goo_value, 10)});
	});
};

/**
 * Turn an eligible item into gems.
 * @param {int} appid
 * @param {int|string} assetid
 * @param {int} expectedGemsValue
 * @param {function} callback
 */
SteamCommunity.prototype.turnItemIntoGems = function(appid, assetid, expectedGemsValue, callback) {
	this._myProfile({
		"endpoint": "ajaxgrindintogoo/",
		"json": true,
		"checkHttpError": false
	}, {
		"appid": appid,
		"contextid": 6,
		"assetid": assetid,
		"goo_value_expected": expectedGemsValue,
		"sessionid": this.getSessionID()
	}, (err, res, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (body.success && body.success != SteamCommunity.EResult.OK) {
			let err = new Error(body.message || SteamCommunity.EResult[body.success]);
			err.eresult = err.code = body.success;
			callback(err);
			return;
		}

		if (!body['goo_value_received '] || !body.goo_value_total) { // lol valve
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, {"gemsReceived": parseInt(body['goo_value_received '], 10), "totalGems": parseInt(body.goo_value_total, 10)});
	})
};

/**
 * Get details about a gift in your inventory.
 * @param {string} giftID
 * @param {function} callback
 */
SteamCommunity.prototype.getGiftDetails = function(giftID, callback) {
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/gifts/" + giftID + "/validateunpack",
		"form": {
			"sessionid": this.getSessionID()
		},
		"json": true
	}, (err, res, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (body.success && body.success != SteamCommunity.EResult.OK) {
			let err = new Error(body.message || SteamCommunity.EResult[body.success]);
			err.eresult = err.code = body.success;
			callback(err);
			return;
		}

		if (!body.packageid || !body.gift_name) {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, {
			"giftName": body.gift_name,
			"packageID": parseInt(body.packageid, 10),
			"owned": body.owned
		});
	});
};

/**
 * Unpack a gift in your inventory to your library.
 * @param {string} giftID
 * @param {function} callback
 */
SteamCommunity.prototype.redeemGift = function(giftID, callback) {
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/gifts/" + giftID + "/unpack",
		"form": {
			"sessionid": this.getSessionID()
		},
		"json": true
	}, (err, res, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (body.success && body.success != SteamCommunity.EResult.OK) {
			let err = new Error(body.message || SteamCommunity.EResult[body.success]);
			err.eresult = err.code = body.success;
			callback(err);
			return;
		}

		callback(null);
	});
};
