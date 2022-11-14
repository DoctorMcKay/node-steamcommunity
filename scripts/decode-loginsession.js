const FS = require('fs');

const Protos = require('../protobufs/generated/_load.js');

if (!process.argv[2] || !FS.existsSync(process.argv[2])) {
	console.error('Usage: node decode-loginsession.js <path to har file> [optional path to output json file]');
	process.exit(1);
}

let har;
let output = [];
try {
	har = JSON.parse(FS.readFileSync(process.argv[2], {encoding: 'utf8'}));
	if (!har.log || !har.log.entries || !Array.isArray(har.log.entries)) {
		throw new Error();
	}
} catch (ex) {
	console.error('Error: Provided file does not appear to be a valid HAR');
	process.exit(2);
}

har.log.entries.forEach(({request, response}) => {
	let match = request.url.match(/^https:\/\/api\.steampowered\.com\/IAuthenticationService\/([^\/]+)\/v\d+[?\/]?/);
	if (!match) {
		// Not a relevant request for us
		return;
	}

	let apiMethod = match[1];
	let requestProto = Protos[`CAuthentication_${apiMethod}_Request`];
	let responseProto = Protos[`CAuthentication_${apiMethod}_Response`];
	if (!requestProto || !responseProto) {
		return;
	}

	let params = (request.method == 'GET' ? request.queryString : request.postData.params) || [];
	let inputParam = params.find(v => v.name == 'input_protobuf_encoded');
	let inputEncoded = Buffer.from(inputParam?.value || '', 'base64');

	if (response.content.encoding != 'base64') {
		return;
	}

	let responseEncoded = Buffer.from(response.content.text, 'base64');

	let decodedRequest = decode(requestProto, inputEncoded);
	let decodedResponse = decode(responseProto, responseEncoded);

	console.log(`===== ${apiMethod} =====`);
	console.log('Request:');
	console.log(decodedRequest);
	console.log('Response:');
	console.log(decodedResponse);

	output.push({
		method: apiMethod,
		request: decodedRequest,
		response: decodedResponse
	});
});

if (process.argv[3]) {
	fixupObject(output);
	FS.writeFileSync(process.argv[3], JSON.stringify(output, undefined, '\t'));
	console.log(`\nOutput file written to ${process.argv[3]}`);
}

function fixupObject(obj) {
	for (let i in obj) {
		if (Buffer.isBuffer(obj[i])) {
			obj[i] = obj[i].toString('base64');
		} else if (obj[i] && typeof obj[i] == 'object') {
			fixupObject(obj[i]);
		}
	}
}

function decode(proto, encoded) {
	let decodedBody = proto.decode(encoded);
	let objNoDefaults = proto.toObject(decodedBody, {longs: String});
	let objWithDefaults = proto.toObject(decodedBody, {defaults: true, longs: String});
	return replaceDefaults(objNoDefaults, objWithDefaults);
}

function replaceDefaults(noDefaults, withDefaults) {
	if (Array.isArray(withDefaults)) {
		return withDefaults.map((val, idx) => replaceDefaults(noDefaults[idx], val));
	}

	for (let i in withDefaults) {
		if (!withDefaults.hasOwnProperty(i)) {
			continue;
		}

		if (withDefaults[i] && typeof withDefaults[i] === 'object' && !Buffer.isBuffer(withDefaults[i])) {
			// Covers both object and array cases, both of which will work
			// Won't replace empty arrays, but that's desired behavior
			withDefaults[i] = replaceDefaults(noDefaults[i], withDefaults[i]);
		} else if (typeof noDefaults[i] === 'undefined' && isReplaceableDefaultValue(withDefaults[i])) {
			withDefaults[i] = null;
		}
	}

	return withDefaults;
}

function isReplaceableDefaultValue(val) {
	if (Buffer.isBuffer(val) && val.length == 0) {
		// empty buffer is replaceable
		return true;
	}

	if (Array.isArray(val)) {
		// empty array is not replaceable (empty repeated fields)
		return false;
	}

	if (val === '0') {
		// Zero as a string is replaceable (64-bit integer)
		return true;
	}

	// Anything falsy is true
	return !val;
}
