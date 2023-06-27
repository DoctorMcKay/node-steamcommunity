// If you aren't running this script inside of the repository, replace the following line with:
// const SteamCommunity = require('steamcommunity');
const SteamCommunity = require('../index.js');
const SteamSession = require('steam-session');
const ReadLine = require('readline');

let g_AbortPromptFunc = null;

let community = new SteamCommunity();

main();
async function main() {
	let accountName = await promptAsync('Username: ');
	let password = await promptAsync('Password (hidden): ', true);

	// Create a LoginSession for us to use to attempt to log into steam
	let session = new SteamSession.LoginSession(SteamSession.EAuthTokenPlatformType.MobileApp);

	// Go ahead and attach our event handlers before we do anything else.
	session.on('authenticated', async () => {
		abortPrompt();

		let accessToken = session.accessToken;
		let cookies = await session.getWebCookies();

		community.setCookies(cookies);
		community.setMobileAppAccessToken(accessToken);

		// Enabling or disabling 2FA is presently the only action in node-steamcommunity which requires an access token.
		// In all other cases, using `community.setCookies(cookies)` is all you need to do in order to be logged in,
		// although there's never any harm in setting a mobile app access token.

		doRevoke();
	});

	session.on('timeout', () => {
		abortPrompt();
		console.log('This login attempt has timed out.');
	});

	session.on('error', (err) => {
		abortPrompt();

		// This should ordinarily not happen. This only happens in case there's some kind of unexpected error while
		// polling, e.g. the network connection goes down or Steam chokes on something.

		console.log(`ERROR: This login attempt has failed! ${err.message}`);
	});

	// Start our login attempt
	let startResult = await session.startWithCredentials({accountName, password});
	if (startResult.actionRequired) {
		// Some Steam Guard action is required. We only care about email and device codes; in theory an
		// EmailConfirmation and/or DeviceConfirmation action could be possible, but we're just going to ignore those.
		// If the user does receive a confirmation and accepts it, LoginSession will detect and handle that automatically.
		// The only consequence of ignoring it here is that we don't print a message to the user indicating that they
		// could accept an email or device confirmation.

		let codeActionTypes = [SteamSession.EAuthSessionGuardType.EmailCode, SteamSession.EAuthSessionGuardType.DeviceCode];
		let codeAction = startResult.validActions.find(action => codeActionTypes.includes(action.type));
		if (codeAction) {
			if (codeAction.type == SteamSession.EAuthSessionGuardType.EmailCode) {
				// We wouldn't expect this to happen since we're trying to disable 2FA, but just in case...
				console.log(`A code has been sent to your email address at ${codeAction.detail}.`);
			} else {
				console.log('You need to provide a Steam Guard Mobile Authenticator code.');
			}

			let code = await promptAsync('Code: ');
			if (code) {
				await session.submitSteamGuardCode(code);
			}

			// If we fall through here without submitting a Steam Guard code, that means one of two things:
			//   1. The user pressed enter without providing a code, in which case the script will simply exit
			//   2. The user approved a device/email confirmation, in which case 'authenticated' was emitted and the prompt was canceled
		}
	}
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
