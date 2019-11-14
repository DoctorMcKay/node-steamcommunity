var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');
var SteamID = require('steamid');
var Async = require('async');

/**
 * Get the items a user has submitted to the workshop
 * @param {SteamID|string} [userID] If not set, get our own items
 * @param {(err: Error, items?: SteamCommunity.CWorkshopItem[]) => any} callback
 */
SteamCommunity.prototype.getWorkshopItems = function(userID, callback) {
    if (typeof userID === 'string') {
		userID = new SteamID(userID);
    }
    if (userID instanceof Function) {
        callback = userID;
        userID = this.steamID;
    }
	if (!userID) {
		callback(new Error("No SteamID specified and not logged in"));
		return;
    }

    var self = this;
    var items = [];
    var pageNum = 1;

    // keep asking for pages until we don't have any more pages to fetch
    Async.doUntil(
        function(cb) {
            var url = "https://steamcommunity.com/profiles/" + userID.getSteamID64() + "/myworkshopfiles/?p="+pageNum+"&numberpage=30";
            self.httpRequest(url, function(err, response, body) {
                if (err) {
                    cb(err);
                    return;
                }

                var $ = Cheerio.load(body);
                $('.workshopItem').each(function(i, $element) {
                    var elm = Cheerio.load($element);
                    var preview = elm('.ugc');
                    var id = preview.attr('data-publishedfileid');
                    items.push(new SteamCommunity.CWorkshopItem(self, id));
                });
                if ($('.workshopBrowsePagingControls .pagebtn:last-child:not(.disabled)').length) {
                    ++pageNum;
                    cb(null, false);
                } else {
                    cb(null, true);
                }
            });
        },
        function(isFinished) { return isFinished; },
        // then return the items (or error) we ended up with
        function(err) {
            if (err) {
                callback(err);
                return;
            }
            callback(null, items);
        }
    );
};