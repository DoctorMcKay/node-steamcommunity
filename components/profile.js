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
	this._myProfile('edit/info', null, function(err, response, body) {
		if (err || response.statusCode != 200) {
			if (callback) {
				callback(err || new Error('HTTP error ' + response.statusCode));
			}

			return;
		}

		var $ = Cheerio.load(body);
		var existingSettings = $('#profile_edit_config').data('profile-edit');
		if (!existingSettings || !existingSettings.strPersonaName) {
			if (callback) {
				callback(new Error('Malformed response'));
			}

			return;
		}

		var values = {
			sessionID: self.getSessionID(),
			type: 'profileSave',
			weblink_1_title: '',
			weblink_1_url: '',
			weblink_2_title: '',
			weblink_2_url: '',
			weblink_3_title: '',
			weblink_3_url: '',
			personaName: existingSettings.strPersonaName,
			real_name: existingSettings.strRealName,
			summary: existingSettings.strSummary,
			country: existingSettings.LocationData.locCountryCode,
			state: existingSettings.LocationData.locStateCode,
			city: existingSettings.LocationData.locCityCode,
			customURL: existingSettings.strCustomURL,
			json: 1
		};

		for (var i in settings) {
			if(!settings.hasOwnProperty(i)) {
				continue;
			}

			switch(i) {
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

				case 'primaryGroup':
					if(typeof settings[i] === 'object' && settings[i].getSteamID64) {
						values.primary_group_steamid = settings[i].getSteamID64();
					} else {
						values.primary_group_steamid = new SteamID(settings[i]).getSteamID64();
					}

					break;

				// These don't work right now
				/*
				case 'background':
					// The assetid of our desired profile background
					values.profile_background = settings[i];
					break;

				case 'featuredBadge':
					// Currently, game badges aren't supported
					values.favorite_badge_badgeid = settings[i];
					break;
				*/
				// TODO: profile showcases
			}
		}

		self._myProfile('edit', values, function(err, response, body) {
			if (settings.customURL) {
				delete self._profileURL;
			}

			if (!callback) {
				return;
			}

			if (err || response.statusCode != 200) {
				callback(err || new Error('HTTP error ' + response.statusCode));
				return;
			}

			try {
				var json = JSON.parse(body);
				if (!json.success || json.success != 1) {
					callback(new Error(json.errmsg || 'Request was not successful'));
					return;
				}

				callback(null);
			} catch (ex) {
				callback(ex);
			}
		});
	});
};

