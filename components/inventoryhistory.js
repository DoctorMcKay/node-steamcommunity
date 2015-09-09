var SteamCommunity = require('../index.js');
var CEconItem = require('../classes/CEconItem.js');
var SteamID = require('steamid');
var request = require('request');
var Cheerio = require('cheerio');
var Async = require('async');

SteamCommunity.prototype.getInventoryHistory = function(options, callback) {
	if(typeof options === 'function') {
		callback = options;
		options = {};
	}
	
	options.page = options.page || 1;
	
	this.request("https://steamcommunity.com/my/inventoryhistory?l=english&p=" + options.page, function(err, response, body) {
		if(err) {
			callback(err);
			return;
		}
		
		var output = {};
		var vanityURLs = [];
		
		var $ = Cheerio.load(body);
		var html = $('.inventory_history_pagingrow').html();
		if(!html) {
			callback("Malformed page: no paging row found");
			return;
		}
		
		var match = html.match(/(\d+) - (\d+) of (\d+) History Items/);
		
		output.first = parseInt(match[1], 10);
		output.last = parseInt(match[2], 10);
		output.totalTrades = parseInt(match[3], 10);
		
		// Load the inventory item data
		var match2 = body.match(/var g_rgHistoryInventory = (.*);/);
		if(!match2) {
			callback(new Error("Malformed page: no trade found"));
			return;
		}
		var historyInventory = JSON.parse(match2[1]);
		
		output.trades = [];
		var trades = $('.tradehistoryrow');
		
		var item, trade, profileLink, items, j, econItem, timeMatch, time;
		for(var i = 0; i < trades.length; i++) {
			item = $(trades[i]);
			trade = {};
			
			timeMatch = item.find('.tradehistory_timestamp').html().match(/(\d+):(\d+)(am|pm)/);
			if(timeMatch[1] == 12 && timeMatch[3] == 'am') {
				timeMatch[1] = 0;
			}
			
			if(timeMatch[1] < 12 && timeMatch[3] == 'pm') {
				timeMatch[1] = parseInt(timeMatch[1], 10) + 12;
			}
			
			time = (timeMatch[1] < 10 ? '0' : '') + timeMatch[1] + ':' + timeMatch[2] + ':00';
			
			trade.date = new Date(item.find('.tradehistory_date').html() + ' ' + time);
			trade.partnerName = item.find('.tradehistory_event_description a').html();
			trade.partnerSteamID = null;
			trade.partnerVanityURL = null;
			trade.itemsReceived = [];
			trade.itemsGiven = [];
			
			profileLink = item.find('.tradehistory_event_description a').attr('href');
			if(profileLink.indexOf('/profiles/') != -1) {
				trade.partnerSteamID = new SteamID(profileLink.match(/(\d+)$/)[1]);
			} else {
				trade.partnerVanityURL = profileLink.match(/\/([^\/]+)$/)[1];
				if(options.resolveVanityURLs && vanityURLs.indexOf(trade.partnerVanityURL) == -1) {
					vanityURLs.push(trade.partnerVanityURL);
				}
			}
			
			items = item.find('.history_item');
			for(j = 0; j < items.length; j++) {
				match = body.match(new RegExp("HistoryPageCreateItemHover\\( '" + $(items[j]).attr('id') + "', (\\d+), '(\\d+)', '(\\d+)', '(\\d+)' \\);"));
				econItem = historyInventory[match[1]][match[2]][match[3]];
				
				if($(items[j]).attr('id').indexOf('received') != -1) {
					trade.itemsReceived.push(new CEconItem(econItem));
				} else {
					trade.itemsGiven.push(new CEconItem(econItem));
				}
			}
			
			output.trades.push(trade);
		}
		
		if(options.resolveVanityURLs) {
			Async.map(vanityURLs, resolveVanityURL, function(err, results) {
				if(err) {
					callback(err);
					return;
				}
				
				for(i = 0; i < output.trades.length; i++) {
					if(output.trades[i].partnerSteamID || !output.trades[i].partnerVanityURL) {
						continue;
					}
					
					// Find the vanity URL
					for(j = 0; j < results.length; j++) {
						if(results[j].vanityURL == output.trades[i].partnerVanityURL) {
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
	});
};

function resolveVanityURL(vanityURL, callback) {
	request("https://steamcommunity.com/id/" + vanityURL + "/?xml=1", function(err, response, body) {
		if(err) {
			callback(err);
			return;
		}
		
		var match = body.match(/<steamID64>(\d+)<\/steamID64>/);
		if(!match || !match[1]) {
			callback(new Error("Couldn't find Steam ID"));
			return;
		}
		
		callback(null, {"vanityURL": vanityURL, "steamID": match[1]});
	});
}
