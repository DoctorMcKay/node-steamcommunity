// If you aren't running this script inside of the repository, replace the following line with:
// const SteamCommunity = require('steamcommunity');
const SteamCommunity = require('../index.js');
const ReadLine = require('readline');
const FS = require('fs');

const EResult = SteamCommunity.EResult;

let community = new SteamCommunity();
let rl = ReadLine.createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.question('Username: ', (accountName) => {
	rl.question('Password: ', (password) => {
		doLogin(accountName, password);
	});
});

function doLogin(accountName, password, authCode, captcha) {
	community.login({
		accountName: accountName,
		password: password,
		authCode: authCode,
		captcha: captcha
	}, (err, sessionID, cookies, steamguard) => {
		if (err) {
			if (err.message == 'SteamGuardMobile') {
				console.log('This account already has two-factor authentication enabled.');
				process.exit();
				return;
			}

			if (err.message == 'SteamGuard') {
				console.log(`An email has been sent to your address at ${err.emaildomain}`);
				rl.question('Steam Guard Code: ',  (code) => {
					doLogin(accountName, password, code);
				});

				return;
			}

			if (err.message == 'CAPTCHA') {
				console.log(err.captchaurl);
				rl.question('CAPTCHA: ', (captchaInput) => {
					doLogin(accountName, password, authCode, captchaInput);
				});

				return;
			}

			console.log(err);
			process.exit();
			return;
		}

		console.log('Logged on!');
		community.enableTwoFactor((err, response) => {
			if (err) {
				if (err.eresult == EResult.Fail) {
					console.log('Error: Failed to enable two-factor authentication. Do you have a phone number attached to your account?');
					process.exit();
					return;
				}

				if (err.eresult == EResult.RateLimitExceeded) {
					console.log('Error: RateLimitExceeded. Try again later.');
					process.exit();
					return;
				}

				console.log(err);
				process.exit();
				return;
			}

			if (response.status != EResult.OK) {
				console.log(`Error: Status ${response.status}`);
				process.exit();
				return;
			}

			let filename = `twofactor_${community.steamID.getSteamID64()}.json`;
			console.log(`Writing secrets to ${filename}`);
			console.log(`Revocation code: ${response.revocation_code}`);
			FS.writeFileSync(filename, JSON.stringify(response, null, '\t'));

			promptActivationCode(response);
		});
	});
}

function promptActivationCode(response) {
	rl.question('SMS Code: ', (smsCode) => {
		community.finalizeTwoFactor(response.shared_secret, smsCode, (err) => {
			if (err) {
				if (err.message == 'Invalid activation code') {
					console.log(err);
					promptActivationCode(response);
					return;
				}

				console.log(err);
			} else {
				console.log('Two-factor authentication enabled!');
			}

			process.exit();
		});
	});
}
