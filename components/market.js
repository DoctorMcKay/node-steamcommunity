var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');

SteamCommunity.prototype.getMarketApps = function(callback) {
	var self = this;
	this.httpRequest('https://steamcommunity.com/market/', function (err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		var $ = Cheerio.load(body);
		if ($('.market_search_game_button_group')) {
			apps = {};
			$('.market_search_game_button_group > a').each(function (i, element) {
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
