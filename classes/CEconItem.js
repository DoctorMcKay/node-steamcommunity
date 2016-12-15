module.exports = CEconItem;

function CEconItem(item, description, contextID) {
	var thing;
	for (thing in item) {
		if (item.hasOwnProperty(thing)) {
			this[thing] = item[thing];
		}
	}

	var isCurrency = !!(this.is_currency || this.currency) || typeof this.currencyid !== 'undefined'; // I don't want to put this on the object yet; it's nice to have the ids at the top of printed output

	if (isCurrency) {
		this.currencyid = this.id = (this.id || this.currencyid);
	} else {
		this.assetid = this.id = (this.id || this.assetid);
	}

	this.instanceid = this.instanceid || '0';
	this.amount = parseInt(this.amount, 10);
	this.contextid = this.contextid || contextID.toString();

	// Merge the description
	if (description) {
		// Is this a listing of descriptions?
		if (description[this.classid + '_' + this.instanceid]) {
			description = description[this.classid + '_' + this.instanceid];
		}

		for (thing in description) {
			if (description.hasOwnProperty(thing)) {
				this[thing] = description[thing];
			}
		}
	}

	this.is_currency = isCurrency;
	this.tradable = !!this.tradable;
	this.marketable = !!this.marketable;
	this.commodity = !!this.commodity;
	this.market_tradable_restriction = (this.market_tradable_restriction ? parseInt(this.market_tradable_restriction, 10) : 0);
	this.market_marketable_restriction = (this.market_marketable_restriction ? parseInt(this.market_marketable_restriction, 10) : 0);
	this.fraudwarnings = this.fraudwarnings || [];
	this.descriptions = this.descriptions || [];

	if (this.owner && JSON.stringify(this.owner) == '{}') {
		this.owner = null;
	}

	// Restore old property names of tags
	if (this.tags) {
		this.tags = this.tags.map(function(tag) {
			return {
				"internal_name": tag.internal_name,
				"name": tag.localized_tag_name || tag.name,
				"category": tag.category,
				"color": tag.color || "",
				"category_name": tag.localized_category_name || tag.category_name
			};
		});
	}

	// Restore market_fee_app, if applicable
	var match;
	if (this.appid == 753 && this.contextid == 6 && this.market_hash_name && (match = this.market_hash_name.match(/^(\d+)\-/))) {
		this.market_fee_app = parseInt(match[1], 10);
	}

	if (this.actions === "") {
		this.actions = [];
	}

	 delete this.currency;
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
	if (!this.tags) {
		return null;
	}

	for (var i = 0; i < this.tags.length; i++) {
		if (this.tags[i].category == category) {
			return this.tags[i];
		}
	}

	return null;
};
