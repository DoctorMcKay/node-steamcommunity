const Cheerio = require('cheerio');
const FS = require('fs');
const SteamID = require('steamid');

const Helpers = require('./helpers.js');
const SteamCommunity = require('../index.js');

SteamCommunity.PrivacyState = {
	"Private": 1,
	"FriendsOnly": 2,
	"Public": 3
};

var CommentPrivacyState = {
	"1": 2,         // private
	"2": 0,         // friends only
	"3": 1          // anyone
};

SteamCommunity.prototype.setupProfile = function(callback) {
	var self = this;
	this._myProfile("edit?welcomed=1", null, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(err || response.statusCode != 200) {
			callback(err || new Error("HTTP error " + response.statusCode));
		} else {
			callback(null);
		}
	});
};

SteamCommunity.prototype.editShowcaseItem = function(showcase, slot, item, callback) {
	const self = this;
	//The possible options, with the maximum number of slots and the corresponding type
	const allowedoptions = {
		"trade": {
			"maxslots": 6,
			"type": 4
		},
		"items": {
			"maxslots": 10,
			"type": 3
		},
		"games": {
			"maxslots": 4,
			"type": 2
		}
	};

	if(!allowedoptions.hasOwnProperty(showcase)){
		const err = new Error("The submitted showcase type has no editable items.");
		return callback ? callback(err) : undefined;
	}
	if(slot < 1 || slot > allowedoptions[showcase]["maxslots"]){
		const err = new Error("The submitted slot is outside of range. (Allowed range: 1-"+allowedoptions[showcase]["maxslots"]+")");
		return callback ? callback(err) : undefined;
	}
	if(!(item.hasOwnProperty("appid") || item.hasOwnProperty("item_contextid") || item.hasOwnProperty("item_assetid"))){
		const err = new Error("The submitted item is not valid.");
		return callback ? callback(err) : undefined;
	}
	const requestdata = item;
	requestdata["slot"] = slot - 1;
	requestdata["customization_type"] = allowedoptions[showcase]["type"];
	requestdata["sessionid"] = self.getSessionID();
	self._myProfile("ajaxsetshowcaseconfig", requestdata, function (err, response, body) {

		if (err || response.statusCode != 200) {
			err = err || new Error("HTTP error " + response.statusCode);
			return callback ? callback(err) : undefined;
		}
		return callback ? callback(null) : undefined;

	});
};

