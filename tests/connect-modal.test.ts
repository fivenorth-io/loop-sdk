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
