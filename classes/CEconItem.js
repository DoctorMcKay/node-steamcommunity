module.exports = CEconItem;

function CEconItem(item, descriptions, contextID) {
	var thing;
	for(thing in item) {
		if(item.hasOwnProperty(thing)) {
			this[thing] = item[thing];
		}
	}

	this.assetid = this.id = (this.id || this.assetid);
	this.instanceid = this.instanceid || '0';
	this.amount = parseInt(this.amount, 10);
	this.contextid = this.contextid || contextID.toString();

	// Merge the description
	if(descriptions) {
		var description = descriptions[this.classid + '_' + this.instanceid];
		if(description) {
			for(thing in description) {
				if(description.hasOwnProperty(thing)) {
					this[thing] = description[thing];
				}
			}
		}
	}

	this.is_currency = !!this.is_currency;
	this.tradable = !!this.tradable;
	this.marketable = !!this.marketable;
	this.commodity = !!this.commodity;
	this.market_tradable_restriction = (this.market_tradable_restriction ? parseInt(this.market_tradable_restriction, 10) : 0);
	this.market_marketable_restriction = (this.market_marketable_restriction ? parseInt(this.market_marketable_restriction, 10) : 0);
	this.fraudwarnings = this.fraudwarnings || [];
	this.descriptions = this.descriptions || [];

	if(this.owner && JSON.stringify(this.owner) == '{}') {
		this.owner = null;
	}
}

CEconItem.prototype.getImageURL = function() {
	return "https://steamcommunity-a.akamaihd.net/economy/image/" + this.icon_url + "/";
};

CEconItem.prototype.getLargeImageURL = function() {
	if(!this.icon_url_large) {
		return this.getImageURL();
	}

	return "https://steamcommunity-a.akamaihd.net/economy/image/" + this.icon_url_large + "/";
};

CEconItem.prototype.getTag = function(category) {
	if(!this.tags) {
		return null;
	}

	for(var i = 0; i < this.tags.length; i++) {
		if(this.tags[i].category == category) {
			return this.tags[i];
		}
	}

	return null;
};
