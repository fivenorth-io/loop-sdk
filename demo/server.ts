/**
 * This uses the simple server flow:
 * executeTransaction(...) = prepare -> sign -> execute
 *
 * In the pending network fee flow, a transaction may return PaymentRequiredError
 * with a trackingId. Pay that pending network fee with checkDueGas/payGas.
 */

import { PaymentRequiredError, loop } from '../src/server/index';

loop.init({
    privateKey: process.env.PRIVATE_KEY || '',
    partyId: process.env.PARTY_ID || '',
    network: 'local',
    walletUrl: process.env.WALLET_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:8080',
});

console.log('Public key:', loop.getSigner().getPublicKey());
console.log('Party ID:', loop.getSigner().getPartyId());
console.log('Signed message:', loop.getSigner().signMessageAsHex('Hello, world!'));

await loop.authenticate();
const provider = loop.getProvider();

const dueGas = await loop.checkDueGas();
console.log('Current pending network fee:', JSON.stringify(dueGas, null, 2));

if (dueGas.pending && dueGas.tracking_id) {
    console.log('Paying existing pending network fee:', dueGas.tracking_id);
    const payResult = await loop.payGas(dueGas.tracking_id);
    console.log('Pending network fee payment result:', JSON.stringify(payResult, null, 2));
}

const holdings = await provider.getHolding();
console.log('Holdings:', JSON.stringify(holdings, null, 2));

const contracts = await provider.getActiveContracts({
    templateId: '#splice-amulet:Splice.Amulet:Amulet',
});
console.log('Amulet contracts:', JSON.stringify(contracts, null, 2));

if (process.env.TRANSFER_TO) {
    console.log('Performing transfer to:', process.env.TRANSFER_TO);
    const transferPayload = await provider.transfer(
        process.env.TRANSFER_TO,
        1,
        {
            instrument_admin: '',
            instrument_id: 'Amulet',
        },
        {
            requestedAt: new Date(),
            executeBefore: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
    );

    try {
        const result = await loop.executeTransaction(transferPayload);
        console.log('Transfer result:', JSON.stringify(result, null, 2));
    } catch (error) {
        if (!(error instanceof PaymentRequiredError) || !error.trackingId) {
            throw error;
        }

        console.log('PaymentRequiredError:', JSON.stringify({
            code: error.code,
            message: error.message,
            trackingId: error.trackingId,
            gasAmount: error.gasAmount,
            status: error.status,
            expiresAt: error.expiresAt,
        }, null, 2));

        const pendingFee = await loop.checkDueGas(error.trackingId);
        console.log('Pending network fee:', JSON.stringify(pendingFee, null, 2));

        const payResult = await loop.payGas(error.trackingId);
        console.log('Pending network fee payment result:', JSON.stringify(payResult, null, 2));
    }
}
