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
		var formd = form.serializeArray();
		var i = 0;
		form.serializeArray().forEach(function (item) {
			values[item.name] = i;
			i++;
		});
		var out = [];
		var requiredvalues = ["sessionID", "type", "weblink_1_title", "weblink_1_url", "weblink_2_title", "weblink_2_url", "weblink_3_title", "weblink_3_url", "personaName", "real_name", "country", "state", "city", "customURL", "summary", "profile_background", "favorite_badge_badgeid", "favorite_badge_communityitemid", "primary_group_steamid"];

		for (var i = 0; i < 18; i++) {
			if (values.hasOwnProperty(requiredvalues[i])) {
				out.push({
					"name": requiredvalues[i],
					"value": formd[values[requiredvalues[i]]].value
				});
			} else {
				out.push({
					"name": requiredvalues[i],
					"value": ""
				});
			}
		}

		for(var i in settings) {
			if(!settings.hasOwnProperty(i)) {
				continue;
			}

			switch(i) {
				case 'name':
					out[8].value = settings[i];
					break;

				case 'realName':
					out[9].value = settings[i];
					break;

				case 'summary':
					out[14].value = settings[i];
					break;

				case 'country':
					out[10].value = settings[i];
					break;

				case 'state':
					out[11].value = settings[i];
					break;

				case 'city':
					out[12].value = settings[i];
					break;

				case 'customURL':
					out[13].value = settings[i];
					break;

				case 'background':
					// The assetid of our desired profile background
					out[15].value = settings[i];
					break;

				case 'featuredBadge':
					// Currently, game badges aren't supported
						out[16].value = settings[i];
					break;

				case 'primaryGroup':
					if (typeof settings[i] === 'object' && settings[i].getSteamID64) {
						out[18].value = settings[i].getSteamID64();
					} else {
						out[18].value = new SteamID(settings[i]).getSteamID64();
					}

					break;

				case 'showcases':
					for (var t in settings[i]) {
						//Variable used to easily make request to`ajaxsetshowcaseconfig` for showcases like trade, items, ...
						var showcaseconfig = {
							"supplied": false,
							"numberofrequests": 0,
							"showcasetype": 0,
							"itemarray": []
						};

						switch (settings[i][t].showcase) {

							case 'infobox':
								out.push({
									"name": "profile_showcase[]",
									"value": "8"
								});
								out.push({
									"name": "rgShowcaseConfig[8][0][title]",
									"value": settings[i][t]["values"]["title"]
								});
								out.push({
									"name": "rgShowcaseConfig[8][0][notes]",
									"value": settings[i][t]["values"]["notes"]
								});
								break;

							case 'artwork':
								out.push({
									"name": "profile_showcase[]",
									"value": "13"
								});
								for (var n = 0; n < 4; n++) {
									out.push({
										"name": "rgShowcaseConfig[13][" + n + "][publishedfileid]",
										"value": settings[i][t]["values"][n] || ""
									});
								}
								break;

							case 'trade':
								out.push({
									"name": "profile_showcase[]",
									"value": "4"
								});
								out.push({
									"name": "rgShowcaseConfig[4][6][notes]",
									"value": settings[i][t]["values"]["notes"]
								});

								if (settings[i][t]["values"].hasOwnProperty("items")) {
									showcaseconfig.supplied = true;
									showcaseconfig.numberofrequests = 6;
									showcaseconfig.showcasetype = 4;
									showcaseconfig.itemarray = settings[i][t]["values"]["items"];
								}
								break;

							case 'items':
								out.push({
									"name": "profile_showcase[]",
									"value": "3"
								});

								if (settings[i][t]["values"].hasOwnProperty("items")) {
									showcaseconfig.supplied = true;
									showcaseconfig.numberofrequests = 10;
									showcaseconfig.showcasetype = 3;
									showcaseconfig.itemarray = settings[i][t]["values"]["items"];
								}
								break;

							case 'game':
								out.push({
									"name": "profile_showcase[]",
									"value": "6"
								});
								out.push({
									"name": "rgShowcaseConfig[6][0][appid]",
									"value": settings[i][t]["values"]["appid"]
								});
								break;

							case 'badge':
								out.push({
									"name": "profile_showcase[]",
									"value": "5"
								});
								var styles = ["rare","selected",null,"recent","random"];
								out.push({
									"name": "profile_showcase_style_5",
									"value": styles.indexOf(settings[i][t]["values"]["style"])
								});

								if (settings[i][t]["values"].hasOwnProperty("badges")){
									for(var n = 0; n < 6; n++){
										var defaultval = ["", "", ""];
										if (settings[i][t]["values"]["badges"][n] != undefined) {
											defaultval = [settings[i][t]["values"]["badges"][n]["badgeid"], settings[i][t]["values"]["badges"][n]["appid"], settings[i][t]["values"]["badges"][n]["border_color"]];
										}
										out.push({
											"name": "rgShowcaseConfig[5][" + n + "][badgeid]",
											"value": defaultval[0]
										});
										out.push({
											"name": "rgShowcaseConfig[5][" + n + "][appid]",
											"value": defaultval[1]
										});
										out.push({
											"name": "rgShowcaseConfig[5][" + n + "][border_color]",
											"value": defaultval[2]
										});
									}
								}

								break;

							case 'rareachievements':
								out.push({
									"name": "profile_showcase[]",
									"value": "1"
								});
								break;

							case 'screenshot':
								out.push({
									"name": "profile_showcase[]",
									"value": "7"
								});
								for (var n = 0; n < 4; n++) {
									out.push({
										"name": "rgShowcaseConfig[7][" + n + "][publishedfileid]",
										"value": settings[i][t]["values"][n] || ""
									});
								}
								break;

							case 'group':
								out.push({
									"name": "profile_showcase[]",
									"value": "9"
								});
								if (typeof settings[i][t]["values"]["groupid"] === 'object' && settings[i][t]["values"]["groupid"].getSteamID64) {
									out.push({
										"name": "rgShowcaseConfig[9][0][accountid]",
										"value": settings[i][t]["values"]["groupid"].getSteamID64()
									});
								} else {
									out.push({
										"name": "rgShowcaseConfig[9][0][accountid]",
										"value": new SteamID(settings[i][t]["values"]["groupid"]).getSteamID64()
									});
								}
								break;

							case 'review':
								out.push({
									"name": "profile_showcase[]",
									"value": "10"
								});
								out.push({
									"name": "rgShowcaseConfig[10][0][appid]",
									"value": settings[i][t]["values"]["appid"]
								});
								break;

							case 'workshop':
								out.push({
									"name": "profile_showcase[]",
									"value": "11"
								});
								out.push({
									"name": "rgShowcaseConfig[11][0][appid]",
									"value": settings[i][t]["values"]["appid"]
								});
								out.push({
									"name": "rgShowcaseConfig[11][0][publishedfileid]",
									"value": settings[i][t]["values"]["publishedfileid"]
								});
								break;

							case 'guide':
								out.push({
									"name": "profile_showcase[]",
									"value": "15"
								});
								out.push({
									"name": "rgShowcaseConfig[15][0][appid]",
									"value": settings[i][t]["values"]["appid"]
								});
								out.push({
									"name": "rgShowcaseConfig[15][0][publishedfileid]",
									"value": settings[i][t]["values"]["publishedfileid"]
								});
								break;

							case 'achievements':
								out.push({
									"name": "profile_showcase[]",
									"value": "17"
								});
								if (settings[i][t]["values"].hasOwnProperty("achievements")) {
									for (var n = 0; n < 7; n++) {
										var defaultval = ["", ""];
										if (settings[i][t]["values"]["achievements"][n] != undefined) {
											defaultval = [settings[i][t]["values"]["achievements"][n]["appid"], settings[i][t]["values"]["achievements"][n]["title"]];
										}
										out.push({
											"name": "rgShowcaseConfig[17][" + n + "][appid]",
											"value": defaultval[0]
										});
										out.push({
											"name": "rgShowcaseConfig[17][" + n + "][title]",
											"value": defaultval[1]
										});
									}
								}
								break;

								case 'games':
									out.push({
										"name": "profile_showcase[]",
										"value": "2"
									});

									if (settings[i][t]["values"].hasOwnProperty("games")) {
										showcaseconfig.supplied = true;
										showcaseconfig.numberofrequests = 4;
										showcaseconfig.showcasetype = 2;
										showcaseconfig.itemarray = settings[i][t]["values"]["games"];
									}
									break;

								case 'ownguides':
									out.push({
										"name": "profile_showcase[]",
										"value": "16"
									});

									for (var n = 0; n < 4; n++) {
										var defaultval = ["", ""];
										if (settings[i][t]["values"][n] != undefined) {
											defaultval = [settings[i][t]["values"][n]["appid"], settings[i][t]["values"][n]["publishedfileid"]];
										}
										out.push({
											"name": "rgShowcaseConfig[16][" + n + "][appid]",
											"value": defaultval[0]
										});
										out.push({
											"name": "rgShowcaseConfig[16][" + n + "][publishedfileid]",
											"value": defaultval[1]
										});
									}
									break;

								case 'ownguides':
									out.push({
										"name": "profile_showcase[]",
										"value": "12"
									});

									for (var n = 0; n < 5; n++) {
										var defaultval = ["", ""];
										if (settings[i][t]["values"][n] != undefined) {
											defaultval = [settings[i][t]["values"][n]["appid"], settings[i][t]["values"][n]["publishedfileid"]];
										}
										out.push({
											"name": "rgShowcaseConfig[12][" + n + "][appid]",
											"value": defaultval[0]
										});
										out.push({
											"name": "rgShowcaseConfig[12][" + n + "][publishedfileid]",
											"value": defaultval[1]
										});
									}
									break;
							}

							if (showcaseconfig.supplied) {
								for (var n = 0; n < showcaseconfig.numberofrequests; n++) {
									var requestdata;
									if (showcaseconfig.itemarray[n] == undefined) {
										requestdata = {
											appid: 0,
											item_contextid: 0,
											item_assetid: 0,
											customization_type: showcaseconfig.showcasetype,
											slot: n,
											sessionid: formd[0].value
										};
									} else {
										requestdata = {
											appid: showcaseconfig.itemarray[n]["appid"],
											item_contextid: showcaseconfig.itemarray[n]["item_contextid"],
											item_assetid: showcaseconfig.itemarray[n]["item_assetid"],
											customization_type: showcaseconfig.showcasetype,
											slot: n,
											sessionid: formd[0].value
										};

									}

									self._myProfile("ajaxsetshowcaseconfig", requestdata, function (err, response, body) {
										if (settings.customURL) {
											delete selfe._profileURL;
										}

										if (err || response.statusCode != 200) {
											if (callback) {
												callback(err || new Error("HTTP error " + response.statusCode));
											}

											return;
										}

										// Check for an error
										var $ = Cheerio.load(body);
										var error = $('#errorText .formRowFields');
										if (error) {
											error = error.text().trim();
											if (error) {
												if (callback) {
													callback(new Error(error));
												}

												return;
											}
										}

										if (callback) {
											callback(null);
										}
									});
								}

							}
						}
					break;

			}
		}

		var parameters = [];
		for(let i = 0; i < out.length; i++){
			parameters.push(encodeURIComponent(out[i].name) + "=" + encodeURIComponent(out[i].value));
		}
		parameters = parameters.join("&");

		self._myProfile("edit", parameters, function(err, response, body) {
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
