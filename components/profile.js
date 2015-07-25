var SteamCommunity = require('../index.js');
var SteamID = require('steamid');
var Cheerio = require('cheerio');

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

SteamCommunity.prototype.editProfile = function(settings, callback) {
	var self = this;
	this._myProfile("edit", null, function(err, response, body) {
		if(err || response.statusCode != 200) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		var $ = Cheerio.load(body);
		var form = $('#editForm');
		if(!form) {
			callback(new Error("Malformed response"));
			return;
		}
		
		var values = {};
		form.serializeArray().forEach(function(item) {
			values[item.name] = item.value;
		});
		
		for(var i in settings) {
			if(!settings.hasOwnProperty(i)) {
				continue;
			}
			
			switch(i) {
				case 'name':
					values.personaName = settings[i];
					break;
				
				case 'realName':
					values.real_name = settings[i];
					break;
				
				case 'summary':
					values.summary = settings[i];
					break;
				
				case 'country':
					values.country = settings[i];
					break;
				
				case 'state':
					values.state = settings[i];
					break;
				
				case 'city':
					values.city = settings[i];
					break;
				
				case 'customURL':
					values.customURL = settings[i];
					break;
				
				case 'background':
					// The assetid of our desired profile background
					values.profile_background = settings[i];
					break;
				
				case 'featuredBadge':
					// Currently, game badges aren't supported
					values.favorite_badge_badgeid = settings[i];
					break;
				
				case 'primaryGroup':
					if(typeof settings[i] === 'object' && settings[i].accountid) {
						values.primary_group_steamid = settings[i].accountid;
					} else {
						values.primary_group_steamid = new SteamID(settings[i]).accountid;
					}
					
					break;
				
				// TODO: profile showcases
			}
		}
		
		self._myProfile("edit", values, function(err, response, body) {
			if(err || response.statusCode != 200) {
				callback(err || new Error("HTTP error " + response.statusCode));
				return;
			}
			
			// Check for an error
			var $ = Cheerio.load(body);
			var error = $('#errorText .formRowFields');
			if(error) {
				error = error.text().trim();
				if(error) {
					callback(new Error(error));
					return;
				}
			}
			
			callback(null);
		});
	});
};

SteamCommunity.prototype.profileSettings = function(settings, callback) {
	var self = this;
	this._myProfile("edit/settings", null, function(err, response, body) {
		if(err || response.statusCode != 200) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}
		
		var $ = Cheerio.load(body);
		var form = $('#editForm');
		if(!form) {
			callback(new Error("Malformed response"));
			return;
		}
		
		var values = {};
		form.serializeArray().forEach(function(item) {
			values[item.name] = item.value;
		});
		
		for(var i in settings) {
			if(!settings.hasOwnProperty(i)) {
				continue;
			}
			
			switch(i) {
				case 'profile':
					values.privacySetting = settings[i];
					break;
				
				case 'comments':
					values.commentSetting = CommentPrivacyState[settings[i]];
					break;
				
				case 'inventory':
					values.inventoryPrivacySetting = settings[i];
					break;
				
				case 'inventoryGifts':
					values.inventoryGiftPrivacy = settings[i] ? 1 : 0;
					break;
				
				case 'emailConfirmation':
					values.tradeConfirmationSetting = settings[i] ? 1 : 0;
					break;
			}
		}
		
		self._myProfile("edit/settings", values, function(err, response, body) {
			if(err || response.statusCode != 200) {
				callback(err || new Error("HTTP error " + response.statusCode));
				return;
			}
			
			callback(null);
		});
	});
};
