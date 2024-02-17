const SteamID = require('steamid');
const StdLib  = require('@doctormckay/stdlib');

const SteamCommunity = require('../index.js');
const Helpers = require('../components/helpers.js');


/**
 * Posts a comment to a review
 * @param {string | SteamID} userID - SteamID object or steamID64 of the review author
 * @param {string} appID - AppID of the associated game
 * @param {String} message - Content of the comment to post
 * @param {function} [callback] - Takes only an Error object/null as the first argument
 * @return Promise<void> Resolves on success, rejects on failure
 */
SteamCommunity.prototype.postReviewComment = function(userID, appID, message, callback) {
	if (typeof userID == 'string') {
		userID = new SteamID(userID);
	}

	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let res = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/comment/Recommendation/post/${userID.getSteamID64()}/${appID}/`,
			form: {
				comment: message,
				count: 10,
				sessionid: this.getSessionID()
			},
			source: 'steamcommunity',
			checkCommunityError: true
		});

		if (res.jsonBody && res.jsonBody.success != SteamCommunity.EResult.OK) {
			reject(new Error(res.jsonBody.error));
			return;
		}

		resolve();
	});
};

/**
 * Deletes a comment from a review
 * @param {string | SteamID} userID - SteamID object or steamID64 of the review author
 * @param {string} appID - AppID of the associated game
 * @param {String} message - Content of the comment to post
 * @param {function} [callback] - Takes only an Error object/null as the first argument
 * @return Promise<void> Resolves on success, rejects on failure
 */
SteamCommunity.prototype.deleteReviewComment = function(userID, appID, cid, callback) {
	if (typeof userID == 'string') {
		userID = new SteamID(userID);
	}

	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let res = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/comment/Recommendation/delete/${userID.getSteamID64()}/${appID}/`,
			form: {
				gidcomment: cid,
				count: 10,
				sessionid: this.getSessionID()
			},
			source: 'steamcommunity',
			checkCommunityError: true
		});

		if (res.jsonBody && res.jsonBody.success != SteamCommunity.EResult.OK) {
			reject(new Error(res.jsonBody.error));
			return;
		}

		resolve();
	});
};

/**
 * Subscribes to a review's comment section
 * @param {string | SteamID} userID - SteamID object or steamID64 of the review author
 * @param {string} appID - AppID of the associated game
 * @param {function} [callback] - Takes only an Error object/null as the first argument
 * @return Promise<void> Resolves on success, rejects on failure
 */
SteamCommunity.prototype.subscribeReviewComments = function(userID, appID, callback) {
	if (typeof userID == 'string') {
		userID = new SteamID(userID);
	}

	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/comment/Recommendation/subscribe/${userID.getSteamID64()}/${appID}/`,
			form: {
				count: 10,
				sessionid: this.getSessionID()
			},
			source: 'steamcommunity'
		});

		resolve();
	});
};

/**
 * Unsubscribes from a review's comment section
 * @param {string | SteamID} userID - SteamID object or steamID64 of the review author
 * @param {string} appID - AppID of the associated game
 * @param {function} [callback] - Takes only an Error object/null as the first argument
 * @return Promise<void> Resolves on success, rejects on failure
 */
SteamCommunity.prototype.unsubscribeReviewComments = function(userID, appID, callback) {
	if (typeof userID == 'string') {
		userID = new SteamID(userID);
	}

	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/comment/Recommendation/unsubscribe/${userID.getSteamID64()}/${appID}/`,
			form: {
				count: 10,
				sessionid: this.getSessionID()
			},
			source: 'steamcommunity'
		});

		resolve();
	});
};

/**
 * Votes on a review as helpful
 * @param {string} rid - ID of the review. You can obtain it through `getSteamReview()`
 * @param {function} [callback] - Takes only an Error object/null as the first argument
 * @return Promise<void> Resolves on success, rejects on failure
 */
SteamCommunity.prototype.voteReviewHelpful = function(rid, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let res = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/userreviews/rate/${rid}`,
			form: {
				rateup: 'true',
				sessionid: this.getSessionID()
			},
			source: 'steamcommunity',
			checkCommunityError: true
		});

		if (res.jsonBody && res.jsonBody.success != SteamCommunity.EResult.OK) {
			reject(Helpers.eresultError(res.jsonBody.success));
			return;
		}

		resolve();
	});
};

/**
 * Votes on a review as unhelpful
 * @param {string} rid - ID of the review. You can obtain it through `getSteamReview()`
 * @param {function} [callback] - Takes only an Error object/null as the first argument
 * @return Promise<void> Resolves on success, rejects on failure
 */
SteamCommunity.prototype.voteReviewUnhelpful = function(rid, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let res = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/userreviews/rate/${rid}`,
			form: {
				rateup: 'false',
				sessionid: this.getSessionID()
			},
			source: 'steamcommunity',
			checkCommunityError: true
		});

		if (res.jsonBody && res.jsonBody.success != SteamCommunity.EResult.OK) {
			reject(Helpers.eresultError(res.jsonBody.success));
			return;
		}

		resolve();
	});
};

/**
 * Votes on a review as funny
 * @param {string} rid - ID of the review. You can obtain it through `getSteamReview()`
 * @param {function} [callback] - Takes only an Error object/null as the first argument
 * @return Promise<void> Resolves on success, rejects on failure
 */
SteamCommunity.prototype.voteReviewFunny = function(rid, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let res = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/userreviews/votetag/${rid}`,
			form: {
				tagid: '1',
				rateup: 'true',
				sessionid: this.getSessionID()
			},
			source: 'steamcommunity',
			checkCommunityError: true
		});

		if (res.jsonBody && res.jsonBody.success != SteamCommunity.EResult.OK) {
			reject(Helpers.eresultError(res.jsonBody.success));
			return;
		}

		resolve();
	});
};

/**
 * Removes funny vote from a review
 * @param {string} rid - ID of the review. You can obtain it through `getSteamReview()`
 * @param {function} [callback] - Takes only an Error object/null as the first argument
 * @return Promise<void> Resolves on success, rejects on failure
 */
SteamCommunity.prototype.voteReviewRemoveFunny = function(rid, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let res = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/userreviews/votetag/${rid}`,
			form: {
				tagid: '1',
				rateup: 'false',
				sessionid: this.getSessionID()
			},
			source: 'steamcommunity',
			checkCommunityError: true
		});

		if (res.jsonBody && res.jsonBody.success != SteamCommunity.EResult.OK) {
			reject(Helpers.eresultError(res.jsonBody.success));
			return;
		}

		resolve();
	});
};
