# Loop SDK

Loop SDK lets dApps connect to a [Loop](https://cantonloop.com) wallet on mobile or desktop, read holdings and contracts, and ask the user to sign DAML transactions. A server SDK is also available for backends that hold their own keys.

**Documentation: [docs.fivenorth.io/loop-sdk](https://docs.fivenorth.io/loop-sdk/overview/)**

## Release updates

Follow [#5n-loop-sdk-releases](https://fivenorthdigital.slack.com/archives/C0CG59QNB32) for new releases, upgrade notes, and breaking changes. For channel access or SDK support, contact [support@looptech.io](mailto:support@looptech.io).

## CIP-103 provider

Use `loop.getCip103Provider()` after `loop.init()` to access Canton dApp API 0.5.0. Existing Loop methods remain available. See the [CIP-103 guide](https://docs.fivenorth.io/loop-sdk/cip103/) for supported methods, ledger endpoints, and compatibility notes, including unconfirmed transaction outcomes.

## Install

```bash
bun add @fivenorth/loop-sdk
```

Or without a build step:

```javascript
import { loop } from 'https://unpkg.com/@fivenorth/loop-sdk@0.17.0/dist';
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

## Read-only reconciliation

Use a separately issued read-only Loop API key without loading a signing key:

```ts
import { ReadOnlyLoopSDK } from '@fivenorth/loop-sdk/server';

const client = new ReadOnlyLoopSDK({
  apiKey: process.env.LOOP_READ_ONLY_API_KEY!,
  network: 'mainnet',
});
const balances = await client.getHolding();
const contracts = await client.getActiveContracts({
  interfaceId: '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding',
});
```

A read-only key can access only its wallet's holdings and active contracts. Keys
expire after 90 days and can be replaced or revoked independently of regular SDK
credentials. See the [read-only guide](docs/read-only.md) for setup and key management.

The client is also exported from `@fivenorth/loop-sdk`.

## Docs

- [Overview and supported contracts](https://docs.fivenorth.io/loop-sdk/overview/)
- [Usage guide](https://docs.fivenorth.io/loop-sdk/usage/): connecting, provider methods, submitting transactions
- [CIP-103 provider](https://docs.fivenorth.io/loop-sdk/cip103/)
- [Read-only reconciliation](docs/read-only.md): holdings and ACS without a signing key
- [Server API](https://docs.fivenorth.io/loop-sdk/server/): signing without a wallet popup
- [Custom contracts](https://docs.fivenorth.io/loop-sdk/custom-contracts/): getting your own DAR reviewed and deployed
- [API reference](https://docs.fivenorth.io/loop-sdk/api-reference/)
- [Live demo](https://docs.fivenorth.io/loop-sdk/demo/)
- [Changelog](CHANGELOG.md) and [security policy](SECURITY.md)

## License

Loop SDK is licensed under the [Apache License 2.0](LICENSE). The license is included in the npm package.

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

Visit http://localhost:3030/cip103 for the CIP-103 demo.
