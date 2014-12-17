var SteamCommunity = require('../index.js');
var SteamID = require('steamid');
var xml2js = require('xml2js');

SteamCommunity.prototype.getSteamGroup = function(id, callback) {
	if(typeof id !== 'string' && !(typeof id === 'object' && id.__proto__ === SteamID.prototype)) {
		throw new Error("id parameter should be a group URL string or a SteamID object");
	}
	
	if(typeof id === 'object' && (id.universe != SteamID.Universe.PUBLIC || id.type != SteamID.Type.CLAN)) {
		throw new Error("SteamID must stand for a clan account in the public universe");
	}
	
	var self = this;
	this._request("https://steamcommunity.com/" + (typeof id === 'string' ? "groups/" + id : "gid/" + id.toString()) + "/memberslistxml/?xml=1", function(err, response, body) {
		if(err || response.statusCode != 200) {
			callback(err || "HTTP error " + response.statusCode);
			return;
		}
		
		if(body.match(/<h1>Sorry!<\/h1>/)) {
			var match = body.match(/<h3>(.+)<\/h3>/);
			callback(match ? match[1] : "Unknown error occurred");
			return;
		}
		
		xml2js.parseString(body, function(err, result) {
			if(err) {
				callback(err);
				return;
			}
			
			callback(null, new CSteamGroup(self, result.memberList));
		});
	});
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

CSteamGroup.prototype.getMembers = function(callback, members, link) {
	members = members || [];
	link = link || "http://steamcommunity.com/gid/" + this.steamID.toString() + "/memberslistxml/?xml=1";
	
	var self = this;
	this._community._request(link, function(err, response, body) {
		if(err || response.statusCode != 200) {
			callback(err || "HTTP error " + response.statusCode);
			return;
		}
		
		xml2js.parseString(body, function(err, result) {
			if(err) {
				callback(err);
				return;
			}
			
			members = members.concat(result.memberList.members[0].steamID64.map(function(steamID) {
				return new SteamID(steamID);
			}));
			
			if(result.memberList.nextPageLink) {
				self.getMembers(callback, members, result.memberList.nextPageLink[0]);
			} else {
				callback(null, members);
			}
		});
	});
};
