const SteamID = require('steamid');

const SteamCommunity = require('../index.js');

SteamCommunity.ChatState = require('../resources/EChatState.js');
SteamCommunity.PersonaState = require('../resources/EPersonaState.js');
SteamCommunity.PersonaStateFlag = require('../resources/EPersonaStateFlag.js');

/**
 * @deprecated No support for new Steam chat. Use steam-user instead.
 * @param {int} interval
 * @param {string} uiMode
 */
SteamCommunity.prototype.chatLogon = function(interval, uiMode) {
	if (this.chatState == SteamCommunity.ChatState.LoggingOn || this.chatState == SteamCommunity.ChatState.LoggedOn) {
		return;
	}

	interval = interval || 500;
	uiMode = uiMode || "web";

	this.emit('debug', 'Requesting chat WebAPI token');
	this.chatState = SteamCommunity.ChatState.LoggingOn;

	this.getWebApiOauthToken((err, token) => {
		if (err) {
			let fatal = err.message.indexOf('not authorized') != -1;

			if (!fatal) {
				this.chatState = SteamCommunity.ChatState.LogOnFailed;
				setTimeout(this.chatLogon.bind(this), 5000);
			} else {
				this.chatState = SteamCommunity.ChatState.Offline;
			}

			this.emit('chatLogOnFailed', err, fatal);
			this.emit('debug', "Cannot get oauth token: " + err.message);
			return;
		}

		this.httpRequestPost({
			"uri": "https://api.steampowered.com/ISteamWebUserPresenceOAuth/Logon/v1",
			"form": {
				"ui_mode": uiMode,
				"access_token": token
			},
			"json": true
		}, (err, response, body) => {
			if (err || response.statusCode != 200) {
				this.chatState = SteamCommunity.ChatState.LogOnFailed;
				this.emit('chatLogOnFailed', err ? err : new Error("HTTP error " + response.statusCode), false);
				this.emit('debug', 'Error logging into webchat: ' + (err ? err.message : "HTTP error " + response.statusCode));
				setTimeout(this.chatLogon.bind(this), 5000);
				return;
			}

			if (body.error != 'OK') {
				this.chatState = SteamCommunity.ChatState.LogOnFailed;
				this.emit('chatLogOnFailed', new Error(body.error), false);
				this.emit('debug', 'Error logging into webchat: ' + body.error);
				setTimeout(this.chatLogon.bind(this), 5000);
				return;
			}

			this._chat = {
				"umqid": body.umqid,
				"message": body.message,
				"accessToken": token,
				"interval": interval,
				"uiMode": uiMode
			};

			this.chatFriends = {};

			this.chatState = SteamCommunity.ChatState.LoggedOn;
			this.emit('chatLoggedOn');
			this._chatPoll();
		}, "steamcommunity");
	});
};

/**
 * @deprecated No support for new Steam chat. Use steam-user instead.
 * @param {string|SteamID} recipient
 * @param {string} text
 * @param {string} [type]
 * @param {function} [callback]
 */
SteamCommunity.prototype.chatMessage = function(recipient, text, type, callback) {
	if (this.chatState != SteamCommunity.ChatState.LoggedOn) {
		throw new Error("Chat must be logged on before messages can be sent");
	}

	if (typeof recipient === 'string') {
		recipient = new SteamID(recipient);
	}

	if (typeof type === 'function') {
		callback = type;
		type = 'saytext';
	}

	type = type || 'saytext';

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
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if (body.error != 'OK') {
			callback(new Error(body.error));
		} else {
			callback(null);
		}
	}, "steamcommunity");
};

/**
 * @deprecated No support for new Steam chat. Use steam-user instead.
 */
SteamCommunity.prototype.chatLogoff = function() {
	this.httpRequestPost({
		"uri": "https://api.steampowered.com/ISteamWebUserPresenceOAuth/Logoff/v1",
		"form": {
			"access_token": this._chat.accessToken,
			"umqid": this._chat.umqid
		}
	}, (err, response, body) => {
		if (err || response.statusCode != 200) {
			this.emit('debug', 'Error logging off of chat: ' + (err ? err.message : "HTTP error " + response.statusCode));
			setTimeout(this.chatLogoff.bind(this), 1000);
		} else {
			this.emit('chatLoggedOff');
			clearTimeout(this._chat.timer);
			delete this._chat;
			delete this.chatFriends;
			this.chatState = SteamCommunity.ChatState.Offline;
		}
	}, "steamcommunity");
};

