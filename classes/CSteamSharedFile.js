const Cheerio = require('cheerio');
const SteamID = require('steamid');

const SteamCommunity  = require('../index.js');
const Helpers = require('../components/helpers.js');

const ESharedFileType = require('../resources/ESharedFileType.js');


/**
 * Scrape a sharedfile's DOM to get all available information
 * @param {string} sharedFileId - ID of the sharedfile
 * @param {function} callback - First argument is null/Error, second is object containing all available information
 */
SteamCommunity.prototype.getSteamSharedFile = function(sharedFileId, callback) {
	// Construct object holding all the data we can scrape
	let sharedfile = {
		id: sharedFileId,
		type: null,
		appID: null,
		owner: null,
		fileSize: null,
		postDate: null,
		resolution: null,
		uniqueVisitorsCount: null,
		favoritesCount: null,
		upvoteCount: null,
		guideNumRatings: null,
		isUpvoted: null,
		isDownvoted: null
	};

	// Get DOM of sharedfile
	this.httpRequestGet(`https://steamcommunity.com/sharedfiles/filedetails/?id=${sharedFileId}`, (err, res, body) => {
		try {

			/* --------------------- Preprocess output --------------------- */

			// Load output into cheerio to make parsing easier
			let $ = Cheerio.load(body);

			// Dynamically map detailsStatsContainerLeft to detailsStatsContainerRight in an object to make readout easier. It holds size, post date and resolution.
			let detailsStatsObj = {};
			let detailsLeft     = $(".detailsStatsContainerLeft").children();
			let detailsRight    = $(".detailsStatsContainerRight").children();

			Object.keys(detailsLeft).forEach((e) => { // Dynamically get all details. Don't hardcore so that this also works for guides.
				if (isNaN(e)) {
					return; // Ignore invalid entries
				}

				detailsStatsObj[detailsLeft[e].children[0].data.trim()] = detailsRight[e].children[0].data;
			});

			// Dynamically map stats_table descriptions to values. This holds Unique Visitors and Current Favorites
			let statsTableObj = {};
			let statsTable    = $(".stats_table").children();

			Object.keys(statsTable).forEach((e) => {
				if (isNaN(e)) {
					return; // Ignore invalid entries
				}

				// Value description is at index 3, value data at index 1
				statsTableObj[statsTable[e].children[3].children[0].data] = statsTable[e].children[1].children[0].data.replace(/,/g, ""); // Remove commas from 1k+ values
			});


			/* --------------------- Find and map values --------------------- */

			// Find appID in share button onclick event
			sharedfile.appID = Number($("#ShareItemBtn").attr()["onclick"].replace(`ShowSharePublishedFilePopup( '${sharedFileId}', '`, "").replace("' );", ""));


			// Find fileSize if not guide
			sharedfile.fileSize = detailsStatsObj["File Size"] || null; // TODO: Convert to bytes? It seems like to always be MB but no guarantee


			// Find postDate and convert to timestamp
			let posted = detailsStatsObj["Posted"].trim();

			sharedfile.postDate = Helpers.decodeSteamTime(posted);


			// Find resolution if artwork or screenshot
			sharedfile.resolution = detailsStatsObj["Size"] || null;


			// Find uniqueVisitorsCount. We can't use ' || null' here as Number("0") casts to false
			if (statsTableObj["Unique Visitors"]) {
				sharedfile.uniqueVisitorsCount = Number(statsTableObj["Unique Visitors"]);
			}


			// Find favoritesCount. We can't use ' || null' here as Number("0") casts to false
			if (statsTableObj["Current Favorites"]) {
				sharedfile.favoritesCount = Number(statsTableObj["Current Favorites"]);
			}


			// Find upvoteCount. We can't use ' || null' here as Number("0") casts to false
			let upvoteCount = $("#VotesUpCountContainer > #VotesUpCount").text();

			if (upvoteCount) {
				sharedfile.upvoteCount = Number(upvoteCount);
			}


			// Find numRatings if this is a guide as they use a different voting system
			let numRatings = $(".ratingSection > .numRatings").text().replace(" ratings", "");

			sharedfile.guideNumRatings = Number(numRatings) || null; // Set to null if not a guide or if the guide does not have enough ratings to show a value


			// Determine if this account has already voted on this sharedfile
			sharedfile.isUpvoted   = String($(".workshopItemControlCtn > #VoteUpBtn")[0].attribs["class"]).includes("toggled");   // Check if upvote btn class contains "toggled"
			sharedfile.isDownvoted = String($(".workshopItemControlCtn > #VoteDownBtn")[0].attribs["class"]).includes("toggled"); // Check if downvote btn class contains "toggled"


			// Determine type by looking at the second breadcrumb. Find the first separator as it has a unique name and go to the next element which holds our value of interest
			let breadcrumb = $(".breadcrumbs > .breadcrumb_separator").next().get(0).children[0].data || "";

			if (breadcrumb.includes("Screenshot")) {
				sharedfile.type = ESharedFileType.Screenshot;
			}

			if (breadcrumb.includes("Artwork")) {
				sharedfile.type = ESharedFileType.Artwork;
			}

			if (breadcrumb.includes("Guide")) {
				sharedfile.type = ESharedFileType.Guide;
			}


			// Find owner profile link, convert to steamID64 using SteamIdResolver lib and create a SteamID object
			let ownerHref = $(".friendBlockLinkOverlay").attr()["href"];

			Helpers.resolveVanityURL(ownerHref, (err, data) => { // This request takes <1 sec
				if (err) {
					callback(err);
					return;
				}

				sharedfile.owner = new SteamID(data.steamID);

				// Make callback when ID was resolved as otherwise owner will always be null
				callback(null, new CSteamSharedFile(this, sharedfile));
			});

		} catch (err) {
			callback(err, null);
		}
	}, "steamcommunity");
};

