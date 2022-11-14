/* eslint-disable */
// Auto-generated by generate-protos script on Sun Aug 28 2022 18:52:02 GMT-0400 (Eastern Daylight Time)

const Schema = module.exports;
const {Root} = require('protobufjs');

mergeObjects(Schema, Root.fromJSON(require('./enums.json')));
mergeObjects(Schema, Root.fromJSON(require('./steammessages_auth.steamclient.json')));
mergeObjects(Schema, Root.fromJSON(require('./steammessages_base.json')));
mergeObjects(Schema, Root.fromJSON(require('./steammessages_unified_base.steamclient.json')));

function mergeObjects(destinationObject, sourceObject) {
	for (let i in sourceObject) {
		if (sourceObject.hasOwnProperty(i)) {
			destinationObject[i] = sourceObject[i];
		}
	}
}
