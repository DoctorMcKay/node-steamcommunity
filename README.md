# Steam Community for Node.js

This lightweight module provides an easy interface to login to the Steam Community website. You can also login to the Steam Community website via [node-steam](https://github.com/seishun/node-steam)'s `webLogOn` method, but this module may be useful if you don't want to run an entire Steam instance.

It supports Steam Guard but doesn't support CAPTCHAs, so make sure you don't provide Steam with an incorrect password.

# Installation

Install it from npm:

    $ npm install steamcommunity

# Usage

First, instantiate the `SteamCommunity` object:

```js
var SteamCommunity = require('steamcommunity');
var community = new SteamCommunity("username", "password");
```

Then, simply call the `login` method:

```js
community.login(function(err, sessionID, cookies, steamguard) {
	// Do something with the sessionID and cookies.
	// The steamguard parameter is only meaningful if you've entered a Steam Guard auth code, as shown below.
});
```

# Steam Guard

In order to authenticate with a Steam Guard authorization, you need to provide your 64-bit Steam ID and machineAuth value to the constructor:

```js
var SteamCommunity = require('steamcommunity');
var community = new SteamCommunity("username", "password", "steamid64", "machineAuth");
```

If you don't have a prior authorization, you can get one by logging in as normal (without the steamID and machineAuth parameters). The callback to the `login` method will get `SteamGuard` as `err`. This means that an email has been sent to the email address tied to your account. Once you get the code, just call `login` again with the code as the first parameter:

```js
community.login('ABCDE', function(err, sessionID, cookies, steamguard) {
	// steamguard is now an object with two properties: steamID and machineAuth. You'll want to save these and provide them to subsequent constructors.
	// If you call login again on this instance of SteamCommunity, the Steam Guard machineAuth will be sent automatically so you don't need to reconstruct a new instance.
});
```

# Methods

## Constructor: SteamCommunity(username, password[, steamID, machineAuth])

Instantiate a new instance of `SteamCommunity`. `steamID` and `machineAuth` are optional, but if you have them and your account is protectd by Steam Guard, you should provide them. Otherwise, you'll get a `SteamGuard` error when you try to login.

## login([code, ]callback)

Attempts to login to Steam Community using the credentials supplied in the constructor. If you have previously received a `SteamGuard` error and you have an email auth code, supply it here as the first parameter.

The `callback` has 4 parameters:

- `err` - An error that occurred, or `null` on success. The value will be `SteamGuard` if you need to supply an email auth code.
- `sessionID` - This session's sessionID. Whatever module you're using with this will know what to do with it.
- `cookies` - An array of session cookies. The format is the same as that returned by [node-steam](https://github.com/seishun/node-steam)'s `webLogOn` method, so anything designed to work with node-steam will also work with this.
- `steamguard` - If you supplied an email auth code, this will contain your `steamID` and `machineAuth` code, which you should save and provide for subsequent logins.