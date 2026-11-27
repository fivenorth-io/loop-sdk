import { afterEach, expect, test } from 'bun:test';
import { SessionInfo } from '../src/session';

const originalLocalStorage = globalThis.localStorage;
afterEach(() => { globalThis.localStorage = originalLocalStorage; });

test('reset clears every session field', () => {
  const removed: string[] = [];
  globalThis.localStorage = { removeItem: (key: string) => { removed.push(key); } } as unknown as Storage;
  const session = new SessionInfo({
    sessionId: 'session-1',
    ticketId: 'ticket-1',
    ticketAuthToken: 'ticket-token',
    authToken: 'auth-token',
    partyId: 'alice::1220',
    publicKey: 'public-key',
    email: 'alice@example.com',
    userApiKey: 'api-key',
    walletUrl: 'https://wallet.test',
  });
  session.authorized();

  session.reset();

  expect(removed).toEqual(['loop_connect']);
  for (const field of ['ticketId', 'ticketAuthToken', 'authToken', 'partyId', 'publicKey', 'email', 'userApiKey', 'walletUrl'] as const) {
    expect(session[field]).toBeUndefined();
  }
  expect(session.sessionId).toBeString();
  expect(session.sessionId).not.toBe('session-1');
  expect(session.isAuthorized()).toBe(false);
});
