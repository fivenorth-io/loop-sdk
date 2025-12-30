/**
 * This file is used to show how to use the Loop SDK in a server side application
 * 
 * Where as the application have access to private key and can compose a singer
 */

import { getSigner, loop } from '../src/server/index';

const signer = getSigner(process.env.PRIVATE_KEY || '', process.env.PARTY_ID || '');

console.log("###########DEBUG########################");
console.log("public key:", signer.getPublicKey());
console.log("party id:", signer.getPartyId());

console.log("sign message as hex:", signer.signMessageAsHex('Hello, world!'));
console.log("#########################################");

loop.init({
    signer: signer,
    network: 'local',
});

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
    console.log("dauhu", JSON.stringify(result, null, 2));
}