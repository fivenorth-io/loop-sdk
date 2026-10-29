# Loop SDK

Loop SDK lets dApps connect to a [Loop](https://cantonloop.com) wallet on mobile or desktop, read holdings and contracts, and ask the user to sign DAML transactions. A server SDK is also available for backends that hold their own keys.

**Documentation: [docs.fivenorth.io/loop-sdk](https://docs.fivenorth.io/loop-sdk/overview/)**

## Install

```bash
bun add @fivenorth/loop-sdk
```

Or without a build step:

```javascript
import { loop } from 'https://unpkg.com/@fivenorth/loop-sdk@0.15/dist';
```

## Quickstart

```javascript
import { loop } from '@fivenorth/loop-sdk';

loop.init({
    appName: 'My dApp',
    network: 'mainnet', // or 'devnet', 'local'
    onAccept: async (provider) => {
        const holdings = await provider.getHolding();
        console.log(provider.party_id, holdings);
    },
    onReject: () => console.log('Connection rejected'),
});

loop.connect(); // shows the QR code / wallet prompt
```

## Docs

- [Overview and supported contracts](https://docs.fivenorth.io/loop-sdk/overview/)
- [Usage guide](https://docs.fivenorth.io/loop-sdk/usage/): connecting, provider methods, submitting transactions
- [Server API](https://docs.fivenorth.io/loop-sdk/server/): signing without a wallet popup
- [Custom contracts](https://docs.fivenorth.io/loop-sdk/custom-contracts/): getting your own DAR reviewed and deployed
- [API reference](https://docs.fivenorth.io/loop-sdk/api-reference/)
- [Live demo](https://docs.fivenorth.io/loop-sdk/demo/)
- [Changelog](CHANGELOG.md) and [security policy](SECURITY.md)

# Development Guide

This section is only for developing the SDK itself. To use the SDK, see the [docs](https://docs.fivenorth.io/loop-sdk/overview/).

To install dependencies:

```bash
bun install
```

To run the dev server, which also recompiles the SDK on change:

```bash
bun start
```

Then visit http://localhost:3030/ to see the local demo app served from `demo/test.html`.
