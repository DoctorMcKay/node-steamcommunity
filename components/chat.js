var SteamCommunity = require('../index.js');
var SteamID = require('steamid');

SteamCommunity.ChatState = {
	"Offline": 0,
	"LoggingOn": 1,
	"LogOnFailed": 2,
	"LoggedOn": 3
};

SteamCommunity.PersonaState = {
	"Offline": 0,
	"Online": 1,
	"Busy": 2,
	"Away": 3,
	"Snooze": 4,
	"LookingToTrade": 5,
	"LookingToPlay": 6,
	"Max": 7
};

SteamCommunity.PersonaStateFlag = {
	"HasRichPresence": 1,
	"InJoinableGame": 2,
	
	"OnlineUsingWeb": 256,
	"OnlineUsingMobile": 512,
	"OnlineUsingBigPicture": 1024
};

SteamCommunity.prototype.chatLogon = function(interval, uiMode) {
	if(this.chatState == SteamCommunity.ChatState.LoggingOn || this.chatState == SteamCommunity.ChatState.LoggedOn) {
		return;
	}
	
	interval = interval || 500;
	uiMode = uiMode || "web";
	
	this.emit('debug', 'Requesting chat WebAPI token');
	this.chatState = SteamCommunity.ChatState.LoggingOn;
	
	var self = this;
	this.getWebApiOauthToken(function(err, token) {
		if(err) {
			var fatal = err.message.indexOf('not authorized') != -1;

			if (!fatal) {
				self.chatState = SteamCommunity.ChatState.LogOnFailed;
				setTimeout(self.chatLogon.bind(self), 5000);
			} else {
				self.chatState = SteamCommunity.ChatState.Offline;
			}

			self.emit('chatLogOnFailed', err, fatal);
			self.emit('debug', "Cannot get oauth token: " + err.message);
			return;
		}
		
		self.httpRequestPost({
			"uri": "https://api.steampowered.com/ISteamWebUserPresenceOAuth/Logon/v1",
			"form": {
				"ui_mode": uiMode,
				"access_token": token
			},
			"json": true
		}, function(err, response, body) {
			if(err || response.statusCode != 200) {
				self.chatState = SteamCommunity.ChatState.LogOnFailed;
				self.emit('chatLogOnFailed', err ? err : new Error("HTTP error " + response.statusCode), false);
				self.emit('debug', 'Error logging into webchat: ' + (err ? err.message : "HTTP error " + response.statusCode));
				setTimeout(self.chatLogon.bind(self), 5000);
				return;
			}
			
			if(body.error != 'OK') {
				self.chatState = SteamCommunity.ChatState.LogOnFailed;
				self.emit('chatLogOnFailed', new Error(body.error), false);
				self.emit('debug', 'Error logging into webchat: ' + body.error);
				setTimeout(self.chatLogon.bind(self), 5000);
				return;
			}
			
			self._chat = {
				"umqid": body.umqid,
				"message": body.message,
				"accessToken": token,
				"interval": interval,
				"uiMode": uiMode
			};
			
			self.chatFriends = {};
			
			self.chatState = SteamCommunity.ChatState.LoggedOn;
			self.emit('chatLoggedOn');
			self._chatPoll();
		}, "steamcommunity");
	});
};

