import { afterEach, expect, test } from 'bun:test';
import { Connection } from '../src/connection';
import { createLoopCip103Provider, type LoopCip103Bridge } from '../src/cip103/loop-adapter';
import type { Account } from '../src/types';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const request = { requestMethod: 'get' as const, resource: '/v2/state/ledger-end' };

test('ledger transport sends the session token and preserves raw arrays', async () => {
  globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
    expect(url).toBe('https://loop.test/api/v1/.connect/ledger-api');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ Authorization: 'Bearer session', 'Content-Type': 'application/json' });
    expect(JSON.parse(options?.body as string)).toEqual(request);
    expect(options?.redirect).toBe('error');
    return Response.json([{ contractEntry: {} }]);
  }) as typeof fetch;
  const connection = new Connection({ apiUrl: 'https://loop.test' });
  expect(await connection.ledgerApi('session', request)).toEqual([{ contractEntry: {} }]);
});

test('ledger transport preserves provider errors and handles network failures', async () => {
  const connection = new Connection({});
  globalThis.fetch = (async () => Response.json({ error: { code: 4100, message: 'Not authorized' } }, { status: 401 })) as typeof fetch;
  await expect(connection.ledgerApi('session', request)).rejects.toMatchObject({ code: 4100 });
  globalThis.fetch = (async () => { throw new Error('network'); }) as typeof fetch;
  await expect(connection.ledgerApi('session', request)).rejects.toMatchObject({ code: -32002 });
});

function fixture() {
  let account: Account | null = {
    party_id: 'alice::namespace', public_key: 'key', auth_token: 'private',
    cip103: { primary: true, partyId: 'alice::namespace', publicKey: 'key', hint: 'alice', namespace: 'namespace', status: 'allocated', networkId: 'canton:test', signingProviderId: 'loop' },
  };
  let changed = () => {};
  let calls = 0;
  let read = async () => ({ offset: 12 });
  const bridge: LoopCip103Bridge = {
    walletUrl: 'https://loop.test', restore: async () => {}, connect: async () => {}, disconnect: async () => {},
    account: async () => account,
    providerStatus: async () => ({ network_id: 'canton:test', signing_provider_id: 'loop', is_network_connected: true }),
    submitTransaction: async () => {}, signMessage: async () => {},
    onSessionChanged: listener => { changed = listener; },
    ledgerApi: async () => { calls++; return read(); },
  };
  return {
    provider: createLoopCip103Provider(bridge),
    clear: () => { account = null; changed(); },
    setRead: (callback: typeof read) => { read = callback; },
    calls: () => calls,
  };
}

test('provider rejects unauthenticated ledger reads before forwarding', async () => {
  const f = fixture();
  f.clear();
  await expect(f.provider.request({ method: 'ledgerApi', params: request })).rejects.toMatchObject({ code: 4100 });
  expect(f.calls()).toBe(0);
});

test('provider discards a ledger response when the session changes', async () => {
  const f = fixture();
  f.setRead(async () => { f.clear(); return { offset: 12 }; });
  await expect(f.provider.request({ method: 'ledgerApi', params: request })).rejects.toMatchObject({ code: 4100 });
});

test('provider validates requests and returns successful reads', async () => {
  const f = fixture();
  expect(await f.provider.request({ method: 'ledgerApi', params: request })).toEqual({ offset: 12 });
  await expect(f.provider.request({ method: 'ledgerApi', params: { requestMethod: 'GET', resource: '/v2/state/ledger-end' } })).rejects.toMatchObject({ code: -32602 });
  expect(f.calls()).toBe(1);
});
