var Request = require('request');
var RSA = require('node-bignumber').Key;
var hex2b64 = require('node-bignumber').hex2b64;

module.exports = SteamCommunity;

function SteamCommunity(username, password, steamID, machineAuth) {
	this._username = username;
	this._password = password;
	this._steamID = steamID;
	this._sentry = machineAuth;
}

SteamCommunity.prototype.login = function(authCode, callback) {
	if(typeof authCode === 'function') {
		callback = authCode;
		authCode = "";
	}
	
	var request;
	if(this._steamID && this._sentry) {
		var jar = Request.jar();
		request = Request.defaults({"jar": jar});
		jar.setCookieSync(Request.cookie('steamMachineAuth' + this._steamID + '=' + this._sentry), 'https://steamcommunity.com');
	} else {
		request = Request;
	}
	
	var self = this;
	request.post("https://steamcommunity.com/login/getrsakey/", {"form": {"username": this._username}}, function(err, response, body) {
		if(err) {
			callback(err);
			return;
		}
		
		var json;
		try {
			json = JSON.parse(body);
		} catch(e) {
			callback(e);
			return;
		}
		
		var key = new RSA();
		key.setPublic(json.publickey_mod, json.publickey_exp);
		
		var form = {
			"captcha_text": "",
			"captchagid": -1,
			"emailauth": authCode || "",
			"emailsteamid": "",
			"loginfriendlyname": "",
			"password": hex2b64(key.encrypt(self._password)),
			"remember_login": false,
			"rsatimestamp": json.timestamp,
			"twofactorcode": "",
			"username": self._username
		};
		
		request.post("https://steamcommunity.com/login/dologin/", {"form": form}, function(err, response, body) {
			if(err) {
				callback(err);
				return;
			}
			
			var json;
			try {
				json = JSON.parse(body);
			} catch(e) {
				callback(e);
				return;
			}
			
			if(!json.success) {
				callback(json.message);
			} else {
				var cookies = [];
				for(var i = 0; i < response.headers['set-cookie'].length; i++) {
					var header = response.headers['set-cookie'][i];
					var pos = header.indexOf(';');
					if(pos != -1) {
						header = header.substring(0, pos);
					}
					
					cookies.push(header);
				}
				
				var sessionID = Math.floor(Math.random() * 1000000000);
				cookies.push('sessionid=' + sessionID);
				
				if(self._steamID && self._sentry) {
					cookies.push('steamMachineAuth' + self._steamID + '=' + self._sentry);
				}
				
				var steamguard = {};
				if(json.transfer_parameters.steamid && json.transfer_parameters.webcookie) {
					steamguard.steamID = json.transfer_parameters.steamid;
					steamguard.machineAuth = json.transfer_parameters.webcookie;
					
					self._steamID = steamguard.steamID;
					self._sentry = steamguard.machineAuth;
				}
				
				callback(null, sessionID, cookies, steamguard);
			}
		});
	});
};