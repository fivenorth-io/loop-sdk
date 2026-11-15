import { expect, mock, test } from 'bun:test';

type ModalOptions = { onDismiss: () => void };
let modal: ModalOptions | undefined;
mock.module('../src/connect-modal', () => ({
  openConnectModal: (options: ModalOptions) => {
    modal = options;
    return { close() {} };
  },
}));
const { loop } = await import('../src/index');
const { Connection } = await import('../src/connection');
const sdk = loop as any;

test('closing the connect modal clears the session and calls onReject', () => {
  let resets = 0;
  let rejects = 0;
  Object.assign(sdk, { session: { reset: () => resets++ }, onReject: () => rejects++ });
  sdk.showQrCode(['https://wallet.test/connect']);
  modal!.onDismiss();
  expect(resets).toBe(1);
  expect(rejects).toBe(1);
  expect(sdk.connectModal).toBeNull();
});

test('closing the connect modal rejects a pending CIP-103 connect with 4001', async () => {
  Object.assign(sdk, { session: null, onReject: null, connect: async () => sdk.showQrCode(['https://wallet.test/connect']) });
  const connecting = sdk.connectForCip103(60_000);
  modal!.onDismiss();
  await expect(connecting).rejects.toMatchObject({ code: 4001 });
});

test('connecting again right after closing the modal opens a socket for the new ticket', () => {
  const RealWebSocket = globalThis.WebSocket;
  const sockets: any[] = [];
  globalThis.WebSocket = Object.assign(
    class {
      readyState = 0;
      onclose?: () => void;
      constructor(public url: string) { sockets.push(this); }
      close() { this.readyState = 2; } // like a real socket, onclose fires later
    },
    { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 },
  ) as any;
  try {
    const connection = new Connection({ network: 'local' });
    Object.assign(sdk, { connection, session: { reset() {} }, onReject: null });
    connection.connectWebSocket('old-ticket', 'auth', () => {});
    sdk.showQrCode(['https://wallet.test/connect']);
    modal!.onDismiss();
    expect(connection.connectInProgress()).toBe(false);
    connection.connectWebSocket('new-ticket', 'auth', () => {});
    expect(sockets[1].url).toContain('new-ticket');
    sockets[0].onclose!(); // the old socket closing late must not drop the new one
    expect(connection.ws).toBe(sockets[1]);
  } finally {
    globalThis.WebSocket = RealWebSocket;
    sdk.connection = null;
  }
});
