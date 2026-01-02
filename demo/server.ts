/**
 * This file is used to show how to use the Loop SDK in a server side application
 * 
 * Where as the application have access to private key and can compose a singer
 */

import { loop } from '../src/server/index';

loop.init({
    privateKey: process.env.PRIVATE_KEY || '',
    partyId: process.env.PARTY_ID || '',
    network: 'devnet',
});

console.log("###########DEBUG########################");
console.log("public key:", loop.getSigner().getPublicKey());
console.log("party id:", loop.getSigner().getPartyId());

console.log("sign message as hex:", loop.getSigner().signMessageAsHex('Hello, world!'));
console.log("#########################################");


await loop.authenticate();
const provider = loop.getProvider();

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

    // Submit the transaction
    const result = await loop.executeTransaction(preparedPayload);
    console.log("Transfer Result", JSON.stringify(result, null, 2));
}