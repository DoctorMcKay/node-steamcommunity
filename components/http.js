var SteamCommunity = require('../index.js');

SteamCommunity.prototype.httpRequest = function(uri, options, callback, source) {
	if (typeof uri === 'object') {
		source = callback;
		callback = options;
		options = uri;
		uri = options.url || options.uri;
	}

	options.url = options.uri = uri;

	if (this._httpRequestConvenienceMethod) {
		options.method = this._httpRequestConvenienceMethod;
		delete this._httpRequestConvenienceMethod;
	}

	var requestID = ++this._httpRequestID;
	source = source || "";

	if (this.onPreHttpRequest && this.onPreHttpRequest(requestID, source, options, callback) === false) {
		return false;
	}

	var self = this;
	this.request(options, function(err, response, body) {
		var hasCallback = !!callback;
		var httpError = options.checkHttpError !== false && self._checkHttpError(err, response, callback);
		var communityError = !options.json && options.checkCommunityError !== false && self._checkCommunityError(body, httpError ? function() {} : callback); // don't fire the callback if hasHttpError did it already
		var tradeError = !options.json && options.checkTradeError !== false && self._checkTradeError(body, httpError || communityError ? function() {} : callback); // don't fire the callback if either of the previous already did

		self.emit('postHttpRequest', requestID, source, options, httpError || communityError || tradeError || null, response, body, {
			"hasCallback": hasCallback,
			"httpError": httpError,
			"communityError": communityError,
			"tradeError": tradeError
		});

		if (hasCallback && !(httpError || communityError || tradeError)) {
			callback.apply(self, arguments);
		}
	});

	return true;
};

SteamCommunity.prototype.httpRequestGet = function() {
	this._httpRequestConvenienceMethod = "GET";
	return this.httpRequest.apply(this, arguments);
};

SteamCommunity.prototype.httpRequestPost = function() {
	this._httpRequestConvenienceMethod = "POST";
	return this.httpRequest.apply(this, arguments);
};

SteamCommunity.prototype._checkHttpError = function(err, response, callback) {
	if(err) {
		callback(err);
		return err;
	}

	if(response.statusCode >= 300 && response.statusCode <= 399 && response.headers.location.indexOf('/login') != -1) {
		err = new Error("Not Logged In");
		callback(err);
		return err;
	}

	if(response.statusCode >= 400) {
		err = new Error("HTTP error " + response.statusCode);
		err.code = response.statusCode;
		callback(err);
		return err;
	}

	return false;
};

SteamCommunity.prototype._checkCommunityError = function(html, callback) {
	if(html.match(/<h1>Sorry!<\/h1>/)) {
		var match = html.match(/<h3>(.+)<\/h3>/);
		var err = new Error(match ? match[1] : "Unknown error occurred");
		callback(err);
		return err;
	}

	return false;
};

SteamCommunity.prototype._checkTradeError = function(html, callback) {
	var match = html.match(/<div id="error_msg">\s*([^<]+)\s*<\/div>/);
	if (match) {
		var err = new Error(match[1].trim());
		callback(new Error(err));
		return err;
	}

	return false;
};
