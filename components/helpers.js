const EResult = require('../resources/EResult.js');
const request = require('request');
const xml2js  = require('xml2js');

/**
 * Make sure that a provided input is a valid SteamID object.
 * @param {object} input
 * @returns {boolean}
 */
exports.isSteamID = function(input) {
	return ['universe', 'type', 'instance', 'accountid'].every(prop => typeof input[prop] == 'number' || typeof input[prop] == 'bigint');
};

exports.decodeSteamTime = function(time) {
	let date = new Date();

	if (time.includes('@')) {
		let parts = time.split('@');
		if (!parts[0].includes(',')) {
			// no year, assume current year
			parts[0] += ', ' + date.getFullYear();
		}

		date = new Date(parts.join('@').replace(/(am|pm)/, ' $1') + ' UTC');  // add a space so JS can decode it
	} else {
		// Relative date
		let amount = time.replace(/(\d) (minutes|hour|hours) ago/, '$1');

		if (time.includes('minutes')) {
			date.setMinutes(date.getMinutes() - amount);
		} else if (time.match(/hour|hours/)) {
			date.setHours(date.getHours() - amount);
		}
	}

	return date;
};

/**
 * Get an Error object for a particular EResult
 * @param {int|EResult} eresult
 * @param {string} [message] - If eresult is a failure code and message exists, this message will be used in the Error object instead
 * @returns {null|Error}
 */
exports.eresultError = function(eresult, message) {
	if (eresult == EResult.OK) {
		// no error
		return null;
	}

	let err = new Error(message || EResult[eresult] || `Error ${eresult}`);
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