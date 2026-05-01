const Cheerio = require('cheerio');
const StdLib = require('@doctormckay/stdlib');

const SteamCommunity = require('../index.js');
const Helpers = require('./helpers.js');


/**
 * Scrapes a range of comments from a Steam discussion
 * @param {url} url - SteamCommunity url pointing to the discussion to fetch
 * @param {number} startIndex - Index (0 based) of the first comment to fetch
 * @param {number} endIndex - Index (0 based) of the last comment to fetch
 * @param {function} callback - First argument is null/Error, second is array containing the requested comments
 */
SteamCommunity.prototype.getDiscussionComments = function(url, startIndex, endIndex, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'GET',
			url: url + '?l=en',
			source: 'steamcommunity'
		});


		// Load output into cheerio to make parsing easier
		let $ = Cheerio.load(result.textBody);

		let paging = $('.forum_paging > .forum_paging_summary').children();

		/**
		 * Stores every loaded page inside a Cheerio instance
		 * @type {{[key: number]: cheerio.Root}}
		 */
		let pages = {
			0: $
		};


		// Determine amount of comments per page and total. Update endIndex if null to get all comments
		let commentsPerPage = Number(paging[4].children[0].data);
		let totalComments   = Number(paging[5].children[0].data);

		if (endIndex == null || endIndex > totalComments - 1) { // Make sure to check against null as the index 0 would cast to false
			endIndex = totalComments - 1;
		}


		// Save all pages that need to be fetched in order to get the requested comments
		let firstPage = Math.trunc(startIndex / commentsPerPage); // Index of the first page that needs to be fetched
		let lastPage  = Math.trunc(endIndex   / commentsPerPage);
		let promises  = [];

		for (let i = firstPage; i <= lastPage; i++) {
			if (i == 0) continue; // First page is already in pages object

			promises.push(new Promise((resolve) => {
				setTimeout(async () => { // Delay fetching a bit to reduce the risk of Steam blocking us

					let commentsPage = await this.httpRequest({
						method: 'GET',
						url: url + '?l=en&ctp=' + (i + 1),
						source: 'steamcommunity'
					});

					try {
						pages[i] = Cheerio.load(commentsPage.textBody);
						resolve();
					} catch (err) {
						return reject('Failed to load comments page: ' + err);
					}

				}, 250 * i);
			}));
		}

		await Promise.all(promises); // Wait for all pages to be fetched


		// Fill comments with content of all comments
		let comments = [];

		for (let i = startIndex; i <= endIndex; i++) {
			let $ = pages[Math.trunc(i / commentsPerPage)];

			let thisComment = $(`.forum_comment_permlink:contains("#${i + 1}")`).parent();
			let thisCommentID = thisComment.attr('id').replace('comment_', '');

			// Note: '>' inside the cheerio selectors didn't work here
			let authorContainer  = thisComment.children('.commentthread_comment_content').children('.commentthread_comment_author').children('.commentthread_author_link');
			let commentContainer = thisComment.children('.commentthread_comment_content').children(`#comment_content_${thisCommentID}`);


			// Prepare comment text by finding all existing blockquotes, formatting them and adding them infront each other. Afterwards handle the text itself
			let commentText = '';
			let blockQuoteSelector = '.bb_blockquote';
			let children = commentContainer.children(blockQuoteSelector);

			for (let i = 0; i < 10; i++) { // I'm not sure how I could dynamically check the amount of nested blockquotes. 10 is prob already too much to stay readable
				if (children.length > 0) {
					let thisQuoteText = '';

					thisQuoteText += children.children('.bb_quoteauthor').text() + '\n'; // Get quote header and add a proper newline

					// Replace <br>'s with newlines to get a proper output
					let quoteWithNewlines = children.first().find('br').replaceWith('\n');

					thisQuoteText += quoteWithNewlines.end().contents().filter(function() { return this.type === 'text'; }).text().trim(); // Get blockquote content without child content - https://stackoverflow.com/a/23956052
					if (i > 0) thisQuoteText += '\n-------\n'; // Add spacer

					commentText = thisQuoteText + commentText; // Concat quoteText to the start of commentText as the most nested quote is the first one inside the comment chain itself

					// Go one level deeper
					children = children.children(blockQuoteSelector);

				} else {

					commentText += '\n\n-------\n\n'; // Add spacer
					break;
				}
			}

			let quoteWithNewlines = commentContainer.first().find('br').replaceWith('\n'); // Replace <br>'s with newlines to get a proper output

			commentText += quoteWithNewlines.end().contents().filter(function() { return this.type === 'text'; }).text().trim(); // Add comment content without child content - https://stackoverflow.com/a/23956052


			comments.push({
				index: i,
				commentId: thisCommentID,
				commentLink: `${url}#c${thisCommentID}`,
				authorLink: authorContainer.attr('href'),                                 // I did not call 'resolveVanityURL()' here and convert to SteamID to reduce the amount of potentially unused Steam pings
				postedDate: Helpers.decodeSteamTime(authorContainer.children('.commentthread_comment_timestamp').text().trim()),
				content: commentText.trim()
			});
		}


		// Resolve with our result
		resolve(comments);

	});
};

