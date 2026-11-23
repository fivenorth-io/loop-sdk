# Read-only API keys

Use `ReadOnlyLoopSDK` to read wallet balances and active contracts with a read-only
API key. No signing key, wallet popup, or `connect()` call is needed.

Available from SDK 0.17.0. Read-only keys must be enabled for the Loop environment
you use.

## Get a key

Sign into your wallet and use its authenticated API to manage your key:

| Action | Request |
| --- | --- |
| Create or replace a key | `POST /api/v1/profile/read-only-api-key` |
| Revoke a key | `DELETE /api/v1/profile/read-only-api-key` |

Use your wallet login access token for these requests. A regular SDK key or a
read-only key cannot create or revoke keys. Key management is currently available
through the API only.

Creating a key returns `api_key`, `party_id`, and `expires_at`. Save the key when
it is returned; you cannot retrieve it later. Keep it in your service's secret
configuration.

## Read balances and contracts

```ts
import { ReadOnlyLoopSDK } from '@fivenorth/loop-sdk/server';

const apiKey = process.env.LOOP_READ_ONLY_API_KEY;
if (!apiKey) throw new Error('LOOP_READ_ONLY_API_KEY is required');

const client = new ReadOnlyLoopSDK({
  apiKey,
  network: 'devnet', // or 'mainnet', 'testnet', 'local'
});

const balances = await client.getHolding();
const contracts = await client.getActiveContracts({
  interfaceId: '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding',
});
```

The client is also exported from `@fivenorth/loop-sdk`. You can supply `apiUrl`
to use a custom API address. Active-contract queries require a `templateId` or
`interfaceId`. See the [API reference](api-reference.md#readonlyloopsdk).

The key can read only its wallet's holdings and active contracts. It cannot sign
messages, submit transactions, or access another wallet.

## Replace or revoke a key

- Each user has one active read-only key, valid for 90 days.
- Replace it before the returned `expires_at` timestamp.
- A replacement immediately invalidates the old key. Update your service's secret
  and create a new client with the replacement.
- Revoke the key when access is no longer needed.
- These actions do not affect your regular SDK credentials.

The SDK does not renew keys automatically.

## Handle errors

Failed API requests throw `Error("Loop read failed (<status>)")`.

| Status | What to do |
| --- | --- |
| `401` | Check whether the key expired, was replaced, or was revoked. |
| `403` | Check that you are requesting an allowed read operation. |
| `429` | Slow down requests and retry later. |
| `5xx` | Retry later or contact support if the problem continues. |

Handle failures in your polling job. The client does not automatically retry or
set a request timeout. Space active-contract requests at least three seconds apart.

## Compare balances

Use the instrument admin and ID to identify a token; symbols alone may not be
unique. Keep locked and unlocked amounts separate. Separate requests may reflect
different points in time.

Before relying on results for reconciliation, verify the tokens you need and
compare with known holdings. For large wallets, confirm that the results include
all holdings; a successful response alone does not establish completeness.
