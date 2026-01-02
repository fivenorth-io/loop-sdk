# Server API

Beside enabling dapp to connect to a user's wallet and sign transaction inside browser, LoopSDK also enables a user extracts their private key to sign and submit DAML transaction programmatically.

## Install the SDK

Follow the same step in [Install SDK](https://docs.fivenorth.io/loop-sdk/usage/#install-the-sdk) to install the SDK.

Secondly, add [node-forge](https://www.npmjs.com/package/node-forge) to your project dependencies

Now, you're ready to use the LoopSDK to sign from server instead of from dapp browser.

If you just want a quick example, look over the file at [demo server signing](https://github.com/fivenorth-io/loop-sdk/blob/main/demo/test.html)

## 1. Initialize the SDK

Call `loop.init()` once when your application loads:

```javascript
import { loop } from '../src/server/index';

loop.init({
    privateKey: process.env.PRIVATE_KEY || '',
    partyId: process.env.PARTY_ID || '',
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

## 3. Submit DAML transaction

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

## 3. Using the Provider
