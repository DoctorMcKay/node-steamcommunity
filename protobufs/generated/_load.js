/* eslint-disable */
// Auto-generated by generate-protos script on Wed Aug 24 2022 22:53:33 GMT-0400 (Eastern Daylight Time)

const Schema = module.exports;
const {Root} = require('protobufjs');

mergeObjects(Schema, Root.fromJSON(require('./authentication_service.json')));

function mergeObjects(destinationObject, sourceObject) {
	for (let i in sourceObject) {
		if (sourceObject.hasOwnProperty(i)) {
			destinationObject[i] = sourceObject[i];
		}
	}
}
