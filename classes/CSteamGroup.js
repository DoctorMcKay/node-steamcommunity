var SteamCommunity = require('../index.js');
var Helpers = require('../components/helpers.js');
var SteamID = require('steamid');
var xml2js = require('xml2js');

SteamCommunity.prototype.getSteamGroup = function(id, callback) {
	if(typeof id !== 'string' && !Helpers.isSteamID(id)) {
		throw new Error("id parameter should be a group URL string or a SteamID object");
	}

	if(typeof id === 'object' && (id.universe != SteamID.Universe.PUBLIC || id.type != SteamID.Type.CLAN)) {
		throw new Error("SteamID must stand for a clan account in the public universe");
	}

	var self = this;
	this.httpRequest("https://steamcommunity.com/" + (typeof id === 'string' ? "groups/" + id : "gid/" + id.toString()) + "/memberslistxml/?xml=1", function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		xml2js.parseString(body, function(err, result) {
			if(err) {
				callback(err);
				return;
			}

			callback(null, new CSteamGroup(self, result.memberList));
		});
	}, "steamcommunity");
};

function CSteamGroup(community, groupData) {
	this._community = community;

	this.steamID = new SteamID(groupData.groupID64[0]);
	this.name = groupData.groupDetails[0].groupName[0];
	this.url = groupData.groupDetails[0].groupURL[0];
	this.headline = groupData.groupDetails[0].headline[0];
	this.summary = groupData.groupDetails[0].summary[0];
	this.avatarHash = groupData.groupDetails[0].avatarIcon[0].match(/([0-9a-f]+)\.jpg$/)[1];
	this.members = parseInt(groupData.groupDetails[0].memberCount[0], 10);
	this.membersInChat = parseInt(groupData.groupDetails[0].membersInChat[0], 10);
	this.membersInGame = parseInt(groupData.groupDetails[0].membersInGame[0], 10);
	this.membersOnline = parseInt(groupData.groupDetails[0].membersOnline[0], 10);
}

CSteamGroup.prototype.getAvatarURL = function(size, protocol) {
	size = size || '';
	protocol = protocol || 'http://';

	var url = protocol + "steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/" + this.avatarHash.substring(0, 2) + "/" + this.avatarHash;
	if(size == 'full' || size == 'medium') {
		return url + "_" + size + ".jpg";
	} else {
		return url + ".jpg";
	}
};

CSteamGroup.prototype.getMembers = function(addresses, callback) {
	if(typeof addresses === 'function') {
		callback = addresses;
		addresses = null;
	}

	this._community.getGroupMembers(this.steamID, callback, null, null, addresses, 0);
};

CSteamGroup.prototype.join = function(callback) {
	this._community.joinGroup(this.steamID, callback);
};

CSteamGroup.prototype.leave = function(callback) {
	this._community.leaveGroup(this.steamID, callback);
};

CSteamGroup.prototype.getAllAnnouncements = function(time, callback) {
	this._community.getAllGroupAnnouncements(this.steamID, time, callback);
};

CSteamGroup.prototype.postAnnouncement = function(headline, content, hidden, callback) {
	this._community.postGroupAnnouncement(this.steamID, headline, content, hidden, callback);
};

CSteamGroup.prototype.editAnnouncement = function(annoucementID, headline, content, callback) {
	this._community.editGroupAnnouncement(this.steamID, annoucementID, headline, content, callback)
};

CSteamGroup.prototype.deleteAnnouncement = function(annoucementID, callback) {
	this._community.deleteGroupAnnouncement(this.steamID, annoucementID, callback)
};

CSteamGroup.prototype.scheduleEvent = function(name, type, description, time, server, callback) {
	this._community.scheduleGroupEvent(this.steamID, name, type, description, time, server, callback);
};

CSteamGroup.prototype.editEvent = function(id, name, type, description, time, server, callback) {
	this._community.editGroupEvent(this.steamID, id, name, type, description, time, server, callback);
};

CSteamGroup.prototype.deleteEvent = function (id, callback) {
	this._community.deleteGroupEvent(this.steamID, id, callback);
};

CSteamGroup.prototype.setPlayerOfTheWeek = function(steamID, callback) {
	this._community.setGroupPlayerOfTheWeek(this.steamID, steamID, callback);
};

CSteamGroup.prototype.kick = function(steamID, callback) {
	this._community.kickGroupMember(this.steamID, steamID, callback);
};

CSteamGroup.prototype.getHistory = function(page, callback) {
	this._community.getGroupHistory(this.steamID, page, callback);
};


CSteamGroup.prototype.getAllComments = function(from, count, callback) {
	this._community.getAllGroupComments(this.steamID, from, count, callback);
};

CSteamGroup.prototype.deleteComment = function(cid, callback) {
	this._community.deleteGroupComment(this.steamID, cid, callback);
};

CSteamGroup.prototype.comment = function(message, callback) {
	this._community.postGroupComment(this.steamID, message, callback);
};

/**
 * Get requests to join this restricted group.
 * @param {function} callback - First argument is null/Error, second is array of SteamID objects
 */
CSteamGroup.prototype.getJoinRequests = function(callback) {
	this._community.getGroupJoinRequests(this.steamID, callback);
};

/**
 * Respond to one or more join requests to this restricted group.
 * @param {SteamID|string|SteamID[]|string[]} steamIDs - The SteamIDs of the users you want to approve or deny membership for (or a single value)
 * @param {boolean} approve - True to put them in the group, false to deny their membership
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamGroup.prototype.respondToJoinRequests = function(steamIDs, approve, callback) {
	this._community.respondToGroupJoinRequests(this.steamID, steamIDs, approve, callback);
};

/**
 * Respond to *ALL* pending group-join requests for this group.
 * @param {boolean} approve - True to allow everyone who requested into the group, false to not
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
CSteamGroup.prototype.respondToAllJoinRequests = function(approve, callback) {
	this._community.respondToAllGroupJoinRequests(this.steamID, approve, callback);
};
