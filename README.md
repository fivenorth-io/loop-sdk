# Loop SDK

Loop SDK allows dApps connect to a [Loop](https://cantonloop.com) account. The Loop wallet can be on mobile or on a desktop browser. All the interaction will happen inside the dApp. For signing, user will be prompted to sign either on their Loop wallet on mobile devices or on browser.

## Limitation

Currently, we only support DAML transaction from the Splice build-in DAR files and Utility app DAR files.

There is no plan to upload and support third party DAR at this moment

## Quick overview

For a quick overview of how the code look like, you can take a look at this pen https://codepen.io/kureikain/pen/KwVGgLX.

## Usage guide

To use the Loop SDK, you first need to install it from NPM:

```bash
bun add @fivenorth/loop-sdk
```

Then you can import it in your dApp:

```javascript
import { loop } from '@fivenorth/loop-sdk';
```

Note that, If you don't want to implement a build process, you can include the file directly with `unpkg` such as 

```javascript
import { loop } from 'https://unpkg.com/@fivenorth/loop-sdk@0.8.0/dist';
```

An example of how we use it in that manner is on our [loopsdk demo](https://codepen.io/kureikain/pen/KwVGgLX)

### 1. Initialize the SDK

Before you can connect, you need to initialize the SDK. This is typically done once when your application loads.

```javascript
loop.init({
    appName: 'My Awesome dApp',
    network: 'local', // or 'devnet', 'mainnet'
    onTransactionUpdate: (payload) => {
        console.log('Transaction update:', payload);
    },
    options: {
        openMode: 'popup', // 'popup' (default) or 'tab'
        requestSigningMode: 'popup', // 'popup' (default) or 'tab'
        redirectUrl: 'https://myapp.com/after-connect', // optional redirect after approval
    },
    onAccept: (provider) => {
        console.log('Connected!', provider);
        // You can now use the provider to interact with the wallet
    },
    onReject: () => {
        console.log('Connection rejected by user.');
    },
});
```

The `init` method takes a configuration object with the following properties:
- `appName`: The name of your application, which will be displayed to the user in the Loop wallet.
- `network`: The network to connect to. Can be `local`, `devnet`, or `mainnet`.
- `onTransactionUpdate`: Called when a transaction update is finalized (includes `update_id` and optional `update_data`).
- `options`: Optional object containing:
  - `openMode`: Controls how Loop opens: `'popup'` (default) or `'tab'`.
  - `requestSigningMode`: Controls how signing/transaction requests open the wallet UI after you're connected: `'popup'` (default) or `'tab'`.
  - `redirectUrl`: Optional redirect URL the wallet will navigate back to after successful approval. If omitted, user stays on Loop dashboard.
- `onAccept`: A callback function that is called when the user accepts the connection. It receives a `provider` object.
- `onReject`: A callback function that is called when the user rejects the connection.

### 2. Connect to the wallet

To initiate the connection, call `loop.connect()`:

```javascript
loop.connect();
```

This will open a modal with a QR code for the user to scan with their Loop wallet.
If you set `requestSigningMode` to `'popup'` (or `'tab'`), each signing/transaction request will also open the wallet dashboard and auto-close the popup once the wallet responds.

### 3. Using the Provider

Once the connection is established, the `onAccept` callback will receive a `provider` object. This object provides methods to interact with the user's wallet and the DAML ledger.

The provider object has the `party_id` of the connected user.

#### Get Holdings

To get the user's token holdings:

```javascript
const holdings = await provider.getHolding();
console.log(holdings);
```

Each holding includes its `instrument_id` (with `admin` and `id` fields), which you can use when building transfers for CC, CIP-56 tokens, LOOP, or any custom instrument.

#### Get Active Contracts

You can query for active contracts by `templateId` or `interfaceId`.

By Template ID:
```javascript
const contracts = await provider.getActiveContracts({ 
    templateId: '#splice-amulet:Splice.Amulet:Amulet' 
});
console.log(contracts);
```

By Interface ID:
```javascript
const contracts = await provider.getActiveContracts({ 
    interfaceId: '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding' 
});
console.log(contracts);
```

#### Submit a Transaction

To submit a DAML transaction, you need to construct a command object and pass it to `submitTransaction`:

```javascript
const damlCommand = {
    commands: [{
        ExerciseCommand: {
            templateId: "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory",
            contractId: 'your-contract-id', // The contract ID to exercise the choice on
            choice: 'TransferFactory_Transfer',
            choiceArgument: {
                // ... your choice arguments
            }
        }
    }],
    // ... other command properties
};

try {
    const result = await provider.submitTransaction(damlCommand, {
        // Optional: show a custom message in the wallet prompt
        message: 'Transfer 10 CC to RetailStore',
        estimateTraffic: true, // optional: return estimated traffic in submission response
    });
    console.log('Transaction successful:', result);
} catch (error) {
    console.error('Transaction failed:', error);
}
```

`onTransactionUpdate` fires once per transaction with a single payload that includes `command_id` and `submission_id`. On success it also includes `update_id` and `update_data` (ledger transaction tree); on failure it includes `status: "failed"` and `error.error_message`.

`submitTransaction` is the default async path. It returns the submission result first (including `command_id` and `submission_id`), then the ledger update arrives later via `onTransactionUpdate` with `update_id` and `update_data`.

To wait for the transaction result directly (opt-in), use:

```javascript
await provider.submitAndWaitForTransaction(damlCommand, {
    message: 'Transfer 10 CC to RetailStore',
});
```

In wait mode, the final result is returned as a single `onTransactionUpdate` payload (command/submission IDs plus update data or failure status).

Note: `submitAndWaitForTransaction` errors do not always mean the transaction failed. A 4xx error (e.g., 400) indicates a definite failure. A 5xx/timeout can mean the ledger is slow or backed up; the transaction may still be committed later, so clients should continue to listen for updates rather than assume failure.

Deduplication: both async execute and execute-and-wait use a 1 hour deduplication window. If you retry within that window, resubmit the same `command_id` and `submission_id` so the request is idempotent.

#### Sign a Message

You can request the user to sign an arbitrary message:

```javascript
const message = 'Hello, Loop!';
try {
    const signature = await provider.signMessage(message);
    console.log('Signature:', signature);
} catch (error) {
    console.error('Signing failed:', error);
}
```

#### Transfer (built-in helper)

```javascript
await loop.wallet.transfer(
  'receiver::fingerprint',
  '5', 
  {
    instrument_admin: 'issuer::fingerprint', // optional: DSO (default)
    instrument_id: 'Amulet',                 // optional: Amulet (default)
  },
  {
    message: 'Send 5 CC to Alice', // optional: show a custom message in the wallet prompt
    memo: 'optional memo for the transfer',   // optional: stored as transfer metadata
    executionMode: 'wait',                   // optional: 'async' (default) or 'wait'
    requestedAt: new Date().toISOString(),   // optional
    executeBefore: new Date(Date.now() + 24*60*60*1000).toISOString(), // optional
    requestTimeout: 5 * 60 * 1000,           // optional (ms), defaults to 5 minutes
    estimateTraffic: true,                   // optional: return estimated traffic in submission response
  },
);
```

Notes:
- You must have spendable holdings for the specified instrument (admin + id). If left blank, the SDK defaults to the native token.
- The helper handles fetching holdings, building the transfer factory payload, and submitting via Wallet Connect.

Common instrument overrides (pass into the `instrument` argument above):

- Canton Coin (CC): `{ instrument_admin: 'cc-issuer::fingerprint', instrument_id: 'CC' }`
- CIP-56: `{ instrument_admin: 'cip56-issuer::fingerprint', instrument_id: 'CIP-56' }`

Swap in the admin/id for the specific instrument you hold in the Loop wallet.

#### USDC withdraw helper

```javascript
await loop.wallet.extension.usdcBridge.withdrawalUSDCxToEthereum(
  '0xYourEthAddress',
  '10.5', // amount in USDCx
  {
    reference: 'optional memo',
    message: 'Withdraw 10.5 USDCx to 0xabc', // optional custom prompt text
    requestTimeout: 5 * 60 * 1000, // optional override (ms)
  },
);
```

Notes:
- Uses the connect-based withdraw endpoint to prepare the transaction and sends it over Wallet Connect.
- The helper auto-reconnects the websocket if it was closed before sending the request.

# API

Coming soon

# Development Guide

This section is only if you want to actively develop the SDK itself. To use the SDK, follow the `#Usage Guide` section

To install dependencies:

```bash
bun install
```

To run the dev server, that is also auto re-compile the sdk:

```bash
bun start
```

Upon doing so you can visit http://localhost:3030/ to see the local demo app, serve in `demo/test.html` and SDK is auto compile so you can actively working and trying out the SDK.

# Publish the package to NPM


```
bun run build
bun publish
```