/**
 * @private
 */
SteamCommunity.prototype._chatPoll = function() {
	this.emit('debug', 'Doing chat poll');

	this.httpRequestPost({
		"uri": "https://api.steampowered.com/ISteamWebUserPresenceOAuth/Poll/v1",
		"form": {
			"umqid": this._chat.umqid,
			"message": this._chat.message,
			"pollid": 1,
			"sectimeout": 20,
			"secidletime": 0,
			"use_accountids": 1,
			"access_token": this._chat.accessToken
		},
		"json": true
	}, (err, response, body) => {
		if (this.chatState == SteamCommunity.ChatState.Offline) {
			return;
		}

		this._chat.timer = setTimeout(this._chatPoll.bind(this), this._chat.interval);

		if (err || response.statusCode != 200) {
			this.emit('debug', 'Error in chat poll: ' + (err ? err.message : "HTTP error " + response.statusCode));
			if (err.message == "Not Logged On") {
				this._relogWebChat();
			}

			return;
		}

		if (!body || body.error != 'OK') {
			this.emit('debug', 'Error in chat poll: ' + (body && body.error ? body.error : "Malformed response"));
			if (body && body.error && body.error == "Not Logged On") {
				this._relogWebChat();
			}

			return;
		}

		this._chat.message = body.messagelast;

		(body.messages || []).forEach(function(message) {
			let sender = new SteamID();
			sender.universe = SteamID.Universe.PUBLIC;
			sender.type = SteamID.Type.INDIVIDUAL;
			sender.instance = SteamID.Instance.DESKTOP;
			sender.accountid = message.accountid_from;

			switch (message.type) {
				case 'personastate':
					this._chatUpdatePersona(sender);
					break;

				case 'saytext':
					this.emit('chatMessage', sender, message.text);
					break;

				case 'typing':
					this.emit('chatTyping', sender);
					break;

				default:
					this.emit('debug', 'Unhandled chat message type: ' + message.type);
			}
		});
	}, "steamcommunity");
};

/**
 * @private
 */
SteamCommunity.prototype._relogWebChat = function() {
	this.emit('debug', "Relogging web chat");
	clearTimeout(this._chat.timer);
	this.chatState = SteamCommunity.ChatState.Offline;
	this.chatLogon(this._chat.interval, this._chat.uiMode);
};

/**
 * @param {SteamID} steamID
 * @private
 */
SteamCommunity.prototype._chatUpdatePersona = function(steamID) {
	if (!this.chatFriends || this.chatState == SteamCommunity.ChatState.Offline) {
		return; // we no longer care
	}

	this.emit('debug', 'Updating persona data for ' + steamID);
	this.httpRequest({
		"uri": "https://steamcommunity.com/chat/friendstate/" + steamID.accountid,
		"json": true
	}, (err, response, body) => {
		if (!this.chatFriends || this.chatState == SteamCommunity.ChatState.Offline) {
			return; // welp
		}

		if (err || response.statusCode != 200) {
			this.emit('debug', 'Chat update persona error: ' + (err ? err.message : "HTTP error " + response.statusCode));
			setTimeout(function() {
				this._chatUpdatePersona(steamID);
			}, 2000);
			return;
		}

		let persona = {
			"steamID": steamID,
			"personaName": body.m_strName,
			"personaState": body.m_ePersonaState,
			"personaStateFlags": body.m_nPersonaStateFlags || 0,
			"avatarHash": body.m_strAvatarHash,
			"inGame": !!body.m_bInGame,
			"inGameAppID": body.m_nInGameAppID ? parseInt(body.m_nInGameAppID, 10) : null,
			"inGameName": body.m_strInGameName || null
		};

		this.emit('chatPersonaState', steamID, persona);
		this.chatFriends[steamID.getSteamID64()] = persona;
	}, "steamcommunity");
};
