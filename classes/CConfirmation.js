const StdLib = require('@doctormckay/stdlib');

const SteamCommunity = require('../index.js');

module.exports = CConfirmation;

function CConfirmation(community, data) {
	Object.defineProperty(this, '_community', {value: community});

	this.id = data.id.toString();
	this.type = data.type;
	this.creator = data.creator.toString();
	this.key = data.key;
	this.title = data.title;
	this.receiving = data.receiving;
	this.sending = data.sending;
	this.time = data.time;
	this.timestamp = data.timestamp;
	this.icon = data.icon;
	this.offerID = this.type == SteamCommunity.ConfirmationType.Trade ? this.creator : null;
}

/**
 * @param {number} time
 * @param {string} key
 * @param {function} [callback]
 * @return Promise<{offerID: number}>
 */
CConfirmation.prototype.getOfferID = function(time, key, callback) {
	return StdLib.Promises.callbackPromise(['offerID'], null, false, async (resolve, reject) => {
		if (this.type && this.creator) {
			if (this.type != SteamCommunity.ConfirmationType.Trade) {
				return reject(new Error('Not a trade confirmation'));
			}

			return resolve({offerID: this.creator});
		}

		return await this._community.getConfirmationOfferID(this.id, time, key, callback);
	});
};

/**
 * @param {number} time
 * @param {string} key
 * @param {boolean} accept
 * @param {function} [callback]
 * @return Promise<void>
 */
CConfirmation.prototype.respond = function(time, key, accept, callback) {
	return this._community.respondToConfirmation(this.id, this.key, time, key, accept, callback);
};
