const SteamCommunity = require('../index.js');

SteamCommunity.prototype.getWebApiKey = function(domain, callback) {
	this.httpRequest({
		uri: 'https://steamcommunity.com/dev/apikey?l=english',
		followRedirect: false
	}, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (body.includes('<h2>Access Denied</h2>')) {
			return callback(new Error('Access Denied'));
		}

		if (body.includes('You must have a validated email address to create a Steam Web API key.')) {
			return callback(new Error('You must have a validated email address to create a Steam Web API key.'));
		}

		let match = body.match(/<p>Key: ([0-9A-F]+)<\/p>/);
		if (match) {
			// We already have an API key registered
			callback(null, match[1]);
		} else {
			// We need to register a new API key
			this.httpRequestPost('https://steamcommunity.com/dev/registerkey?l=english', {
				form: {
					domain,
					agreeToTerms: 'agreed',
					sessionid: this.getSessionID(),
					Submit: 'Register'
				}
			}, (err, response, body) => {
				if (err) {
					callback(err);
					return;
				}

				this.getWebApiKey(domain, callback);
			}, 'steamcommunity');
		}
	}, 'steamcommunity');
};
