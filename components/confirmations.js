const Cheerio = require('cheerio');
const SteamTotp = require('steam-totp');

const SteamCommunity = require('../index.js');

const CConfirmation = require('../classes/CConfirmation.js');
var EConfirmationType = require('../resources/EConfirmationType.js');

/**
 * Get a list of your account's currently outstanding confirmations.
 * @param {int} time - The unix timestamp with which the following key was generated
 * @param {string} key - The confirmation key that was generated using the preceeding time and the tag 'conf' (this key can be reused)
 * @param {SteamCommunity~getConfirmations} callback - Called when the list of confirmations is received
 */
SteamCommunity.prototype.getConfirmations = function(time, key, callback) {
	var self = this;

	// Ugly hack to maintain backward compatibility
	var tag = 'conf';
	if (typeof key == 'object') {
		tag = key.tag;
		key = key.key;
	}

	// The official Steam app uses the tag 'list', but 'conf' still works so let's use that for backward compatibility.
	request(this, 'getlist', key, time, tag, null, true, function(err, body) {
		if (err) {
			callback(err);
			return;
		}

		if (!body.success) {
			if (body.needauth) {
				var err = new Error('Not Logged In');
				self._notifySessionExpired(err);
				callback(err);
				return;
			}

			callback(new Error(body.message || body.detail || 'Failed to get confirmation list'));
			return;
		}

		var confs = (body.conf || []).map(conf => new CConfirmation(self, {
			id: conf.id,
			type: conf.type,
			creator: conf.creator_id,
			key: conf.nonce,
			title: `${conf.type_name || 'Confirm'} - ${conf.headline || ''}`,
			receiving: conf.type == EConfirmationType.Trade ? ((conf.summary || [])[1] || '') : '',
			sending: (conf.summary || [])[0] || '',
			time: (new Date(conf.creation_time * 1000)).toISOString(), // for backward compatibility
			timestamp: new Date(conf.creation_time * 1000),
			icon: conf.icon || ''
		}));

		callback(null, confs);
	});
};

/**
 * @callback SteamCommunity~getConfirmations
 * @param {Error|null} err - An Error object on failure, or null on success
 * @param {CConfirmation[]} [confirmations] - An array of CConfirmation objects
 */

/**
 * Get the trade offer ID associated with a particular confirmation
 * @param {int} confID - The ID of the confirmation in question
 * @param {int} time - The unix timestamp with which the following key was generated
 * @param {string} key - The confirmation key that was generated using the preceeding time and the tag "detail" (this key can be reused)
 * @param {SteamCommunity~getConfirmationOfferID} callback
 */
SteamCommunity.prototype.getConfirmationOfferID = function(confID, time, key, callback) {
	// The official Steam app uses the tag 'detail', but 'details' still works so let's use that for backward compatibility
	request(this, 'detailspage/' + confID, key, time, 'details', null, false, function(err, body) {
		if (err) {
			callback(err);
			return;
		}

		if (typeof body != 'string') {
			callback(new Error('Cannot load confirmation details'));
			return;
		}

		let $ = Cheerio.load(body);
		let offer = $('.tradeoffer');
		if (offer.length < 1) {
			callback(null, null);
			return;
		}

		callback(null, offer.attr('id').split('_')[1]);
	});
};

/**
 * @callback SteamCommunity~getConfirmationOfferID
 * @param {Error|null} err - An Error object on failure, or null on success
 * @param {string} offerID - The trade offer ID associated with the specified confirmation, or null if not for an offer
 */

/**
 * Confirm or cancel a given confirmation.
 * @param {int|int[]|string|string[]} confID - The ID of the confirmation in question, or an array of confirmation IDs
 * @param {string|string[]} confKey - The confirmation key associated with the confirmation in question (or an array of them) (not a TOTP key, the `key` property of CConfirmation)
 * @param {int} time - The unix timestamp with which the following key was generated
 * @param {string} key - The confirmation key that was generated using the preceding time and the tag "allow" (if accepting) or "cancel" (if not accepting)
 * @param {boolean} accept - true if you want to accept the confirmation, false if you want to cancel it
 * @param {SteamCommunity~genericErrorCallback} callback - Called when the request is complete
 */
