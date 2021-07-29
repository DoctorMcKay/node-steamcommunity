const Cheerio = require('cheerio');

const SteamCommunity = require('../index.js');

SteamCommunity.prototype.getMarketItem = function(appid, hashName, currency, callback) {
	if (typeof currency == 'function') {
		callback = currency;
		currency = 1;
	}

	this.httpRequest('https://steamcommunity.com/market/listings/' + appid + '/' + encodeURIComponent(hashName), (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		let $ = Cheerio.load(body);
		let $listingTableMessage = $('.market_listing_table_message');
		if ($listingTableMessage && $listingTableMessage.text().trim() == 'There are no listings for this item.') {
			callback(new Error('There are no listings for this item.'));
			return;
		}

		let item = new CMarketItem(appid, hashName, this, body, $);
		item.updatePrice(currency, (err) => {
			if (err) {
				callback(err);
			} else {
				callback(null, item);
			}
		});
	}, 'steamcommunity');
};

function CMarketItem(appid, hashName, community, body, $) {
	this._appid = appid;
	this._hashName = hashName;
	this._community = community;
	this._$ = $;

	this._country = 'US';
	let match = body.match(/var g_strCountryCode = "([^"]+)";/);
	if (match) {
		this._country = match[1];
	}

	this._language = 'english';
	match = body.match(/var g_strLanguage = "([^"]+)";/);
	if (match) {
		this._language = match[1];
	}

	this.commodity = false;
	match = body.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\);/);
	if (match) {
		this.commodity = true;
		this.commodityID = parseInt(match[1], 10);
	}

	this.medianSalePrices = null;
	match = body.match(/var line1=([^;]+);/);
	if (match) {
		try {
			this.medianSalePrices = JSON.parse(match[1]);
			this.medianSalePrices = this.medianSalePrices.map((item) => ({
				hour: new Date(item[0]),
				price: item[1],
				quantity: parseInt(item[2], 10)
			}));
		} catch (e) {
			// ignore
		}
	}

	this.firstAsset = null;
	this.assets = null;
	match = body.match(/var g_rgAssets = (.*);/);
	if (match) {
		try {
			this.assets = JSON.parse(match[1]);
			this.assets = this.assets[appid];
			this.assets = this.assets[Object.keys(this.assets)[0]];
			this.firstAsset = this.assets[Object.keys(this.assets)[0]];
		} catch (e) {
			// ignore
		}
	}

	this.quantity = 0;
	this.lowestPrice = 0;
	// TODO: Buying listings and placing buy orders
}

CMarketItem.prototype.updatePrice = function (currency, callback) {
	if (this.commodity) {
		this.updatePriceForCommodity(currency, callback);
	} else {
		this.updatePriceForNonCommodity(currency, callback);
	}
};

CMarketItem.prototype.updatePriceForCommodity = function(currency, callback) {
	if (!this.commodity) {
		throw new Error('Cannot update price for non-commodity item');
	}

	this._community.httpRequest({
		uri: 'https://steamcommunity.com/market/itemordershistogram?country=US&language=english&currency=' + currency + '&item_nameid=' + this.commodityID,
		json: true
	}, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (body.success != 1) {
			if (callback) {
				callback(new Error('Error ' + body.success));
			}

			return;
		}

		let match = (body.sell_order_summary || '').match(/<span class="market_commodity_orders_header_promote">(\d+)<\/span>/);
		if (match) {
			this.quantity = parseInt(match[1], 10);
		}

		this.buyQuantity = 0;
		match = (body.buy_order_summary || '').match(/<span class="market_commodity_orders_header_promote">(\d+)<\/span>/);
		if (match) {
			this.buyQuantity = parseInt(match[1], 10);
		}

		this.lowestPrice = parseInt(body.lowest_sell_order, 10);
		this.highestBuyOrder = parseInt(body.highest_buy_order, 10);

		// TODO: The tables?
		if (callback) {
			callback(null);
		}
	}, 'steamcommunity');
};

CMarketItem.prototype.updatePriceForNonCommodity = function (currency, callback) {
	if (this.commodity) {
		throw new Error('Cannot update price for commodity item');
	}

	this._community.httpRequest({
		uri: 'https://steamcommunity.com/market/listings/' +
			this._appid + '/' +
			encodeURIComponent(this._hashName) +
			'/render/?query=&start=0&count=10&country=US&language=english&currency=' + currency,
		json: true
	}, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (body.success != 1) {
			callback && callback(new Error('Error ' + body.success));
			return;
		}

		let match = body.total_count;
		if (match) {
			this.quantity = parseInt(match, 10);
		}

		let lowestPrice;
		let $ = Cheerio.load(body.results_html);
		match = $('.market_listing_price.market_listing_price_with_fee');
		if (match) {
			for (let i = 0; i < match.length; i++) {
				lowestPrice = parseFloat($(match[i]).text().replace(',', '.').replace(/[^\d.]/g, ''));
				if (!isNaN(lowestPrice)) {
					this.lowestPrice = lowestPrice;
					break;
				}
			}
		}

		callback && callback(null);
	}, 'steamcommunity');
};
