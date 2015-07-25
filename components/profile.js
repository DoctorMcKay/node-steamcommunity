var SteamCommunity = require('../index.js');

SteamCommunity.PrivacyState = {
	"Private": 1,
	"FriendsOnly": 2,
	"Public": 3
};

var CommentPrivacyState = {
	"1": "commentselfonly",
	"2": "commentfriendsonly",
	"3": "commentanyone"
};

SteamCommunity.prototype.profileSettings = function(profile, comments, inventory, inventoryGiftPrivacy, emailConfirmation, callback) {
	this._myProfile("edit/settings", {
		"sessionID": this.getSessionID(),
		"type": "profileSettings",
		"privacySetting": profile,
		"commentSetting": CommentPrivacyState[comments],
		"inventoryPrivacySetting": inventory,
		"inventoryGiftPrivacy": inventoryGiftPrivacy ? 1 : 0,
		"tradeConfirmationSetting": emailConfirmation ? 1 : 0
	}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if(err || response.statusCode != 200) {
			callback(err || new Error("HTTP error " + response.statusCode));
		} else {
			callback(null);
		}
	});
};
