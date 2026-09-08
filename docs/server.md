# Server API

Loop SDK also supports a server-side signing flow. Instead of asking the user to approve each action in the wallet UI, your backend signs and submits transactions directly using the user's private key.

Important: this flow requires access to the user's private key. Party ID + public key alone is not enough.

## Install the SDK

Follow the same step in [Install SDK](https://docs.fivenorth.io/loop-sdk/usage/#install-the-sdk) to install the SDK.

Secondly, add [node-forge](https://www.npmjs.com/package/node-forge) to your project dependencies.

Now, you're ready to use the Loop SDK to sign from your server instead of from a browser dApp.

If you just want a quick example:

- `demo/server.ts`: simple server flow with pending network fee fallback
- `demo/server-fee-balance.ts`: Fee Balance server flow
- `demo/fee-balance-top-up.ts`: standalone Fee Balance top-up helper demo

## 1. Initialize the SDK

Call `loop.init()` once when your application starts:

```javascript
import { loop } from '@fivenorth/loop-sdk/server';

loop.init({
    privateKey: process.env.PRIVATE_KEY,
    partyId: process.env.PARTY_ID,
    network: 'local',
});
```

### Parameters

| Field | Description |
|-------|-------------|
| `privateKey` | Private key in hex format (exported from Loop wallet UI) |
| `partyId` | Your party ID |
| `network` | `local`, `devnet`, or `mainnet` |

## 2. Authenticate yourself

Ideally do this once when your application boots. After init, authenticate with the Loop backend:

```javascript
await loop.authenticate()
```

Upon successful authentication, you will have two objects: `signer` and `provider`, accessible via `getSigner()` and `getProvider()`.

Most of the time you won't need them directly and can use the high-level `loop.executeTransaction()` flow instead.

---

## 3. Submit a DAML transaction (simple)

With the signer and provider ready, you can submit any DAML transaction:

```javascript
await loop.executeTransaction({
  commands: [
    {
      ExerciseCommand: {
        templateId: 'template',
        contractId: 'contractid',
        choice: 'choice',
        choiceArgument: {
          arg1: 'val1',
        },
      },
    },
  ],
  disclosedContracts: [],
});
```

And that's all

## 3.1 Handle Fee Balance

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

Top-ups are scoped to the authenticated party from `loop.init({ partyId, privateKey })`. They do not credit arbitrary accounts.

Keep a Fee Balance reserve before submitting transactions. If the balance is too low to pay for a top-up transaction, `topUpFeeBalance()` may fail and the account may require operator support.

Recommended flow:

- call `loop.prepareSubmission(...)` to prepare the transaction and inspect the expected Fee Balance cost before execution;
- call `loop.ensureFeeBalance({ requiredCC })` to check the current Fee Balance and top up if needed;
- still handle transaction failures from Canton as the final source of truth.

By default, `ensureFeeBalance(...)` keeps a `10 CC` reserve and tops up at least `25 CC` when the balance is too low. If the shortfall is larger, it tops up enough to cover `requiredCC + reserveCC`, plus the reserve as a cushion for the network fee for the top-up transaction. Override `reserveCC` or `topUpAmountCC` only if your integration needs different behavior.

The Server SDK `loop.estimateGas(...)` method is the pending network fee estimate path, not the Fee Balance estimate.

```javascript
import { loop, PaymentRequiredError } from '@fivenorth/loop-sdk/server';

const payload = {
  commands: [
    {
      ExerciseCommand: {
        templateId: 'template',
        contractId: 'contractid',
        choice: 'choice',
        choiceArgument: { arg1: 'val1' },
      },
    },
  ],
  disclosedContracts: [],
};

let preparedSubmission;

try {
  preparedSubmission = await loop.prepareSubmission(payload);
  if (!preparedSubmission.estimated_network_fee_amount) {
    throw new Error('Prepare did not return a Fee Balance estimate.');
  }

  const feeBalance = await loop.ensureFeeBalance({
    requiredCC: preparedSubmission.estimated_network_fee_amount,
  });

  if (feeBalance.topped_up) {
    preparedSubmission = await loop.prepareSubmission(payload);
  }
} catch (error) {
  if (!(error instanceof PaymentRequiredError) || error.trackingId || !error.requiredBalanceCC) {
    throw error;
  }

  await loop.ensureFeeBalance({
    requiredCC: error.requiredBalanceCC,
  });

  preparedSubmission = await loop.prepareSubmission(payload);
}

const signature = loop.getSigner().signTransactionHash(preparedSubmission.transaction_hash);
await loop.executeSubmission({
  command_id: preparedSubmission.command_id,
  transaction_data: preparedSubmission.transaction_data,
  signature,
});
```

### Pending Network Fees

Some integrations may use the pending network fee helpers:

- `checkDueGas()`
- `payGas(trackingId)`
- `PaymentRequiredError`

You should still handle `PaymentRequiredError` as a fallback. A `PaymentRequiredError` with a `trackingId` is a pending network fee and can be paid with `payGas(...)`. A `PaymentRequiredError` without a `trackingId` can be a Fee Balance failure; check `error.message` / `error.code`, top up Fee Balance if needed, then retry the original transaction.

```javascript
import { loop, PaymentRequiredError } from '@fivenorth/loop-sdk/server';

try {
  await loop.executeTransaction({
    commands: [
      {
        ExerciseCommand: {
          templateId: 'template',
          contractId: 'contractid',
          choice: 'choice',
          choiceArgument: { arg1: 'val1' },
        },
      },
    ],
    disclosedContracts: [],
  });
} catch (error) {
  if (error instanceof PaymentRequiredError) {
    if (!error.trackingId) {
      console.log('Transaction needs more Fee Balance:', error.message);
      await loop.topUpFeeBalance('25');
      return;
    }

    // Inspect the exact pending network fee before paying it
    const dueGas = await loop.checkDueGas(error.trackingId);
    console.log('Pending network fee:', dueGas.gas_amount, dueGas.tracking_id);

    // Pay the pending network fee explicitly
    await loop.payGas(error.trackingId!);
  } else {
    throw error;
  }
}
```

### Fee Balance Methods

These methods support the Fee Balance flow.

#### `loop.getFeeBalance()`

Returns the current Fee Balance for the authenticated party.

#### `loop.topUpFeeBalance(amountCC)`

Tops up the authenticated party's Fee Balance by preparing a CC payment, signing it with the server signer, and executing the top-up.

The response includes `amount_cc` for the CC-equivalent Fee Balance credited and `payment_amount_cc` for the CC paid after any Loop service charge.

#### `loop.ensureFeeBalance({ requiredCC, reserveCC?, topUpAmountCC? })`

Checks the authenticated party's Fee Balance and tops up only when the current balance is below `requiredCC + reserveCC`.

Defaults:

- `reserveCC`: `10`
- `topUpAmountCC`: minimum top-up amount, default `25`; larger shortfalls are topped up with an extra reserve cushion for the network fee for the top-up transaction

#### `loop.prepareSubmission(payload)`

Prepares a server-side transaction for signing. When Fee Balance is enabled, the response includes estimate fields such as `estimated_network_fee_amount` and `estimated_network_fee_asset`.

#### `loop.executeSubmission(payload)`

Executes a previously prepared and signed submission.

### Pending Network Fee Methods

These methods support the pending network fee flow.

#### `loop.estimateGas(payload)`

Returns the server-side network fee estimate before submission. For Server SDK Fee Balance handling, use `loop.prepareSubmission(...)`.

#### `loop.checkDueGas(trackingId?)`

Returns the current pending network fee for the authenticated party. When `trackingId` is provided, it targets that exact pending charge.

#### `loop.payGas(trackingId)`

Prepares the pending network fee transfer for the specified tracking ID, signs the returned transaction hash with the server signer, and executes the payment.

## 4. Using the Provider (advanced)

For more granular control over transaction submission, you can use the `provider` object directly. This allows you to integrate your own signing mechanism instead of the SDK signer.

The process involves two steps:

1.  `prepareSubmission`: This step sends the transaction payload to the server and returns a prepared payload with a transaction hash and Fee Balance estimate fields when available.
2.  `executeSubmission`: This step takes the prepared payload and a signature of the transaction hash and submits it to the ledger.

Here is an example of how to use the provider to submit a transaction:

```javascript
import { loop } from '@fivenorth/loop-sdk/server';

// Initialize and authenticate loop first
// ...

// Get provider and signer
const provider = loop.getProvider();
const signer = loop.getSigner();

// 1. Prepare the transaction
const preparedPayload = await provider.prepareSubmission({
  commands: [
    {
      ExerciseCommand: {
        templateId: 'template',
        contractId: 'contractid',
        choice: 'choice',
        choiceArgument: {
          arg1: 'val1',
        },
      },
    },
  ],
  disclosedContracts: [],
});

// 2. Sign the transaction hash from the prepared payload
// The transaction_hash is a base64 encoded string
const signedTransactionHash = signer.signTransactionHash(preparedPayload.transaction_hash);

// 3. Execute the transaction
const submissionResponse = await provider.executeSubmission({
    command_id: preparedPayload.command_id,
    transaction_data: preparedPayload.transaction_data,
    signature: signedTransactionHash,
    deduplication_period: { seconds: 60 },
});

console.log('Transaction submitted:', submissionResponse);
```

### Methods

#### `provider.prepareSubmission(payload: TransactionPayload)`

Prepares a transaction for submission.

-   `payload`: The DAML transaction payload.
-   Returns: A `Promise` that resolves to a `PreparedSubmissionResponse` object, which contains `transaction_hash`, `command_id`, `transaction_data`, and Fee Balance estimate fields such as `estimated_network_fee_amount` and `estimated_network_fee_asset`.

#### `provider.executeSubmission(payload: ExecuteSubmissionRequest)`

Submits the signed transaction to the ledger. If `deduplication_period` is omitted, the backend defaults to 1800 seconds.

Executes a prepared transaction.

-   `payload`: An object containing:
    -   `command_id`: The command ID from the prepared response.
    -   `transaction_data`: The transaction data from the prepared response.
    -   `signature`: The signature of the `transaction_hash`.
-   Returns: A `Promise` that resolves to the submission response.

---

## Examples

These are high-level examples to show what the SDK enables. The key point: you can execute any DAML transaction, not just transfers.

Common server-SDK flow for all examples:


1. `loop.init({ privateKey, partyId, ... })`
2. `await loop.authenticate()`
3. Build a DAML command payload
4. `await loop.executeTransaction(payload)` (prepare → sign → execute)

### Example 1: List pending transfers  

   Functions: `loop.getProvider()`, `provider.getActiveContracts()`  
   Use `getActiveContracts()` with the transfer instruction template or interface ID to list pending transfer contracts. This is a read call, no signing required.
   The template is `#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction`

### Example 2: Accept a pending transfer  

Functions: `loop.executeTransaction()`  
Build an `ExerciseCommand` that accepts the transfer instruction contract and submit it with `loop.executeTransaction()`.

The process of accepting a transfer instruction is:

- Get the choice context. Post to <registry-api>/registry/transfer-instruction/v1/<transfer-instruction-contract-id>/choice-contexts/(accept|reject)
- Build out the ExerciseCommand in below format

```
{
  "templateId": "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction",
  "contractId": "<transafer-factory>",
  "choice": "TransferInstruction_Accept",
  "choiceArgument": {
    "extraArgs": {
      "context": {
        "values": <these-are-return-from-the-choice-context-call>
      },
      "meta": {
        "values": {}
      }
    }
  }
}

```


If you can express it as a DAML transaction, you can submit it through the SDK.

---

## Security notes

- The server flow only works if you can access the user's private key. This is a custody decision.
- Rate limit: server-side signing requests are limited to **1 request per minute (1 RPM)**.