SteamCommunity.prototype.chatMessage = function(recipient, text, type, callback) {
	if(this.chatState != SteamCommunity.ChatState.LoggedOn) {
		throw new Error("Chat must be logged on before messages can be sent");
	}
	
	if(typeof recipient === 'string') {
		recipient = new SteamID(recipient);
	}
	
	if(typeof type === 'function') {
		callback = type;
		type = 'saytext';
	}
	
	type = type || 'saytext';

	var self = this;
	this.httpRequestPost({
		"uri": "https://api.steampowered.com/ISteamWebUserPresenceOAuth/Message/v1",
		"form": {
			"access_token": this._chat.accessToken,
			"steamid_dst": recipient.toString(),
			"text": text,
			"type": type,
			"umqid": this._chat.umqid
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}
		
		if (err) {
			callback(err);
			return;
		}
		
		if(body.error != 'OK') {
			callback(new Error(body.error));
		} else {
			callback(null);
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.chatLogoff = function() {
	var self = this;
	this.httpRequestPost({
		"uri": "https://api.steampowered.com/ISteamWebUserPresenceOAuth/Logoff/v1",
		"form": {
			"access_token": this._chat.accessToken,
			"umqid": this._chat.umqid
		}
	}, function(err, response, body) {
		if(err || response.statusCode != 200) {
			self.emit('debug', 'Error logging off of chat: ' + (err ? err.message : "HTTP error " + response.statusCode));
			setTimeout(self.chatLogoff.bind(self), 1000);
		} else {
			self.emit('chatLoggedOff');
			clearTimeout(self._chat.timer);
			delete self._chat;
			delete self.chatFriends;
			self.chatState = SteamCommunity.ChatState.Offline;
		}
	}, "steamcommunity");
};

SteamCommunity.prototype._chatPoll = function() {
	this.emit('debug', 'Doing chat poll');
	
	var self = this;
	this.httpRequestPost({
		"uri": "https://api.steampowered.com/ISteamWebUserPresenceOAuth/Poll/v1",
		"form": {
			"umqid": self._chat.umqid,
			"message": self._chat.message,
			"pollid": 1,
			"sectimeout": 20,
			"secidletime": 0,
			"use_accountids": 1,
			"access_token": self._chat.accessToken
		},
		"json": true
	}, function(err, response, body) {
		if(self.chatState == SteamCommunity.ChatState.Offline) {
			return;
		}
		
		self._chat.timer = setTimeout(self._chatPoll.bind(self), self._chat.interval);
		
		if(err || response.statusCode != 200) {
			self.emit('debug', 'Error in chat poll: ' + (err ? err.message : "HTTP error " + response.statusCode));
			if (err.message == "Not Logged On") {
				self._relogWebChat();
			}

			return;
		}
		
		if(!body || body.error != 'OK') {
			self.emit('debug', 'Error in chat poll: ' + (body && body.error ? body.error : "Malformed response"));
			if (body && body.error && body.error == "Not Logged On") {
				self._relogWebChat();
			}

			return;
		}
		
		self._chat.message = body.messagelast;
		
		(body.messages || []).forEach(function(message) {
			var sender = new SteamID();
			sender.universe = SteamID.Universe.PUBLIC;
			sender.type = SteamID.Type.INDIVIDUAL;
			sender.instance = SteamID.Instance.DESKTOP;
			sender.accountid = message.accountid_from;
			
			switch(message.type) {
				case 'personastate':
					self._chatUpdatePersona(sender);
					break;
				
				case 'saytext':
					self.emit('chatMessage', sender, message.text);
					break;
				
				case 'typing':
					self.emit('chatTyping', sender);
					break;
				
				default:
					self.emit('debug', 'Unhandled chat message type: ' + message.type);
			}
		});
	}, "steamcommunity");
};

SteamCommunity.prototype._relogWebChat = function() {
	this.emit('debug', "Relogging web chat");
	clearTimeout(this._chat.timer);
	this.chatState = SteamCommunity.ChatState.Offline;
	this.chatLogon(this._chat.interval, this._chat.uiMode);
};

SteamCommunity.prototype._chatUpdatePersona = function(steamID) {
	this.emit('debug', 'Updating persona data for ' + steamID);
	var self = this;
	this.httpRequest({
		"uri": "https://steamcommunity.com/chat/friendstate/" + steamID.accountid,
		"json": true
	}, function(err, response, body) {
		if(err || response.statusCode != 200) {
			self.emit('debug', 'Chat update persona error: ' + (err ? err.message : "HTTP error " + response.statusCode));
			setTimeout(function() {
				self._chatUpdatePersona(steamID);
			}, 2000);
			return;
		}
		
		var persona = {
			"steamID": steamID,
			"personaName": body.m_strName,
			"personaState": body.m_ePersonaState,
			"personaStateFlags": body.m_nPersonaStateFlags || 0,
			"avatarHash": body.m_strAvatarHash,
			"inGame": !!body.m_bInGame,
			"inGameAppID": body.m_nInGameAppID ? parseInt(body.m_nInGameAppID, 10) : null,
			"inGameName": body.m_strInGameName || null
		};

		self.emit('chatPersonaState', steamID, persona);
		self.chatFriends[steamID.getSteamID64()] = persona;
	}, "steamcommunity");
};