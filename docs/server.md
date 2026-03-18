# Server API

Loop SDK also supports a server-side signing flow. Instead of asking the user to approve each action in the wallet UI, your backend signs and submits transactions directly using the user's private key.

Important: this flow requires access to the user's private key. Party ID + public key alone is not enough.

## Install the SDK

Follow the same step in [Install SDK](https://docs.fivenorth.io/loop-sdk/usage/#install-the-sdk) to install the SDK.

Secondly, add [node-forge](https://www.npmjs.com/package/node-forge) to your project dependencies.

Now, you're ready to use the Loop SDK to sign from your server instead of from a browser dApp.

If you just want a quick example, look at `demo/server.ts`.

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

## 3.1 Handle pending network gas

Server SDK transactions now use an after-execution network gas model:

- your main transaction executes first
- pending network gas is recorded after execution
- the next server-SDK transaction may return `402 Payment Required` until that network gas is paid

Best practice:

- Server SDK integrations should use `loop.estimateGas(...)` before submission if they want to inspect the expected network gas first. Browser / WalletConnect dApps should use `provider.estimateGas(...)` in `docs/usage.md`.
- call `checkDueGas()` before submitting a transaction, and if gas is due, call `payGas(...)` first

That avoids both surprise gas amounts and hitting `PaymentRequiredError` during normal transaction submission.

```javascript
const gasEstimate = await loop.estimateGas({
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

console.log('Estimated network gas:', gasEstimate.estimated_gas_amount);
```

```javascript
const dueGas = await loop.checkDueGas();

if (dueGas.pending && dueGas.tracking_id) {
  await loop.payGas(dueGas.tracking_id);
}

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
```

You should still handle `PaymentRequiredError` as a fallback, for example if another transaction creates pending network gas between your pre-check and submission:

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
    // Inspect the exact pending network gas before paying it
    const dueGas = await loop.checkDueGas(error.trackingId);
    console.log('Pending network gas:', dueGas.gas_amount, dueGas.tracking_id);

    // Pay the pending network gas explicitly
    await loop.payGas(error.trackingId!);
  } else {
    throw error;
  }
}
```

### Network Gas Methods

#### `loop.estimateGas(payload)`

Returns the estimated network gas for a transaction before submission without requiring you to clear existing pending gas first.

#### `loop.checkDueGas(trackingId?)`

Returns the current pending network gas for the authenticated party. When `trackingId` is provided, it targets that exact pending charge.

#### `loop.payGas(trackingId)`

Prepares the pending network gas transfer for the specified tracking ID, signs the returned transaction hash with the server signer, and executes the payment.

## 4. Using the Provider (advanced)

For more granular control over transaction submission, you can use the `provider` object directly. This allows you to integrate your own signing mechanism instead of the SDK signer.

The process involves two steps:

1.  `prepareSubmission`: This step sends the transaction payload to the server and returns a prepared payload which includes a transaction hash.
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
-   Returns: A `Promise` that resolves to a `PreparedSubmissionResponse` object, which contains `transaction_hash`, `command_id`, and `transaction_data`.

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
