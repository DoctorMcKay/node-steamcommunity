const SteamID = require('steamid');
const StdLib  = require('@doctormckay/stdlib');

const SteamCommunity = require('../index.js');
const Helpers = require('../components/helpers.js');


/**
 * Posts a comment to a review
 * @param {String} message - Content of the comment to post
 * @param {function} [callback] - Takes only an Error object/null as the first argument
 * @return Promise<void>
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