/**
 * Constructor - Creates a new SharedFile object
 * @class
 * @param {SteamCommunity} community
 * @param {{ id: string, type: ESharedFileType, appID: number, owner: SteamID|null, fileSize: string|null, postDate: number, resolution: string|null, uniqueVisitorsCount: number, favoritesCount: number, upvoteCount: number|null, guideNumRatings: Number|null, isUpvoted: boolean, isDownvoted: boolean }} data
 */
function CSteamSharedFile(community, data) {
	/**
	 * @type {SteamCommunity}
	 */
	this._community = community;

	// Clone all the data we received
	Object.assign(this, data);
}

/**
 * Deletes a comment from this sharedfile's comment section
 * @param {String} cid - ID of the comment to delete
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedFile.prototype.deleteComment = function(cid, callback) {
	this._community.deleteSharedFileComment(this.owner, this.id, cid, callback);
};

/**
 * Favorites this sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedFile.prototype.favorite = function(callback) {
	this._community.favoriteSharedFile(this.id, this.appID, callback);
};

/**
 * Posts a comment to this sharedfile
 * @param {String} message - Content of the comment to post
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedFile.prototype.comment = function(message, callback) {
	this._community.postSharedFileComment(this.owner, this.id, message, callback);
};

/**
 * Subscribes to this sharedfile's comment section. Note: Checkbox on webpage does not update
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedFile.prototype.subscribe = function(callback) {
	this._community.subscribeSharedFileComments(this.owner, this.id, callback);
};

/**
 * Unfavorites this sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedFile.prototype.unfavorite = function(callback) {
	this._community.unfavoriteSharedFile(this.id, this.appID, callback);
};

/**
 * Unsubscribes from this sharedfile's comment section. Note: Checkbox on webpage does not update
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedFile.prototype.unsubscribe = function(callback) {
	this._community.unsubscribeSharedFileComments(this.owner, this.id, callback);
};
