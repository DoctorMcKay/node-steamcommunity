var SteamCommunity = require('../index.js');
var SteamID = require('steamid');


/**
 * Deletes a comment from a sharedfile's comment section
 * @param {SteamID | String} userID - ID of the user associated to this sharedfile
 * @param {String} sid - ID of the sharedfile
 * @param {String} cid - ID of the comment to delete
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.deleteSharedfileComment = function(userID, sid, cid, callback) {
	if (typeof userID === "string") {
		userID = new SteamID(userID);
	}

	this.httpRequestPost({
		"uri": `https://steamcommunity.com/comment/PublishedFile_Public/delete/${userID.toString()}/${sid}/`,
		"form": {
			"gidcomment": cid,
			"count": 10,
			"sessionid": this.getSessionID()
		}
	}, function(err, response, body) {
		if (!callback) {
			return;
		}

		callback(null || err);
	}, "steamcommunity");
};

/**
 * Favorites a sharedfile
 * @param {String} sid - ID of the sharedfile
 * @param {String} appid - ID of the app associated to this sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.favoriteSharedfile = function(sid, appid, callback) {
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/sharedfiles/favorite",
		"form": {
			"id": sid,
			"appid": appid,
			"sessionid": this.getSessionID()
		}
	}, function(err, response, body) {
		if (!callback) {
			return;
		}

		callback(null || err);
	}, "steamcommunity");
};

/**
 * Posts a comment to a sharedfile
 * @param {SteamID | String} userID - ID of the user associated to this sharedfile
 * @param {String} sid - ID of the sharedfile
 * @param {String} message - Content of the comment to post
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.postSharedfileComment = function(userID, sid, message, callback) {
	if (typeof userID === "string") {
		userID = new SteamID(userID);
	}

	this.httpRequestPost({
		"uri": `https://steamcommunity.com/comment/PublishedFile_Public/post/${userID.toString()}/${sid}/`,
		"form": {
			"comment": message,
			"count": 10,
			"sessionid": this.getSessionID()
		}
	}, function(err, response, body) {
		if (!callback) {
			return;
		}

		callback(null || err);
	}, "steamcommunity");
};

/**
 * Subscribes to a sharedfile's comment section. Note: Checkbox on webpage does not update
 * @param {SteamID | String} userID ID of the user associated to this sharedfile
 * @param {String} sid ID of the sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.subscribeSharedfileComments = function(userID, sid, callback) {
	if (typeof userID === "string") {
		userID = new SteamID(userID);
	}

	this.httpRequestPost({
		"uri": `https://steamcommunity.com/comment/PublishedFile_Public/subscribe/${userID.toString()}/${sid}/`,
		"form": {
			"count": 10,
			"sessionid": this.getSessionID()
		}
	}, function(err, response, body) { // eslint-disable-line
		if (!callback) {
			return;
		}

		callback(null || err);
	}, "steamcommunity");
};

/**
 * Unfavorites a sharedfile
 * @param {String} sid - ID of the sharedfile
 * @param {String} appid - ID of the app associated to this sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.unfavoriteSharedfile = function(sid, appid, callback) {
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/sharedfiles/unfavorite",
		"form": {
			"id": sid,
			"appid": appid,
			"sessionid": this.getSessionID()
		}
	}, function(err, response, body) {
		if (!callback) {
			return;
		}

		callback(null || err);
	}, "steamcommunity");
};

/**
 * Unsubscribes from a sharedfile's comment section. Note: Checkbox on webpage does not update
 * @param {SteamID | String} userID - ID of the user associated to this sharedfile
 * @param {String} sid - ID of the sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.unsubscribeSharedfileComments = function(userID, sid, callback) {
	if (typeof userID === "string") {
		userID = new SteamID(userID);
	}

	this.httpRequestPost({
		"uri": `https://steamcommunity.com/comment/PublishedFile_Public/unsubscribe/${userID.toString()}/${sid}/`,
		"form": {
			"count": 10,
			"sessionid": this.getSessionID()
		}
	}, function(err, response, body) { // eslint-disable-line
		if (!callback) {
			return;
		}

		callback(null || err);
	}, "steamcommunity");
};
