module.exports = CEconItem;

function CEconItem(item, description, contextID) {
	for (let thing in item) {
		this[thing] = item[thing];
	}

	let isCurrency = !!(this.is_currency || this.currency) || typeof this.currencyid !== 'undefined'; // I don't want to put this on the object yet; it's nice to have the ids at the top of printed output

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

		for (let thing in description) {
			this[thing] = description[thing];
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
		this.tags = this.tags.map((tag) => ({
			internal_name: tag.internal_name,
			name: tag.localized_tag_name || tag.name,
			category: tag.category,
			color: tag.color || '',
			category_name: tag.localized_category_name || tag.category_name
		}));
	}

	// Restore market_fee_app, if applicable
	let match;
	if (this.appid == 753 && this.contextid == 6 && this.market_hash_name && (match = this.market_hash_name.match(/^(\d+)-/))) {
		this.market_fee_app = parseInt(match[1], 10);
	}

	// Restore cache_expiration, if we can (for CS:GO items)
	if (this.appid == 730 && this.contextid == 2 && this.owner_descriptions) {
		let description = this.owner_descriptions.find(d => d.value && d.value.indexOf('Tradable After ') == 0);
		if (description) {
			let date = new Date(description.value.substring(15).replace(/[,()]/g, ''));
			if (date) {
				this.cache_expiration = date.toISOString();
			}
		}
	}

	// If we have item_expiration, also set cache_expiration to the same value
	if (this.item_expiration) {
		this.cache_expiration = this.item_expiration;
	}

	if (this.actions === '') {
		this.actions = [];
	}

	// One wouldn't think that we need this if statement, but apparently v8 has a weird bug/quirk where deleting a
	// property results in greatly increased memory usage. Because that makes sense.
	if (this.currency) {
		delete this.currency;
	}
}

CEconItem.prototype.getImageURL = function() {
	return 'https://steamcommunity-a.akamaihd.net/economy/image/' + this.icon_url + '/';
};

CEconItem.prototype.getLargeImageURL = function() {
	if (!this.icon_url_large) {
		return this.getImageURL();
	}

	return 'https://steamcommunity-a.akamaihd.net/economy/image/' + this.icon_url_large + '/';
};

CEconItem.prototype.getTag = function(category) {
	if (!this.tags) {
		return null;
	}

	for (let i = 0; i < this.tags.length; i++) {
		if (this.tags[i].category == category) {
			return this.tags[i];
		}
	}

	return null;
};
