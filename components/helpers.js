const EResult = require('../resources/EResult.js');

exports.isSteamID = function(input) {
	let keys = Object.keys(input);
	if (keys.length != 4) {
		return false;
	}

	// Make sure it has the keys we expect
	keys.sort();
	return keys.join(',') == 'accountid,instance,type,universe';
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
