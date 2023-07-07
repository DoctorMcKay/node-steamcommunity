const Cheerio = require('cheerio');
const SteamID = require('steamid');
const XML2JS = require('xml2js');

const Helpers = require('./helpers.js');
const SteamCommunity = require('../index.js');

const EResult = SteamCommunity.EResult;

SteamCommunity.prototype.getGroupMembers = function(gid, callback, members, link, addresses, addressIdx) {
	members = members || [];

	if (!link) {
		if (typeof gid != 'string') {
			// It's a SteamID object
			link = `https://steamcommunity.com/gid/${gid.toString()}/memberslistxml/?xml=1`;
		} else {
			try {
				// new SteamID could throw which is why we have this funky-looking try/catch set up here
				let sid = new SteamID(gid);
				if (sid.type == SteamID.Type.CLAN && sid.isValid()) {
					link = `https://steamcommunity.com/gid/${sid.getSteamID64()}/memberslistxml/?xml=1`;
				} else {
					throw new Error('Doesn\'t particularly matter what this message is');
				}
			} catch (e) {
				link = `http://steamcommunity.com/groups/${gid}/memberslistxml/?xml=1`;
			}
		}
	}

	addressIdx = addressIdx || 0;

	let options = {};
	options.uri = link;

	if (addresses) {
		if (addressIdx >= addresses.length) {
			addressIdx = 0;
		}

		options.localAddress = addresses[addressIdx];
	}

	this.httpRequest(options, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		XML2JS.parseString(body, (err, result) => {
			if (err) {
				callback(err);
				return;
			}

			members = members.concat(result.memberList.members[0].steamID64.map(sid => new SteamID(sid)));

			if (result.memberList.nextPageLink) {
				addressIdx++;
				this.getGroupMembers(gid, callback, members, result.memberList.nextPageLink[0], addresses, addressIdx);
			} else {
				callback(null, members);
			}
		});
	}, 'steamcommunity');
};

SteamCommunity.prototype.getGroupMembersEx = function(gid, addresses, callback) {
	this.getGroupMembers(gid, callback, null, null, addresses, 0);
};

