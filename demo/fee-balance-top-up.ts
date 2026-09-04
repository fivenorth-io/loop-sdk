import { loop } from '../src/server/index';

const privateKey = process.env.PRIVATE_KEY || '';
const partyId = process.env.PARTY_ID || '';
const topUpAmountCC = process.env.TOP_UP_CC || '10';

if (!privateKey || !partyId) {
    throw new Error('PRIVATE_KEY and PARTY_ID are required');
}

loop.init({
    privateKey,
    partyId,
    network: 'local',
    walletUrl: process.env.WALLET_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:8080',
});

console.log('Authenticating server SDK party:', partyId);
await loop.authenticate();

const before = await loop.getFeeBalance();
console.log('Fee Balance before top-up:', JSON.stringify(before, null, 2));

console.log(`Topping up ${topUpAmountCC} CC of Fee Balance...`);
const topUpResult = await loop.topUpFeeBalance(topUpAmountCC);
console.log('Top-up result:', JSON.stringify(topUpResult, null, 2));

const after = await loop.getFeeBalance();
console.log('Fee Balance after top-up:', JSON.stringify(after, null, 2));
