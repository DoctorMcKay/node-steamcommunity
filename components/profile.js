const StdLib = require('@doctormckay/stdlib');

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
 * @return {Promise<void>}
 */
SteamCommunity.prototype.setupProfile = function(callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		const {statusCode} = await this._myProfile('edit?welcomed=1', null);
		if (statusCode !== 200) {
			return reject(new Error(`HTTP error ${statusCode}`));
		}

		resolve();
	});
};

/**
 * Edits your profile details.
 * @param {object} settings
 * @param {string} [settings.name] - Your new profile name
 * @param {string} [settings.realName] - Your new profile "real name", or empty string to remove it
 * @param {string} [settings.country] - A country code, like US, or empty string to remove it
 * @param {string} [settings.state] - A state code, like FL, or empty string to remove it
 * @param {number|string} [settings.city] - A numeric city code, or empty string to remove it
 * @param {string} [settings.customURL] - Your new profile custom URL
 * @param {function} [callback]
 * @return {Promise<void>}
 */
SteamCommunity.prototype.editProfile = function(settings, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		const {statusCode, rawBody} = await this._myProfile('edit/info', null);
		if (statusCode !== 200) {
			return reject(new Error(`HTTP error ${statusCode}`));
		}

		let $ = Cheerio.load(rawBody);
		let existingSettings = $('#profile_edit_config').data('profile-edit');
		if (!existingSettings || !existingSettings.strPersonaName) {
			return reject(new Error('Malformed response'));
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

		for (let name in settings) {
			switch (name) {
				case 'name':
					values.personaName = settings[name];
					break;

				case 'realName':
					values.real_name = settings[name];
					break;

				case 'summary':
					values.summary = settings[name];
					break;

				case 'country':
					values.country = settings[name];
					break;

				case 'state':
					values.state = settings[name];
					break;

				case 'city':
					values.city = settings[name];
					break;

				case 'customURL':
					values.customURL = settings[name];
					break;

				case 'primaryGroup':
					if (typeof settings[name] === 'object' && settings[name].getSteamID64) {
						values.primary_group_steamid = settings[name].getSteamID64();
					} else {
						values.primary_group_steamid = new SteamCommunity.SteamID(settings[name]).getSteamID64();
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

		const {statusCode: statusCode2, jsonBody} = await this._myProfile('edit', values);
		if (settings.customURL) {
			delete this._profileURL;
		}

		if (statusCode2 !== 200) {
			return reject(new Error(`HTTP error ${statusCode2}`));
		}

		if (!jsonBody) {
			return reject(new Error('Malformed response'));
		}

		const jsonError = Helpers.eresultError(jsonBody.success, jsonBody.errmsg);
		jsonError ? reject(jsonError) : resolve();
	});
};

/**
 * Edits your profile privacy settings
 * @param {object} settings
 * @param {number} [settings.profile] - A value from `SteamCommunity.PrivacyState` for your desired profile privacy state
 * @param {number} [settings.comments] - A value from `SteamCommunity.PrivacyState` for your desired profile comments privacy state
 * @param {number} [settings.inventory] - A value from `SteamCommunity.PrivacyState` for your desired inventory privacy state
 * @param {boolean} [settings.inventoryGifts] - `true` to keep your Steam gift inventory private, `false` otherwise
 * @param {number} [settings.gameDetails] - A value from `SteamCommunity.PrivacyState` for your desired privacy level
 * required to view games you own and what game you're currently playing
 * @param {boolean} [settings.playtime] - `true` to keep your game playtime private, `false` otherwise
 * @param {number} [settings.friendsList] - A value from `SteamCommunity.PrivacyState` for your desired privacy level
 * required to view your friends list
 * @param {function} callback
 * @return {Promise<object>} An object containing your newly updated privacy settings
 */
SteamCommunity.prototype.profileSettings = function(settings, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		const {statusCode, rawBody} = await this._myProfile('edit/settings', null);
		if (statusCode !== 200) {
			return reject(new Error(`HTTP error ${statusCode}`));
		}

		let $ = Cheerio.load(rawBody);
		let existingSettings = $('#profile_edit_config').data('profile-edit');
		if (!existingSettings || !existingSettings.Privacy) {
			return reject(new Error('Malformed response'));
		}

		// PrivacySettings => {PrivacyProfile, PrivacyInventory, PrivacyInventoryGifts, PrivacyOwnedGames, PrivacyPlaytime}
		// eCommentPermission
		let privacy = existingSettings.Privacy.PrivacySettings;
		let commentPermission = existingSettings.Privacy.eCommentPermission;

		for (let name in settings) {
			switch (name) {
				case 'profile':
					privacy.PrivacyProfile = settings[name];
					break;

				case 'comments':
					commentPermission = CommentPrivacyState[settings[name]];
					break;

				case 'inventory':
					privacy.PrivacyInventory = settings[name];
					break;

				case 'inventoryGifts':
					privacy.PrivacyInventoryGifts = settings[name] ? SteamCommunity.PrivacyState.Private : SteamCommunity.PrivacyState.Public;
					break;

				case 'gameDetails':
					privacy.PrivacyOwnedGames = settings[name];
					break;

				case 'playtime':
					privacy.PrivacyPlaytime = settings[name] ? SteamCommunity.PrivacyState.Private : SteamCommunity.PrivacyState.Public;
					break;

				case 'friendsList':
					privacy.PrivacyFriendsList = settings[name];
					break;
			}
		}

		const {statusCode: statusCode2, jsonBody} = await this._myProfile({
			method: 'POST',
			endpoint: 'ajaxsetprivacy/',
			json: true,
			formData: { // it's multipart because lolvalve
				sessionid: this.getSessionID(),
				Privacy: JSON.stringify(privacy),
				eCommentPermission: commentPermission
			}
		}, null);

		if (statusCode2 !== 200) {
			return reject(new Error(`HTTP error ${statusCode2}`));
		}

		if (!jsonBody) {
			return reject(new Error('Malformed response'));
		}

		let jsonError = Helpers.eresultError(jsonBody.success);
		jsonError ? reject(jsonError) : resolve(jsonBody.Privacy);
	});
};

