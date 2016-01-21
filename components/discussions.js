var SteamCommunity = require('../index.js');
var Cheerio = require('cheerio');
var VM = require('vm');

SteamCommunity.prototype.getDiscussion = function(url, callback) {
	var self = this;

	this.request.get({
		"uri": url,
		"followRedirect": false
	}, function(err, response, body) {
		if(self._checkHttpError(err, response, callback)) {
			return;
		}

		if(self._checkCommunityError(body, callback)) {
			return;
		}

		if(response.statusCode >= 300 && response.statusCode <= 399) {
			callback(new Error("Topic Not Found"));
			return
		}

		var $ = Cheerio.load(body);
		var scripts = $('#group_tab_content_discussions').find('script');
		if(scripts.length < 2) {
			callback(new Error("Malformed response"));
			return;
		}

		var context = VM.createContext({
			"ForumTopic": {},
			"CommentThread": {},
			"$J": function(input) {
				if(typeof input === 'function') {
					input();
				}
			},
			"InitializeForumTopic": function(board, boardUrl, topicID, topic) {
				context.ForumTopic.board = board;
				context.ForumTopic.topicID = topicID;
				context.ForumTopic.topic = topic;
			},
			"InitializeCommentThread": function(type, name, commentData, url, quoteBoxHeight) {
				context.CommentThread.type = type;
				context.CommentThread.name = name;
				context.CommentThread.commentData = commentData;
				context.CommentThread.url = url;
				context.CommentThread.quoteBoxHeight = quoteBoxHeight;
			}
		});

		console.log(context);

		VM.runInContext($(scripts[0]).html(), context);
		VM.runInContext($(scripts[1]).html(), context);

		console.log(context);
	});
};