SteamCommunity.prototype.editProfile = function(settings, callback) {
	var self = this;
	this._myProfile("edit", null, function(err, response, body) {
		if(err || response.statusCode != 200) {
			if(callback) {
				callback(err || new Error("HTTP error " + response.statusCode));
			}

			return;
		}

		var $ = Cheerio.load(body);
		var form = $('#editForm');
		if(!form) {
			if(callback) {
				callback(new Error("Malformed response"));
			}

			return;
		}

		var values = {};
		form.serializeArray().forEach(function (item) {
			values[item.name] = item.value;
		});

		var remainingshowcases = $(".profile_showcase_selector").length;

		for (var i in settings) {
			if (!settings.hasOwnProperty(i)) {
				continue;
			}
			switch (i) {
				case 'name':
					values.personaName = settings[i];
					break;

				case 'realName':
					values.real_name = settings[i];
					break;

				case 'summary':
					values.summary = settings[i];
					break;

				case 'country':
					values.country = settings[i];
					break;

				case 'state':
					values.state = settings[i];
					break;

				case 'city':
					values.city = settings[i];
					break;

				case 'customURL':
					values.customURL = settings[i];
					break;

				case 'background':
					// The assetid of our desired profile background
					values.profile_background = settings[i];
					break;

				case 'featuredBadge':
					// Currently, game badges aren't supported
					values.favorite_badge_badgeid = settings[i];
					break;

				case 'primaryGroup':
					if (typeof settings[i] === 'object' && settings[i].getSteamID64) {
						values.primary_group_steamid = settings[i].getSteamID64();
					} else {
						values.primary_group_steamid = new SteamID(settings[i]).getSteamID64();
					}

					break;


				case 'showcases':

					//When supplying a new showcases array, remove the old showcase (order)
					for (var val in values) {
						if (val.indexOf("[") !== -1) {
							if (val.split("[")[0] == "profile_showcase")
								delete values[val];
						}
					}

					for (var type in settings[i]) {

						if (remainingshowcases === 0) {
							break;
						}

						remainingshowcases--;

						switch (settings[i][type].showcase) {

							case 'infobox':
								values["profile_showcase[8]"] = 8;

								if (settings[i][type].hasOwnProperty("values")) {
									if (settings[i][type]["values"].hasOwnProperty("title")) {
										values["rgShowcaseConfig[8][0][title]"] = settings[i][type]["values"]["title"];
									}
									if (settings[i][type]["values"].hasOwnProperty("notes")) {
										values["rgShowcaseConfig[8][0][notes]"] = settings[i][type]["values"]["notes"];
									}
								}

								break;

							case 'artwork':
								values["profile_showcase[13]"] = 13;

								if (settings[i][type].hasOwnProperty("values")) {
									for (var n = 0; n < 4; n++) {
										values["profile_showcase[13][" + n + "][publishedfileid]"] = settings[i][type]["values"][n] || "";
									}
								}
								break;

							case 'trade':
								values["profile_showcase[4]"] = 4;

								if (settings[i][type].hasOwnProperty("values")) {
									if (settings[i][type]["values"].hasOwnProperty("notes")) {
										values["rgShowcaseConfig[4][6][notes]"] = settings[i][type]["values"]["notes"];
									}
								}
								break;

							case 'items':
								values["profile_showcase[3]"] = 3;
								break;

							case 'game':
								values["profile_showcase[6]"] = 6;

								if (settings[i][type].hasOwnProperty("values")) {
									values["rgShowcaseConfig[6][0][appid]"] = settings[i][type]["values"];
								}
								break;

							case 'badge':
								values["profile_showcase[5]"] = 5;

								if (settings[i][type].hasOwnProperty("values")) {

									if (settings[i][type]["values"].hasOwnProperty("style")) {
										var styles = ["rare", "selected", null, "recent", "random"];
										values["profile_showcase_style_5"] = styles.indexOf(settings[i][type]["values"]["style"]);
									}

									if (settings[i][type]["values"].hasOwnProperty("badges")) {
										var types = ["badgeid", "appid", "border_color"];
										for (var n = 0; n < 6; n++) {
											for (var t in types) {
												if (settings[i][type]["values"]["badges"][n] != undefined) {
													if (settings[i][type]["values"]["badges"][n].hasOwnProperty(types[t])) {
														values["rgShowcaseConfig[5][" + n + "][" + types[t] + "]"] = settings[i][type]["values"]["badges"][n][types[t]] || values["rgShowcaseConfig[5][" + n + "][" + types[t] + "]"] || "";
													}
												}
											}
										}
									}
								}

								break;

							case 'rareachievements':
								values["profile_showcase[1]"] = 1;
								break;

							case 'screenshot':
								values["profile_showcase[7]"] = 7;

								if (settings[i][type].hasOwnProperty("values")) {
									for (var n = 0; n < 4; n++) {
										if (settings[i][type]["values"][n] != undefined) {
											values["rgShowcaseConfig[7][" + n + "][publishedfileid]"] = settings[i][type]["values"][n];
										}
									}
								}
								break;

							case 'group':
								values["profile_showcase[9]"] = 9;

								if (settings[i][type].hasOwnProperty("values")) {
									if (typeof settings[i][type]["values"] === 'object' && settings[i][type]["values"].getSteamID64) {
										values["rgShowcaseConfig[9][0][accountid]"] = settings[i][type]["values"].getSteamID64();
									} else {
										values["rgShowcaseConfig[9][0][accountid]"] = new SteamID(settings[i][type]["values"]).getSteamID64();
									}
								}
								break;

							case 'review':
								values["profile_showcase[10]"] = 10;

								if (settings[i][type].hasOwnProperty("values")) {
									values["rgShowcaseConfig[10][0][appid]"] = settings[i][type]["values"];
								}
								break;

							case 'workshop':
								values["profile_showcase[11]"] = 11;

								if (settings[i][type].hasOwnProperty("values")) {
									values["rgShowcaseConfig[11][0][appid]"] = settings[i][type]["values"]["appid"];
									values["rgShowcaseConfig[11][0][publishedfileid]"] = settings[i][type]["values"]["publishedfileid"];
								}
								break;

							case 'guide':
								values["profile_showcase[15]"] = 15;

								if (settings[i][type].hasOwnProperty("values")) {
									values["rgShowcaseConfig[15][0][appid]"] = settings[i][type]["values"]["appid"];
									values["rgShowcaseConfig[15][0][publishedfileid]"] = settings[i][type]["values"]["publishedfileid"];
								}
								break;

							case 'achievements':
								values["profile_showcase[17]"] = 17;

								if (settings[i][type].hasOwnProperty("values") && settings[i][type]["values"].hasOwnProperty("achievements")) {
									for (var n = 0; n < 7; n++) {
										if (settings[i][type]["values"]["achievements"][n] != undefined) {
											values["rgShowcaseConfig[17][" + n + "][appid]"] = settings[i][type]["values"]["achievements"][n]["appid"];
											values["rgShowcaseConfig[17][" + n + "][title]"] = settings[i][type]["values"]["achievements"][n]["title"];
										}
									}
								}
								break;

							case 'games':
								values["profile_showcase[2]"] = 2;
								break;

							case 'ownguides':
								values["profile_showcase[16]"] = 16;

								if (settings[i][type].hasOwnProperty("values")) {
									for (var n = 0; n < 4; n++) {
										if (settings[i][type]["values"][n] != undefined) {
											values["rgShowcaseConfig[16][" + n + "][appid]"] = settings[i][type]["values"][n]["appid"];
											values["rgShowcaseConfig[16][" + n + "][publishedfileid]"] = settings[i][type]["values"][n]["publishedfileid"];
										}
									}
								}
								break;

							case 'ownworkshop':
								values["profile_showcase[12]"] = 12;

								if (settings[i][type].hasOwnProperty("values")) {
									for (var n = 0; n < 5; n++) {
										if (settings[i][type]["values"][n] != undefined) {
											values["rgShowcaseConfig[12][" + n + "][appid]"] = settings[i][type]["values"][n]["appid"];
											values["rgShowcaseConfig[12][" + n + "][publishedfileid]"] = settings[i][type]["values"][n]["publishedfileid"];
										}
									}
								}
								break;
						}
					}
					break;

			}
		}

		self._myProfile("edit", values, function(err, response, body) {
			if (settings.customURL) {
				delete self._profileURL;
			}

			if(err || response.statusCode != 200) {
				if(callback) {
					callback(err || new Error("HTTP error " + response.statusCode));
				}

				return;
			}

			// Check for an error
			var $ = Cheerio.load(body);
			var error = $('#errorText .formRowFields');
			if(error) {
				error = error.text().trim();
				if(error) {
					if(callback) {
						callback(new Error(error));
					}

					return;
				}
			}

			if(callback) {
				callback(null);
			}
		});
	});
};

