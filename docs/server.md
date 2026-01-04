# Server API

Beside enabling dapp to connect to a user's wallet and sign transaction in browser, LoopSDK also enables a user extracts their private key to sign and submit DAML transaction programmatically.

## Install the SDK

Follow the same step in [Install SDK](https://docs.fivenorth.io/loop-sdk/usage/#install-the-sdk) to install the SDK.

Secondly, add [node-forge](https://www.npmjs.com/package/node-forge) to your project dependencies

Now, you're ready to use the LoopSDK to sign from server instead of from dapp browser.

If you just want a quick example, look over the file at [demo server signing](https://github.com/fivenorth-io/loop-sdk/blob/main/demo/test.html)

## 1. Initialize the SDK

Call `loop.init()` once when your application loads:

```javascript
import { loop } from '@fivenorth/loops-dk/server';

loop.init({
    privateKey: process.env.PRIVATE_KEY,
    partyId: process.env.PARTY_ID,
    network: 'local',
});
```

### Parameters

| Field | Description |
|-------|-------------|
| `privateKey` | Private key in hex format, extract from Loop wallet UI |
| `partyId` | your party id |
| `network` | `local`, `devnet`, or `mainnet` |

## 2. Authenticate yourself

Ideally do this once when your application boot and initialize the SDK. After init, you will authenticate yourself to the server.

```javascript
await loop.authenticate()
```

Upon authenticate succesfully you will now have 2 object `signer` and `provider` that you can get through `getSigner` and `getProvider`.

Majority of time you don't need to use these directly and can use the high level signing process of `loop` object instead.

---

## 3. Submit DAML transaction (simple)

With the signer and provider ready after authenticate, you can submit any DAML transaction

```javascript
await loop.executeTransaction({
"commands": [
    {
      "ExerciseCommand": {
        "templateId": "template",
        "contractId": "contractid",
        "choice": "choice",
        "choiceArgument": {
            "arg1": "val1",
        }
      }
    }
  ],
  "disclosedContracts": []
})
```

And that's all

## 4. Using the Provider

For more granular control over transaction submission, you can use the `provider` object directly. This gives you more control over the signing process. For example, you can use your own signing mechanism instead of the one provided by the SDK.

The process involves two steps:

1.  `prepareSubmission`: This step sends the transaction payload to the server and returns a prepared payload which includes a transaction hash.
2.  `executeSubmission`: This step takes the prepared payload and a signature of the transaction hash and submits it to the ledger.

Here is an example of how to use the provider to submit a transaction:

```javascript
import { loop } from '../src/server/index';

// Initialize and authenticate loop first
// ...

// Get provider and signer
const provider = loop.getProvider();
const signer = loop.getSigner();

// 1. Prepare the transaction
const preparedPayload = await provider.prepareSubmission({
    "commands": [
        {
          "ExerciseCommand": {
            "templateId": "template",
            "contractId": "contractid",
            "choice": "choice",
            "choiceArgument": {
                "arg1": "val1",
            }
          }
        }
      ],
      "disclosedContracts": []
});

// 2. Sign the transaction hash from the prepared payload
// The transaction_hash is a base64 encoded string
const signedTransactionHash = signer.signTransactionHash(preparedPayload.transaction_hash);

// 3. Execute the transaction
const submissionResponse = await provider.executeSubmission({
    command_id: preparedPayload.command_id,
    transaction_data: preparedPayload.transaction_data,
    signature: signedTransactionHash,
});

console.log('Transaction submitted:', submissionResponse);
```

### Methods

#### `provider.prepareSubmission(payload: TransactionPayload)`

Prepares a transaction for submission.

-   `payload`: The DAML transaction payload.
-   Returns: A `Promise` that resolves to a `PreparedSubmissionResponse` object, which contains `transaction_hash`, `command_id`, and `transaction_data`.

#### `provider.executeSubmission(payload: ExecuteSubmissionRequest)`

Executes a prepared transaction.

-   `payload`: An object containing:
    -   `command_id`: The command ID from the prepared response.
    -   `transaction_data`: The transaction data from the prepared response.
    -   `signature`: The signature of the `transaction_hash`.
-   Returns: A `Promise` that resolves to the submission response.

