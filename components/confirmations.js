const Cheerio = require('cheerio');
const StdLib = require('@doctormckay/stdlib');
const SteamTotp = require('steam-totp');

const SteamCommunity = require('../index.js');

const CConfirmation = require('../classes/CConfirmation.js');
const EConfirmationType = SteamCommunity.EConfirmationType;

/**
 * Get a list of your account's currently outstanding confirmations.
 * @param {int} time - The unix timestamp with which the following key was generated
 * @param {string} key - The confirmation key that was generated using the preceeding time and the tag 'conf' (this key can be reused)
 * @param {SteamCommunity~getConfirmations} [callback] - Called when the list of confirmations is received
 * @return Promise<{confirmations: CConfirmation[]}>
 */
SteamCommunity.prototype.getConfirmations = function(time, key, callback) {
	return StdLib.Promises.callbackPromise(['confirmations'], callback, false, async (resolve, reject) => {
		let body = await request(this, 'getlist', key, time, 'list', null);

		if (!body.success) {
			if (body.needauth) {
				let err = new Error('Not Logged In');
				this._notifySessionExpired(err);
				return reject(err);
			}

			return reject(new Error(body.message || body.detail || 'Failed to get confirmation list'));
		}

		let confs = (body.conf || []).map(conf => new CConfirmation(this, {
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

		resolve({confirmations: confs});
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
 * @param {SteamCommunity~getConfirmationOfferID} [callback]
 * @return Promise<{offerID: string|null}>
 */
SteamCommunity.prototype.getConfirmationOfferID = function(confID, time, key, callback) {
	return StdLib.Promises.callbackPromise(['offerID'], callback, false, async (resolve, reject) => {
		let body = await request(this, 'detailspage/' + confID, key, time, 'detail', null);

		if (typeof body != 'string') {
			return reject(new Error('Cannot load confirmation details'));
		}

		let $ = Cheerio.load(body);
		let offer = $('.tradeoffer');
		if (offer.length < 1) {
			return resolve({offerID: null});
		}

		resolve({offerID: offer.attr('id').split('_')[1]});
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
 * @param {SteamCommunity~genericErrorCallback} [callback] - Called when the request is complete
 * @return Promise<void>
 */
SteamCommunity.prototype.respondToConfirmation = function(confID, confKey, time, key, accept, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let tag = accept ? 'accept' : 'reject';

		// The official app uses tags reject/accept, but cancel/allow still works so use these for backward compatibility
		let body = await request(this, (confID instanceof Array) ? 'multiajaxop' : 'ajaxop', key, time, tag, {
			op: accept ? 'allow' : 'cancel',
			cid: confID,
			ck: confKey
		});

		if (body.success) {
			return resolve();
		}

		reject(new Error(body.message || body.detail || 'Could not act on confirmation'));
	});
};

/**
 * Accept a confirmation for a given object (trade offer or market listing) automatically.
 * @param {string} identitySecret
 * @param {number|string} objectID
 * @param {SteamCommunity~genericErrorCallback} [callback]
 * @return Promise<void>
 */
SteamCommunity.prototype.acceptConfirmationForObject = function(identitySecret, objectID, callback) {
	this._usedConfTimes = this._usedConfTimes || [];

	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		// Figure out our time offset
		if (typeof this._timeOffset == 'undefined') {
			await new Promise((resolve) => {
				SteamTotp.getTimeOffset((err, offset) => {
					if (err) {
						// not critical that this succeeds
						return resolve();
					}

					this._timeOffset = offset;
					resolve();
				});
			});
		}

		let offset = this._timeOffset;
		let time = SteamTotp.time(offset);
		let key = SteamTotp.getConfirmationKey(identitySecret, time, 'list');
		let {confirmations} = await this.getConfirmations(time, key);

		let conf = confirmations.find(conf => conf.creator == objectID);
		if (!conf) {
			return reject(new Error(`Could not find confirmation for object ${objectID}`));
		}

		// make sure we don't reuse the same time
		let localOffset = 0;
		do {
			time = SteamTotp.time(offset) + localOffset++;
		} while (this._usedConfTimes.includes(time));

		this._usedConfTimes.push(time);
		if (this._usedConfTimes.length > 60) {
			this._usedConfTimes.splice(0, this._usedConfTimes.length - 60); // we don't need to save more than 60 entries
		}

		await conf.respond(time, SteamTotp.getConfirmationKey(identitySecret, time, 'accept'), true);
	});
};

/**
 * Send a single request to Steam to accept all outstanding confirmations (after loading the list). If one fails, the
 * entire request will fail and there will be no way to know which failed without loading the list again.
 * @param {number} time
 * @param {string} listKey
 * @param {string} acceptKey
 * @param {function} [callback]
 * @return Promise<{confirmations: CConfirmation[]}>
 */
SteamCommunity.prototype.acceptAllConfirmations = function(time, listKey, acceptKey, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let {confirmations} = await this.getConfirmations(time, listKey);

		if (confirmations.length == 0) {
			return resolve({confirmations: []});
		}

		let confIds = confirmations.map(conf => conf.id);
		let confKeys = confirmations.map(conf => conf.key);
		await this.respondToConfirmation(confIds, confKeys, time, acceptKey, true);

		resolve({confirmations});
	});
};

async function request(community, url, key, time, tag, params) {
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
		url: `https://steamcommunity.com/mobileconf/${url}`,
		source: 'steamcommunity'
	};

	if (req.method == 'GET') {
		req.qs = params;
	} else {
		req.form = params;
	}

	let result = await community.httpRequest(req);
	return result.jsonBody || result.textBody;
}
