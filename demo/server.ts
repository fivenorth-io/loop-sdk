/**
 * This file is used to show how to use the Loop SDK in a server side application
 * 
 * Where as the application have access to private key and can compose a singer DAML
 * transaction to be executed
 */

import { PaymentRequiredError, loop } from '../src/server/index';

loop.init({
    privateKey: process.env.PRIVATE_KEY || '',
    partyId: process.env.PARTY_ID || '',
    network: 'local',
    walletUrl: process.env.WALLET_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:8080',
});

console.log("###########DEBUG########################");
console.log("public key:", loop.getSigner().getPublicKey());
console.log("party id:", loop.getSigner().getPartyId());

console.log("sign message as hex:", loop.getSigner().signMessageAsHex('Hello, world!'));
console.log("#########################################");


await loop.authenticate();
const provider = loop.getProvider();

const dueGas = await loop.checkDueGas();
console.log("Current Due Gas", JSON.stringify(dueGas, null, 2));

if (dueGas.pending && dueGas.tracking_id) {
    console.log("Paying existing due gas:", dueGas.tracking_id);
    const payResult = await loop.payGas(dueGas.tracking_id);
    console.log("Pay Gas Result", JSON.stringify(payResult, null, 2));
}

// Now list holdings
//console.log('api key:', loop.getApiKey());
const holdings = await provider.getHolding();
console.log(holdings);


// example of list acs
const contracts = await provider.getActiveContracts({
    templateId: '#splice-amulet:Splice.Amulet:Amulet'
});
console.log(JSON.stringify(contracts, null, 2));


// Perform a transfer
if (process.env.TRANSFER_TO && process.env.TRANSFER_TO !== "") {
    console.log("Performing transfer to:", process.env.TRANSFER_TO);
    // Performa a transfer of 1 CC to the recipient
    const preparedPayload = await provider.transfer(
        process.env.TRANSFER_TO!,
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
    console.log(JSON.stringify(preparedPayload, null, 2));
    console.log("Estimated Gas", JSON.stringify(await loop.estimateGas(preparedPayload), null, 2));

    const runTransfer = async (label: string) => {
        console.log(`Submitting transfer (${label})`);
        const result = await loop.executeTransaction(preparedPayload);
        console.log("Transfer Result", JSON.stringify(result, null, 2));
        return result;
    };

    try {
        await runTransfer('default');
    } catch (error) {
        if (!(error instanceof PaymentRequiredError)) {
            throw error;
        }

        console.log("PaymentRequiredError", JSON.stringify({
            code: error.code,
            trackingId: error.trackingId,
            gasAmount: error.gasAmount,
            status: error.status,
            expiresAt: error.expiresAt,
        }, null, 2));

        const dueGas = await loop.checkDueGas(error.trackingId);
        console.log("Due Gas", JSON.stringify(dueGas, null, 2));

        if (!error.trackingId) {
            throw new Error('Missing trackingId on PaymentRequiredError');
        }

        const payResult = await loop.payGas(error.trackingId);
        console.log("Pay Gas Result", JSON.stringify(payResult, null, 2));

        await runTransfer('after-gas-payment');
    }
}
