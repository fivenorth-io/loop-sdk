# Usage Guide

## Install the SDK

Using Bun:

```bash
bun add @fivenorth/loop-sdk
```

Or via CDN (no build process required):

```javascript
import { loop } from "https://unpkg.com/@fivenorth/loop-sdk@0.3.0/dist";
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
    options: {
        openMode: 'popup', // or 'tab'
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

### Options

| Field | Description |
|-------|-------------|
| `openMode` | `'popup'` (default) or `'tab'` |
| `redirectUrl` | Optional URL your user will return to after connecting |

---

## 2. Connect to the Wallet

To start the connection:

```javascript
loop.connect();
```

`redirectUrl` and `openMode` are read from the `options` in `init()`.

This opens a QR modal for the user to scan with their Loop wallet.

---

## 3. Using the Provider

When the user accepts, the `provider` object gives you access to wallet data and ledger operations.

The provider object includes:

- `party_id`
- `public_key`
- `email` 

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
    const result = await provider.submitTransaction(damlCommand);
    console.log('Transaction successful:', result);
} catch (error) {
    console.error('Transaction failed:', error);
}
```

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
  '5', // amount as string or number
  {
    // Optional overrides. Defaults to Amulet/DSO if omitted.
    instrument_admin: 'issuer::fingerprint', // optional
    instrument_id: 'LOOP',                   // optional
    requestedAt: new Date().toISOString(),   // optional
    executeBefore: new Date(Date.now() + 24*60*60*1000).toISOString(), // optional
  },
);
```

Notes:
- You must have spendable holdings for the specified instrument (admin + id). If left blank, the SDK defaults to the native token.
- The helper handles: fetching holdings, building the transfer factory payload, and submitting via Wallet Connect.

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
