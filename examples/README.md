# node-steamcommunity examples

The files in this directory are example scripts that you can use as a getting-started point for using node-steamcommunity.

## Enable or Disable Two-Factor Authentication

If you need to enable or disable 2FA on your bot account, you can use enable_twofactor.js and disable_twofactor.js to do so.
The way that you're intended to use these scripts is by cloning the repository locally, and then running them directly
from this examples directory.

For example:

```shell
git clone https://github.com/DoctorMcKay/node-steamcommunity node-steamcommunity
cd node-steamcommunity
npm install
cd examples
node enable_twofactor.js
```

## Accept All Confirmations

If you need to accept trade or market confirmations on your bot account for which you have your identity secret, you can
use accept_all_confirmations.js to do so. The way that you're intended to use this script is by cloning the repository
locally, and then running it directly from this examples directory.

For example:

```shell
git clone https://github.com/DoctorMcKay/node-steamcommunity node-steamcommunity
cd node-steamcommunity
npm install
cd examples
node accept_all_confirmations.js
```
