const Cheerio = require('cheerio');
const SteamID = require('steamid');

const SteamCommunity  = require('../index.js');
const Helpers = require('../components/helpers.js');


/**
 * Scrape a discussion's DOM to get all available information
 * @param {string} url - SteamCommunity url pointing to the discussion to fetch
 * @param {function} callback - First argument is null/Error, second is object containing all available information
 */
SteamCommunity.prototype.getSteamDiscussion = function(url, callback) {
	// Construct object holding all the data we can scrape
	let discussion = {
		id: null,
		appID: null,
		forumID: null,
		author: null,
		postedDate: null,
		title: null,
		content: null,
		commentsAmount: null // I originally wanted to fetch all comments by default but that would have been a lot of potentially unused data
	};

	// Get DOM of discussion
	this.httpRequestGet(url, (err, res, body) => {
		try {

			/* --------------------- Preprocess output --------------------- */

			// Load output into cheerio to make parsing easier
			let $ = Cheerio.load(body);

			// Get breadcrumbs once
			let breadcrumbs = $(".forum_breadcrumbs").children();


			/* --------------------- Find and map values --------------------- */

			// Get discussionID from url
			discussion.id = url.split("/")[url.split("/").length - 1];


			// Get appID from breadcrumbs
			let appIdHref = breadcrumbs[0].attribs["href"].split("/");

			discussion.appID = appIdHref[appIdHref.length - 1];


			// Get forumID from breadcrumbs
			let forumIdHref = breadcrumbs[2].attribs["href"].split("/");

			discussion.forumID = forumIdHref[forumIdHref.length - 2];


			// Find postedDate and convert to timestamp
			let posted = $(".topicstats > .topicstats_label:contains(\"Date Posted:\")").next().text()

			discussion.postedDate = Helpers.decodeSteamTime(posted.trim());


			// Find commentsAmount
			discussion.commentsAmount = Number($(".topicstats > .topicstats_label:contains(\"Posts:\")").next().text());


			// Get discussion title & content
			discussion.title = $(".forum_op > .topic").text().trim();
			discussion.content = $(".forum_op > .content").text().trim();


			// Find author and convert to SteamID object
			let authorLink = $(".authorline > .forum_op_author").attr("href");

			Helpers.resolveVanityURL(authorLink, (err, data) => { // This request takes <1 sec
				if (err) {
					callback(err);
					return;
				}

				discussion.author = new SteamID(data.steamID);

				// Make callback when ID was resolved as otherwise owner will always be null
				callback(null, new CSteamDiscussion(this, discussion));
			});

		} catch (err) {
			callback(err, null);
		}
	}, "steamcommunity");
}


/**
 * Constructor - Creates a new Discussion object
 * @class
 * @param {SteamCommunity} community
 * @param {{ id: string, appID: string, forumID: string, author: SteamID, postedDate: Object, title: string, content: string, commentsAmount: number }} data
 */
function CSteamDiscussion(community, data) {
	/**
	 * @type {SteamCommunity}
	 */
	this._community = community;

	// Clone all the data we received
	Object.assign(this, data);
}