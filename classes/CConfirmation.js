module.exports = CConfirmation;

function CConfirmation(community, data) {
	this._community = community;

	this.id = data.id;
	this.key = data.key;
	this.title = data.title;
	this.receiving = data.receiving;
	this.time = data.time;
	this.icon = data.icon;
}

CConfirmation.prototype.getOfferID = function(time, key, callback) {
	this._community.getConfirmationOfferID(this.id, time, key, callback);
};

CConfirmation.prototype.respond = function(time, key, accept, callback) {
	this._community.respondToConfirmation(this.id, this.key, time, key, accept, callback);
};
