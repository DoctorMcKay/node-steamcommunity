const Cheerio = require('cheerio');
const SteamID = require('steamid');
const StdLib = require('@doctormckay/stdlib');

const SteamCommunity  = require('../index.js');
const Helpers = require('../components/helpers.js');


/**
 * @typedef Review
 * @type {object}
 * @property {string} [reviewID] ID of review, used for voting & reporting. Remains `null` if it is your review or you are not logged in as the buttons are not presented then.
 * @property {SteamID} steamID SteamID object of the review author
 * @property {string} appID AppID of the associated game
 * @property {Date} postedDate Date of when the review was posted initially
 * @property {Date} [updatedDate] Date of when the review was last updated. Remains `null` if review was never updated
 * @property {boolean} recommended True if the author recommends the game, false otherwise.
 * @property {boolean} isEarlyAccess True if the review is an early access review
 * @property {string} content Text content of the review
 * @property {number} [commentsAmount] Amount of comments reported by Steam. Remains `null` if coments are disabled
 * @property {Array.<{ index: number, id: string, authorLink: string, postedDate: Date, content: string }>} [comments] Array of the last 10 comments left on this review
 * @property {number} recentPlaytimeHours Amount of hours the author played this game for in the last 2 weeks
 * @property {number} totalPlaytimeHours Amount of hours the author played this game for in total
 * @property {number} [playtimeHoursAtReview] Amount of hours the author played this game for at the point of review. Remains `null` if Steam does not provide this information.
 * @property {number} votesHelpful Amount of 'Review is helpful' votes
 * @property {number} votesFunny Amount of 'Review is funny' votes
 */

/**
 * Scrape a review's DOM to get all available information
 * @param {string | SteamID} userID - SteamID object or steamID64 of the review author
 * @param {string} appID - AppID of the associated game
 * @param {function(Error, CSteamReview)} [callback] - First argument is null/Error, second is object containing all available information
 * @returns {Promise.<CSteamReview>} Resolves with CSteamReview object
 */
SteamCommunity.prototype.getSteamReview = function(userID, appID, callback) {
	if (typeof userID !== 'string' && !Helpers.isSteamID(userID)) {
		throw new Error('userID parameter should be a user URL string or a SteamID object');
	}

	if (typeof userID === 'object' && (userID.universe != SteamID.Universe.PUBLIC || userID.type != SteamID.Type.INDIVIDUAL)) {
		throw new Error('SteamID must stand for an individual account in the public universe');
	}

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}


	// Construct object holding all the data we can scrape
	let review = {
		reviewID: null,
		steamID: userID,
		appID: appID,
		postedDate: null,
		updatedDate: null,
		recommended: null,
		isEarlyAccess: false,
		content: null,
		commentsAmount: null,
		comments: [],
		recentPlaytimeHours: null,
		totalPlaytimeHours: null,
		playtimeHoursAtReview: null,
		votesHelpful: 0,
		votesFunny: 0
	};


	// Get DOM of review
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'GET',
			url: `https://steamcommunity.com/profiles/${userID.getSteamID64()}/recommended/${appID}?l=en`,
			source: 'steamcommunity',
			followRedirect: true // This setting is important: Steam redirects /profiles/ links to /id/ if user has a vanity set
		});


		try {

			// Load output into cheerio to make parsing easier
			let $ = Cheerio.load(result.textBody);


			// Find reviewID which is needed for upvoting, downvoting, etc.
			review.reviewID = $('.review_rate_bar').children('span').attr('id').replace('RecommendationVoteUpBtn', '');

			// Find postedDate & updatedDate and convert to timestamp
			let posted = $('.recommendation_date').text().split('\n');

			posted.forEach((e) => {
				e = e.trim();

				if (e.startsWith('Posted')) {
					review.postedDate = Helpers.decodeSteamTime(e.replace('Posted: ', ''));
				}
				if (e.startsWith('Updated')) {
					review.updatedDate = Helpers.decodeSteamTime(e.replace('Updated: ', ''));
				}
			});

			// Find out if user recommended the game or not
			review.recommended = $('.ratingSummary').text().trim() == 'Recommended';

			// Find out if review is an early access review
			review.isEarlyAccess = $('.early_access_review').length > 0;

			// Get content
			review.content = $('.review_area_content > #ReviewText').find('br').replaceWith('\n').end().text().trim(); // Preserve line breaks in text

			// Get comments data if any exist
			let commentThread = $('.commentthread_area').children();

			if (commentThread.length > 0) {
				// Get amount of comments reported by Steam
				review.commentsAmount = Number(commentThread.children('.commentthread_count').children('.commentthread_count_label').children().first().text());

				// Get content and author of each comment
				commentThread.children('.commentthread_comments').children().each(async (i, e) => {
					let comment = $(e).children('.commentthread_comment_content'); // The whole comment

					let author = comment.children('.commentthread_comment_author'); // The author part of the comment - contains profile link and date
					let commentEmoji = comment.children('.commentthread_comment_text').find('img'); // Emojis in the comment text

					review.comments.push({
						index: i,
						id: comment.children('.commentthread_comment_text').attr('id').replace('comment_content_', ''),
						authorLink: author.children('.commentthread_author_link').attr('href'),
						postedDate: Helpers.decodeSteamTime(author.children('.commentthread_comment_timestamp').text()),
						content: commentEmoji.replaceWith(commentEmoji.attr('alt')).end().find('br').replaceWith('\n').end().text().trim() // Preserve emojis by using alt text and line breaks in text
					});
				});
			}

			// Get recent playtime. Format: recentPlaytime / totalPlaytime (playtimeAtReview)
			let playtimeStr = $('.ratingSummaryHeader > .playTime').text().trim().split('/');

			review.recentPlaytimeHours = Number(playtimeStr[0].trim().split(' ')[0]);
			review.totalPlaytimeHours = Number(playtimeStr[1].trim().split(' ')[0]);

			if (playtimeStr[1].includes('at review time')) { // Some reviews don't contain info about playtime at the time of review
				review.playtimeHoursAtReview = Number(playtimeStr[1].trim().split('(')[1].split(' ')[0]);
			}

			// Get votes
			let ratings = $('.ratingBar').find('br').replaceWith('\n').end().text().trim().split('\n');

			let helpfulStr = ratings.find((e) => e.includes('helpful'));
			let funnyStr   = ratings.find((e) => e.includes('funny'));

			if (helpfulStr) {
				review.votesHelpful = Number(helpfulStr.split(' ')[0]);
			}

			if (funnyStr) {
				review.votesFunny = Number(funnyStr.split(' ')[0]);
			}

			resolve(new CSteamReview(this, review));

		} catch (err) {
			reject(err);
		}
	});
};