SteamCommunity.prototype.profileSettings = function(settings, callback) {
	this._myProfile('edit/settings', null, (err, response, body) => {
		if (err || response.statusCode != 200) {
			if (callback) {
				callback(err || new Error('HTTP error ' + response.statusCode));
			}

			return;
		}

		var $ = Cheerio.load(body);
		var existingSettings = $('#profile_edit_config').data('profile-edit');
		if (!existingSettings || !existingSettings.Privacy) {
			if (callback) {
				callback(new Error('Malformed response'));
			}

			return;
		}

		// PrivacySettings => {PrivacyProfile, PrivacyInventory, PrivacyInventoryGifts, PrivacyOwnedGames, PrivacyPlaytime}
		// eCommentPermission
		var privacy = existingSettings.Privacy.PrivacySettings;
		var commentPermission = existingSettings.Privacy.eCommentPermission;

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

				case 'friendsList':
					privacy.PrivacyFriendsList = settings[i];
					break;
			}
		}

		this._myProfile({
			method: 'POST',
			endpoint: 'ajaxsetprivacy/',
			json: true,
			formData: { // it's multipart because lolvalve
				sessionid: this.getSessionID(),
				Privacy: JSON.stringify(privacy),
				eCommentPermission: commentPermission
			}
		}, null, function(err, response, body) {
			if (err || response.statusCode != 200) {
				if (callback) {
					callback(err || new Error('HTTP error ' + response.statusCode));
				}

				return;
			}

			if (body.success != 1) {
				if (callback) {
					callback(new Error(body.success ? 'Error ' + body.success : 'Request was not successful'));
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

/**
 * Get your profile activity feed.
 * @param {{start: int|date, startoffset: int, myactivity: int, l: string}} [options] - All are optional. If you don't pass any options, this can be omitted.
 * @param {function} callback - err, activities
 */
SteamCommunity.prototype.getFriendActivity = function(options, callback) {
	if (typeof options === 'function') {
		callback = options;
		var l = 'english';
		var startoffset = 0;
        var start = new Date();
		var myactivity = 0;
        start.setHours(0);
        start.setMinutes(0);
        start.setSeconds(0);
        start = Math.floor(startDate.valueOf() / 1000);
		options = { start, startoffset, myactivity, l };
	}

	if (!callback) {
		return;
	}

	options.start = options.start.valueOf ? options.start.valueOf() : options.start;
	var qs = new URLSearchParams(params);
	this._myProfile("ajaxgetusernews/?" + qs, null, (err, res, body) => {
		if(err) {
			callback(err);
			return;
		}

		if(!body) {
			callback(new Error("Malformed response"));
			return;
		}

		try {
			body = JSON.parse(body);
			if (!body.success) {
				callback(new Error("Malformed response"));
				return;
			}

			parseFriendActivity(body, callback);
		} catch (ex) {
			callback(ex);
		}
	});

	function parseFriendActivity(body, callback) {
		var $ = Cheerio.load(body.blotter_html);
		var output = {
			"start": new Date(body.timestart * 1000),
			"nextRequest": body.next_request,
			"items": []
		};

		Array.prototype.forEach.call($('.blotter_block, .blotter_daily_rollup_line, .blotter_daily_rollup_line_groups'), function(item) {
			var data = {};

			var $item = $(item);
			var $dailyRollup = $item.find('.blotter_daily_rollup')
			if ($dailyRollup.length > 0) {
				return;
			}

			var $userBlock = $item.find('.blotter_author_block');
			var $groupBlock = $item.find('.blotter_group_announcement_header');

			// Author
			if ($userBlock.length > 0) {
				var $miniprofile = $userBlock.find(' > div > a[data-miniprofile]');

				var sid = new SteamID();
				sid.universe = SteamID.Universe.PUBLIC;
				sid.type = SteamID.Type.INDIVIDUAL;
				sid.instance = SteamID.Instance.DESKTOP;
				sid.accountid = $miniprofile.data('miniprofile');

				var nameGroup = $miniprofile.text();
				var nicknameGroup = $miniprofile.find('.nickname_block').text();
				var name = nameGroup.replace(nicknameGroup, '').trim();
				var nickname = $miniprofile.find('.nickname_name').text().trim();

				data.author = {
					"steamID": sid,
					"url": $miniprofile.attr('href'),
					"avatar": $userBlock.find('img').attr('src'),
					"name": name
				};

				if (nickname) {
					data.author.nickName = nickname;
				}
			} else if ($groupBlock.length > 0) {
				var $line = $groupBlock.find('.blotter_group_announcement_header_text > a:first');
				var url = $line.attr('href');
				var sid;
				if (url.includes('/curator/')) {
					sid = new SteamID();
					sid.universe = SteamID.Universe.PUBLIC;
					sid.type = SteamID.Type.CLAN;
					sid.instance = SteamID.Instance.DESKTOP;
					sid.accountid = parseInt(url.split('/curator/')[1].match(/^\d+/g)[0], 10);
				}

				data.author = {
					"url": url,
					"avatar": $groupBlock.find('img').attr('src'),
					"name": $line.text().trim()
				};

				if (sid) {
					data.author.steamID = sid;
				}
			} else { // should be daily_rollup_line
				var $avatar = $item.find('.blotter_rollup_avatar');
				var $subject = $item.find('span > a:first');
				var sid, name, nickname;

				if ($subject.is('[data-miniprofile]')) {
					sid = new SteamID();
					sid.universe = SteamID.Universe.PUBLIC;
					sid.type = SteamID.Type.INDIVIDUAL;
					sid.instance = SteamID.Instance.DESKTOP;
					sid.accountid = $subject.data('miniprofile');

					var nameGroup = $subject.text();
					var nicknameGroup = $subject.find('.nickname_block').text();
					name = nameGroup.replace(nicknameGroup, '').trim();
					nickname = $subject.find('.nickname_name').text().trim();
				} else {
					name = $subject.text().trim();
				}

				data.author = {
					"url": $avatar.find('a').attr('href'),
					"avatar": $avatar.find('img').attr('src'),
					"name": name
				};

				if (sid) {
					data.author.steamID = sid;
				}

				if (nickname) {
					data.author.nickName = nickname;
				}
			}

			// Subject
			if ($userBlock.length > 0) {
				data.subject = $userBlock.find(' > div:last').text().trim();
			} else if ($groupBlock.length > 0) {
				data.subject = $groupBlock.find('.blotter_group_announcement_header_text').text().replace(data.author.name, '').trim();
			} else {
				data.subject = $item.find('span').text().trim();
			}

			// Body
			// TODO: Better parsing of body (consider each type separately?)
			data.body = $item.text();
			data.blotter = $item.html(); // include this?

			// Misc
			data.apps = [...new Set($item.find('[href*="steamcommunity.com/app/"], [href*="steamcommunity.com/games/"]').get().map(e => parseInt(e.href.split('/')[4], 10)))];
			data.votes = parseInt($(".rateUpCount > span, .blotter_voters_names").text().trim().split(" ")[0], 10) || 0;

			// Add to output
			output.items.push(data);
		});

		callback(null, output);
	}
};


SteamCommunity.prototype.editFriendActivity = function(settings, callback) {
	var self = this;
	var values = {
		"setting": 1,
		"sessionid": self.getSessionID(),
		"subscription_option[achievementunlocked]": 1,
		"subscription_option[addedgametowishlist]": 1,
		"subscription_option[createsgroup]": 1,
		"subscription_option[curatorrecommendations]": 1,
		"subscription_option[filefavorited]": 1,
		"subscription_option[followingpublishedugc]": 1,
		"subscription_option[friendadded]": 1,
		"subscription_option[greenlightannouncement]": 1,
		"subscription_option[joinedgroup]": 1,
		"subscription_option[postedannouncement]": 1,
		"subscription_option[promotednewadmin]": 1,
		"subscription_option[receivednewgame]": 1,
		"subscription_option[receivesgroupcomment]": 1,
		"subscription_option[recommendedgame]": 1,
		"subscription_option[scheduledevent]": 1,
		"subscription_option[screenshotpublished]": 1,
		"subscription_option[selectednewpotw]": 1,
		"subscription_option[taggedinscreenshot]": 1,
		"subscription_option[videopublished]": 1,
		"subscription_option[workshopannouncement]": 1
	};

	for (var i in settings) {
		if(!settings.hasOwnProperty(i)) {
			continue;
		}

		switch(i) {
			case 'addedGameToWishlist':
				values['subscriptions[addedgametowishlist]'] = settings[i] ? 1 : 0;
				break;

			case 'createsGroup':
				values['subscriptions[createsgroup]'] = settings[i] ? 1 : 0;
				break;

			case 'curatorRecommendations':
				values['subscriptions[curatorrecommendations]'] = settings[i] ? 1 : 0;
				break;

			case 'fileFavoried':
				values['subscriptions[filefavorited]'] = settings[i] ? 1 : 0;
				break;

			case 'followingPublishedUGC':
				values['subscriptions[followingpublishedugc]'] = settings[i] ? 1 : 0;
				break;

			case 'friendAdded':
				values['subscriptions[friendadded]'] = settings[i] ? 1 : 0;
				break;

			case 'greenlightAnnouncement':
				values['subscriptions[greenlightannouncement]'] = settings[i] ? 1 : 0;
				break;

			case 'joinedGroup':
				values['subscriptions[joinedgroup]'] = settings[i] ? 1 : 0;
				break;

			case 'postedAnnouncement':
				values['subscriptions[postedannouncement]'] = settings[i] ? 1 : 0;
				break;

			case 'promotedNewAdmin':
				values['subscriptions[promotednewadmin]'] = settings[i] ? 1 : 0;
				break;

			case 'receivedNewGame':
				values['subscriptions[receivednewgame]'] = settings[i] ? 1 : 0;
				break;

			case 'receivesGroupComment':
				values['subscriptions[receivesgroupcomment]'] = settings[i] ? 1 : 0;
				break;

			case 'recommendedGame':
				values['subscriptions[recommendedgame]'] = settings[i] ? 1 : 0;
				break;

			case 'scheduledEvent':
				values['subscriptions[scheduledevent]'] = settings[i] ? 1 : 0;
				break;

			case 'screenshotPublished':
				values['subscriptions[screenshotpublished]'] = settings[i] ? 1 : 0;
				break;

			case 'selectedNewPotw':
				values['subscriptions[selectednewpotw]'] = settings[i] ? 1 : 0;
				break;

			case 'taggedInScreenshot':
				values['subscriptions[taggedinscreenshot]'] = settings[i] ? 1 : 0;
				break;

			case 'videoPublished':
				values['subscriptions[videopublished]'] = settings[i] ? 1 : 0;
				break;

			case 'workshopAnnouncement':
				values['subscriptions[workshopannouncement]'] = settings[i] ? 1 : 0
				break;

		}
	}

	self._myProfile('blotteredit', values, function(err, response, body) {
		if (!callback) {
			return;
		}

		if (err || response.statusCode != 200) {
			callback(err || new Error('HTTP error ' + response.statusCode));
			return;
		}

		callback(null);
	});
};