SteamCommunity.prototype.profileSettings = function(settings, callback) {
	this._myProfile("edit/settings", null, (err, response, body) => {
		if (err || response.statusCode != 200) {
			if (callback) {
				callback(err || new Error("HTTP error " + response.statusCode));
			}

			return;
		}

		var $ = Cheerio.load(body);
		var existingSettings = $('.ProfileReactRoot[data-privacysettings]').data('privacysettings');
		if (!existingSettings) {
			if(callback) {
				callback(new Error("Malformed response"));
			}

			return;
		}

		// PrivacySettings => {PrivacyProfile, PrivacyInventory, PrivacyInventoryGifts, PrivacyOwnedGames, PrivacyPlaytime}
		// eCommentPermission
		var privacy = existingSettings.PrivacySettings;
		var commentPermission = existingSettings.eCommentPermission;

		for (var i in settings) {
			if (!settings.hasOwnProperty(i)) {
				continue;
			}

			switch (i) {
				case 'profile':
					privacy.PrivacyProfile = settings[i];
					break;

				case 'comments':
					commentPermission = CommentPrivacyState[settings[i]];
					break;

				case 'inventory':
					privacy.PrivacyInventory = settings[i];
					break;

				case 'inventoryGifts':
					privacy.PrivacyInventoryGifts = settings[i] ? SteamCommunity.PrivacyState.Private : SteamCommunity.PrivacyState.Public;
					break;

				case 'gameDetails':
					privacy.PrivacyOwnedGames = settings[i];
					break;

				case 'playtime':
					privacy.PrivacyPlaytime = settings[i] ? SteamCommunity.PrivacyState.Private : SteamCommunity.PrivacyState.Public;
					break;
			}
		}

		this._myProfile({
			"method": "POST",
			"endpoint": "ajaxsetprivacy/",
			"json": true,
			"formData": { // it's multipart because lolvalve
				"sessionid": this.getSessionID(),
				"Privacy": JSON.stringify(privacy),
				"eCommentPermission": commentPermission
			}
		}, null, function(err, response, body) {
			if (err || response.statusCode != 200) {
				if (callback) {
					callback(err || new Error("HTTP error " + response.statusCode));
				}

				return;
			}

			if (body.success != 1) {
				if (callback) {
					callback(new Error(body.success ? "Error " + body.success : "Request was not successful"));
				}

				return;
			}

			if (callback) {
				callback(null, body.Privacy);
			}
		});
	});
};

