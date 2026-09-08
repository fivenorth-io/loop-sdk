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
import { loop } from 'https://unpkg.com/@fivenorth/loop-sdk@0.14.0/dist';
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
If you set `requestSigningMode` to `'popup'` (or `'tab'`), each signing/transaction request will also open the wallet dashboard. The SDK does not auto-close the popup/tab; wallet UI controls completion/close behavior.

### 3. Using the Provider

Once the connection is established, the `onAccept` callback will receive a `provider` object. This object provides methods to interact with the user's wallet and the DAML ledger.

The provider object has the `party_id` of the connected user.

#### Get Account

Retrieve the latest account status for the connected wallet:

```javascript
const account = await provider.getAccount();
console.log(account.has_preapproval);
console.log(account.utility_preapproval_admins);
console.log(account.has_merge_delegation);
console.log(account.usdc_bridge_access);
```

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

#### Estimate Network Fee

```javascript
const gasEstimate = await provider.estimateGas(damlCommand);
console.log(gasEstimate);
```

`provider.estimateGas(...)` is the existing browser / WalletConnect estimate helper. It keeps the existing method name, but returns the expected network fee before submission.

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
        deduplicationPeriod: { seconds: 60 }, // optional: override the default 30 minute dedup window
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
    deduplicationPeriod: { seconds: 60 },
});
```

In wait mode, the final result is returned as a single `onTransactionUpdate` payload (command/submission IDs plus update data or failure status).

Note: `submitAndWaitForTransaction` errors do not always mean the transaction failed. A 4xx error (e.g., 400) indicates a definite failure. A 5xx/timeout can mean the ledger is slow or backed up; the transaction may still be committed later, so clients should continue to listen for updates rather than assume failure.

Deduplication: by default the wallet execute path uses a 30 minute deduplication window. You can override it with `deduplicationPeriod` in submit options. For ambiguous outcomes (for example timeout, disconnect, or 5xx where the previous submission may already have reached Canton), retry with the same payload `commandId` within that window to avoid double execution.

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
    deduplicationPeriod: { seconds: 60 },    // optional: override the default 30 minute dedup window
  },
);
```

Notes:
- You must have spendable holdings for the specified instrument (admin + id). If left blank, the SDK defaults to the native token.
- The helper handles fetching holdings, building the transfer factory payload, and submitting via Wallet Connect.
- If the wallet popup/tab is closed before the request completes, the SDK rejects with `PopupClosedError`. If no response arrives and no closable window handle is available, the request still falls back to `requestTimeout`.

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

## Loop Server Signing API

Loop SDK also supports a server-side signing flow. Instead of a wallet popup, your backend signs and submits transactions directly using the user's private key.

### Installation

For server-side usage, you need to install the SDK and `node-forge`:

```bash
bun add @fivenorth/loop-sdk node-forge
# or
npm install @fivenorth/loop-sdk node-forge
```

**Note:** `node-forge` is a peer dependency and must be installed manually when using the server SDK. It's not required for browser usage.

### Usage

```javascript
import { loop } from '@fivenorth/loop-sdk/server';

// Initialize with private key
loop.init({
    privateKey: process.env.PRIVATE_KEY, // hex-encoded Ed25519 private key
    partyId: process.env.PARTY_ID,       // your party ID
    network: 'local',                    // or 'devnet', 'mainnet'
    walletUrl: process.env.WALLET_URL,   // optional
    apiUrl: process.env.API_URL,         // optional
});

// Authenticate to get API access
await loop.authenticate();

// Get the provider to interact with the ledger
const provider = loop.getProvider();

// List holdings
const holdings = await provider.getHolding();
console.log(holdings);

// Get active contracts
const contracts = await provider.getActiveContracts({
    templateId: '#splice-amulet:Splice.Amulet:Amulet'
});

// Transfer tokens
const preparedPayload = await provider.transfer(
    'recipient::partyId',
    1,
    {
        instrument_admin: '',
        instrument_id: 'Amulet',
    },
    {
        requestedAt: new Date(),
        executeBefore: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }
);

// Execute the transaction
const result = await loop.executeTransaction(preparedPayload);
console.log('Transfer result:', result);
```

