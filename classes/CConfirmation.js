var SteamCommunity = require('../index.js');

module.exports = CConfirmation;

function CConfirmation(community, data) {
	Object.defineProperty(this, "_community", {"value": community});

	this.id = data.id;
	this.type = data.type;
	this.creator = data.creator;
	this.key = data.key;
	this.title = data.title;
	this.receiving = data.receiving;
	this.time = data.time;
	this.icon = data.icon;
	this.offerID = this.type == SteamCommunity.ConfirmationType.Trade ? this.creator : null;
}

CConfirmation.prototype.getOfferID = function(time, key, callback) {
	if (this.type && this.creator) {
		if (this.type != SteamCommunity.ConfirmationType.Trade) {
			callback(new Error("Not a trade confirmation"));
			return;
		}

		callback(null, this.creator);
		return;
	}

	this._community.getConfirmationOfferID(this.id, time, key, callback);
};

CConfirmation.prototype.respond = function(time, key, accept, callback) {
	this._community.respondToConfirmation(this.id, this.key, time, key, accept, callback);
};
