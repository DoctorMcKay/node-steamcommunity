var SteamCommunity = require('../index.js');

SteamCommunity.prototype.getWebApiKey = function(domain, callback) {
	var self = this;
	this.request({
		"uri": "https://steamcommunity.com/dev/apikey",
		"followRedirect": false
	}, function(err, response, body) {
		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		if(body.match(/<h2>Access Denied<\/h2>/)) {
			return callback(new Error("Access Denied"));
		}

		var match = body.match(/<p>Key: ([0-9A-F]+)<\/p>/);
		if(match) {
			// We already have an API key registered
			callback(null, match[1]);
		} else {
			// We need to register a new API key
			self.request.post('https://steamcommunity.com/dev/registerkey', {
				"form": {
					"domain": domain,
					"agreeToTerms": "agreed",
					"sessionid": self.getSessionID(),
					"Submit": "Register"
				}
			}, function(err, response, body) {
				if(self._checkHttpError(err, response, callback)) {
					return;
				}

				self.getWebApiKey(domain, callback);
			});
		}
	});
};

SteamCommunity.prototype.getWebApiOauthToken = function(callback) {
	var self = this;

	if( this.oAuthToken ) {
		return callback( null, this.oAuthToken );
	}

	// Pull an oauth token from the webchat UI
	this.request("https://steamcommunity.com/chat", function(err, response, body) {
		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		if(self._checkCommunityError(body, callback)) {
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
