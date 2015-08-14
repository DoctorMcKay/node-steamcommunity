var SteamCommunity = require('../index.js');

SteamCommunity.prototype.addFriend = function(userID, callback) {
	var self = this;
	this.request.post({
		"uri": "https://steamcommunity.com/actions/AddFriendAjax",
		"form": {
			"accept_invite": 0,
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		if(body.success) {
			callback(null);
		} else {
			callback(new Error("Unknown error"));
		}
	});
};

SteamCommunity.prototype.acceptFriendRequest = function(userID, callback) {
	var self = this;
	this.request.post({
		"uri": "https://steamcommunity.com/actions/AddFriendAjax",
		"form": {
			"accept_invite": 1,
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		callback(null);
	});
};

SteamCommunity.prototype.removeFriend = function(userID, callback) {
	var self = this;
	this.request.post({
		"uri": "https://steamcommunity.com/actions/RemoveFriendAjax",
		"form": {
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		callback(null);
	});
};

SteamCommunity.prototype.blockCommunication = function(userID, callback) {
	var self = this;
	this.request.post({
		"uri": "https://steamcommunity.com/actions/BlockUserAjax",
		"form": {
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		callback(null);
	});
};

SteamCommunity.prototype.unblockCommunication = function(userID, callback) {
	var form = {"action": "unignore"};
	form['friends[' + userID.toString() + ']'] = 1;

	this._myProfile('friends/blocked/', form, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}

		callback(null);
	});
};

SteamCommunity.prototype.postUserComment = function(userID, message, callback) {
	var self = this;
	this.request.post({
		"uri": "https://steamcommunity.com/comment/Profile/post/" + userID.toString() + "/-1",
		"form": {
			"comment": message,
			"count": 6,
			"sessionid": this.getSessionID()
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		if(body.success) {
			callback(null);
		} else if(bpdy.error) {
			callback(new Error(body.error));
		} else {
			callback(new Error("Unknown error"));
		}
	});
};