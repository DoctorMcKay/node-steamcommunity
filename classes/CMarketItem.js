var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');

SteamCommunity.prototype.getMarketItem = function(appid, hashName, callback) {
	var self = this;
	this.request("https://steamcommunity.com/market/listings/" + appid + "/" + encodeURIComponent(hashName), function(err, response, body) {
		if(self._checkHttpError(err, response, callback)) {
			return;
		}
		
		var $ = Cheerio.load(body);
		if($('.market_listing_table_message') && $('.market_listing_table_message').text().trim() == 'There are no listings for this item.') {
			callback(new Error("There are no listings for this item."));
			return;
		}
		
		var item = new CMarketItem(self, body, $);
		if(item.commodity) {
			item.updatePrice(function(err) {
				if(err) {
					callback(err);
				} else {
					callback(null, item);
				}
			});
		} else {
			callback(null, item);
		}
	});
};

function CMarketItem(community, body, $) {
	this._community = community;
	this._$ = $;
	
	this._country = "US";
	var match = body.match(/var g_strCountryCode = "([^"]+)";/);
	if(match) {
		this._country = match[1];
	}
	
	this.commodity = false;
	var match = body.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\);/);
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
	
	this.quantity = 0;
	this.lowestPrice = 0;
	
	if(!this.commodity) {
		var total = $('#searchResults_total');
		if(total) {
			this.quantity = parseInt(total.text().replace(/[^\d]/g, '').trim(), 10);
		}
		
		var lowest = $('.market_listing_price.market_listing_price_with_fee');
		if(lowest[0]) {
			this.lowestPrice = parseInt($(lowest[0]).text().replace(/[^\d]/g, '').trim(), 10);
		}
	}
	
	// TODO: Buying listings and placing buy orders
}

CMarketItem.prototype.updatePrice = function(callback) {
	if(!this.commodity) {
		throw new Error("Cannot update price for non-commodity item");
	}
	
	// TODO: Currency option maybe?
	var self = this;
	this._community.request({
		"uri": "https://steamcommunity.com/market/itemordershistogram?country=US&language=english&currency=1&item_nameid=" + this.commodityID,
		"json": true,
	}, function(err, response, body) {
		if(self._community._checkHttpError(err, response, callback)) {
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
	});
};
