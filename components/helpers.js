exports.isSteamID = function(input) {
	var keys = Object.keys(input);
	if (keys.length != 4) {
		return false;
	}

	// Make sure it has the keys we expect
	keys = keys.filter(function(item) {
		return ['universe', 'type', 'instance', 'accountid'].indexOf(item) != -1;
	});

	return keys.length == 4;
};

exports.decodeSteamTime = function(time) {
	var parts = time.split('@');
	if (!parts[0].match(/,/)) {
		// no year, assume current year
		parts[0] += ", " + (new Date()).getFullYear();
	}

	return new Date(parts.join('@').replace(/(am|pm)/, ' $1') + " UTC"); // add a space so JS can decode it
};
