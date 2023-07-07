const Cheerio = require('cheerio');
const FS = require('fs');

const Helpers = require('./helpers.js');
const SteamCommunity = require('../index.js');

SteamCommunity.PrivacyState = {
	Private: 1,
	FriendsOnly: 2,
	Public: 3
};

const CommentPrivacyState = {
	1: 2,         // private
	2: 0,         // friends only
	3: 1          // anyone
};

/**
 * Creates a profile page if you don't already have one.
 * @param {function} callback
 */
SteamCommunity.prototype.setupProfile = function(callback) {
	this._myProfile('edit?welcomed=1', null, (err, response, body) => {
		if (!callback) {
			return;
		}

		if (err || response.statusCode != 200) {
			callback(err || new Error('HTTP error ' + response.statusCode));
		} else {
			callback(null);
		}
	});
};

/**
 * Edits your profile details.
 * @param {object} settings
 * @param {function} callback
 */
SteamCommunity.prototype.editProfile = function(settings, callback) {
	this._myProfile('edit/info', null, (err, response, body) => {
		if (err || response.statusCode != 200) {
			if (callback) {
				callback(err || new Error('HTTP error ' + response.statusCode));
			}

			return;
		}

		let $ = Cheerio.load(body);
		let existingSettings = $('#profile_edit_config').data('profile-edit');
		if (!existingSettings || !existingSettings.strPersonaName) {
			if (callback) {
				callback(new Error('Malformed response'));
			}

			return;
		}

		let values = {
			sessionID: this.getSessionID(),
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

		for (let i in settings) {
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

		this._myProfile('edit', values, (err, response, body) => {
			if (settings.customURL) {
				delete this._profileURL;
			}

			if (!callback) {
				return;
			}

			if (err || response.statusCode != 200) {
				callback(err || new Error('HTTP error ' + response.statusCode));
				return;
			}

			try {
				let json = JSON.parse(body);
				let err2 = Helpers.eresultError(json.success, json.errmsg);
				if (err2) {
					return callback(err2);
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

		let $ = Cheerio.load(body);
		let existingSettings = $('#profile_edit_config').data('profile-edit');
		if (!existingSettings || !existingSettings.Privacy) {
			if (callback) {
				callback(new Error('Malformed response'));
			}

			return;
		}

		// PrivacySettings => {PrivacyProfile, PrivacyInventory, PrivacyInventoryGifts, PrivacyOwnedGames, PrivacyPlaytime}
		// eCommentPermission
		let privacy = existingSettings.Privacy.PrivacySettings;
		let commentPermission = existingSettings.Privacy.eCommentPermission;

		for (let i in settings) {
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
		}, null, (err, response, body) => {
			if (err || response.statusCode != 200) {
				if (callback) {
					callback(err || new Error('HTTP error ' + response.statusCode));
				}

				return;
			}

			let err2 = Helpers.eresultError(body.success);
			if (err2) {
				callback && callback(err2);
				return;
			}

			if (callback) {
				callback(null, body.Privacy);
			}
		});
	});
};

SteamCommunity.prototype.uploadAvatar = function(image, format, callback) {
	if (typeof format === 'function') {
		callback = format;
		format = null;
	}

	// are we logged in?
	if (!this.steamID) {
		callback(new Error('Not Logged In'));
		return;
	}

	const doUpload = (buffer) => {
		if (!format) {
			if (callback) {
				callback(new Error('Unknown image format'));
			}

			return;
		}

		if (format.match(/^image\//)) {
			format = format.substring(6);
		}

		let filename = '';
		let contentType = '';

		switch (format.toLowerCase()) {
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
				if (callback) {
					callback(new Error('Unknown or invalid image format'));
				}

				return;
		}

		this.httpRequestPost({
			url: 'https://steamcommunity.com/actions/FileUploader',
			formData: {
				MAX_FILE_SIZE: buffer.length,
				type: 'player_avatar_image',
				sId: this.steamID.getSteamID64(),
				sessionid: this.getSessionID(),
				doSub: 1,
				json: 1,
				avatar: {
					value: buffer,
					options: {
						filename: filename,
						contentType: contentType
					}
				}
			},
			json: true
		}, (err, response, body) => {
			if (err) {
				callback && callback(err);
				return;
			}

			if (body && !body.success && body.message) {
				callback && callback(new Error(body.message));
				return;
			}

			if (response.statusCode != 200) {
				callback && callback(new Error(`HTTP error ${response.statusCode}`));
				return;
			}

			if (!body || !body.success) {
				callback && callback(new Error('Malformed response'));
				return;
			}

			callback && callback(null, body.images.full);
		}, 'steamcommunity');
	};

	if (image instanceof Buffer) {
		doUpload(image);
	} else if (image.match(/^https?:\/\//)) {
		this.httpRequestGet({
			url: image,
			encoding: null
		}, (err, response, body) => {
			if (err || response.statusCode != 200) {
				if (callback) {
					callback(new Error(err ? `${err.message} downloading image` : `HTTP error ${response.statusCode} downloading image`));
				}

				return;
			}

			if (!format) {
				format = response.headers['content-type'];
			}

			doUpload(body);
		}, 'steamcommunity');
	} else {
		if (!format) {
			format = image.match(/\.([^.]+)$/);
			if (format) {
				format = format[1];
			}
		}

		FS.readFile(image, (err, file) => {
			if (err) {
				if (callback) {
					callback(err);
				}

				return;
			}

			doUpload(file);
		});
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

	this._myProfile('ajaxpostuserstatus/', {
		appid: options.appID || 0,
		sessionid: this.getSessionID(),
		status_text: statusText
	}, (err, res, body) => {
		try {
			body = JSON.parse(body);
			if (body.message) {
				callback(new Error(body.message));
				return;
			}

			let match = body.blotter_html.match(/id="userstatus_(\d+)_/);
			if (!match) {
				callback(new Error('Malformed response'));
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
	this._myProfile('ajaxdeleteuserstatus/', {
		sessionid: this.getSessionID(),
		postid: postID
	}, (err, res, body) => {
		if (!callback) {
			return;
		}

		try {
			body = JSON.parse(body);
			if (!body.success) {
				callback(new Error('Malformed response'));
				return;
			}

			callback(Helpers.eresultError(body.success));
		} catch (ex) {
			callback(ex);
		}
	});
};