/**
 * Constructor - Creates a new CSteamReview object
 * @class
 * @param {SteamCommunity} community - Current SteamCommunity instance
 * @param {Review} data - Review data collected by the scraper
 */
function CSteamReview(community, data) {
	/**
	 * @type {SteamCommunity}
	 */
	this._community = community;

	// Clone all the data we received
	Object.assign(this, data);
}


/**
 * Posts a comment to this review
 * @param {string} message - Content of the comment to post
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamReview.prototype.comment = function(message, callback) {
	this._community.postReviewComment(this.steamID.getSteamID64(), this.appID, message, callback);
};

/**
 * Deletes a comment from this review
 * @param {string} gidcomment - ID of the comment to delete
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamReview.prototype.deleteComment = function(gidcomment, callback) {
	this._community.deleteReviewComment(this.steamID.getSteamID64(), this.appID, gidcomment, callback);
};

/**
 * Subscribes to this review's comment section
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamReview.prototype.subscribe = function(callback) {
	this._community.subscribeReviewComments(this.steamID.getSteamID64(), this.appID, callback);
};

/**
 * Unsubscribes from this review's comment section
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamReview.prototype.unsubscribe = function(callback) {
	this._community.unsubscribeReviewComments(this.steamID.getSteamID64(), this.appID, callback);
};

/**
 * Votes on this review as helpful
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamReview.prototype.voteHelpful = function(callback) {
	this._community.voteReviewHelpful(this.reviewID, callback);
};

/**
 * Votes on this review as unhelpful
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamReview.prototype.voteUnhelpful = function(callback) {
	this._community.voteReviewUnhelpful(this.reviewID, callback);
};

/**
 * Votes on this review as funny
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamReview.prototype.voteFunny = function(callback) {
	this._community.voteReviewFunny(this.reviewID, callback);
};

/**
 * Removes funny vote from this review
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamReview.prototype.voteRemoveFunny = function(callback) {
	this._community.voteReviewRemoveFunny(this.reviewID, callback);
};
