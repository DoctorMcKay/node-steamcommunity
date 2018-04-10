var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');

SteamCommunity.prototype.getMarketItem = function(appid, hashName, currency, callback) {
	if (typeof currency == "function") {
		callback = currency;
		currency = 1;
	}
	var self = this;
	this.httpRequest("https://steamcommunity.com/market/listings/" + appid + "/" + encodeURIComponent(hashName), function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		var $ = Cheerio.load(body);
		if($('.market_listing_table_message') && $('.market_listing_table_message').text().trim() == 'There are no listings for this item.') {
			callback(new Error("There are no listings for this item."));
			return;
		}

		var item = new CMarketItem(appid, hashName, self, body, $);
		item.updatePrice(currency, function(err) {
			if(err) {
				callback(err);
			} else {
				callback(null, item);
			}
		});
	}, "steamcommunity");
};

function CMarketItem(appid, hashName, community, body, $) {
	this._appid = appid;
	this._hashName = hashName;
	this._community = community;
	this._$ = $;

	this._country = "US";
	var match = body.match(/var g_strCountryCode = "([^"]+)";/);
	if(match) {
		this._country = match[1];
	}

	this._language = "english";
	match = body.match(/var g_strLanguage = "([^"]+)";/);
	if(match) {
		this._language = match[1];
	}

	this.commodity = false;
	match = body.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\);/);
	if(match) {
		this.commodity = true;
		this.commodityID = parseInt(match[1], 10);
	}

	this.medianSalePrices = null;
	match = body.match(/var line1=([^;]+);/);
	if(match) {
		try {
			this.medianSalePrices = JSON.parse(match[1]);
			this.medianSalePrices = this.medianSalePrices.map(function(item) {
				return {
					"hour": new Date(item[0]),
					"price": item[1],
					"quantity": parseInt(item[2], 10)
				};
			});
		} catch(e) {
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
	if(!this.commodity) {
		throw new Error("Cannot update price for non-commodity item");
	}

	var self = this;
	this._community.httpRequest({
		"uri": "https://steamcommunity.com/market/itemordershistogram?country=US&language=english&currency=" + currency + "&item_nameid=" + this.commodityID,
		"json": true
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if(body.success != 1) {
			if(callback) {
				callback(new Error("Error " + body.success));
			}

			return;
		}

		var match = (body.sell_order_summary || '').match(/<span class="market_commodity_orders_header_promote">(\d+)<\/span>/);
		if(match) {
			self.quantity = parseInt(match[1], 10);
		}

		self.buyQuantity = 0;
		match = (body.buy_order_summary || '').match(/<span class="market_commodity_orders_header_promote">(\d+)<\/span>/);
		if(match) {
			self.buyQuantity = parseInt(match[1], 10);
		}

		self.lowestPrice = parseInt(body.lowest_sell_order, 10);
		self.highestBuyOrder = parseInt(body.highest_buy_order, 10);

		// TODO: The tables?
		if(callback) {
			callback(null);
		}
	}, "steamcommunity");
};

CMarketItem.prototype.updatePriceForNonCommodity = function (currency, callback) {
	if(this.commodity) {
		throw new Error("Cannot update price for commodity item");
	}

	var self = this;
	this._community.httpRequest({
		"uri": "https://steamcommunity.com/market/listings/" +
			this._appid + "/" +
			encodeURIComponent(this._hashName) +
			"/render/?query=&start=0&count=10&country=US&language=english&currency=" + currency,
		"json": true
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if (body.success != 1) {
			callback && callback(new Error("Error " + body.success));
			return;
		}

		var match = body.total_count;
		if (match) {
			self.quantity = parseInt(match, 10);
		}

		var lowestPrice;
		var $ = Cheerio.load(body.results_html);
		match = $(".market_listing_price.market_listing_price_with_fee");
		if (match) {
			for (var i = 0; i < match.length; i++) {
				lowestPrice = parseFloat($(match[i]).text().replace(",", ".").replace(/[^\d.]/g, ''));
				if (!isNaN(lowestPrice)) {
					self.lowestPrice = lowestPrice;
					break;
				}
			}
		}

		callback && callback(null);
	}, "steamcommunity");
};
