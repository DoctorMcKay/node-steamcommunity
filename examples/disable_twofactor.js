// If you aren't running this script inside of the repository, replace the following line with:
// const SteamCommunity = require('steamcommunity');
const SteamCommunity = require('../index.js');
const ReadLine = require('readline');

let community = new SteamCommunity();
let rl = ReadLine.createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.question('Username: ', (accountName) => {
	rl.question('Password: ', (password) => {
		rl.question('Two-Factor Auth Code: ', (authCode) =>{
			rl.question('Revocation Code: R', (rCode) => {
				doLogin(accountName, password, authCode, '', rCode);
			});
		});
	});
});

function doLogin(accountName, password, authCode, captcha, rCode) {
	community.login({
		accountName: accountName,
		password: password,
		twoFactorCode: authCode,
		captcha: captcha
	}, (err, sessionID, cookies, steamguard) => {
		if (err) {
			if (err.message == 'SteamGuard') {
				console.log('This account does not have two-factor authentication enabled.');
				process.exit();
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
		community.disableTwoFactor('R' + rCode, (err) => {
			if (err) {
				console.log(err);
				process.exit();
				return;
			}

			console.log('Two-factor authentication disabled!');
			process.exit();
		});
	});
}
