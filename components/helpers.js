const EResult = require('../resources/EResult.js');
const request = require('request');
const xml2js  = require('xml2js');

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
	var date = new Date();

	if (time.includes("@")) {
		var parts = time.split('@');
		if (!parts[0].includes(",")) {
			// no year, assume current year
			parts[0] += ", " + date.getFullYear();
		}

		date = new Date(parts.join('@').replace(/(am|pm)/, ' $1') + " UTC");  // add a space so JS can decode it
	} else {
		// Relative date
		var amount = time.replace(/(\d) (minutes|hour|hours) ago/, "$1");

		if(time.includes("minutes")) {
			date.setMinutes(date.getMinutes() - amount);
		} else if(time.match(/hour|hours/)) {
			date.setHours(date.getHours() - amount);
		}
	}

	return date;
};

/**
 * Get an Error object for a particular EResult
 * @param {int} eresult
 * @returns {null|Error}
 */
exports.eresultError = function(eresult) {
	if (eresult == EResult.OK) {
		// no error
		return null;
	}

	var err = new Error(EResult[eresult] || ("Error " + eresult));
	err.eresult = eresult;
	return err;
};

exports.decodeJwt = function(jwt) {
	let parts = jwt.split('.');
	if (parts.length != 3) {
		throw new Error('Invalid JWT');
	}

	let standardBase64 = parts[1].replace(/-/g, '+')
		.replace(/_/g, '/');

	return JSON.parse(Buffer.from(standardBase64, 'base64').toString('utf8'));
};

/**
 * Resolves a Steam profile URL to get steamID64 and vanityURL
 * @param {String} url - Full steamcommunity profile URL or only the vanity part.
 * @param {Object} callback - First argument is null/Error, second is object containing vanityURL (String) and steamID (String)
 */
exports.resolveVanityURL = function(url, callback) {
	// Precede url param if only the vanity was provided
	if (!url.includes("steamcommunity.com")) {
		url = "https://steamcommunity.com/id/" + url;
	}

	// Make request to get XML data
	request(url + "/?xml=1", function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		// Parse XML data returned from Steam into an object
		new xml2js.Parser().parseString(body, (err, parsed) => {
			if (err) {
				callback(new Error("Couldn't parse XML response"));
				return;
			}

			if (parsed.response && parsed.response.error) {
				callback(new Error("Couldn't find Steam ID"));
				return;
			}

			let steamID64 = parsed.profile.steamID64[0];
			let vanityURL = parsed.profile.customURL[0];

			callback(null, {"vanityURL": vanityURL, "steamID": steamID64});
		});
	});
};