/**
 * Replaces your current avatar image with a new one.
 *
 * @param {string|Buffer} image - A `Buffer` containing the image, a string containing a URL to the image,
 * or a string containing the path to the image on the local disk.
 * @param {*} [format] - Required if image is a `Buffer`, else it will be detected from the `Content-Type` header
 * (if image is a URL) or the file extension (if image is a local path).
 * If provided, format should be one of jpg (or jpeg), gif, or png. These are the only supported image formats.
 *
 * The only supported protocols for URLs are http:// and https://. Any other string will be treated as a local path.
 * @param {function} [callback]
 * @return {Promise<{url: string}>} The URL to the new image on Steam's CDN
 */
SteamCommunity.prototype.uploadAvatar = function(image, format, callback) {
	if (typeof format === 'function') {
		callback = format;
		format = null;
	}

	return StdLib.Promises.callbackPromise(['url'], callback, true, async (resolve, reject) => {
		// are we logged in?
		if (!this.steamID) {
			return reject(new Error('Not Logged In'));
		}

		const doUpload = async (buffer) => {
			if (!format) {
				return reject(new Error('Unknown image format'));
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
					return reject(new Error('Unknown or invalid image format'));
			}

			const {statusCode, jsonBody} = await this.httpRequest({
				method: 'POST',
				url: 'https://steamcommunity.com/actions/FileUploader',
				json: true,
				source: 'steamcommunity',
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
				}
			});

			if (jsonBody && !jsonBody.success && jsonBody.message) {
				return reject(new Error(jsonBody.message));
			}

			if (statusCode !== 200) {
				return reject(new Error(`HTTP error ${statusCode}`));
			}

			if (!jsonBody || !jsonBody.success) {
				return reject(new Error('Malformed response'));
			}

			resolve({url: jsonBody.images.full});
		};

		if (image instanceof Buffer) {
			await doUpload(image);
		} else if (image.match(/^https?:\/\//)) {
			let statusCode, headers, rawBody;
			try {
				({statusCode, headers, rawBody} = await this.httpRequest({
					method: 'GET',
					url: image,
					source: 'steamcommunity'
				}));
			} catch (err) {
				return reject(new Error(`${err.message || err} downloading image`));
			}

			if (statusCode !== 200) {
				return reject(new Error(`HTTP error ${statusCode} downloading image`));
			}

			if (!format) {
				format = headers['content-type'];
			}

			await doUpload(rawBody);
		} else {
			if (!format) {
				format = image.match(/\.([^.]+)$/);
				if (format) {
					format = format[1];
				}
			}

			FS.readFile(image, async (err, file) => {
				if (err) {
					return reject(err);
				}

				await doUpload(file);
			});
		}
	});
};

/**
 * Post a new status to your profile activity feed.
 * @param {string} statusText - The text of this status update
 * @param {{appID: int}} [options] - Options for this status update. All are optional. If you don't pass any options, this can be omitted.
 * @param {function} callback - err, postID
 * @return {Promise<{postID: number}>} The ID of this new post
 */
SteamCommunity.prototype.postProfileStatus = function(statusText, options, callback) {
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}

	return StdLib.Promises.callbackPromise(['postID'], callback, false, (resolve, reject) => {
		const {jsonBody} = this._myProfile('ajaxpostuserstatus/', {
			appid: options.appID || 0,
			sessionid: this.getSessionID(),
			status_text: statusText
		});

		if (!jsonBody) {
			return reject(new Error('Malformed data'));
		}

		if (jsonBody.message) {
			return reject(new Error(jsonBody.message));
		}

		let match = jsonBody.blotter_html.match(/id="userstatus_(\d+)_/);
		if (!match) {
			return reject(new Error('Malformed response'));
		}

		resolve({postID: parseInt(match[1], 10)});
	});
};

/**
 * Delete a previously-posted profile status update.
 * @param {int} postID
 * @param {function} [callback]
 * @return {Promise<void>}
 */
SteamCommunity.prototype.deleteProfileStatus = function(postID, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		const {jsonBody} = this._myProfile('ajaxdeleteuserstatus/', {
			sessionid: this.getSessionID(),
			postid: postID
		});

		if (!jsonBody || !jsonBody.success) {
			return reject(new Error('Malformed response'));
		}

		const err = Helpers.eresultError(jsonBody.success);
		err ? reject(err) : resolve();
	});
};