### Handling Fee Balance in the server SDK

Loop supports two server SDK fee flows: Fee Balance, where users maintain a prepaid balance and Canton deducts transaction costs from that balance, and pending network fees, where a transaction can create a separate fee payment that must be paid before the next transaction.

Existing server SDK integrations can keep using `loop.executeTransaction(...)`. That helper still performs the simple one-call flow:

```text
prepare -> sign -> execute
```

Use the explicit Fee Balance flow when you want the SDK to check and top up the authenticated party's Fee Balance before execution:

```text
prepareSubmission -> ensureFeeBalance -> sign -> executeSubmission
```

`loop.prepareSubmission(...)` prepares the transaction and returns Fee Balance estimate fields in the same response. `loop.ensureFeeBalance(...)` checks the current Fee Balance and tops up only if needed.

Browser / WalletConnect dApps do not manage Fee Balance directly. Users maintain their Fee Balance in the Loop wallet, and the wallet handles Fee Balance prompts during browser signing/submission flows.

Top-ups are scoped to the authenticated party from `loop.init({ partyId, privateKey })`. They do not credit arbitrary accounts. Keep a Fee Balance reserve before submitting transactions. If the balance is too low to pay for a top-up transaction, `topUpFeeBalance()` may fail and the account may require operator support.

Recommended flow:

- call `loop.prepareSubmission(...)` to prepare the transaction and inspect the expected Fee Balance cost before execution
- call `loop.ensureFeeBalance({ requiredCC })` to check the current Fee Balance and top up if needed
- still handle transaction failures from Canton as the final source of truth

By default, `ensureFeeBalance(...)` keeps a `10 CC` reserve and tops up at least `25 CC` when the balance is too low. If the shortfall is larger, it tops up enough to cover `requiredCC + reserveCC`, plus the reserve as a cushion for the network fee for the top-up transaction. Override `reserveCC` or `topUpAmountCC` only if your integration needs different behavior.

```javascript
import { loop, PaymentRequiredError } from '@fivenorth/loop-sdk/server';

let preparedSubmission;

try {
    preparedSubmission = await loop.prepareSubmission(preparedPayload);
    if (!preparedSubmission.estimated_network_fee_amount) {
        throw new Error('Prepare did not return a Fee Balance estimate.');
    }

    const feeBalance = await loop.ensureFeeBalance({
        requiredCC: preparedSubmission.estimated_network_fee_amount,
    });

    if (feeBalance.topped_up) {
        preparedSubmission = await loop.prepareSubmission(preparedPayload);
    }
} catch (error) {
    if (!(error instanceof PaymentRequiredError) || error.trackingId || !error.requiredBalanceCC) {
        throw error;
    }

    await loop.ensureFeeBalance({
        requiredCC: error.requiredBalanceCC,
    });

    preparedSubmission = await loop.prepareSubmission(preparedPayload);
}

const signature = loop.getSigner().signTransactionHash(preparedSubmission.transaction_hash);
await loop.executeSubmission({
    command_id: preparedSubmission.command_id,
    transaction_data: preparedSubmission.transaction_data,
    signature,
});
```

You should still handle `PaymentRequiredError` as a fallback. A `PaymentRequiredError` with a `trackingId` is a pending network fee and can be paid with `payGas(...)`. A `PaymentRequiredError` without a `trackingId` can be a Fee Balance failure; check `error.message` / `error.code`, top up Fee Balance if needed, and retry the original transaction.

```javascript
import { loop, PaymentRequiredError } from '@fivenorth/loop-sdk/server';

try {
    await loop.executeTransaction(preparedPayload);
} catch (error) {
    if (error instanceof PaymentRequiredError) {
        if (!error.trackingId) {
            console.log('Transaction needs more Fee Balance:', error.message);
            await loop.topUpFeeBalance('25');
            return;
        }

        const dueGas = await loop.checkDueGas(error.trackingId);
        console.log('Pending network fee amount:', dueGas.gas_amount);

        await loop.payGas(error.trackingId);
    } else {
        throw error;
    }
}
```

Example ideas:
- List pending transfers
- Accept a pending transfer
- Automated transaction processing


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
