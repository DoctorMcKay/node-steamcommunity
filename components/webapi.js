var SteamCommunity = require('../index.js');

SteamCommunity.prototype.getWebApiOauthToken = function(callback) {
	var self = this;

	// Pull an oauth token from the webchat UI
	this.request("https://steamcommunity.com/chat", function(err, response, body) {
		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		var match = body.match(/"([0-9a-f]{32})"/);
		if (!match) {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, match[1]);
	});
};
