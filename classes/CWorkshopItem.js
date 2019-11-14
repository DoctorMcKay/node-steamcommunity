var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');
var SteamID = require('steamid');

/**
 * Representation of a workshop item
 * @param {SteamCommunity} community
 * @param {string} id The file id, usually found in the URL
 */
function CWorkshopItem(community, id) {
    this._community = community;

    this.id = id;
    this.hasInformation = false;

    // information that is filled out by .fetchInformation
    /** @type {string} */
    this.title = null;
    /** @type {string} Item description as HTML */
    this.description = null;
    /** @type {SteamID[]} People who created the item */
    this.creators = null;
    /** @type {number} Number of ratings on the item */
    this.numRatings = null;
    /** @type {number} Number of comments on the item */
    this.numComments = null;
}

/**
 * Fetches information about the workshop item
 * After the callback is called, the information is available on the CWorkshopItem instance
 * @param {(err: Error)} callback
 */
CWorkshopItem.prototype.fetchInformation = function(callback) {
    var self = this;
    this._community.httpRequest(
        "https://steamcommunity.com/sharedfiles/filedetails/?id="+this.id,
        function(err, response, body) {
            if (err) {
                callback(err);
                return;
            }

            var $ = Cheerio.load(body);
            self.title = $('.workshopItemTitle').text().trim();
            self.description = $('.workshopItemDescription').html();
            var $creators = $('.creatorsBlock .persona');
            self.creators = $creators.map(function(i, creator) {
                return SteamID.fromIndividualAccountID($(creator).attr('data-miniprofile'));
            }).get();
            var numRatings = /(\d+) ratings/.exec($('.numRatings').text());
            self.numRatings = numRatings ? +numRatings[1] : null;
            self.numComments = +$('.sectionTab[href*="/comments/"] .tabCount').text();

            self.hasInformation = true;
            callback(null);
        }
    );
};

/**
 * Get comments from the page, optionally with a maximum to fetch
 * @param {number} [max=Infinity] Maximum number of comments to fetch
 * @param {(err: Error, comments?: SteamCommunity.CCommunityComment[]) => any} callback
 */
CWorkshopItem.prototype.getComments = function(max, callback) {
    if (!this.hasInformation) {
        callback(new Error("Item must have fetched information first"));
        return;
    }
    if (max instanceof Function) {
        callback = max;
        max = this.numComments;
    }

    var self = this;
    var url = "https://steamcommunity.com/comment/PublishedFile_Public/render/" + this.creators[0].getSteamID64() + "/" + this.id + "/";
    this._community.httpRequestPost({
            "uri": url,
            "form": {
                start: 0,
                count: max,
                sessionid: this._community.getSessionID(),
                feature2: "-1"
            },
            "json": true
        },
        function(err, response, body) {
            if (err) {
                callback(err);
                return;
            }
            if (body.success !== true) {
                callback(new Error(body.error));
                return;
            }

            var $ = Cheerio.load(body.comments_html);
            var comments = $('.commentthread_comment').map(function(i, elm) {
                return SteamCommunity.CCommunityComment.fromHTML(self._community, self, $.html(elm));
            }).get();
            callback(null, comments);
        }
    );
};

SteamCommunity.CWorkshopItem = CWorkshopItem;