SteamCommunity.prototype.respondToConfirmation = function(confID, confKey, time, key, accept, callback) {
	// Ugly hack to maintain backward compatibility
	var tag = accept ? 'allow' : 'cancel';
	if (typeof key == 'object') {
		tag = key.tag;
		key = key.key;
	}

	// The official app uses tags reject/accept, but cancel/allow still works so use these for backward compatibility
	request(this, (confID instanceof Array) ? 'multiajaxop' : 'ajaxop', key, time, tag, {
		op: accept ? 'allow' : 'cancel',
		cid: confID,
		ck: confKey
	}, true, function(err, body) {
		if (!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if (body.success) {
			callback(null);
			return;
		}

		if (body.message) {
			callback(new Error(body.message));
			return;
		}

		callback(new Error('Could not act on confirmation'));
	});
};

/**
 * Accept a confirmation for a given object (trade offer or market listing) automatically.
 * @param {string} identitySecret
 * @param {number|string} objectID
 * @param {SteamCommunity~genericErrorCallback} callback
 */
SteamCommunity.prototype.acceptConfirmationForObject = function(identitySecret, objectID, callback) {
	this._usedConfTimes = this._usedConfTimes || [];

	let doConfirmation = () => {
		let offset = this._timeOffset;
		let time = SteamTotp.time(offset);
		this.getConfirmations(time, SteamTotp.getConfirmationKey(identitySecret, time, 'conf'), (err, confs) => {
			if (err) {
				callback(err);
				return;
			}

			let conf = confs.find(conf => conf.creator == objectID);
			if (!conf) {
				callback(new Error('Could not find confirmation for object ' + objectID));
				return;
			}

			// make sure we don't reuse the same time
			let localOffset = 0;
			do {
				time = SteamTotp.time(offset) + localOffset++;
			} while (this._usedConfTimes.indexOf(time) != -1);

			this._usedConfTimes.push(time);
			if (this._usedConfTimes.length > 60) {
				this._usedConfTimes.splice(0, this._usedConfTimes.length - 60); // we don't need to save more than 60 entries
			}

			conf.respond(time, SteamTotp.getConfirmationKey(identitySecret, time, 'allow'), true, callback);
		});
	};

	if (typeof this._timeOffset !== 'undefined') {
		// time offset is already known and saved
		doConfirmation();
	} else {
		SteamTotp.getTimeOffset((err, offset) => {
			if (err) {
				callback(err);
				return;
			}

			this._timeOffset = offset;
			doConfirmation();

			setTimeout(() => {
				// Delete the saved time offset after 12 hours because why not
				delete this._timeOffset;
			}, 1000 * 60 * 60 * 12).unref();
		});
	}
};

/**
 * Send a single request to Steam to accept all outstanding confirmations (after loading the list). If one fails, the
 * entire request will fail and there will be no way to know which failed without loading the list again.
 * @param {number} time
 * @param {string} confKey
 * @param {string} allowKey
 * @param {function} callback
 */
SteamCommunity.prototype.acceptAllConfirmations = function(time, confKey, allowKey, callback) {
	this.getConfirmations(time, confKey, (err, confs) => {
		if (err) {
			callback(err);
			return;
		}

		if (confs.length == 0) {
			callback(null, []);
			return;
		}

		this.respondToConfirmation(confs.map(conf => conf.id), confs.map(conf => conf.key), time, allowKey, true, (err) => {
			if (err) {
				callback(err);
				return;
			}

			callback(err, confs);
		});
	});
};

function request(community, url, key, time, tag, params, json, callback) {
	if (!community.steamID) {
		throw new Error('Must be logged in before trying to do anything with confirmations');
	}

	params = params || {};
	params.p = SteamTotp.getDeviceID(community.steamID);
	params.a = community.steamID.getSteamID64();
	params.k = key;
	params.t = time;
	params.m = 'react';
	params.tag = tag;

	let req = {
		method: url == 'multiajaxop' ? 'POST' : 'GET',
		uri: 'https://steamcommunity.com/mobileconf/' + url,
		json: !!json
	};

	if (req.method == 'GET') {
		req.qs = params;
	} else {
		req.form = params;
	}

	community.httpRequest(req, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		callback(null, body);
	}, 'steamcommunity');
}
