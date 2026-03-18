# Usage Guide

Looking for server-side signing (no wallet popup)? See `docs/server.md`.

## Install the SDK

Using Bun:

```bash
bun add @fivenorth/loop-sdk
```

Or via CDN (no build process required):

```javascript
import { loop } from "https://unpkg.com/@fivenorth/loop-sdk@0.8.0/dist";
```

Then import into your dApp:

```javascript
import { loop } from '@fivenorth/loop-sdk';
```

---

## 1. Initialize the SDK

Call `loop.init()` once when your application loads:

```javascript
loop.init({
    appName: 'My Awesome dApp',
    network: 'local', // or 'devnet', 'mainnet'
    onTransactionUpdate: (payload) => {
        console.log('Transaction update:', payload);
    },
    options: {
        openMode: 'popup', // or 'tab'
        requestSigningMode: 'popup', // 'popup' (default) | 'tab'
        redirectUrl: 'https://mydapp.com/after-connect', // optional
    },
    onAccept: (provider) => {
        console.log('Connected!', provider);
    },
    onReject: () => {
        console.log('Connection rejected by user.');
    },
});
```

### Parameters

| Field | Description |
|-------|-------------|
| `appName` | Name shown to the user in Loop wallet |
| `network` | `local`, `devnet`, or `mainnet` |
| `onAccept(provider)` | Called when the user approves connection |
| `onReject()` | Called when the user rejects connection |
| `onTransactionUpdate(payload)` | Called when a transaction update is finalized (includes `update_id` and optional `update_data`) |

### Options

| Field | Description |
|-------|-------------|
| `openMode` | `'popup'` (default) or `'tab'` |
| `requestSigningMode` | Controls how signing/transaction requests open the wallet UI: `'popup'` (default) or `'tab'` |
| `redirectUrl` | Optional URL your user will return to after connecting |

---

## 2. Connect to the Wallet

To start the connection:

```javascript
loop.connect();
```

`redirectUrl` and `openMode` are read from the `options` in `init()`.

This opens a QR modal for the user to scan with their Loop wallet.

If you set `requestSigningMode` to `'popup'` (or `'tab'`), the SDK will also open the wallet dashboard for signing/transaction requests. The SDK does not auto-close the popup/tab; wallet UI controls completion/close behavior.

Usually you will want to run this when user initiate some action and they had not login to wallet yet. To automatically connect on pageload, follow the next section.

### Auto reconnect on page reload

A common pattern is if user already connect, approved the connection, and have a valid session, then they close the browser or the tab, later on when user resume to the app, we want to automatically connect them on page load. If user has not connect wallet, or has not approved the connection previously, we do not want to show them the QR code onboarding screen because this flow automatically on page reload and will disrupted user experience. To achive that, simply run this code


```
await loop.autoConnect()
```

---

## 3. Using the Provider

When the user accepts, the `provider` object gives you access to wallet data and ledger operations.

The provider object includes:

- `party_id`
- `public_key`
- `email` 

---

### Get Account

Retrieve extra information about the account connected to the provider

```javascript
const account = await provider.getAccount();
console.log(account);
```

---

### Get Holdings

```javascript
const holdings = await provider.getHolding();
console.log(holdings);
```

---

### Get Active Contracts

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

---

### Estimate Network Gas

Browser / WalletConnect dApps should use `provider.estimateGas(...)`. If you are using the Server SDK instead, use `loop.estimateGas(...)` in `docs/server.md`.

```javascript
const gasEstimate = await provider.estimateGas(damlCommand);
console.log(gasEstimate);
```

Use this before submission if you want to inspect the expected network gas first.

---

### Submit a Transaction

```javascript
const damlCommand = {
    commands: [{
        ExerciseCommand: {
            templateId: "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory",
            contractId: 'your-contract-id', 
            choice: 'TransferFactory_Transfer',
            choiceArgument: {
                // ... your arguments
            }
        }
    }],
};

try {
    const result = await provider.submitTransaction(damlCommand, {
        // Optional: show a custom message in the wallet prompt
        message: 'Transfer 10 CC to RetailStore',
        estimateTraffic: true, // optional: return estimated traffic in submission response
        deduplicationPeriod: { seconds: 60 }, // optional: override the default 30 minute dedup window
    });
    console.log('Transaction successful:', result);
} catch (error) {
    console.error('Transaction failed:', error);
}
```

