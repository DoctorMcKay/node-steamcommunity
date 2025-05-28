var SteamID = require('steamid');

var SteamCommunity = require('../index.js');

const Helpers = require('./helpers.js');


/**
 * Deletes a comment from a sharedfile's comment section
 * @param {SteamID | String} userID - ID of the user associated to this sharedfile
 * @param {String} sharedFileId - ID of the sharedfile
 * @param {String} cid - ID of the comment to delete
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.deleteSharedFileComment = function(userID, sharedFileId, cid, callback) {
	if (typeof userID === "string") {
		userID = new SteamID(userID);
	}

	this.httpRequestPost({
		"uri": `https://steamcommunity.com/comment/PublishedFile_Public/delete/${userID.toString()}/${sharedFileId}/`,
		"form": {
			"gidcomment": cid,
			"count": 10,
			"json": 1,
			"sessionid": this.getSessionID()
		},
		"json": true
	}, function(err, response, body) {
		if (!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if (body.success) {
			callback(null);
		} else {
			callback(new Error(body.error));
		}
	}, "steamcommunity");
};

/**
 * Favorites a sharedfile
 * @param {String} sharedFileId - ID of the sharedfile
 * @param {String} appid - ID of the app associated to this sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.favoriteSharedFile = function(sharedFileId, appid, callback) {
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/sharedfiles/favorite",
		"form": {
			"id": sharedFileId,
			"appid": appid,
			"sessionid": this.getSessionID()
		}
	}, function(err, response, body) { // Steam does not seem to return any errors for this request
		if (!callback) {
			return;
		}

		callback(err);
	}, "steamcommunity");
};

/**
 * Posts a comment to a sharedfile
 * @param {SteamID | String} userID - ID of the user associated to this sharedfile
 * @param {String} sharedFileId - ID of the sharedfile
 * @param {String} message - Content of the comment to post
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.postSharedFileComment = function(userID, sharedFileId, message, callback) {
	if (typeof userID === "string") {
		userID = new SteamID(userID);
	}

	this.httpRequestPost({
		"uri": `https://steamcommunity.com/comment/PublishedFile_Public/post/${userID.toString()}/${sharedFileId}/`,
		"form": {
			"comment": message,
			"count": 10,
			"json": 1,
			"sessionid": this.getSessionID()
		},
		"json": true
	}, function(err, response, body) {
		if (!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if (body.success) {
			callback(null);
		} else {
			callback(new Error(body.error));
		}
	}, "steamcommunity");
};

/**
 * Subscribes to a sharedfile's comment section. Note: Checkbox on webpage does not update
 * @param {SteamID | String} userID ID of the user associated to this sharedfile
 * @param {String} sharedFileId ID of the sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.subscribeSharedFileComments = function(userID, sharedFileId, callback) {
	if (typeof userID === "string") {
		userID = new SteamID(userID);
	}

	this.httpRequestPost({
		"uri": `https://steamcommunity.com/comment/PublishedFile_Public/subscribe/${userID.toString()}/${sharedFileId}/`,
		"form": {
			"count": 10,
			"json": 1,
			"sessionid": this.getSessionID()
		},
		"json": true
	}, function(err, response, body) { // eslint-disable-line
		if (!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if (body.success && body.success != SteamCommunity.EResult.OK) {
			callback(Helpers.eresultError(body.success));
			return;
		}

		callback(null);
	}, "steamcommunity");
};

/**
 * Unfavorites a sharedfile
 * @param {String} sharedFileId - ID of the sharedfile
 * @param {String} appid - ID of the app associated to this sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.unfavoriteSharedFile = function(sharedFileId, appid, callback) {
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/sharedfiles/unfavorite",
		"form": {
			"id": sharedFileId,
			"appid": appid,
			"sessionid": this.getSessionID()
		}
	}, function(err, response, body) { // Steam does not seem to return any errors for this request
		if (!callback) {
			return;
		}

		callback(err);
	}, "steamcommunity");
};

/**
 * Unsubscribes from a sharedfile's comment section. Note: Checkbox on webpage does not update
 * @param {SteamID | String} userID - ID of the user associated to this sharedfile
 * @param {String} sharedFileId - ID of the sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.unsubscribeSharedFileComments = function(userID, sharedFileId, callback) {
	if (typeof userID === "string") {
		userID = new SteamID(userID);
	}

	this.httpRequestPost({
		"uri": `https://steamcommunity.com/comment/PublishedFile_Public/unsubscribe/${userID.toString()}/${sharedFileId}/`,
		"form": {
			"count": 10,
			"json": 1,
			"sessionid": this.getSessionID()
		},
		"json": true
	}, function(err, response, body) { // eslint-disable-line
		if (!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if (body.success && body.success != SteamCommunity.EResult.OK) {
			callback(Helpers.eresultError(body.success));
			return;
		}

		callback(null);
	}, "steamcommunity");
};