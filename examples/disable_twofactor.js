// If you aren't running this script inside of the repository, replace the following line with:
// const SteamCommunity = require('steamcommunity');
const SteamCommunity = require('../index.js');
const SteamTotp = require('steam-totp');
const ReadLine = require('readline');

let g_AbortPromptFunc = null;

let community = new SteamCommunity();

main();
async function main() {
	let accountName = await promptAsync('Username: ');
	let password = await promptAsync('Password (hidden): ', true);

	attemptLogin(accountName, password);
}

function attemptLogin(accountName, password, twoFactorCode) {
	community.login({
		accountName,
		password,
		twoFactorCode,
		disableMobile: false
	}, async (err) => {
		if (err && err.message == 'SteamGuardMobile') {
			let code = await promptAsync('Steam Guard App Code OR Shared Secret: ');
			if (code.length > 5) {
				// If we were provided a shared secret, turn it into a code.
				code = SteamTotp.getAuthCode(code);
			}
			attemptLogin(accountName, password, code);
			return;
		}

		if (err) {
			throw err;
		}

		doRevoke();
	});
}

async function doRevoke() {
	let rCode = await promptAsync('Revocation Code: R');
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

// Nothing interesting below here, just code for prompting for input from the console.

function promptAsync(question, sensitiveInput = false) {
	return new Promise((resolve) => {
		let rl = ReadLine.createInterface({
			input: process.stdin,
			output: sensitiveInput ? null : process.stdout,
			terminal: true
		});

		g_AbortPromptFunc = () => {
			rl.close();
			resolve('');
		};

		if (sensitiveInput) {
			// We have to write the question manually if we didn't give readline an output stream
			process.stdout.write(question);
		}

		rl.question(question, (result) => {
			if (sensitiveInput) {
				// We have to manually print a newline
				process.stdout.write('\n');
			}

			g_AbortPromptFunc = null;
			rl.close();
			resolve(result);
		});
	});
}

function abortPrompt() {
	if (!g_AbortPromptFunc) {
		return;
	}

	g_AbortPromptFunc();
	process.stdout.write('\n');
}
