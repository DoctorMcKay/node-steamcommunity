const Cheerio = require('cheerio');
const SteamID = require('steamid');
const Helpers = require('../components/helpers.js');
const SteamCommunity  = require('../index.js');
const ESharedfileType = require('../resources/ESharedfileType.js');


/**
 * Scrape a sharedfile's DOM to get all available information
 * @param {String} sid - ID of the sharedfile
 * @param {function} callback - First argument is null/Error, second is object containing all available information
 */
SteamCommunity.prototype.getSteamSharedfile = function(sid, callback) {

	// Construct object holding all the data we can scrape
	let sharedfile = {
		id: sid,
		type: null,
		appID: null,
		owner: null,
		fileSize: null,
		postDate: null,
		resolution: null,
		uniqueVisitorsCount: null,
		favoritesCount: null,
		upvoteCount: null
	};


	// Get DOM of sharedfile
	this.httpRequestGet(`https://steamcommunity.com/sharedfiles/filedetails/?id=${sid}`, (err, res, body) => {
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
			sharedfile.appID = Number($("#ShareItemBtn").attr()["onclick"].replace(`ShowSharePublishedFilePopup( '${sid}', '`, "").replace("' );", ""));


			// Find fileSize if not guide
			sharedfile.fileSize = detailsStatsObj["File Size"] || null; // TODO: Convert to bytes? It seems like to always be MB but no guarantee


			// Find postDate and convert to timestamp
			let posted = detailsStatsObj["Posted"].trim();

			sharedfile.postDate = Date.parse(Helpers.decodeSteamTime(posted)); // Pass String into helper and parse the returned String to get a Unix timestamp


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


			// Determine type by looking at the second breadcrumb. Find the first separator as it has a unique name and go to the next element which holds our value of interest
			let breadcrumb = $(".breadcrumbs > .breadcrumb_separator").next().get(0).children[0].data || "";

			if (breadcrumb.includes("Screenshot")) {
				sharedfile.type = ESharedfileType.Screenshot;
			}

			if (breadcrumb.includes("Artwork")) {
				sharedfile.type = ESharedfileType.Artwork;
			}

			if (breadcrumb.includes("Guide")) {
				sharedfile.type = ESharedfileType.Guide;
			}


			// Find owner profile link, convert to steamID64 using SteamIdResolver lib and create a SteamID object
			let ownerHref = $(".friendBlockLinkOverlay").attr()["href"];

			Helpers.resolveVanityURL(ownerHref, (err, data) => { // This request takes <1 sec
				if (!err) {
					sharedfile.owner = new SteamID(data.steamID);
				}

				// Make callback when ID was resolved as otherwise owner will always be null
				callback(null, new CSteamSharedfile(this, sharedfile));
			});

		} catch (err) {
			callback(err, null);
		}
	}, "steamcommunity");
};

function CSteamSharedfile(community, data) {
	this._community = community;

	// Clone all the data we recieved
	Object.assign(this, data); // TODO: This is cleaner but might break IntelliSense. I'm leaving the block below to be reactivated if necessary

	/* this.id = data.id;
	this.type = data.type;
	this.appID = data.appID;
	this.owner = data.owner;
	this.fileSize = data.fileSize;
	this.postDate = data.postDate;
	this.resolution = data.resolution;
	this.uniqueVisitorsCount = data.uniqueVisitorsCount;
	this.favoritesCount = data.favoritesCount;
	this.upvoteCount = data.upvoteCount; */
}

/**
 * Deletes a comment from this sharedfile's comment section
 * @param {String} cid - ID of the comment to delete
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedfile.prototype.deleteComment = function(cid, callback) {
	this._community.deleteSharedfileComment(this.userID, this.id, cid, callback);
};

/**
 * Favorites this sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedfile.prototype.favorite = function(callback) {
	this._community.favoriteSharedfile(this.id, this.appID, callback);
};

/**
 * Posts a comment to this sharedfile
 * @param {String} message - Content of the comment to post
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedfile.prototype.comment = function(message, callback) {
	this._community.postSharedfileComment(this.owner, this.id, message, callback);
};

/**
 * Subscribes to this sharedfile's comment section. Note: Checkbox on webpage does not update
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedfile.prototype.subscribe = function(callback) {
	this._community.subscribeSharedfileComments(this.owner, this.id, callback);
};

/**
 * Unfavorites this sharedfile
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedfile.prototype.unfavorite = function(callback) {
	this._community.unfavoriteSharedfile(this.id, this.appID, callback);
};

/**
 * Unsubscribes from this sharedfile's comment section. Note: Checkbox on webpage does not update
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamSharedfile.prototype.unsubscribe = function(callback) {
	this._community.unsubscribeSharedfileComments(this.owner, this.id, callback);
};
