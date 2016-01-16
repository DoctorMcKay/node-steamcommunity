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

function doLogin(accountName, password, authCode, twoFactorCode) {
	community.login({
		"accountName": accountName,
		"password": password,
		"authCode": authCode,
		"twoFactorCode": twoFactorCode
	}, function(err, sessionID, cookies, steamguard) {
		if(err) {
			if(err.message == 'SteamGuardMobile') {
				rl.question("Steam Authenticator Code: ", function(code) {
					doLogin(accountName, password, null, code);
				});

				return;
			}

			if(err.message == 'SteamGuard') {
				console.log("An email has been sent to your address at " + err.emaildomain);
				rl.question("Steam Guard Code: ", function(code) {
					doLogin(accountName, password, code);
				});

				return;
			}

			console.log(err);
			process.exit();
			return;
		}

		console.log("Logged on!");

		rl.question("Group ID: ", function(gid) {
			community.getSteamGroup(gid, function(err, group) {
				if (err) {
					console.log(err);
					process.exit(1);
				}

				group.getAllAnnouncements(function(err, announcements) {
						
					if(announcements.length === 0) {
						return console.log("This group has no announcements");
					}

					for (var i = announcements.length - 1; i >= 0; i--) {
						console.log("[%s] %s %s: %s", announcements[i].date, announcements[i].aid, announcements[i].author, announcements[i].content);
					};

					rl.question("Annoucement ID: ", function(aid) {
						rl.question("New title: ", function(header) {
							rl.question("New body: ", function(content) {
								// EW THE PYRAMID!
								editAnnouncement(group, aid, header, content);
							});
						});
					});
				});
			});
		});
	});
}

function editAnnouncement(group, aid, header, content) {
	// Actual community method.
	group.editAnnouncement(aid, header, content, function(error) {
		if(!error) {
			console.log("Annoucement edited!");
		} else {
			console.log("Unable to edit annoucement! %j", error);
			process.exit(1);
		}
	});
}
