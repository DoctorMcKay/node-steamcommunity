var SteamCommunity = require('../index.js');
var ReadLine = require('readline');
var fs = require('fs');

var community = new SteamCommunity();
var rl = ReadLine.createInterface({
	"input": process.stdin,
	"output": process.stdout
});

rl.question("Username: ", function(accountName) {
	rl.question("Password: ", function(password) {
		rl.question("Two-Factor Auth Code: ", function(authCode) {
			rl.question("Revocation Code: R", function(rCode) {
				doLogin(accountName, password, authCode, "", rCode);
			});
		});
	});
});

function doLogin(accountName, password, authCode, captcha, rCode) {
	community.login({
		"accountName": accountName,
		"password": password,
		"twoFactorCode": authCode,
		"captcha": captcha
	}, function(err, sessionID, cookies, steamguard) {
		if(err) {
			if(err.message == 'SteamGuard') {
				console.log("This account does not have two-factor authentication enabled.");
				process.exit();
				return;
			}

			if(err.message == 'CAPTCHA') {
				console.log(err.captchaurl);
				rl.question("CAPTCHA: ", function(captchaInput) {
					doLogin(accountName, password, authCode, captchaInput);
				});

				return;
			}

			console.log(err);
			process.exit();
			return;
		}

		console.log("Logged on!");
		community.disableTwoFactor("R" + rCode, function(err) {
			if(err) {
				console.log(err);
				process.exit();
				return;
			}

			console.log("Two-factor authentication disabled!");
			process.exit();
		});
	});
}
