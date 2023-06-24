var SteamCommunity = require('../index.js');
var CEconItem = require('../classes/CEconItem.js');
var Helpers = require('./helpers.js');
var SteamID = require('steamid');
var request = require('request');
var Cheerio = require('cheerio');
var Async = require('async');

/*
 * Inventory history in a nutshell.
 *
 * There are no more page numbers. Now you have to request after_time and optionally after_trade.
 * Without "prev" set, you will request 30 trades that were completed FURTHER IN THE PAST than after_time (and optionally after_trade)
 * With "prev" set, you will request 30 trades that were completed MORE RECENTLY than after_time (and optionally after_trade)
 */

/**
 * @deprecated Use GetTradeHistory instead: https://lab.xpaw.me/steam_api_documentation.html#IEconService_GetTradeHistory_v1
 * @param {object} options
 * @param {function} callback
 */
SteamCommunity.prototype.getInventoryHistory = function(options, callback) {
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}
	
	options.direction = options.direction || "past";

	var qs = "?l=english";
	if (options.startTime) {
		if (options.startTime instanceof Date) {
			options.startTime = Math.floor(options.startTime.getTime() / 1000);
		}

		qs += "&after_time=" + options.startTime;

		if (options.startTrade) {
			qs += "&after_trade=" + options.startTrade;
		}
	}

	if (options.direction == "future") {
		qs += "&prev=1";
	}

	this._myProfile("inventoryhistory" + qs, null, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		var output = {};
		var vanityURLs = [];

		var $ = Cheerio.load(body);
		if (!$('.inventory_history_pagingrow').html()) {
			callback(new Error("Malformed page: no paging row found"));
			return;
		}

		// Load the inventory item data
		var match2 = body.match(/var g_rgHistoryInventory = (.*);/);
		if (!match2) {
			callback(new Error("Malformed page: no trade found"));
			return;
		}

		try {
			var historyInventory = JSON.parse(match2[1]);
		} catch (ex) {
			callback(new Error("Malformed page: no well-formed trade data found"));
			return;
		}

		var i;

		// See if we've got paging buttons
		var $paging = $('.inventory_history_nextbtn .pagebtn:not(.disabled)');
		var href;
		for (i = 0; i < $paging.length; i++) {
			href = $paging[i].attribs.href;
			if (href.match(/prev=1/)) {
				output.firstTradeTime = new Date(href.match(/after_time=(\d+)/)[1] * 1000);
				output.firstTradeID = href.match(/after_trade=(\d+)/)[1];
			} else {
				output.lastTradeTime = new Date(href.match(/after_time=(\d+)/)[1] * 1000);
				output.lastTradeID = href.match(/after_trade=(\d+)/)[1];
			}
		}

		output.trades = [];
		var trades = $('.tradehistoryrow');

		var item, trade, profileLink, items, j, econItem, timeMatch, time;
		for (i = 0; i < trades.length; i++) {
			item = $(trades[i]);
			trade = {};

			trade.onHold = !!item.find('span:nth-of-type(2)').text().match(/Trade on Hold/i);

			timeMatch = item.find('.tradehistory_timestamp').html().match(/(\d+):(\d+)(am|pm)/);
			if (timeMatch[1] == 12 && timeMatch[3] == 'am') {
				timeMatch[1] = 0;
			}

			if (timeMatch[1] < 12 && timeMatch[3] == 'pm') {
				timeMatch[1] = parseInt(timeMatch[1], 10) + 12;
			}

			time = (timeMatch[1] < 10 ? '0' : '') + timeMatch[1] + ':' + timeMatch[2] + ':00';

			trade.date = new Date(item.find('.tradehistory_date').html() + ' ' + time + ' UTC');
			trade.partnerName = item.find('.tradehistory_event_description a').html();
			trade.partnerSteamID = null;
			trade.partnerVanityURL = null;
			trade.itemsReceived = [];
			trade.itemsGiven = [];

			profileLink = item.find('.tradehistory_event_description a').attr('href');
			if (profileLink.indexOf('/profiles/') != -1) {
				trade.partnerSteamID = new SteamID(profileLink.match(/(\d+)$/)[1]);
			} else {
				trade.partnerVanityURL = profileLink.match(/\/([^\/]+)$/)[1];
				if (options.resolveVanityURLs && vanityURLs.indexOf(trade.partnerVanityURL) == -1) {
					vanityURLs.push(trade.partnerVanityURL);
				}
			}

			items = item.find('.history_item');
			for (j = 0; j < items.length; j++) {
				match = body.match(new RegExp("HistoryPageCreateItemHover\\( '" + $(items[j]).attr('id') + "', (\\d+), '(\\d+)', '(\\d+|class_\\d+_instance_\\d+|class_\\d+)', '(\\d+)' \\);"));
				econItem = historyInventory[match[1]][match[2]][match[3]];

				if ($(items[j]).attr('id').indexOf('received') != -1) {
					trade.itemsReceived.push(new CEconItem(econItem));
				} else {
					trade.itemsGiven.push(new CEconItem(econItem));
				}
			}

			output.trades.push(trade);
		}

		if (options.resolveVanityURLs) {
			Async.map(vanityURLs, Helpers.resolveVanityURL, function(err, results) {
				if (err) {
					callback(err);
					return;
				}

				for (i = 0; i < output.trades.length; i++) {
					if (output.trades[i].partnerSteamID || !output.trades[i].partnerVanityURL) {
						continue;
					}

					// Find the vanity URL
					for (j = 0; j < results.length; j++) {
						if (results[j].vanityURL == output.trades[i].partnerVanityURL) {
							output.trades[i].partnerSteamID = new SteamID(results[j].steamID);
							break;
						}
					}
				}

				callback(null, output);
			});
		} else {
			callback(null, output);
		}
	}, "steamcommunity");
};

