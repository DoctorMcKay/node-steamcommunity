var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');
var SteamTotp = require('steam-totp');
var Async = require('async');

var CConfirmation = require('../classes/CConfirmation.js');

/**
 * Get a list of your account's currently outstanding confirmations.
 * @param {int} time - The unix timestamp with which the following key was generated
 * @param {string} key - The confirmation key that was generated using the preceeding time and the tag "conf" (this key can be reused)
 * @param {SteamCommunity~getConfirmations} callback - Called when the list of confirmations is received
 */
SteamCommunity.prototype.getConfirmations = function(time, key, callback) {
	var self = this;

	request(this, "conf", key, time, "conf", null, false, function(err, body) {
		if(err) {
			if (err.message == "Invalid protocol: steammobile:") {
				err.message = "Not Logged In";
				self._notifySessionExpired(err);
			}

			callback(err);
			return;
		}

		var $ = Cheerio.load(body);
		var empty = $('#mobileconf_empty');
		if(empty.length > 0) {
			if(!$(empty).hasClass('mobileconf_done')) {
				// An error occurred
				callback(new Error(empty.find('div:nth-of-type(2)').text()));
			} else {
				callback(null, []);
			}

			return;
		}

		// We have something to confirm
		var confirmations = $('#mobileconf_list');
		if(!confirmations) {
			callback(new Error("Malformed response"));
			return;
		}

		var confs = [];
		Array.prototype.forEach.call(confirmations.find('.mobileconf_list_entry'), function(conf) {
			conf = $(conf);

			var img = conf.find('.mobileconf_list_entry_icon img');
			confs.push(new CConfirmation(self, {
				"id": conf.data('confid'),
				"type": conf.data('type'),
				"creator": conf.data('creator'),
				"key": conf.data('key'),
				"title": conf.find('.mobileconf_list_entry_description>div:nth-of-type(1)').text().trim(),
				"receiving": conf.find('.mobileconf_list_entry_description>div:nth-of-type(2)').text().trim(),
				"time": conf.find('.mobileconf_list_entry_description>div:nth-of-type(3)').text().trim(),
				"icon": img.length < 1 ? '' : $(img).attr('src')
			}));
		});

		callback(null, confs);
	});
};

/**
 * @callback SteamCommunity~getConfirmations
 * @param {Error|null} err - An Error object on failure, or null on success
 * @param {CConfirmation[]} confirmations - An array of CConfirmation objects
 */

/**
 * Get the trade offer ID associated with a particular confirmation
 * @param {int} confID - The ID of the confirmation in question
 * @param {int} time - The unix timestamp with which the following key was generated
 * @param {string} key - The confirmation key that was generated using the preceeding time and the tag "details" (this key can be reused)
 * @param {SteamCommunity~getConfirmationOfferID} callback
 */
SteamCommunity.prototype.getConfirmationOfferID = function(confID, time, key, callback) {
	request(this, "details/" + confID, key, time, "details", null, true, function(err, body) {
		if(err) {
			callback(err);
			return;
		}

		if(!body.success) {
			callback(new Error("Cannot load confirmation details"));
			return;
		}

		var $ = Cheerio.load(body.html);
		var offer = $('.tradeoffer');
		if(offer.length < 1) {
			callback(null, null);
			return;
		}

		callback(null, offer.attr('id').split('_')[1]);
	});
};

/**
 * @callback SteamCommunity~getConfirmationOfferID
 * @param {Error|null} err - An Error object on failure, or null on success
 * @param {string} offerID - The trade offer ID associated with the specified confirmation, or null if not for an offer
 */

/**
 * Confirm or cancel a given confirmation.
 * @param {int|int[]} confID - The ID of the confirmation in question, or an array of confirmation IDs
 * @param {string|string[]} confKey - The confirmation key associated with the confirmation in question (or an array of them) (not a TOTP key, the `key` property of CConfirmation)
 * @param {int} time - The unix timestamp with which the following key was generated
 * @param {string} key - The confirmation key that was generated using the preceding time and the tag "allow" (if accepting) or "cancel" (if not accepting)
 * @param {boolean} accept - true if you want to accept the confirmation, false if you want to cancel it
 * @param {SteamCommunity~genericErrorCallback} callback - Called when the request is complete
 */
