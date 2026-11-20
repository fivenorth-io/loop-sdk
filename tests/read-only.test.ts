import { afterEach, expect, test } from 'bun:test';
import { ReadOnlyLoopSDK } from '../src/read-only';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('reads holdings and filtered ACS with only a read-only key', async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
    calls.push(String(url));
    expect(options?.method).toBe('GET');
    expect(options?.headers).toEqual({ Authorization: 'Bearer loop_ro_test' });
    expect(options?.credentials).toBe('omit');
    expect(options?.redirect).toBe('error');
    return Response.json([{ amount: '12' }]);
  }) as typeof fetch;
  const client = new ReadOnlyLoopSDK({ apiKey: 'loop_ro_test', apiUrl: 'https://loop.test/' });
  expect(await client.getHolding()).toEqual([{ amount: '12' }]);
  await client.getActiveContracts({ interfaceId: '#token:Holding' });
  expect(calls).toEqual([
    'https://loop.test/api/v1/.connect/pair/account/holding',
    'https://loop.test/api/v1/.connect/pair/account/active-contracts?interfaceId=%23token%3AHolding',
  ]);
});

test('rejects missing filters and propagates revoked-key errors', async () => {
  expect(() => new ReadOnlyLoopSDK({ apiKey: 'ordinary-session-token' })).toThrow();
  const client = new ReadOnlyLoopSDK({ apiKey: 'loop_ro_revoked' });
  expect(() => client.getActiveContracts({})).toThrow('templateId or interfaceId is required');
  globalThis.fetch = (async () => new Response('', { status: 401 })) as typeof fetch;
  await expect(client.getHolding()).rejects.toThrow('Loop read failed (401)');
});
