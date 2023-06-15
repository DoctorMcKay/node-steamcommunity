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

		if (community.mobileAccessToken) {
			// If we already have a mobile access token, we don't need to prompt for one.
			doRevoke(rCode);
			return;
		}

		console.log('You need to provide a mobile app access token to continue.');
		console.log('You can generate one using steam-session (https://www.npmjs.com/package/steam-session).');
		console.log('The access token needs to be generated using EAuthTokenPlatformType.MobileApp.');
		console.log('Make sure you provide an *ACCESS* token, not a refresh token.');

		rl.question('Access Token: ', (accessToken) => {
			community.setMobileAppAccessToken(accessToken);
			doRevoke(rCode);
		});
	});
}

function doRevoke(rCode) {
	community.disableTwoFactor('R' + rCode, (err) => {
		if (err) {
			console.log(err);
			process.exit();
			return;
		}

		console.log('Two-factor authentication disabled!');
		process.exit();
	});
}
