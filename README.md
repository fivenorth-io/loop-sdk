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
import { loop } from 'https://unpkg.com/@fivenorth/loop-sdk@0.1.1/dist';
```

An example of how we use it in that manner is on our [loopsdk demo](https://codepen.io/kureikain/pen/KwVGgLX)

### 1. Initialize the SDK

Before you can connect, you need to initialize the SDK. This is typically done once when your application loads.

```javascript
loop.init({
    appName: 'My Awesome dApp',
    network: 'local', // or 'devnet', 'mainnet'
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
- `onAccept`: A callback function that is called when the user accepts the connection. It receives a `provider` object.
- `onReject`: A callback function that is called when the user rejects the connection.

### 2. Connect to the wallet

To initiate the connection, call `loop.connect()`:

```javascript
loop.connect();
```

This will open a modal with a QR code for the user to scan with their Loop wallet.

### 3. Using the Provider

Once the connection is established, the `onAccept` callback will receive a `provider` object. This object provides methods to interact with the user's wallet and the DAML ledger.

The provider object has the `party_id` of the connected user.

#### Get Holdings

To get the user's token holdings:

```javascript
const holdings = await provider.getHolding();
console.log(holdings);
```

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
    const result = await provider.submitTransaction(damlCommand);
    console.log('Transaction successful:', result);
} catch (error) {
    console.error('Transaction failed:', error);
}
```

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

# API



# Development Guide

This section is only if you want to actively develop the SDK itself. To use the SDK, follow the `#Usage Guide` section

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

# Publish the package to NPM


```
bun run build
bun publish
```