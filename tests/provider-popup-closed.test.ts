import { describe, it, expect, mock } from 'bun:test';
import { Provider } from '../src/provider';
import { PopupClosedError } from '../src/errors';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup() {
  // Fake wallet popup handle returned by the onRequestStart hook
  const popup = { closed: false };
  const ws = { readyState: WebSocket.OPEN, send: mock(() => {}) };
  const connection: any = { ws, reconnect: mock(async () => {}) };
  const hooks = {
    onRequestStart: mock(async () => popup),
    onRequestFinish: mock(() => {}),
  };
  const provider = new Provider({
    connection, party_id: 'p', public_key: 'k', auth_token: 't', hooks,
  });
  return { popup, ws, hooks, provider };
}

describe('Provider popup handling', () => {
  it('does not reject an approved request when the popup closes', async () => {
    const { popup, ws, hooks, provider } = setup();
    const result = provider.submitCip103Transaction({ commands: [] } as any, () => false, 60_000);

    // Let the request be sent
    await sleep(50);
    const sent = JSON.parse((ws.send.mock.calls[0] as any)[0]);

    // The wallet approved the request and reports progress
    provider.handleResponse({
      type: 'transaction_progress',
      payload: { request_id: sent.request_id, status: 'approved' },
    });

    // The popup closes after approval, before the final response arrives
    popup.closed = true;
    await sleep(400); // longer than the 300ms polling interval

    // No reject_request must be sent for an approved request
    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(hooks.onRequestFinish).not.toHaveBeenCalled();

    // The final response still resolves the request
    provider.handleResponse({
      request_id: sent.request_id,
      type: 'transaction_completed',
      payload: { ok: true },
    });
    await expect(result).resolves.toEqual({ ok: true });
    expect(hooks.onRequestFinish).toHaveBeenCalledTimes(1);
  });

  it('still rejects with PopupClosedError when the popup closes before approval', async () => {
    const { popup, ws, provider } = setup();
    const result = provider
      .submitCip103Transaction({ commands: [] } as any, () => false, 60_000)
      .catch((e: any) => e);

    await sleep(50);

    // The popup closes and no progress was ever received
    popup.closed = true;

    expect(await result).toBeInstanceOf(PopupClosedError);
    // run_transaction + reject_request
    expect(ws.send).toHaveBeenCalledTimes(2);
  });

  it('does not reject an approved request in wait mode without a progress listener', async () => {
    const { popup, ws, provider } = setup();
    const result = provider.submitAndWaitForTransaction({ commands: [] } as any);

    await sleep(50);
    const sent = JSON.parse((ws.send.mock.calls[0] as any)[0]);

    // Progress arrives although no progress listener was registered
    provider.handleResponse({
      type: 'transaction_progress',
      payload: { request_id: sent.request_id, status: 'approved' },
    });
    popup.closed = true;
    await sleep(400);

    // No reject_request must be sent for an approved request
    expect(ws.send).toHaveBeenCalledTimes(1);

    provider.handleResponse({
      request_id: sent.request_id,
      type: 'transaction_completed',
      payload: { ok: true },
    });
    await expect(result).resolves.toEqual({ ok: true });
  });
});
