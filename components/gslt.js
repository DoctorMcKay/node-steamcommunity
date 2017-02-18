var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');

SteamCommunity.prototype.getGSLTs = function(callback) {
	var self = this;
	this.httpRequestGet({
		"uri": "https://steamcommunity.com/dev/managegameservers?l=english",
		"followRedirect": false
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		//the webpage still loads without error
		//even if the user isn't signed in
		//so we don't need to check for access errors
		var $ = Cheerio.load(body);
		var gsltRows = $('table.gstable tbody').find('tr');
		var gslts = [];
		gsltRows.each(function (i, element) {
			var e = $(this).find('td');
			var st = $(e[4]).find('input[type="hidden"][name="steamid"]')[0]
			var steamId = $(st).attr('value');
			gslts.push({
				gameId: $(e[0]).text().trim(),
				loginToken: $(e[1]).text().trim(),
				lastLogin: $(e[2]).text().trim(),
				memo: $(e[3]).text().trim(),
				steamId
			});
		});
		callback(null, gslts);
	}, "steamcommunity");
};

SteamCommunity.prototype.createGSLT = function(appId, memo, callback){
	self.httpRequestPost('https://steamcommunity.com/dev/creategsaccount?l=english', {
		"form": {
			"appid": appId,
			"memo": memo,
			"sessionid": self.getSessionID()
		}
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if(body.match(/Failed to create account/)) {
			return callback(new Error("Failed to create account"));
		}

		callback();
	}, "steamcommunity");
};

SteamCommunity.prototype.updateGSLTMemo = function(steamId, memo, callback){
	self.httpRequestPost('https://steamcommunity.com/dev/updategsmemo?l=english', {
		"form": {
			"steamid": steamId,
			"memo": memo,
			"sessionid": self.getSessionID()
		}
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if(body.match(/Failed to set memo/)) {
			return callback(new Error("Failed to set memo"));
		}

		callback();
	}, "steamcommunity");
};

SteamCommunity.prototype.regenerateGSLTToken = function(steamId, callback){
	self.httpRequestPost('https://steamcommunity.com/dev/resetgstoken?l=english', {
		"form": {
			"steamid": steamId,
			"sessionid": self.getSessionID()
		}
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		callback();
	}, "steamcommunity");
};

SteamCommunity.prototype.deleteGSLT = function(steamId, callback) {
	self.httpRequestPost('https://steamcommunity.com/dev/deletegsaccount?l=english', {
		"form": {
			"steamid": steamId,
			"sessionid": self.getSessionID()
		}
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}
		callback();
	}, "steamcommunity");
};

