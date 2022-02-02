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
 * Get the booster pack catalog to see what booster packs you can create
 * @param {function} callback
 */
SteamCommunity.prototype.getBoosterPackCatalog = function(callback) {
	this.httpRequestGet('https://steamcommunity.com/tradingcards/boostercreator/', (err, res, body) => {
		if (err) {
			callback(err);
			return;
		}

		let idx = body.indexOf('CBoosterCreatorPage.Init(');
		if (idx == -1) {
			callback(new Error('Malformed response'));
			return;
		}

		let lines = body.slice(idx).split('\n').map(l => l.trim());

		for (let i = 1; i <= 4; i++) {
			if (typeof lines[i] != 'string' || !lines[i].match(/,$/)) {
				let err = new Error('Malformed response');
				err.line = i;
				callback(err);
				return;
			}

			lines[i] = lines[i].replace(/,$/, '');
		}

		let boosterPackCatalog, totalGems, tradableGems, untradableGems;
		try {
			boosterPackCatalog = JSON.parse(lines[1]);
			totalGems = parseInt(lines[2].match(/\d+/)[0], 10);
			tradableGems = parseInt(lines[3].match(/\d+/)[0], 10);
			untradableGems = parseInt(lines[4].match(/\d+/)[0], 10);
		} catch (ex) {
			let err = new Error('Malformed response');
			err.inner = ex;
			callback(err);
			return;
		}

		let keyedCatalog = {};
		boosterPackCatalog.forEach((app) => {
			app.price = parseInt(app.price, 10);
			app.unavailable = app.unavailable || false;
			app.availableAtTime = app.available_at_time || null;

			if (typeof app.availableAtTime == 'string') {
				app.availableAtTime = Helpers.decodeSteamTime(app.availableAtTime);
			}

			delete app.available_at_time;

			keyedCatalog[app.appid] = app;
		});

		callback(null, {
			totalGems,
			tradableGems,
			untradableGems,
			catalog: keyedCatalog
		});
	});
};

/**
 * Create a booster pack using gems.
 * @param {int} appid
 * @param {boolean} [useUntradableGems=false]
 * @param callback
 */
SteamCommunity.prototype.createBoosterPack = function(appid, useUntradableGems, callback) {
	if (typeof useUntradableGems == 'function') {
		callback = useUntradableGems;
		useUntradableGems = false;
	}

	this.httpRequestPost({
		uri: 'https://steamcommunity.com/tradingcards/ajaxcreatebooster/',
		form: {
			sessionid: this.getSessionID(),
			appid,
			series: 1,
			// tradability_preference can be a value 1-3
			// 1: Prefer using tradable gems, but use untradable if necessary
			// 2: Only use tradable gems
			// 3: Prefer using untradable gems, but use tradable if necessary
			tradability_preference: useUntradableGems ? 3 : 2
		},
		json: true,
		checkHttpError: false
	}, (err, res, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (body.purchase_eresult && body.purchase_eresult != 1) {
			callback(Helpers.eresultError(body.purchase_eresult));
			return;
		}

		// We can now check HTTP status codes
		if (this._checkHttpError(err, res, callback, body)) {
			return;
		}

		callback(null, {
			totalGems: parseInt(body.goo_amount, 10),
			tradableGems: parseInt(body.tradable_goo_amount, 10),
			untradableGems: parseInt(body.untradable_goo_amount, 10),
			resultItem: body.purchase_result
		});
	});
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
