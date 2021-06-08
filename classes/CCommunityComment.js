var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');
var SteamID = require('steamid');

/**
 * Representation of a comment in the community, e.g. on a profile page or a workshop item
 * @param {SteamCommunity} community
 * @param {SteamCommunity.CWorkshopItem} owner The entity we originated from. Currently only workshop item is supported
 */
function CCommunityComment(community, owner) {
    this._community = community;
    this._owner = owner;

    /** Filled out by .fromHTML() */
    /** @type {string} */
    this.id = null;
    /** @type {SteamID} */
    this.submitter = null;
    /** @type {string} The body of the comment as HTML */
    this.content = null;
    /** @type {Date} The time at which the comment was posted */
    this.time = null;
}

/**
 * Parses a comment from its HTML
 * @param {SteamCommunity} community
 * @param {SteamCommunity.CWorkshopItem} owner The entity it originated from. Currently only workshop item is supported
 * @returns {CCommunityComment}
 */
CCommunityComment.fromHTML = function(community, owner, html) {
    var $ = Cheerio.load(html);
    var comment = new SteamCommunity.CCommunityComment(community, owner);
    var id = /comment_(\d+)/.exec($.root().children().first().attr('id'));
    if (!id) { throw new Error("Could not find ID of comment"); }
    comment.id = id[1];
    comment.submitter = SteamID.fromIndividualAccountID($('.commentthread_author_link').attr('data-miniprofile'));
    comment.content = $('.commentthread_comment_text').html();
    comment.time = new Date(+$('.commentthread_comment_timestamp').attr('data-timestamp') * 1000);
    return comment;
};

CCommunityComment.prototype._getActionUrl = function(action) {
    if (this._owner instanceof SteamCommunity.CWorkshopItem) {
        return "https://steamcommunity.com/comment/PublishedFile_Public/"+action+"/"+this._owner.creators[0].getSteamID64()+"/"+this._owner.id+"/";
    }

    throw new Error("Unknown owner "+this._owner);
};

/**
 * Deletes the comment for good. Only call if you're for real.
 * @param {(err: Error) => any} callback
 */
CCommunityComment.prototype.delete = function(callback) {
    if (!(callback instanceof Function)) {
        throw new Error("Callback must be a function");
    }
    this._community.httpRequestPost(
        {
            "uri": this._getActionUrl('delete'),
            "form": {
                start: 0,
                gidcomment: this.id,
                sessionid: this._community.getSessionID()
            },
            "json": true
        },
        function(err, response, body) {
            if (err) {
                callback(err);
                return;
            }
            if (body.success !== true) {
                callback(new Error(JSON.stringify(body)));
                return;
            }
            callback(null);
        }
    );
};

SteamCommunity.CCommunityComment = CCommunityComment;