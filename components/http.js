const {HttpResponse} = require('@doctormckay/stdlib/http'); // eslint-disable-line

const SteamCommunity = require('../index.js');

/**
 * @param {object} options
 * @param {string} options.method
 * @param {string} options.url
 * @param {string} [options.source='']
 * @param {object} [options.qs]
 * @param {*} [options.body]
 * @param {object} [options.form]
 * @param {object} [options.multipartForm]
 * @param {boolean} [options.json=false] - Controls whether the *REQUEST* should be sent as json.
 * @param {boolean} [options.followRedirect=true]
 * @param {boolean} [options.checkHttpError=true]
 * @param {boolean} [options.checkCommunityError=true]
 * @param {boolean} [options.checkTradeError=true]
 * @param {boolean} [options.checkJsonError=true]
 * @return {Promise<HttpResponse>}
 */
SteamCommunity.prototype.httpRequest = function(options) {
	return new Promise((resolve, reject) => {
		let requestID = ++this._httpRequestID;
		let source = options.source || '';

		let continued = false;

		let continueRequest = async (err) => {
			if (continued) {
				return;
			}

			continued = true;

			if (err) {
				return reject(err);
			}

			/** @var {HttpResponse} result */
			let result;

			try {
				result = await this._httpClient.request({
					method: options.method,
					url: options.url,
					queryString: options.qs,
					headers: options.headers,
					body: options.body,
					urlEncodedForm: options.form,
					multipartForm: options.multipartForm,
					json: options.json,
					followRedirects: options.followRedirect
				});
			} catch (ex) {
				return reject(ex);
			}

			let httpError = options.checkHttpError !== false && this._checkHttpError(result);
			let communityError = !options.json && options.checkCommunityError !== false && this._checkCommunityError(result);
			let tradeError = !options.json && options.checkTradeError !== false && this._checkTradeError(result);
			let jsonError = options.json && options.checkJsonError !== false && !result.jsonBody ? new Error('Malformed JSON response') : null;

			this.emit('postHttpRequest', {
				requestID,
				source,
				options,
				response: result,
				body: result.textBody,
				error: httpError || communityError || tradeError || jsonError || null,
				httpError,
				communityError,
				tradeError,
				jsonError
			});

			resolve(result);
		};

		if (!this.onPreHttpRequest || !this.onPreHttpRequest(requestID, source, options, continueRequest)) {
			// No pre-hook, or the pre-hook doesn't want to delay the request.
			continueRequest(null);
		}
	});
};

/**
 * @param {string|object} endpoint
 * @param {object} [form]
 * @private
 */
SteamCommunity.prototype._myProfile = async function(endpoint, form) {
	if (!this._profileURL) {
		let result = await this.httpRequest({
			method: 'GET',
			url: 'https://steamcommunity.com/my',
			followRedirect: false,
			source: 'steamcommunity'
		});

		if (result.statusCode != 302) {
			throw new Error(`HTTP error ${result.statusCode}`);
		}

		let match = result.headers.location.match(/steamcommunity\.com(\/(id|profiles)\/[^/]+)\/?/);
		if (!match) {
			throw new Error('Can\'t get profile URL');
		}

		this._profileURL = match[1];
		setTimeout(() => {
			delete this._profileURL; // delete the cache
		}, 60000).unref();
	}

	let options = endpoint.endpoint ? endpoint : {};
	options.url = `https://steamcommunity.com${this._profileURL}/${endpoint.endpoint || endpoint}`;
	options.followRedirect = true;

	if (form) {
		options.method = 'POST';
		options.form = form;
	} else if (!options.method) {
		options.method = 'GET';
	}

	options.source = 'steamcommunity';

	return await this.httpRequest(options);
};

SteamCommunity.prototype._notifySessionExpired = function(err) {
	this.emit('sessionExpired', err);
};

/**
 * @param {HttpResponse} response
 * @return {Error|boolean}
 * @private
 */
SteamCommunity.prototype._checkHttpError = function(response) {
	if (response.statusCode >= 300 && response.statusCode <= 399 && response.headers.location.indexOf('/login') != -1) {
		let err = new Error('Not Logged In');
		this._notifySessionExpired(err);
		return err;
	}

	if (
		response.statusCode == 403
		&& typeof response.textBody == 'string'
		&& response.textBody.match(/<div id="parental_notice_instructions">Enter your PIN below to exit Family View.<\/div>/)
	) {
		return new Error('Family View Restricted');
	}

	if (response.statusCode >= 400) {
		let err = new Error(`HTTP error ${response.statusCode}`);
		err.code = response.statusCode;
		return err;
	}

	return false;
};

/**
 * @param {HttpResponse} response
 * @return {Error|boolean}
 * @private
 */
SteamCommunity.prototype._checkCommunityError = function(response) {
	let html = response.textBody;

	if (typeof html == 'string' && html.match(/<h1>Sorry!<\/h1>/)) {
		let match = html.match(/<h3>(.+)<\/h3>/);
		return new Error(match ? match[1] : 'Unknown error occurred');
	}

	if (typeof html == 'string' && html.indexOf('g_steamID = false;') > -1 && html.indexOf('<title>Sign In</title>') > -1) {
		let err = new Error('Not Logged In');
		this._notifySessionExpired(err);
		return err;
	}

	return false;
};

/**
 * @param {HttpResponse} response
 * @return {Error|boolean}
 * @private
 */
SteamCommunity.prototype._checkTradeError = function(response) {
	let html = response.textBody;

	if (typeof html !== 'string') {
		return false;
	}

	let match = html.match(/<div id="error_msg">\s*([^<]+)\s*<\/div>/);
	if (match) {
		return new Error(match[1].trim());
	}

	return false;
};