SteamCommunity.prototype.respondToConfirmation = function(confID, confKey, time, key, accept, callback) {
	request(this, (confID instanceof Array) ? "multiajaxop" : "ajaxop", key, time, accept ? "allow" : "cancel", {
		"op": accept ? "allow" : "cancel",
		"cid": confID,
		"ck": confKey
	}, true, function(err, body) {
		if(!callback) {
			return;
		}

		if(err) {
			callback(err);
			return;
		}

		if(body.success) {
			callback(null);
			return;
		}

		if(body.message) {
			callback(new Error(body.message));
			return;
		}

		callback(new Error("Could not act on confirmation"));
	});
};

/**
 * Accept a confirmation for a given object (trade offer or market listing) automatically.
 * @param {string} identitySecret
 * @param {number|string} objectID
 * @param {SteamCommunity~genericErrorCallback} callback
 */
SteamCommunity.prototype.acceptConfirmationForObject = function(identitySecret, objectID, callback) {
	var self = this;
	this._usedConfTimes = this._usedConfTimes || [];

	if (typeof this._timeOffset !== 'undefined') {
		// time offset is already known and saved
		doConfirmation();
	} else {
		SteamTotp.getTimeOffset(function(err, offset) {
			if (err) {
				callback(err);
				return;
			}

			self._timeOffset = offset;
			doConfirmation();

			setTimeout(function() {
				// Delete the saved time offset after 12 hours because why not
				delete self._timeOffset;
			}, 1000 * 60 * 60 * 12).unref();
		});
	}

	function doConfirmation() {
		var offset = self._timeOffset;
		var time = SteamTotp.time(offset);
		self.getConfirmations(time, SteamTotp.getConfirmationKey(identitySecret, time, "conf"), function(err, confs) {
			if (err) {
				callback(err);
				return;
			}

			var conf = confs.filter(function(conf) { return conf.creator == objectID; });
			if (conf.length == 0) {
				callback(new Error("Could not find confirmation for object " + objectID));
				return;
			}

			conf = conf[0];

			// make sure we don't reuse the same time
			var localOffset = 0;
			do {
				time = SteamTotp.time(offset) + localOffset++;
			} while (self._usedConfTimes.indexOf(time) != -1);

			self._usedConfTimes.push(time);
			if (self._usedConfTimes.length > 60) {
				self._usedConfTimes.splice(0, self._usedConfTimes.length - 60); // we don't need to save more than 60 entries
			}

			conf.respond(time, SteamTotp.getConfirmationKey(identitySecret, time, "allow"), true, callback);
		});
	}
};

/**
 * Send a single request to Steam to accept all outstanding confirmations (after loading the list). If one fails, the
 * entire request will fail and there will be no way to know which failed without loading the list again.
 * @param {number} time
 * @param {string} confKey
 * @param {string} allowKey
 * @param {function} callback
 */
SteamCommunity.prototype.acceptAllConfirmations = function(time, confKey, allowKey, callback) {
	var self = this;

	this.getConfirmations(time, confKey, function(err, confs) {
		if (err) {
			callback(err);
			return;
		}

		if (confs.length == 0) {
			callback(null, []);
			return;
		}

		self.respondToConfirmation(confs.map(function(conf) { return conf.id; }), confs.map(function(conf) { return conf.key; }), time, allowKey, true, function(err) {
			if (err) {
				callback(err);
				return;
			}

			callback(err, confs);
		});
	});
};

function request(community, url, key, time, tag, params, json, callback) {
	if (!community.steamID) {
		throw new Error("Must be logged in before trying to do anything with confirmations");
	}

	params = params || {};
	params.p = SteamTotp.getDeviceID(community.steamID);
	params.a = community.steamID.getSteamID64();
	params.k = key;
	params.t = time;
	params.m = "android";
	params.tag = tag;

	var req = {
		"method": url == 'multiajaxop' ? 'POST' : 'GET',
		"uri": "https://steamcommunity.com/mobileconf/" + url,
		"json": !!json
	};

	if (req.method == "GET") {
		req.qs = params;
	} else {
		req.form = params;
	}

	community.httpRequest(req, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		callback(null, body);
	}, "steamcommunity");
}

// Confirmation checker

/**
 * Start automatically polling our confirmations for new ones. The `confKeyNeeded` event will be emitted when we need a confirmation key, or `newConfirmation` when we get a new confirmation
 * @param {int} pollInterval - The interval, in milliseconds, at which we will poll for confirmations. This should probably be at least 10,000 to avoid rate-limits.
 * @param {Buffer|string|null} [identitySecret=null] - Your identity_secret. If passed, all confirmations will be automatically accepted and nothing will be emitted.
 */
