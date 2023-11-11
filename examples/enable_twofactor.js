// If you aren't running this script inside of the repository, replace the following line with:
// const SteamCommunity = require('steamcommunity');
const SteamCommunity = require('../index.js');
const ReadLine = require('readline');
const FS = require('fs');

const EResult = SteamCommunity.EResult;

let g_AbortPromptFunc = null;

let community = new SteamCommunity();

main();
async function main() {
	let accountName = await promptAsync('Username: ');
	let password = await promptAsync('Password (hidden): ', true);

	attemptLogin(accountName, password);
}

function attemptLogin(accountName, password, authCode) {
	community.login({
		accountName,
		password,
		authCode,
		disableMobile: false
	}, async (err) => {
		if (err && err.message == 'SteamGuard') {
			let code = await promptAsync('Steam Guard Email Code: ');
			attemptLogin(accountName, password, code);
			return;
		}

		if (err) {
			throw err;
		}

		doSetup();
	});
}

function doSetup() {
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
}

async function promptActivationCode(response) {
	if (response.phone_number_hint) {
		console.log(`An activation code has been sent to your phone ending in ${response.phone_number_hint}.`);
	} else if (response.confirm_type == 3) {
		// Exact meaning of confirm_type is unknown, but 3 appears to be email code
		console.log('An activation code has been sent to your email.');
	}

	let smsCode = await promptAsync('Activation Code: ');
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