/**
 * Posts a comment to a discussion
 * @param {String} topicOwner - ID of the topic owner
 * @param {String} gidforum - GID of the discussion's forum
 * @param {String} discussionId - ID of the discussion
 * @param {String} message - Content of the comment to post
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.postDiscussionComment = function(topicOwner, gidforum, discussionId, message, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/comment/ForumTopic/post/${topicOwner}/${gidforum}/`,
			form: {
				comment: message,
				count: 15,
				sessionid: this.getSessionID(),
				extended_data: '{"topic_permissions":{"can_view":1,"can_post":1,"can_reply":1}}',
				feature2: discussionId,
				json: 1
			},
			source: 'steamcommunity'
		});

		if (result.jsonBody.success) {
			resolve(null);
		} else {
			reject(new Error(result.jsonBody.error));
		}
	});
};

/**
 * Deletes a comment from a discussion
 * @param {String} topicOwner - ID of the topic owner
 * @param {String} gidforum - GID of the discussion's forum
 * @param {String} discussionId - ID of the discussion
 * @param {String} gidcomment - ID of the comment to delete
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.deleteDiscussionComment = function(topicOwner, gidforum, discussionId, gidcomment, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/comment/ForumTopic/delete/${topicOwner}/${gidforum}/`,
			form: {
				gidcomment: gidcomment,
				count: 15,
				sessionid: this.getSessionID(),
				extended_data: '{"topic_permissions":{"can_view":1,"can_post":1,"can_reply":1}}',
				feature2: discussionId,
				json: 1
			},
			source: 'steamcommunity'
		});

		if (result.jsonBody.success) {
			resolve(null);
		} else {
			reject(new Error(result.jsonBody.error));
		}
	});
};

/**
 * Subscribes to a discussion's comment section
 * @param {String} topicOwner - ID of the topic owner
 * @param {String} gidforum - GID of the discussion's forum
 * @param {String} discussionId - ID of the discussion
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.subscribeDiscussionComments = function(topicOwner, gidforum, discussionId, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/comment/ForumTopic/subscribe/${topicOwner}/${gidforum}/`,
			form: {
				count: 15,
				sessionid: this.getSessionID(),
				extended_data: '{"topic_permissions":{"can_view":1,"can_post":1,"can_reply":1}}',
				feature2: discussionId,
				json: 1
			},
			source: 'steamcommunity'
		});

		if (result.jsonBody.success && result.jsonBody.success != SteamCommunity.EResult.OK) {
			reject(Helpers.eresultError(result.jsonBody.success));
			return;
		}

		resolve(null);
	});
};

/**
 * Unsubscribes from a discussion's comment section
 * @param {String} topicOwner - ID of the topic owner
 * @param {String} gidforum - GID of the discussion's forum
 * @param {String} discussionId - ID of the discussion
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.unsubscribeDiscussionComments = function(topicOwner, gidforum, discussionId, callback) {
	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'POST',
			url: `https://steamcommunity.com/comment/ForumTopic/unsubscribe/${topicOwner}/${gidforum}/`,
			form: {
				count: 15,
				sessionid: this.getSessionID(),
				extended_data: '{}', // Unsubscribing does not require any data here
				feature2: discussionId,
				json: 1
			},
			source: 'steamcommunity'
		});

		if (result.jsonBody.success && result.jsonBody.success != SteamCommunity.EResult.OK) {
			reject(Helpers.eresultError(result.jsonBody.success));
			return;
		}

		resolve(null);
	});
};

/**
 * Sets an amount of comments per page
 * @param {String} value - 15, 30 or 50
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.setDiscussionCommentsPerPage = function(value, callback) {
	if (!['15', '30', '50'].includes(value)) value = '50'; // Check for invalid setting

	return StdLib.Promises.callbackPromise(null, callback, true, async (resolve, reject) => {
		let result = await this.httpRequest({
			method: 'POST',
			url: 'https://steamcommunity.com/forum/0/0/setpreference',
			form: {
				preference: 'topicrepliesperpage',
				value: value,
				sessionid: this.getSessionID(),
			},
			source: 'steamcommunity'
		});

		if (result.jsonBody.success && result.jsonBody.success != SteamCommunity.EResult.OK) {
			reject(Helpers.eresultError(result.jsonBody.success));
			return;
		}

		resolve(null);
	});
};