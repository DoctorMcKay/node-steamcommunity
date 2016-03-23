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
 * @param {int} confID - The ID of the confirmation in question
 * @param {string} confKey - The confirmation key associated with the confirmation in question (not a TOTP key, the `key` property of CConfirmation)
 * @param {int} time - The unix timestamp with which the following key was generated
 * @param {string} key - The confirmation key that was generated using the preceeding time and the tag "allow" (if accepting) or "cancel" (if not accepting)
 * @param {boolean} accept - true if you want to accept the confirmation, false if you want to cancel it
 * @param {SteamCommunity~genericErrorCallback} callback - Called when the request is complete
 */
SteamCommunity.prototype.respondToConfirmation = function(confID, confKey, time, key, accept, callback) {
	request(this, "ajaxop", key, time, accept ? "allow" : "cancel", {
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

function request(community, url, key, time, tag, params, json, callback) {
	params = params || {};
	params.p = SteamTotp.getDeviceID(community.steamID);
	params.a = community.steamID.getSteamID64();
	params.k = key;
	params.t = time;
	params.m = "android";
	params.tag = tag;

	community.httpRequestGet({
		"uri": "https://steamcommunity.com/mobileconf/" + url,
		"qs": params,
		"json": !!json
	}, function(err, response, body) {
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
				conf.respond(time, SteamTotp.getConfirmationKey(self._identitySecret, time, "allow"), true, function() {
					// If there was an error and it wasn't actually accepted, we'll pick it up again
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

			// We have new confirmations! Grab a key to get details.
			self._confirmationCheckerGetKey('details', function(err, key) {
				newOnes.forEach(function(conf) {
					self._knownConfirmations[conf.id] = conf; // Add it to our list of known confirmations

					if(err) {
						self._confirmationQueue.push(conf);
					} else {
						// Get its offer ID, if we can
						conf.getOfferID(key.time, key.key, function(err, offerID) {
							conf.offerID = offerID ? offerID : null;
							self._confirmationQueue.push(conf);
						});
					}
				});

				resetTimer();
			});
		});
	});

	function resetTimer() {
		if(self._confirmationPollInterval) {
			self._confirmationTimer = setTimeout(self.checkConfirmations.bind(self), self._confirmationPollInterval);
		}
	}

	function handleNewConfirmation(conf, handleNumber) {
		self._knownConfirmations[conf.id] = conf;

		// Delay them by 1 second per new confirmation that we see, so that keys won't be the same.
		setTimeout(function() {
			if(self._identitySecret) {
				self.emit('debug', 'Accepting confirmation #' + conf.id);
				var time = Math.floor(Date.now() / 1000);
				conf.respond(time, SteamTotp.getConfirmationKey(self._identitySecret, time, "allow"), true, function(err) {
					if (err) {
						self.emit('debug', "Can't accept confirmation #" + conf.id + ": " + err.message);
					}

					// We'll just retry next time we poll
					delete self._knownConfirmations[conf.id];
				});
			} else {
				self.emit('newConfirmation', conf);
			}
		}, handleNumber * 1000);
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
