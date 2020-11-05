const SteamCommunity = require('../index.js');
const Cheerio = require('cheerio');

const Helpers = require('./helpers.js');

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
 * Open a booster pack.
 * @param {int} appid
 * @param {int|string} assetid
 * @param {function} callback
 */
SteamCommunity.prototype.openBoosterPack = function(appid, assetid, callback) {
	this._myProfile({
		"endpoint": "ajaxunpackbooster/",
		"json": true,
		"checkHttpError": false
	}, {
		"appid": appid,
		"communityitemid": assetid,
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

		if (!body.rgItems) {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, body.rgItems);
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

/**
 * @param {int|string} assetid
 * @param {int} denominationIn
 * @param {int} denominationOut
 * @param {int} quantityIn
 * @param {int} quantityOut
 * @param {function} callback
 * @private
 */
SteamCommunity.prototype._gemExchange = function(assetid, denominationIn, denominationOut, quantityIn, quantityOut, callback) {
	this._myProfile({
		endpoint: 'ajaxexchangegoo/',
		json: true,
		checkHttpError: false
	}, {
		appid: 753,
		assetid,
		goo_denomination_in: denominationIn,
		goo_amount_in: quantityIn,
		goo_denomination_out: denominationOut,
		goo_amount_out_expected: quantityOut,
		sessionid: this.getSessionID()
	}, (err, res, body) => {
		if (err) {
			callback(err);
			return;
		}

		callback(Helpers.eresultError(body.success));
	});
};

/**
 * Pack gems into sack of gems.
 * @param {int|string} assetid - ID of gem stack you want to pack into sacks
 * @param {int} desiredSackCount - How many sacks you want. You must have at least this amount * 1000 gems in the stack you're packing
 * @param {function} callback
 */
SteamCommunity.prototype.packGemSacks = function(assetid, desiredSackCount, callback) {
	this._gemExchange(assetid, 1, 1000, desiredSackCount * 1000, desiredSackCount, callback);
};

/**
 * Unpack sack of gems into gems.
 * @param {int|string} assetid - ID of sack stack you want to unpack (say that 5 times fast)
 * @param {int} sacksToUnpack
 * @param {function} callback
 */
SteamCommunity.prototype.unpackGemSacks = function(assetid, sacksToUnpack, callback) {
	this._gemExchange(assetid, 1000, 1, sacksToUnpack, sacksToUnpack * 1000, callback);
};
