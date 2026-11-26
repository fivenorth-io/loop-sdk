import { afterEach, expect, test } from 'bun:test';
import { Connection } from '../src/connection';
import { SessionInfo } from '../src/session';
import type { DeduplicationPeriodInput } from '../src/types';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const sent: Record<string, unknown>[] = [];

async function executeBody(deduplicationPeriod?: unknown) {
  globalThis.fetch = (async (_url: string | URL | Request, options?: RequestInit) => {
    sent.push(JSON.parse(String(options?.body)));
    return Response.json({ submission_id: 'submission-1' });
  }) as typeof fetch;
  const connection = new Connection({ network: 'local', apiUrl: 'https://loop.test' });
  const session = new SessionInfo({ ticketId: 'ticket-1', userApiKey: 'api-key' });
  await connection.executeTransaction(session, {
    command_id: 'command-1',
    transaction_data: 'data',
    signature: '00',
    deduplication_period: deduplicationPeriod as DeduplicationPeriodInput | undefined,
  });
  return sent.at(-1)!;
}

test('sends deduplication_period in the ledger format', async () => {
  expect((await executeBody({ seconds: 60 })).deduplication_period).toEqual({ DeduplicationDuration: { value: { seconds: 60, nanos: 0 } } });
  expect((await executeBody({ seconds: 1, nanos: 500 })).deduplication_period).toEqual({ DeduplicationDuration: { value: { seconds: 1, nanos: 500 } } });
  expect((await executeBody({ empty: true })).deduplication_period).toEqual({ Empty: {} });
});

test('passes a period already in the ledger format through as is', async () => {
  const duration = { DeduplicationDuration: { value: { seconds: 60, nanos: 0 } } };
  expect((await executeBody(duration)).deduplication_period).toEqual(duration);
  expect((await executeBody({ Empty: {} })).deduplication_period).toEqual({ Empty: {} });
});

test('throws before sending when seconds is not a finite number', async () => {
  for (const period of [{}, { seconds: undefined }, { seconds: NaN }, { seconds: Infinity }]) {
    const count = sent.length;
    await expect(executeBody(period)).rejects.toThrow('Deduplication period must be { seconds, nanos? } or { empty: true }');
    expect(sent.length).toBe(count);
  }
});

test('leaves deduplication_period out when none is given', async () => {
  expect(await executeBody()).not.toHaveProperty('deduplication_period');
  expect(await executeBody(null)).not.toHaveProperty('deduplication_period');
});
