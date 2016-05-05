var SteamCommunity = require('../index.js');
var SteamID = require('steamid');
var Cheerio = require('cheerio');
var fs = require('fs');

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

SteamCommunity.prototype.setupProfile = function(callback) {
	var self = this;
	this._myProfile("edit?welcomed=1", null, function(err, response, body) {
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

SteamCommunity.prototype.editProfile = function(settings, callback) {
	var self = this;
	this._myProfile("edit", null, function(err, response, body) {
		if(err || response.statusCode != 200) {
			if(callback) {
				callback(err || new Error("HTTP error " + response.statusCode));
			}
			
			return;
		}
		
		var $ = Cheerio.load(body);
		var form = $('#editForm');
		if(!form) {
			if(callback) {
				callback(new Error("Malformed response"));
			}
			
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
					if(typeof settings[i] === 'object' && settings[i].getSteamID64) {
						values.primary_group_steamid = settings[i].getSteamID64();
					} else {
						values.primary_group_steamid = new SteamID(settings[i]).getSteamID64();
					}
					
					break;
				
				// TODO: profile showcases
			}
		}
		
		self._myProfile("edit", values, function(err, response, body) {
			if (settings.customURL) {
				delete self._profileURL;
			}

			if(err || response.statusCode != 200) {
				if(callback) {
					callback(err || new Error("HTTP error " + response.statusCode));
				}
				
				return;
			}
			
			// Check for an error
			var $ = Cheerio.load(body);
			var error = $('#errorText .formRowFields');
			if(error) {
				error = error.text().trim();
				if(error) {
					if(callback) {
						callback(new Error(error));
					}
					
					return;
				}
			}
			
			if(callback) {
				callback(null);
			}
		});
	});
};

SteamCommunity.prototype.profileSettings = function(settings, callback) {
	var self = this;
	this._myProfile("edit/settings", null, function(err, response, body) {
		if(err || response.statusCode != 200) {
			if(callback) {
				callback(err || new Error("HTTP error " + response.statusCode));
			}
			
			return;
		}
		
		var $ = Cheerio.load(body);
		var form = $('#editForm');
		if(!form) {
			if(callback) {
				callback(new Error("Malformed response"));
			}
			
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
			}
		}
		
		self._myProfile("edit/settings", values, function(err, response, body) {
			if(err || response.statusCode != 200) {
				if(callback) {
					callback(err || new Error("HTTP error " + response.statusCode));
				}
				
				return;
			}
			
			if(callback) {
				callback(null);
			}
		});
	});
};

SteamCommunity.prototype.uploadAvatar = function(image, format, callback) {
	if(typeof format === 'function') {
		callback = format;
		format = null;
	}

	var self = this;

	if(image instanceof Buffer) {
		doUpload(image);
	} else if(image.match(/^https?:\/\//)) {
		this.httpRequestGet({
			"uri": image,
			"encoding": null
		}, function(err, response, body) {
			if(err || response.statusCode != 200) {
				if(callback) {
					callback(err ? new Error(err.message + " downloading image") : new Error("HTTP error " + response.statusCode + " downloading image"));
				}

				return;
			}

			if(!format) {
				format = response.headers['content-type'];
			}

			doUpload(body);
		}, "steamcommunity");
	} else {
		if(!format) {
			format = image.match(/\.([^\.]+)$/);
			if(format) {
				format = format[1];
			}
		}

		fs.readFile(image, function(err, file) {
			if(err) {
				if(callback) {
					callback(err);
				}

				return;
			}

			doUpload(file);
		})
	}

	function doUpload(buffer) {
		if(!format) {
			if(callback) {
				callback(new Error("Unknown image format"));
			}

			return;
		}

		if(format.match(/^image\//)) {
			format = format.substring(6);
		}

		var filename = '';
		var contentType = '';

		switch(format.toLowerCase()) {
			case 'jpg':
			case 'jpeg':
				filename = 'avatar.jpg';
				contentType = 'image/jpeg';
				break;

			case 'png':
				filename = 'avatar.png';
				contentType = 'image/png';
				break;

			case 'gif':
				filename = 'avatar.gif';
				contentType = 'image/gif';
				break;

			default:
				if(callback) {
					callback(new Error("Unknown or invalid image format"));
				}

				return;
		}

		self.httpRequestPost({
			"uri": "https://steamcommunity.com/actions/FileUploader",
			"formData": {
				"MAX_FILE_SIZE": buffer.length,
				"type": "player_avatar_image",
				"sId": self.steamID.getSteamID64(),
				"sessionid": self.getSessionID(),
				"doSub": 1,
				"json": 1,
				"avatar": {
					"value": buffer,
					"options": {
						"filename": filename,
						"contentType": contentType
					}
				}
			},
			"json": true
		}, function(err, response, body) {
			if(err) {
				if(callback) {
					callback(err);
				}

				return;
			}

			if(body && !body.success && body.message) {
				if(callback) {
					callback(new Error(body.message));
				}

				return;
			}

			if(response.statusCode != 200) {
				if(callback) {
					callback(new Error("HTTP error " + response.statusCode));
				}

				return;
			}

			if(!body || !body.success) {
				if(callback) {
					callback(new Error("Malformed response"));
				}

				return;
			}

			if(callback) {
				callback(null, body.images.full);
			}
		}, "steamcommunity");
	}
};
