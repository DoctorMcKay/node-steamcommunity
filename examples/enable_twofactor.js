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
		doLogin(accountName, password);
	});
});

function doLogin(accountName, password, authCode, captcha) {
	community.login({
		"accountName": accountName,
		"password": password,
		"authCode": authCode,
		"captcha": captcha
	}, function(err, sessionID, cookies, steamguard) {
		if(err) {
			if(err.message == 'SteamGuardMobile') {
				console.log("This account already has two-factor authentication enabled.");
				process.exit();
				return;
			}

			if(err.message == 'SteamGuard') {
				console.log("An email has been sent to your address at " + err.emaildomain);
				rl.question("Steam Guard Code: ", function (code) {
					doLogin(accountName, password, code);
				});

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
		community.enableTwoFactor(function(err, response) {
			if(err) {
				if(err.eresult == 2) {
					console.log("Error: Failed to enable two-factor authentication. Do you have a phone number attached to your account?");
					process.exit();
					return;
				}

				if(err.eresult == 84) {
					console.log("Error: RateLimitExceeded. Try again later.");
					process.exit();
					return;
				}

				console.log(err);
				process.exit();
				return;
			}

			if(response.status != 1) {
				console.log("Error: Status " + response.status);
				process.exit();
				return;
			}

			console.log("Writing secrets to twofactor_" + community.steamID.getSteamID64() + ".json");
			console.log("Revocation code: " + response.revocation_code);
			fs.writeFile("twofactor_" + community.steamID.getSteamID64() + ".json", JSON.stringify(response, null, "\t"));

			promptActivationCode(response);
		});
	});
}

function promptActivationCode(response) {
	rl.question("SMS Code: ", function(smsCode) {
		community.finalizeTwoFactor(response.shared_secret, smsCode, function(err) {
			if(err) {
				if(err.message == "Invalid activation code") {
					console.log(err);
					promptActivationCode(response);
					return;
				}

				console.log(err);
			} else {
				console.log("Two-factor authentication enabled!");
			}

			process.exit();
		});
	});
}
