var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');

SteamCommunity.prototype.marketSearch = function(options, callback) {
	var qs = {};

	if(typeof options === 'string') {
		qs.query = options;
	} else {
		qs.query = options.query || '';
		qs.appid = options.appid;
		qs.search_descriptions = options.searchDescriptions ? 1 : 0;

		if(qs.appid) {
			for(var i in options) {
				if(['query', 'appid', 'searchDescriptions'].indexOf(i) != -1) {
					continue;
				}

				// This is a tag
				qs['category_' + qs.appid + '_' + i + '[]'] = 'tag_' + options[i];
			}
		}
	}

	qs.start = 0;
	qs.count = 100;
	qs.sort_column = 'price';
	qs.sort_dir = 'asc';

	var self = this;
	var results = [];
	performSearch();

	function performSearch() {
		self.httpRequest({
			"uri": "https://steamcommunity.com/market/search/render/",
			"qs": qs,
			"headers": {
				"referer": "https://steamcommunity.com/market/search"
			},
			"json": true
		}, function(err, response, body) {
			if (err) {
				callback(err);
				return;
			}

			if(!body.success) {
				callback(new Error("Success is not true"));
				return;
			}

			if(!body.results_html) {
				callback(new Error("No results_html in response"));
				return;
			}

			var $ = Cheerio.load(body.results_html);
			var $errorMsg = $('.market_listing_table_message');
			if($errorMsg.length > 0) {
				callback(new Error($errorMsg.text()));
				return;
			}

			var rows = $('.market_listing_row_link');
			for(var i = 0; i < rows.length; i++) {
				results.push(new CMarketSearchResult($(rows[i])));
			}

			if(body.start + body.pagesize >= body.total_count) {
				callback(null, results);
			} else {
				qs.start += body.pagesize;
				performSearch();
			}
		}, "steamcommunity");
	}
};

function CMarketSearchResult(row) {
	var match = row.attr('href').match(/\/market\/listings\/(\d+)\/([^\?\/]+)/);

	this.appid = parseInt(match[1], 10);
	this.market_hash_name = decodeURIComponent(match[2]);
	this.image = ((row.find('.market_listing_item_img').attr('src') || "").match(/^https?:\/\/[^\/]+\/economy\/image\/[^\/]+\//) || [])[0];
	this.price = parseInt(row.find('.market_listing_their_price .market_table_value span.normal_price').text().replace(/[^\d]+/g, ''), 10);
	this.quantity = parseInt(row.find('.market_listing_num_listings_qty').text().replace(/[^\d]+/g, ''), 10);
}