SteamCommunity.prototype.joinGroup = function(gid, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	this.httpRequestPost({
		url: `https://steamcommunity.com/gid/${gid.getSteamID64()}`,
		form: {
			action: 'join',
			sessionID: this.getSessionID()
		}
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.leaveGroup = function(gid, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	this._myProfile('home_process', {
		sessionID: this.getSessionID(),
		action: 'leaveGroup',
		groupId: gid.getSteamID64()
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	});
};

SteamCommunity.prototype.getAllGroupAnnouncements = function(gid, time, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	if (typeof time == 'function') {
		callback = time;
		time = new Date(0); // The beginnig of time...
	}

	this.httpRequest({
		url: `https://steamcommunity.com/gid/${gid.getSteamID64()}/rss/`
	}, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		XML2JS.parseString(body, (err, results) => {
			if (err) {
				return callback(err);
			}

			if (!results.rss.channel[0].item) {
				return callback(null, []);
			}

			let announcements = results.rss.channel[0].item.map((announcement) => {
				let splitLink = announcement.link[0].split('/');
				return {
					headline: announcement.title[0],
					content: announcement.description[0],
					date: new Date(announcement.pubDate[0]),
					author: (typeof announcement.author === 'undefined') ? null : announcement.author[0],
					aid: splitLink[splitLink.length - 1]
				};
			}).filter(announcement => announcement.date > time);

			return callback(null, announcements);
		});
	}, 'steamcommunity');
};

SteamCommunity.prototype.postGroupAnnouncement = function(gid, headline, content, hidden, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	if (typeof hidden === 'function') {
		callback = hidden;
		hidden = false;
	}

	let form = {
		sessionID: this.getSessionID(),
		action: 'post',
		headline: headline,
		body: content,
		'languages[0][headline]': headline,
		'languages[0][body]': content
	};

	if (hidden) {
		form.is_hidden = 'is_hidden';
	}

	this.httpRequestPost({
		url: `https://steamcommunity.com/gid/${gid.getSteamID64()}/announcements`,
		form
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.editGroupAnnouncement = function(gid, aid, headline, content, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	let submitData = {
		url: `https://steamcommunity.com/gid/${gid.getSteamID64()}/announcements`,
		form: {
			sessionID: this.getSessionID(),
			gid: aid,
			action: 'update',
			headline: headline,
			body: content,
			'languages[0][headline]': headline,
			'languages[0][body]': content,
			'languages[0][updated]': 1
		}
	};

	this.httpRequestPost(submitData, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.deleteGroupAnnouncement = function(gid, aid, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	let submitData = {
		url: `https://steamcommunity.com/gid/${gid.getSteamID64()}/announcements/delete/${aid}?sessionID=${this.getSessionID()}`
	};

	this.httpRequestGet(submitData, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.scheduleGroupEvent = function(gid, name, type, description, time, server, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	// Event types: ChatEvent - Chat, OtherEvent - A lil somethin somethin, PartyEvent - Party!, MeetingEvent - Important meeting, SpecialCauseEvent - Special cause (charity ball?), MusicAndArtsEvent - Music or Art type thing, SportsEvent - Sporting endeavor, TripEvent - Out of town excursion
	// Passing a number for type will make it a game event for that appid

	switch (typeof server) {
		case 'function':
			callback = server;
			server = {ip: '', password: ''};
			break;

		case 'string':
			server = {ip: server, password: ''};
			break;

		default:
			if (typeof server != 'object') {
				server = {ip: '', password: ''};
			}
	}

	let form = {
		sessionid: this.getSessionID(),
		action: 'newEvent',
		tzOffset: new Date().getTimezoneOffset() * -60,
		name: name,
		type: (typeof type == 'number' || !isNaN(parseInt(type, 10)) ? 'GameEvent' : type),
		appID: (typeof type == 'number' || !isNaN(parseInt(type, 10)) ? type : ''),
		serverIP: server.ip,
		serverPassword: server.password,
		notes: description,
		eventQuickTime: 'now'
	};

	if (time === null) {
		form.startDate = 'MM/DD/YY';
		form.startHour = '12';
		form.startMinute = '00';
		form.startAMPM = 'PM';
		form.timeChoice = 'quick';
	} else {
		form.startDate = (time.getMonth() + 1 < 10 ? '0' : '') + (time.getMonth() + 1) + '/' + (time.getDate() < 10 ? '0' : '') + time.getDate() + '/' + time.getFullYear().toString().substring(2);
		form.startHour = (time.getHours() === 0 ? '12' : (time.getHours() > 12 ? time.getHours() - 12 : time.getHours()));
		form.startMinute = (time.getMinutes() < 10 ? '0' : '') + time.getMinutes();
		form.startAMPM = (time.getHours() <= 12 ? 'AM' : 'PM');
		form.timeChoice = 'specific';
	}

	this.httpRequestPost({
		url: `https://steamcommunity.com/gid/${gid.toString()}/eventEdit`,
		form
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.editGroupEvent = function(gid, id, name, type, description, time, server, callback) {
	if (typeof gid === 'string') {
		gid = new SteamID(gid);
	}

	// Event types: ChatEvent - Chat, OtherEvent - A lil somethin somethin, PartyEvent - Party!, MeetingEvent - Important meeting, SpecialCauseEvent - Special cause (charity ball?), MusicAndArtsEvent - Music or Art type thing, SportsEvent - Sporting endeavor, TripEvent - Out of town excursion
	// Passing a number for type will make it a game event for that appid

	switch (typeof server) {
		case 'function':
			callback = server;
			server = {ip: '', password: ''};
			break;

		case 'string':
			server = {ip: server, password: ''};
			break;

		default:
			if (typeof server != 'object') {
				server = {ip: '', password: ''};
			}
	}

	let form = {
		sessionid: this.getSessionID(),
		action: 'updateEvent',
		eventID: id,
		tzOffset: new Date().getTimezoneOffset() * -60,
		name: name,
		type: (typeof type == 'number' || !isNaN(parseInt(type, 10)) ? 'GameEvent' : type),
		appID: (typeof type == 'number' || !isNaN(parseInt(type, 10)) ? type : ''),
		serverIP: server.ip,
		serverPassword: server.password,
		notes: description,
		eventQuickTime: 'now'
	};

	if (time === null) {
		form.startDate = 'MM/DD/YY';
		form.startHour = '12';
		form.startMinute = '00';
		form.startAMPM = 'PM';
		form.timeChoice = 'quick';
	} else {
		form.startDate = (time.getMonth() + 1 < 10 ? '0' : '') + (time.getMonth() + 1) + '/' + (time.getDate() < 10 ? '0' : '') + time.getDate() + '/' + time.getFullYear().toString().substring(2);
		form.startHour = (time.getHours() === 0 ? '12' : (time.getHours() > 12 ? time.getHours() - 12 : time.getHours()));
		form.startMinute = (time.getMinutes() < 10 ? '0' : '') + time.getMinutes();
		form.startAMPM = (time.getHours() <= 12 ? 'AM' : 'PM');
		form.timeChoice = 'specific';
	}

	this.httpRequestPost({
		url: `https://steamcommunity.com/gid/${gid.toString()}/eventEdit`,
		form
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.deleteGroupEvent = function(gid, id, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	let form = {
		sessionid: this.getSessionID(),
		action: 'deleteEvent',
		eventID: id
	};

	this.httpRequestPost({
		url: `https://steamcommunity.com/gid/${gid.toString()}/eventEdit`,
		form
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.setGroupPlayerOfTheWeek = function(gid, steamID, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	if (typeof steamID == 'string') {
		steamID = new SteamID(steamID);
	}

	this.httpRequestPost({
		url: `https://steamcommunity.com/gid/${gid.getSteamID64()}/potwEdit`,
		form: {
			xml: 1,
			action: 'potw',
			memberId: steamID.getSteam3RenderedID(),
			sessionid: this.getSessionID()
		}
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		if (err || response.statusCode != 200) {
			callback(err || new Error(`HTTP error ${response.statusCode}`));
			return;
		}

		XML2JS.parseString(body, (err, results) => {
			if (err) {
				callback(err);
				return;
			}

			if (results.response.results[0] == 'OK') {
				callback(null, new SteamID(results.response.oldPOTW[0]), new SteamID(results.response.newPOTW[0]));
			} else {
				callback(new Error(results.response.results[0]));
			}
		});
	}, 'steamcommunity');
};

SteamCommunity.prototype.kickGroupMember = function(gid, steamID, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	if (typeof steamID == 'string') {
		steamID = new SteamID(steamID);
	}

	this.httpRequestPost({
		url: `https://steamcommunity.com/gid/${gid.getSteamID64()}/membersManage`,
		form: {
			sessionID: this.getSessionID(),
			action: 'kick',
			memberId: steamID.getSteamID64(),
			queryString: ''
		}
	}, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.getGroupHistory = function(gid, page, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	if (typeof page == 'function') {
		callback = page;
		page = 1;
	}

	this.httpRequest(`https://steamcommunity.com/gid/${gid.getSteamID64()}/history?p=${page}`, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		let $ = Cheerio.load(body);
		let output = {};

		let paging = $('.group_paging p').text();
		let match = paging.match(/(\d+) - (\d+) of (\d+)/);

		if (match) {
			output.first = parseInt(match[1], 10);
			output.last = parseInt(match[2], 10);
			output.total = parseInt(match[3], 10);
		}

		output.items = [];
		let currentYear = (new Date()).getFullYear();
		let lastDate = Date.now();

		Array.prototype.forEach.call($('.historyItem, .historyItemb'), (item) => {
			let data = {};

			let $item = $(item);
			data.type = $item.find('.historyShort').text().replace(/ /g, '');

			let users = $item.find('.whiteLink[data-miniprofile]');
			let sid;
			if (users[0]) {
				sid = new SteamID();
				sid.universe = SteamID.Universe.PUBLIC;
				sid.type = SteamID.Type.INDIVIDUAL;
				sid.instance = SteamID.Instance.DESKTOP;
				sid.accountid = $(users[0]).data('miniprofile');
				data.user = sid;
			}

			if (users[1]) {
				sid = new SteamID();
				sid.universe = SteamID.Universe.PUBLIC;
				sid.type = SteamID.Type.INDIVIDUAL;
				sid.instance = SteamID.Instance.DESKTOP;
				sid.accountid = $(users[1]).data('miniprofile');
				data.actor = sid;
			}

			// Figure out the date. Of course there's no year, because Valve
			let dateParts = $item.find('.historyDate').text().split('@');
			let date = dateParts[0].trim().replace(/(st|nd|th)$/, '').trim() + ', ' + currentYear;
			let time = dateParts[1].trim().replace(/(am|pm)/, ' $1');

			date = new Date(date + ' ' + time + ' UTC');

			// If this date is in the future, or it's later than the previous one, decrement the year
			if (date.getTime() > lastDate) {
				date.setFullYear(date.getFullYear() - 1);
			}

			data.date = date;

			output.items.push(data);
		});

		callback(null, output);
	}, 'steamcommunity');
};

SteamCommunity.prototype.getAllGroupComments = function(gid, from, count, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	let options = {
		url: `https://steamcommunity.com/comment/Clan/render/${gid.getSteamID64()}/-1/`,
		form: {
			start: from,
			count
		}
	};

	this.httpRequestPost(options, (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		let comments = [];

		let $ = Cheerio.load(JSON.parse(body).comments_html);

		$('.commentthread_comment_content').each((i, element) => {
			let comment = {};

			let $element = $(element);
			let $selector = $($element.find('.commentthread_author_link'));
			comment.authorName = $selector.find('bdi').text();
			comment.authorId = $selector.attr('href').replace(/https?:\/\/steamcommunity.com\/(id|profiles)\//, '');
			comment.date = Helpers.decodeSteamTime($(this).find('.commentthread_comment_timestamp').text().trim());

			$selector = $($element.find('.commentthread_comment_text'));
			comment.commentId = $selector.attr('id').replace('comment_content_', '');
			comment.text = $selector.html().trim();

			comments.push(comment);
		});

		callback(null, comments);
	}, 'steamcommunity');
};

SteamCommunity.prototype.deleteGroupComment = function(gid, cid, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	if (typeof cid != 'string') {
		cid = cid.toString();
	}

	let options = {
		url: `https://steamcommunity.com/comment/Clan/delete/${gid.getSteamID64()}/-1/`,
		form: {
			sessionid: this.getSessionID(),
			gidcomment: cid
		}
	};

	this.httpRequestPost(options, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

SteamCommunity.prototype.postGroupComment = function(gid, message, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	let options = {
		url: `https://steamcommunity.com/comment/Clan/post/${gid.getSteamID64()}/-1/`,
		form: {
			comment: message,
			count: 6,
			sessionid: this.getSessionID()
		}
	};

	this.httpRequestPost(options, (err, response, body) => {
		if (!callback) {
			return;
		}

		callback(err || null);
	}, 'steamcommunity');
};

/**
 * Get requests to join a restricted group.
 * @param {SteamID|string} gid - The SteamID of the group you want to manage
 * @param {function} callback - First argument is null/Error, second is array of SteamID objects
 */
SteamCommunity.prototype.getGroupJoinRequests = function(gid, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	this.httpRequestGet(`https://steamcommunity.com/gid/${gid.getSteamID64()}/joinRequestsManage`, (err, res, body) => {
		if (!body) {
			callback(new Error('Malformed response'));
			return;
		}

		let matches = body.match(/JoinRequests_ApproveDenyUser\(\W*['"](\d+)['"],\W0\W\)/g);
		if (!matches) {
			// no pending requests
			callback(null, []);
			return;
		}

		let requests = [];
		for (let i = 0; i < matches.length; i++) {
			requests.push(new SteamID('[U:1:' + matches[i].match(/JoinRequests_ApproveDenyUser\(\W*['"](\d+)['"],\W0\W\)/)[1] + ']'));
		}

		callback(null, requests);
	}, 'steamcommunity');
};

/**
 * Respond to one or more join requests to a restricted group.
 * @param {SteamID|string} gid - The SteamID of the group you want to manage
 * @param {SteamID|string|SteamID[]|string[]} steamIDs - The SteamIDs of the users you want to approve or deny membership for (or a single value)
 * @param {boolean} approve - True to put them in the group, false to deny their membership
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.respondToGroupJoinRequests = function(gid, steamIDs, approve, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	let rgAccounts = (!Array.isArray(steamIDs) ? [steamIDs] : steamIDs).map(sid => sid.toString());

	this.httpRequestPost({
		url: `https://steamcommunity.com/gid/${gid.getSteamID64()}/joinRequestsManage`,
		form: {
			rgAccounts: rgAccounts,
			bapprove: approve ? '1' : '0',
			json: '1',
			sessionID: this.getSessionID()
		},
		json: true
	}, (err, res, body) => {
		if (!callback) {
			return;
		}

		if (body != EResult.OK) {
			let err = new Error(EResult[body] || `Error ${body}`);
			err.eresult = body;
			callback(err);
		} else {
			callback(null);
		}
	}, 'steamcommunity');
};

/**
 * Respond to *ALL* pending group-join requests for a particular group.
 * @param {SteamID|string} gid - The SteamID of the group you want to manage
 * @param {boolean} approve - True to allow everyone who requested into the group, false to not
 * @param {function} callback - Takes only an Error object/null as the first argument
 */
SteamCommunity.prototype.respondToAllGroupJoinRequests = function(gid, approve, callback) {
	if (typeof gid == 'string') {
		gid = new SteamID(gid);
	}

	this.httpRequestPost({
		url: `https://steamcommunity.com/gid/${gid.getSteamID64()}/joinRequestsManage`,
		form: {
			bapprove: approve ? '1' : '0',
			json: '1',
			action: 'bulkrespond',
			sessionID: this.getSessionID()
		},
		json: true
	}, (err, res, body) => {
		if (!callback) {
			return;
		}

		if (body != EResult.OK) {
			let err = new Error(EResult[body] || `Error ${body}`);
			err.eresult = body;
			callback(err);
		} else {
			callback(null);
		}
	}, 'steamcommunity');
};