SteamCommunity.prototype.uploadAvatar = function(image, format, callback) {
	if(typeof format === 'function') {
		callback = format;
		format = null;
	}

	// are we logged in?
	if (!this.steamID) {
		callback(new Error("Not Logged In"));
		return;
	}

	var self = this;

	if(image instanceof Buffer) {
		doUpload(image);
	} else if(image.match(/^https?:\/\//)) {
		this.httpRequestGet({
			"uri": image,
			"encoding": null
		}, function(err, response, body) {
			if(err || response.statusCode != 200) {
				if(callback) {
					callback(err ? new Error(err.message + " downloading image") : new Error("HTTP error " + response.statusCode + " downloading image"));
				}

				return;
			}

			if(!format) {
				format = response.headers['content-type'];
			}

			doUpload(body);
		}, "steamcommunity");
	} else {
		if(!format) {
			format = image.match(/\.([^\.]+)$/);
			if(format) {
				format = format[1];
			}
		}

		FS.readFile(image, function(err, file) {
			if(err) {
				if(callback) {
					callback(err);
				}

				return;
			}

			doUpload(file);
		})
	}

	function doUpload(buffer) {
		if(!format) {
			if(callback) {
				callback(new Error("Unknown image format"));
			}

			return;
		}

		if(format.match(/^image\//)) {
			format = format.substring(6);
		}

		var filename = '';
		var contentType = '';

		switch(format.toLowerCase()) {
			case 'jpg':
			case 'jpeg':
				filename = 'avatar.jpg';
				contentType = 'image/jpeg';
				break;

			case 'png':
				filename = 'avatar.png';
				contentType = 'image/png';
				break;

			case 'gif':
				filename = 'avatar.gif';
				contentType = 'image/gif';
				break;

			default:
				if(callback) {
					callback(new Error("Unknown or invalid image format"));
				}

				return;
		}

		self.httpRequestPost({
			"uri": "https://steamcommunity.com/actions/FileUploader",
			"formData": {
				"MAX_FILE_SIZE": buffer.length,
				"type": "player_avatar_image",
				"sId": self.steamID.getSteamID64(),
				"sessionid": self.getSessionID(),
				"doSub": 1,
				"json": 1,
				"avatar": {
					"value": buffer,
					"options": {
						"filename": filename,
						"contentType": contentType
					}
				}
			},
			"json": true
		}, function(err, response, body) {
			if(err) {
				if(callback) {
					callback(err);
				}

				return;
			}

			if(body && !body.success && body.message) {
				if(callback) {
					callback(new Error(body.message));
				}

				return;
			}

			if(response.statusCode != 200) {
				if(callback) {
					callback(new Error("HTTP error " + response.statusCode));
				}

				return;
			}

			if(!body || !body.success) {
				if(callback) {
					callback(new Error("Malformed response"));
				}

				return;
			}

			if(callback) {
				callback(null, body.images.full);
			}
		}, "steamcommunity");
	}
};

/**
 * Post a new status to your profile activity feed.
 * @param {string} statusText - The text of this status update
 * @param {{appID: int}} [options] - Options for this status update. All are optional. If you don't pass any options, this can be omitted.
 * @param {function} callback - err, postID
 */
SteamCommunity.prototype.postProfileStatus = function(statusText, options, callback) {
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}

	this._myProfile("ajaxpostuserstatus/", {
		"appid": options.appID || 0,
		"sessionid": this.getSessionID(),
		"status_text": statusText
	}, (err, res, body) => {
		try {
			body = JSON.parse(body);
			if (body.message) {
				callback(new Error(body.message));
				return;
			}

			var match = body.blotter_html.match(/id="userstatus_(\d+)_/);
			if (!match) {
				callback(new Error("Malformed response"));
				return;
			}

			callback(null, parseInt(match[1], 10));
		} catch (ex) {
			callback(ex);
		}
	});
};

/**
 * Delete a previously-posted profile status update.
 * @param {int} postID
 * @param {function} [callback]
 */
SteamCommunity.prototype.deleteProfileStatus = function(postID, callback) {
	this._myProfile("ajaxdeleteuserstatus/", {
		"sessionid": this.getSessionID(),
		"postid": postID
	}, (err, res, body) => {
		if (!callback) {
			return;
		}

		try {
			body = JSON.parse(body);
			if (!body.success) {
				callback(new Error("Malformed response"));
				return;
			}

			callback(Helpers.eresultError(body.success));
		} catch (ex) {
			callback(ex);
		}
	});
};
