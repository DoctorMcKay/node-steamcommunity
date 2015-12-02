var SteamCommunity = require('../index.js');
var SteamTotp = require('steam-totp');
var Crypto = require('crypto');
var ByteBuffer = require('bytebuffer');

SteamCommunity.prototype.getConfirmations = function(secret, offset, callback) {
  var url = this._generateConfirmationUrl(secret, offset);
  var self = this;
  return this.request.get(url, function(err, resp, body) {
    if (err) {
      return err;
    }

    var toConfirm = [];

    var idRegex = /data-confid="(\d+)"/g;
    var keyRegex = /data-key="(\d+)"/g;
    var descRegex = /<div>((Confirm|Trade with|Sell -) .+)<\/div>/g;
    while(true) {
      try {
        var id = idRegex.exec(body);
        var key = keyRegex.exec(body);
        var desc = descRegex.exec(body);

        if (!id){
          break;
        }

        toConfirm.push({ id: id[1], key: key[1], desc: desc[1] });
        }
      catch (e) {
        callback(e);
      }
    }


    callback(null, toConfirm);
  });
};

SteamCommunity.prototype.confirmTrade = function(confirmation, secret, callback) {
  this._sendConfirmationRequest(confirmation, secret, 'allow', callback);
};

SteamCommunity.prototype.cancelTrade = function(confirmation, secret, callback) {
  this._sendConfirmationRequest(confirmation, secret, 'cancel', callback);
};

SteamCommunity.prototype._sendConfirmationRequest = function(confirmation, secret, op, callback) {
  var url = 'https://steamcommunity.com/mobileconf/ajaxop';
  var query = "?op=" + op + "&";
  query += this._generateConfirmationQueryParams(secret, op);
  query += "&cid=" + confirmation.id + "&ck=" + confirmation.key;
  url += query;

  this.request.get(url, function(err, resp, body) {
    if (err) {
      return err;
    }

    callback(body.success);
  });
};

SteamCommunity.prototype._generateConfirmationUrl = function(secret, offset) {
  var endpoint = 'https://steamcommunity.com/mobileconf/conf?';
  return endpoint + this._generateConfirmationQueryParams(secret, 'conf');
};

SteamCommunity.prototype._generateConfirmationQueryParams = function(secret, tag, offset) {
  offset = offset || 0;
  var deviceID = require('crypto').createHash('sha1');
  deviceID.update(Math.random().toString());
  deviceID = deviceID.digest('hex');

  var time = Math.floor(new Date() / 1000) + offset;

  return 'p=' + deviceID + '&a=' + this.steamID.toString() + '&k=' + this._generateConfirmationHash(secret, tag, time) + '&t=' + time + '&m=android&tag=' + tag;
};

SteamCommunity.prototype._generateConfirmationHash = function(secret, tag, time) {
  var secretBuffer = bufferizeSecret(secret);

  var n2 = 8;

  if (tag) {
    if (tag.length > 32) {
      n = 8 + 32;
    }
    else {
      n2 = 8 + tag.length;
    }
  }

  var buffer = new Buffer(n2);
  buffer.writeUInt32BE(0, 0);
  buffer.writeUInt32BE(time, 4);

  if (tag) {
    ByteBuffer.fromUTF8(tag).toBuffer().copy(buffer, 8, 0, n2 - 8);
  }

  var hmac = Crypto.createHmac('sha1', secretBuffer);
  hmac = hmac.update(buffer).digest();
  var encodedData = hmac.toString('base64');
  return escape(encodedData);

};

function bufferizeSecret(secret) {
  if(typeof secret === 'string') {
    // Check if it's hex
    if(secret.match(/[0-9a-f]{40}/i)) {
      return new Buffer(secret, 'hex');
    } else {
      // Looks like it's base64
      return new Buffer(secret, 'base64');
    }
  }

  return secret;
}
