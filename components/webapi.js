var SteamCommunity = require('../index.js');

SteamCommunity.prototype.getWebApiKey = function(domain, callback) {
	var self = this;
	this.httpRequest({
		"uri": "https://steamcommunity.com/dev/apikey?l=english",
		"followRedirect": false
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if(body.match(/<h2>Access Denied<\/h2>/)) {
			return callback(new Error("Access Denied"));
		}

		if(body.match(/You must have a validated email address to create a Steam Web API key./)) {
			return callback(new Error("You must have a validated email address to create a Steam Web API key."));
		}

		var match = body.match(/<p>Key: ([0-9A-F]+)<\/p>/);
		if(match) {
			// We already have an API key registered
			callback(null, match[1]);
		} else {
			// We need to register a new API key
			self.httpRequestPost('https://steamcommunity.com/dev/registerkey?l=english', {
				"form": {
					"domain": domain,
					"agreeToTerms": "agreed",
					"sessionid": self.getSessionID(),
					"Submit": "Register"
				}
			}, function(err, response, body) {
				if (err) {
					callback(err);
					return;
				}

				self.getWebApiKey(domain, callback);
			}, "steamcommunity");
		}
	}, "steamcommunity");
};

/**
 * @deprecated No longer works if not logged in via mobile login. Will be removed in a future release.
 * @param {function} callback
 */
SteamCommunity.prototype.getWebApiOauthToken = function(callback) {
	if (this.oAuthToken) {
		return callback(null, this.oAuthToken);
	}

	callback(new Error('This operation requires an OAuth token, which can only be obtained from node-steamcommunity\'s `login` method.'));
};
