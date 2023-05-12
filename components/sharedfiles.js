var SteamCommunity = require('../index.js');
var SteamID = require('steamid');

// Note: a CSteamSharedfile class does not exist because we can't get data using the "normal" xml way to fill a CSteamSharedfile object

/**
 * Deletes a comment from a sharedfile's comment section
 * @param {SteamID | String} userID - ID of the user associated to this sharedfile
 * @param {String} sid - ID of the sharedfile
 * @param {String} cid - ID of the comment to delete
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.deleteSharedfileComment = function(userID, sid, cid, callback) {
    if (typeof userID === "string") {
        userID = new SteamID(userID);
    }

    this.httpRequestPost({
        "uri": `https://steamcommunity.com/comment/PublishedFile_Public/delete/${userID.toString()}/${sid}/`,
        "form": {
            "gidcomment": cid,
            "count": 10,
            "sessionid": this.getSessionID()
        }
    }, function(err, response, body) {
        if (!callback) {
            return;
        }

        callback(null || err);
    }, "steamcommunity");
};

/**
 * Posts a comment to a sharedfile
 * @param {SteamID | String} userID - ID of the user associated to this sharedfile
 * @param {String} sid - ID of the sharedfile
 * @param {String} message - Content of the comment to post
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.postSharedfileComment = function(userID, sid, message, callback) {
    if (typeof userID === "string") {
        userID = new SteamID(userID);
    }

    this.httpRequestPost({
        "uri": `https://steamcommunity.com/comment/PublishedFile_Public/post/${userID.toString()}/${sid}/`,
        "form": {
            "comment": message,
            "count": 10,
            "sessionid": this.getSessionID()
        }
    }, function(err, response, body) {
        if (!callback) {
            return;
        }

        callback(null || err);
    }, "steamcommunity");
};