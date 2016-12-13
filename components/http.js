var SteamCommunity = require('../index.js');

SteamCommunity.prototype.httpRequest = function(uri, options, callback, source) {
	if (typeof uri === 'object') {
		source = callback;
		callback = options;
		options = uri;
		uri = options.url || options.uri;
	} else if (typeof options === 'function') {
		source = callback;
		callback = options;
		options = {};
	}

	options.url = options.uri = uri;

	if (this._httpRequestConvenienceMethod) {
		options.method = this._httpRequestConvenienceMethod;
		delete this._httpRequestConvenienceMethod;
	}

	var requestID = ++this._httpRequestID;
	source = source || "";

	var self = this;
	var continued = false;

	if (!this.onPreHttpRequest || !this.onPreHttpRequest(requestID, source, options, continueRequest)) {
		// No pre-hook, or the pre-hook doesn't want to delay the request.
		continueRequest(null);
	}

	function continueRequest(err) {
		if (continued) {
			return;
		}

		continued = true;

		if (err) {
			if (callback) {
				callback(err);
			}

			return;
		}

		self.request(options, function (err, response, body) {
			var hasCallback = !!callback;
			var httpError = options.checkHttpError !== false && self._checkHttpError(err, response, callback, body);
			var communityError = !options.json && options.checkCommunityError !== false && self._checkCommunityError(body, httpError ? function () {} : callback); // don't fire the callback if hasHttpError did it already
			var tradeError = !options.json && options.checkTradeError !== false && self._checkTradeError(body, httpError || communityError ? function () {} : callback); // don't fire the callback if either of the previous already did
			var jsonError = options.json && options.checkJsonError !== false && !body ? new Error("Malformed JSON response") : null;

			self.emit('postHttpRequest', requestID, source, options, httpError || communityError || tradeError || jsonError || null, response, body, {
				"hasCallback": hasCallback,
				"httpError": httpError,
				"communityError": communityError,
				"tradeError": tradeError,
				"jsonError": jsonError
			});

			if (hasCallback && !(httpError || communityError || tradeError)) {
				if (jsonError) {
					callback.call(self, jsonError, response);
				} else {
					callback.apply(self, arguments);
				}
			}
		});
	}
};

SteamCommunity.prototype.httpRequestGet = function() {
	this._httpRequestConvenienceMethod = "GET";
	return this.httpRequest.apply(this, arguments);
};

SteamCommunity.prototype.httpRequestPost = function() {
	this._httpRequestConvenienceMethod = "POST";
	return this.httpRequest.apply(this, arguments);
};

SteamCommunity.prototype._notifySessionExpired = function(err) {
	this.emit('sessionExpired', err);
};

SteamCommunity.prototype._checkHttpError = function(err, response, callback, body) {
	if (err) {
		callback(err, response, body);
		return err;
	}

	if (response.statusCode >= 300 && response.statusCode <= 399 && response.headers.location.indexOf('/login') != -1) {
		err = new Error("Not Logged In");
		callback(err, response, body);
		this._notifySessionExpired(err);
		return err;
	}

	if (response.statusCode == 403 && response.body && response.body.match(/<div id="parental_notice_instructions">Enter your PIN below to exit Family View.<\/div>/)) {
		err = new Error("Family View Restricted");
		callback(err, response, body);
		return err;
	}

	if (response.statusCode >= 400) {
		err = new Error("HTTP error " + response.statusCode);
		err.code = response.statusCode;
		callback(err, response, body);
		return err;
	}

	return false;
};

SteamCommunity.prototype._checkCommunityError = function(html, callback) {
	var err;

	if(typeof html === 'string' && html.match(/<h1>Sorry!<\/h1>/)) {
		var match = html.match(/<h3>(.+)<\/h3>/);
		err = new Error(match ? match[1] : "Unknown error occurred");
		callback(err);
		return err;
	}

	if (typeof html === 'string' && html.match(/g_steamID = false;/) && html.match(/<h1>Sign In<\/h1>/)) {
		err = new Error("Not Logged In");
		callback(err);
		this._notifySessionExpired(err);
		return err;
	}

	return false;
};

SteamCommunity.prototype._checkTradeError = function(html, callback) {
	if (typeof html !== 'string') {
		return false;
	}

	var match = html.match(/<div id="error_msg">\s*([^<]+)\s*<\/div>/);
	if (match) {
		var err = new Error(match[1].trim());
		callback(err);
		return err;
	}

	return false;
};
