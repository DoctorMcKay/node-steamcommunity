const Cheerio = require('cheerio');
const SteamID = require('steamid');
const StdLib = require('@doctormckay/stdlib');

const SteamCommunity  = require('../index.js');
const Helpers = require('../components/helpers.js');


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
		steamID: userID,
		appID: appID,
		postedDate: null,
		updatedDate: null,
		recommended: null,
		content: null,
		commentsAmount: null,
		comments: [],
		recentPlaytimeHours: null,
		totalPlaytimeHours: null,
		playtimeHoursAtReview: null,
		votesHelpful: null,
		votesFunny: null
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
						id: comment.children('.commentthread_comment_text').attr('id').replace('content_', ''),
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
			let ratings = $('.ratingBar').find('br').replaceWith('\n').end().text().trim().split('\n')

			let helpfulStr = ratings.find((e) => e.includes('helpful'));
			let funnyStr   = ratings.find((e) => e.includes('funny'));

			if (helpfulStr) {
				review.votesHelpful = Number(helpfulStr.split(' ')[0]);
			}

			if (funnyStr) {
				review.votesFunny = Number(funnyStr.split(' ')[0]);
			}

		} catch (err) {
			callback(err, null);
		}
	});
};


function CSteamReview(community, data) {

}
