const SteamCommunity = require('../index.js');

SteamCommunity.TargetType = {
	"UserReview": 1,
	"SharedFile": 2,
	"Profile": 3,
	"Topic": 4,
	"Comment": 5
};

SteamCommunity.prototype.getPointsSummary = function(callback) {
	this.httpRequestGet({
		"uri": "https://api.steampowered.com/ILoyaltyRewardsService/GetSummary/v1",
		"qs": {
			"access_token": this.getAccessToken(),
			"input_json": JSON.stringify({
				"steamid": this.steamID.toString()
			})
		},
		"json": true
	}, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (!body || !body.response || !body.response.summary) {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, body.response.summary);
	});
};

SteamCommunity.prototype.listReactions = function(callback) {
	this.httpRequestGet({
		"uri": "https://api.steampowered.com/ILoyaltyRewardsService/GetReactionConfig/v1",
		"qs": {
			"input_json": "{}"
		},
		"json": true
	}, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		if (!body || !body.response || !body.response.reactions) {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, body.response.reactions);
	});
};

SteamCommunity.prototype.award = function(targetType, targetID, reactionID, callback) {
	this.httpRequestPost({
		"uri": "https://api.steampowered.com/ILoyaltyRewardsService/AddReaction/v1",
		"qs": {
			"access_token": this.getAccessToken()
		},
		"form": {
			"input_json": JSON.stringify({
				"target_type": targetType,
				"targetid": targetID,
				"reactionid": reactionID
			})
		},
		"json": true
	}, function(err, response, body) { // TODO: Investigate body
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

SteamCommunity.prototype.awardUserReview(recommendationID, reactionID, callback) {
	this.award(SteamCommunity.TargetType.UserReview, recommendationID, reactionID, callback);
};

SteamCommunity.prototype.awardSharedFile = function(sharedFileID, reactionID, callback) {
	this.award(SteamCommunity.TargetType.SharedFile, sharedFileID, reactionID, callback);
};

SteamCommunity.prototype.awardUserProfile = function(userID, reactionID, callback) {
	this.award(SteamCommunity.TargetType.Profile, userID, reactionID, callback);
};

SteamCommunity.prototype.awardTopic = function(topicID, reactionID, callback) {
	this.award(SteamCommunity.TargetType.Topic, topicID, reactionID, callback);
};

SteamCommunity.prototype.awardComment = function(commentID, reactionID, callback) {
	this.award(SteamCommunity.TargetType.Comment, commentID, reactionID, callback);
};