SteamCommunity.prototype.startConfirmationChecker = function(pollInterval, identitySecret) {
	this._confirmationPollInterval = pollInterval;
	this._knownConfirmations = this._knownConfirmations || {};
	this._confirmationKeys = this._confirmationKeys || {};
	this._identitySecret = identitySecret;

	if(this._confirmationTimer) {
		clearTimeout(this._confirmationTimer);
	}

	setTimeout(this.checkConfirmations.bind(this), 500);
};

/**
 * Stop automatically polling our confirmations.
 */
SteamCommunity.prototype.stopConfirmationChecker = function() {
	if(this._confirmationPollInterval) {
		delete this._confirmationPollInterval;
	}

	if(this._identitySecret) {
		delete this._identitySecret;
	}

	if(this._confirmationTimer) {
		clearTimeout(this._confirmationTimer);
		delete this._confirmationTimer;
	}
};

/**
 * Run the confirmation checker right now instead of waiting for the next poll.
 * Useful to call right after you send/accept an offer that needs confirmation.
 */
SteamCommunity.prototype.checkConfirmations = function() {
	if(this._confirmationTimer) {
		clearTimeout(this._confirmationTimer);
		delete this._confirmationTimer;
	}

	var self = this;
	if(!this._confirmationQueue) {
		this._confirmationQueue = Async.queue(function(conf, callback) {
			// Worker to process new confirmations
			if(self._identitySecret) {
				// We should accept this
				self.emit('debug', "Accepting confirmation #" + conf.id);
				var time = Math.floor(Date.now() / 1000);
				conf.respond(time, SteamTotp.getConfirmationKey(self._identitySecret, time, "allow"), true, function(err) {
					// If there was an error and it wasn't actually accepted, we'll pick it up again
					if (!err) self.emit('confirmationAccepted', conf);
					delete self._knownConfirmations[conf.id];
					setTimeout(callback, 1000); // Call the callback in 1 second, to make sure the time changes
				});
			} else {
				self.emit('newConfirmation', conf);
				setTimeout(callback, 1000); // Call the callback in 1 second, to make sure the time changes
			}
		}, 1);
	}

	this.emit('debug', 'Checking confirmations');

	this._confirmationCheckerGetKey('conf', function(err, key) {
		if(err) {
			resetTimer();
			return;
		}

		self.getConfirmations(key.time, key.key, function(err, confirmations) {
			if(err) {
				self.emit('debug', "Can't check confirmations: " + err.message);
				resetTimer();
				return;
			}

			var known = self._knownConfirmations;

			var newOnes = confirmations.filter(function(conf) {
				return !known[conf.id];
			});

			if(newOnes.length < 1) {
				resetTimer();
				return; // No new ones
			}

			// We have new confirmations!
			newOnes.forEach(function(conf) {
				self._knownConfirmations[conf.id] = conf; // Add it to our list of known confirmations
				self._confirmationQueue.push(conf);
			});

			resetTimer();
		});
	});

	function resetTimer() {
		if(self._confirmationPollInterval) {
			self._confirmationTimer = setTimeout(self.checkConfirmations.bind(self), self._confirmationPollInterval);
		}
	}
};

SteamCommunity.prototype._confirmationCheckerGetKey = function(tag, callback) {
	if(this._identitySecret) {
		if(tag == 'details') {
			// We don't care about details
			callback(new Error("Disabled"));
			return;
		}

		var time = Math.floor(Date.now() / 1000);
		callback(null, {"time": time, "key": SteamTotp.getConfirmationKey(this._identitySecret, time, tag)});
		return;
	}

	var existing = this._confirmationKeys[tag];
	var reusable = ['conf', 'details'];

	// See if we already have a key that we can reuse.
	if(reusable.indexOf(tag) != -1 && existing && (Date.now() - (existing.time * 1000) < (1000 * 60 * 5))) {
		callback(null, existing);
		return;
	}

	// We need a fresh one
	var self = this;
	this.emit('confKeyNeeded', tag, function(err, time, key) {
		if(err) {
			callback(err);
			return;
		}

		self._confirmationKeys[tag] = {"time": time, "key": key};
		callback(null, {"time": time, "key": key});
	});
};
