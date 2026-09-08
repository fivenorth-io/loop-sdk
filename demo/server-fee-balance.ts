/**
 * Fee Balance server SDK demo.
 *
 * This uses the explicit Fee Balance flow:
 * prepareSubmission -> ensureFeeBalance -> sign -> executeSubmission
 */

import { PaymentRequiredError, loop } from '../src/server/index';

loop.init({
    privateKey: process.env.PRIVATE_KEY || '',
    partyId: process.env.PARTY_ID || '',
    network: 'local',
    walletUrl: process.env.WALLET_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:8080',
});

await loop.authenticate();
const provider = loop.getProvider();

if (!process.env.TRANSFER_TO) {
    throw new Error('TRANSFER_TO is required');
}

const buildTransferPayload = async () => provider.transfer(
    process.env.TRANSFER_TO!,
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

let transferPayload = await buildTransferPayload();
let preparedSubmission: Awaited<ReturnType<typeof loop.prepareSubmission>>;

try {
    preparedSubmission = await loop.prepareSubmission(transferPayload);
    console.log('Prepared submission:', JSON.stringify(preparedSubmission, null, 2));

    if (!preparedSubmission.estimated_network_fee_amount) {
        throw new Error('Prepare did not return a Fee Balance estimate.');
    }

    const feeBalance = await loop.ensureFeeBalance({
        requiredCC: preparedSubmission.estimated_network_fee_amount,
        reserveCC: process.env.FEE_BALANCE_RESERVE_CC,
        topUpAmountCC: process.env.TOP_UP_CC,
    });
    console.log('Fee Balance check:', JSON.stringify(feeBalance, null, 2));

    if (feeBalance.topped_up) {
        transferPayload = await buildTransferPayload();
        preparedSubmission = await loop.prepareSubmission(transferPayload);
        console.log('Prepared submission after top-up:', JSON.stringify(preparedSubmission, null, 2));
    }
} catch (error) {
    if (!(error instanceof PaymentRequiredError) || error.trackingId || !error.requiredBalanceCC) {
        throw error;
    }

    console.log('Prepare needs more Fee Balance:', error.message);
    console.log('Fee Balance check:', JSON.stringify(await loop.ensureFeeBalance({
        requiredCC: error.requiredBalanceCC,
        topUpAmountCC: process.env.TOP_UP_CC,
    }), null, 2));

    transferPayload = await buildTransferPayload();
    preparedSubmission = await loop.prepareSubmission(transferPayload);
    console.log('Prepared submission after top-up:', JSON.stringify(preparedSubmission, null, 2));
}

const signedTransactionHash = loop.getSigner().signTransactionHash(preparedSubmission.transaction_hash);
const result = await loop.executeSubmission({
    command_id: preparedSubmission.command_id,
    transaction_data: preparedSubmission.transaction_data,
    signature: signedTransactionHash,
});

console.log('Transfer result:', JSON.stringify(result, null, 2));
