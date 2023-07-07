const SteamID = require('steamid');
const XML2JS = require('xml2js');

const Helpers = require('../components/helpers.js');
const SteamCommunity = require('../index.js');

SteamCommunity.prototype.getSteamUser = function(id, callback) {
	if (typeof id !== 'string' && !Helpers.isSteamID(id)) {
		throw new Error('id parameter should be a user URL string or a SteamID object');
	}

	if (typeof id === 'object' && (id.universe != SteamID.Universe.PUBLIC || id.type != SteamID.Type.INDIVIDUAL)) {
		throw new Error('SteamID must stand for an individual account in the public universe');
	}

	this.httpRequest('http://steamcommunity.com/' + (typeof id === 'string' ? 'id/' + id : 'profiles/' + id.toString()) + '/?xml=1', (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		XML2JS.parseString(body, (err, result) => {
			if (err || (!result.response && !result.profile)) {
				callback(err || new Error('No valid response'));
				return;
			}

			if (result.response && result.response.error && result.response.error.length) {
				callback(new Error(result.response.error[0]));
				return;
			}

			// Try and find custom URL from redirect
			let customurl = null;
			if (response.request.redirects && response.request.redirects.length) {
				let match = response.request.redirects[0].redirectUri.match(/https?:\/\/steamcommunity\.com\/id\/([^/])+\/\?xml=1/);
				if (match) {
					customurl = match[1];
				}
			}

			if (!result.profile.steamID64) {
				callback(new Error('No valid response'));
				return;
			}

			callback(null, new CSteamUser(this, result.profile, customurl));
		});
	}, 'steamcommunity');
};

function CSteamUser(community, userData, customurl) {
	this._community = community;

	this.steamID = new SteamID(userData.steamID64[0]);
	this.name = processItem('steamID');
	this.onlineState = processItem('onlineState');
	this.stateMessage = processItem('stateMessage');
	this.privacyState = processItem('privacyState', 'uncreated');
	this.visibilityState = processItem('visibilityState');
	this.avatarHash = processItem('avatarIcon', '').match(/([0-9a-f]+)\.[a-z]+$/);
	if (this.avatarHash) {
		this.avatarHash = this.avatarHash[1];
	}

	this.vacBanned = processItem('vacBanned', false) == 1;
	this.tradeBanState = processItem('tradeBanState', 'None');
	this.isLimitedAccount = processItem('isLimitedAccount') == 1;
	this.customURL = processItem('customURL', customurl);

	if (this.visibilityState == SteamCommunity.PrivacyState.Public) {
		let memberSinceValue = processItem('memberSince', '0').replace(/(\d{1,2})(st|nd|th)/, '$1');

		if (memberSinceValue.indexOf(',') === -1) {
			memberSinceValue += ', ' + new Date().getFullYear();
		}

		this.memberSince = new Date(memberSinceValue);
		this.location = processItem('location');
		this.realName = processItem('realname');
		this.summary = processItem('summary');
	} else {
		this.memberSince = null;
		this.location = null;
		this.realName = null;
		this.summary = null;
	}

	// Maybe handle mostPlayedGames?

	this.groups = null;
	this.primaryGroup = null;

	if (userData.groups && userData.groups[0] && userData.groups[0].group) {
		this.groups = userData.groups[0].group.map((group) => {
			if (group.$ && group.$.isPrimary === '1') {
				this.primaryGroup = new SteamID(group.groupID64[0]);
			}

			return new SteamID(group.groupID64[0]);
		});
	}

	function processItem(name, defaultVal) {
		if (!userData[name]) {
			return defaultVal;
		}

		return userData[name][0];
	}
}

CSteamUser.getAvatarURL = function(hash, size, protocol) {
	size = size || '';
	protocol = protocol || 'http://';

	hash = hash || '72f78b4c8cc1f62323f8a33f6d53e27db57c2252'; // The default "?" avatar

	let url = protocol + 'steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/' + hash.substring(0, 2) + '/' + hash;
	if (size == 'full' || size == 'medium') {
		return url + '_' + size + '.jpg';
	} else {
		return url + '.jpg';
	}
};

CSteamUser.prototype.getAvatarURL = function(size, protocol) {
	return CSteamUser.getAvatarURL(this.avatarHash, size, protocol);
};

CSteamUser.prototype.addFriend = function(callback) {
	this._community.addFriend(this.steamID, callback);
};

CSteamUser.prototype.acceptFriendRequest = function(callback) {
	this._community.acceptFriendRequest(this.steamID, callback);
};

CSteamUser.prototype.removeFriend = function(callback) {
	this._community.removeFriend(this.steamID, callback);

};

CSteamUser.prototype.blockCommunication = function(callback) {
	this._community.blockCommunication(this.steamID, callback);
};

CSteamUser.prototype.unblockCommunication = function(callback) {
	this._community.unblockCommunication(this.steamID, callback);
};

CSteamUser.prototype.comment = function(message, callback) {
	this._community.postUserComment(this.steamID, message, callback);
};

CSteamUser.prototype.deleteComment = function(commentID, callback) {
	this._community.deleteUserComment(this.steamID, commentID, callback);
};

CSteamUser.prototype.getComments = function(options, callback) {
	this._community.getUserComments(this.steamID, options, callback);
};

CSteamUser.prototype.inviteToGroup = function(groupID, callback) {
	this._community.inviteUserToGroup(this.steamID, groupID, callback);
};

CSteamUser.prototype.getAliases = function(callback) {
	this._community.getUserAliases(this.steamID, callback);
};

CSteamUser.prototype.getInventoryContexts = function(callback) {
	this._community.getUserInventoryContexts(this.steamID, callback);
};

/**
 * Get the contents of a user's inventory context.
 * @deprecated Use CSteamUser#getInventoryContents instead
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param callback
 */
CSteamUser.prototype.getInventory = function(appID, contextID, tradableOnly, callback) {
	this._community.getUserInventory(this.steamID, appID, contextID, tradableOnly, callback);
};

/**
 * Get the contents of a user's inventory context.
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param {string} [language] - The language of item descriptions to return. Omit for default (which may either be English or your account's chosen language)
 * @param callback
 */
CSteamUser.prototype.getInventoryContents = function(appID, contextID, tradableOnly, language, callback) {
	this._community.getUserInventoryContents(this.steamID, appID, contextID, tradableOnly, language, callback);
};

/**
 * Get the background URL of user's profile.
 * @param {function} callback
 */
CSteamUser.prototype.getProfileBackground = function(callback) {
	this._community.getUserProfileBackground(this.steamID, callback);
};

/**
 * Upload an image to Steam and send it to the target user over chat.
 * @param {Buffer} imageContentsBuffer - The image contents, as a Buffer
 * @param {{spoiler?: boolean}} [options]
 * @param {function} callback
 */
CSteamUser.prototype.sendImage = function(imageContentsBuffer, options, callback) {
	this._community.sendImageToUser(this.steamID, imageContentsBuffer, options, callback);
};
