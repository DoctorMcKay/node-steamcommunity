var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');

var CConfirmation = require('../classes/CConfirmation.js');

SteamCommunity.prototype.getConfirmations = function(time, key, callback) {
	var self = this;

	request(this, "conf", key, time, "conf", null, false, function(err, body) {
		if(err) {
			callback(err);
		}

		var $ = Cheerio.load(body);
		var empty = $('#mobileconf_empty');
		if(empty.length > 0) {
			if(!$(empty).hasClass('mobileconf_done')) {
				// An error occurred
				callback(new Error(empty.find('div:nth-of-type(2)').text()));
			} else {
				callback(null, []);
			}

			return;
		}

		// We have something to confirm
		var confirmations = $('#mobileconf_list');
		if(!confirmations) {
			callback(new Error("Malformed response"));
			return;
		}

		var confs = [];
		Array.prototype.forEach.call(confirmations.find('.mobileconf_list_entry'), function(conf) {
			conf = $(conf);

			var img = conf.find('.mobileconf_list_entry_icon img');
			confs.push(new CConfirmation(self, {
				"id": conf.data('confid'),
				"key": conf.data('key'),
				"title": conf.find('.mobileconf_list_entry_description>div:nth-of-type(1)').text().trim(),
				"receiving": conf.find('.mobileconf_list_entry_description>div:nth-of-type(2)').text().trim(),
				"time": conf.find('.mobileconf_list_entry_description>div:nth-of-type(3)').text().trim(),
				"icon": img.length < 1 ? '' : $(img).attr('src')
			}));
		});

		callback(null, confs);
	});
};

SteamCommunity.prototype.getConfirmationOfferID = function(confID, time, key, callback) {
	request(this, "details/" + confID, key, time, "details", null, true, function(err, body) {
		if(err) {
			callback(err);
		}

		if(!body.success) {
			callback(new Error("Cannot load confirmation details"));
			return;
		}

		var $ = Cheerio.load(body.html);
		var offer = $('.tradeoffer');
		if(offer.length < 1) {
			callback(null, null);
			return;
		}

		callback(null, offer.attr('id').split('_')[1]);
	});
};

SteamCommunity.prototype.respondToConfirmation = function(confID, confKey, time, key, accept, callback) {
	request(this, "ajaxop", key, time, accept ? "allow" : "cancel", {
		"op": accept ? "allow" : "cancel",
		"cid": confID,
		"ck": confKey
	}, true, function(err, body) {
		if(!callback) {
			return;
		}

		if(err) {
			callback(err);
			return;
		}

		if(body.success) {
			callback(null);
			return;
		}

		if(body.message) {
			callback(new Error(body.message));
			return;
		}

		callback(new Error("Could not act on confirmation"));
	});
};

function request(community, url, key, time, tag, params, json, callback) {
	params = params || {};
	params.p = "android:" + Date.now();
	params.a = community.steamID.getSteamID64();
	params.k = key;
	params.t = time;
	params.m = "android";
	params.tag = tag;

	community.request.get({
		"uri": "https://steamcommunity.com/mobileconf/" + url,
		"qs": params,
		"json": !!json
	}, function(err, response, body) {
		if(community._checkHttpError(err, response, callback)) {
			return;
		}

		callback(null, body);
	});
}