Transaction responses include `command_id` and `submission_id`. When the transaction is completed on-ledger, `update_id` arrives and `onTransactionUpdate` fires with `update_id` and `update_data` (ledger transaction tree).

By default, submit flows use a 30 minute deduplication window. For ambiguous outcomes, keep the same `commandId` on the payload and optionally set `deduplicationPeriod` to match your retry horizon so retries stay idempotent.

---

### Sign a Message

```javascript
const message = 'Hello, Loop!';
try {
    const signature = await provider.signMessage(message);
    console.log('Signature:', signature);
} catch (error) {
    console.error('Signing failed:', error);
}
```

---

### Transfer (built-in helper)

```javascript
// Fast path: uses your wallet connection to build and run a transfer
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
    deduplicationPeriod: { seconds: 60 },   // optional: override the default 30 minute dedup window
    requestedAt: new Date().toISOString(),   // optional
    executeBefore: new Date(Date.now() + 24*60*60*1000).toISOString(), // optional
    requestTimeout: 5 * 60 * 1000,           // optional (ms), defaults to 5 minutes
    estimateTraffic: true,                   // optional: return estimated traffic in submission response
  },
);
```

Notes:
- You must have spendable holdings for the specified instrument (admin + id). If left blank, the SDK defaults to the native token.
- The helper handles: fetching holdings, building the transfer factory payload, and submitting via Wallet Connect.

---

### USDC withdraw helper

```javascript
await loop.wallet.extension.usdcBridge.withdrawalUSDCxToEthereum(
  '0xYourEthAddress',
  '10.5',
  {
    reference: 'optional memo',
    message: 'Withdraw 10.5 USDCx to 0xabc', // optional custom prompt text
    requestTimeout: 5 * 60 * 1000,
  },
);
```

Notes:
- Uses the connect-based withdraw endpoint to prepare the transaction and sends it over Wallet Connect.
- The helper auto-reconnects the websocket if it was closed before sending the request.

---

## How the Loop Connect Flow Works

This section explains the code path from your dApp to the Loop wallet and back.

### 1. Your dApp initializes the SDK

You call `loop.init()` once your app loads:

```javascript
loop.init({
    appName: 'My Test dApp',
    network: 'devnet',
    options: {
        openMode: 'popup',
        redirectUrl: 'https://mydapp.com/connected',
    },
    walletUrl,
    apiUrl,
    onAccept: (provider) => setProvider(provider),
    onReject: () => console.log('User rejected connection'),
});
```

This step only configures the SDK.
**No connection is made yet.**

---

### 2. User clicks "Connect" in your dApp

```javascript
loop.connect();
```

When called, the SDK:

1. Checks localStorage to see if there is a previous session.
2. If not, it asks the Loop backend for a **connect ticket**.
3. Builds the wallet URL:
    `/.connect/?ticketId=xxxx`
4. Opens the connection flow (QR, popup, or new tab).
5. Opens a WebSocket to wait for approve/reject.

If a valid session is already cached, the SDK may skip the QR step and reconnect automatically.

---

### 3. User approves in the Loop wallet

When the user approves:

1. The wallet updates the backend with "approved".
2. The backend sends a `handshake_accept` message over WebSocket.
3. The SDK creates a `Provider` object containing:

- `party_id`
- `public_key`
- `email`
- `authToken`

4. SDK calls your `onAccept(provider)` callback.

At this point, **your dApp is connected**.

---

### 4. Your dApp uses the Provider

After you store the provider in your component/state, you can call:

```javascript
provider.getHolding();
provider.getActiveContracts({ templateId });
provider.submitTransaction(damlCommand);
provider.signMessage("Hello");
```

This is the same flow used in the CodePen demo.
You initialize once, connect on the button click, then use the provider to interact with the wallet and ledger.

---

## FAQ

### Why is my workflowId missing from transaction updates?

The Loop SDK uses **Interactive Submission** (prepare -> sign -> execute) so external users can safely sign transactions in the wallet.

In Canton, **workflowId is not supported for Interactive Submission.** It is only available in direct command submission (submit / submit-and-wait), where workflows may span multiple commands. Interactive Submission explicitly supports only a single command, so the ledger does not persist or return workflowId for these transactions.

As a result, `update_data.workflowId` (and Lighthouse) may show it as empty even if you provided one.

What to do instead
- Use `commandId` / `submissionId` for correlation. Keep track of your workflow identifiers on your side and map them to command or submission IDs.
