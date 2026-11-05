import { generateRequestId, type TransactionProgressListener } from '../provider';
import type { TransactionPayload } from '../types';
import { Cip103ProviderRpcError, toCip103Error } from './errors';
import type { Cip103JsPrepareSubmissionRequest, Cip103TxChangedEvent, Cip103TxChangedExecutedEvent, Cip103Wallet } from './types';

interface TransactionBridge {
  account(): Promise<Cip103Wallet>;
  submit(payload: TransactionPayload, onProgress: TransactionProgressListener, timeout: number): Promise<unknown>;
  revision(): number;
  notify(event: Cip103TxChangedEvent): void;
}

export function createTransactionHandlers(bridge: TransactionBridge, timeout = 300_000) {
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Cip103ProviderRpcError(-32602, 'Invalid transaction timeout');
  const commandIds = new Map<string, number>();
  let active = false;

  async function start(input: Cip103JsPrepareSubmissionRequest) {
    // Handle one transaction at a time so approval requests don't overwrite each other.
    if (active) throw new Cip103ProviderRpcError(-32002, 'Another transaction is awaiting completion');
    active = true;
    try {
      const account = await bridge.account();
      const revision = bridge.revision();
      if (account.status !== 'allocated') throw new Cip103ProviderRpcError(4100, 'Account is not allocated');
      for (const parties of [input.actAs, input.readAs]) {
        if (parties?.some(party => party !== account.partyId)) {
          throw new Cip103ProviderRpcError(4100, 'Transaction parties must match the authorized account');
        }
      }
      const commandId = input.commandId ?? generateRequestId();
      if (!commandId.trim()) throw new Cip103ProviderRpcError(-32602, 'Command ID must not be empty');
      for (const [id, expires] of commandIds) if (expires <= Date.now()) commandIds.delete(id);
      if (commandIds.has(commandId)) throw new Cip103ProviderRpcError(-32602, 'Command ID was already used in this provider session');
      commandIds.set(commandId, Date.now() + timeout + 600_000);
      // Copy the request so the dApp cannot change it while the wallet is using it.
      const payload: TransactionPayload = structuredClone({
        ...input, commandId, actAs: [account.partyId], readAs: input.readAs ?? [account.partyId],
        disclosedContracts: input.disclosedContracts ?? [],
      });
      let terminal = false;
      let signed = false;
      let pending = false;
      let executed: Cip103TxChangedExecutedEvent | undefined;
      let failure: Cip103ProviderRpcError | undefined;
      let readyResolve!: (value: null) => void;
      let readyReject!: (error: unknown) => void;
      const ready = new Promise<null>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
      // Avoid an unhandled rejection when the caller only waits for completion.
      void ready.catch(() => {});
      const current = () => revision === bridge.revision();
      const emitPending = () => {
        if (!pending) { pending = true; bridge.notify({ status: 'pending', commandId }); }
      };
      const failed = (error: Cip103ProviderRpcError) => {
        if (terminal) return;
        terminal = true;
        failure = error;
        bridge.notify({ status: 'failed', commandId });
        readyReject(error);
      };
      const progress: TransactionProgressListener = data => {
        if (!current() || terminal) return true;
        if (!data || typeof data !== 'object') return false;
        if (data.status === 'pending') {
          emitPending();
          readyResolve(null);
        } else if (data.status === 'signed') {
          if (typeof data.signature !== 'string' || !data.signature
            || data.party !== account.partyId || data.signed_by !== account.namespace) return false;
          emitPending();
          if (!signed) {
            signed = true;
            bridge.notify({ status: 'signed', commandId, payload: {
              signature: data.signature, signedBy: data.signed_by, party: data.party,
            } });
          }
          readyResolve(null);
        } else if (data.status === 'succeeded') {
          const tx = data.update_data;
          const updateId = data.update_id;
          const offset = tx?.offset;
          // Require a ledger receipt before reporting success.
          if (typeof updateId !== 'string' || !updateId || tx?.updateId !== updateId
            || !Number.isSafeInteger(offset) || offset < 0) return false;
          emitPending();
          terminal = true;
          executed = { status: 'executed', commandId, payload: { updateId, completionOffset: offset } };
          bridge.notify(executed);
          readyResolve(null);
        } else if (data.status === 'failed') {
          failed(new Cip103ProviderRpcError(-32003, 'Transaction rejected by the ledger'));
        }
        return terminal;
      };

      const completion = (async () => {
        try {
          const result = await bridge.submit(payload, progress, timeout);
          if (!current()) throw new Cip103ProviderRpcError(4100, 'Session changed during transaction');
          progress(result);
          if (failure) throw failure;
          if (!executed) throw new Cip103ProviderRpcError(-32002, 'Transaction outcome is unknown; do not automatically resubmit', { commandId });
          return { tx: executed };
        } catch (error) {
          // Keep a confirmed result even if the connection fails afterward.
          if (executed && current()) return { tx: executed };
          let mapped = failure ?? toCip103Error(error);
          if (signed && mapped.code === 4001) mapped = new Cip103ProviderRpcError(
            -32002, 'Transaction outcome is unknown after signing', { commandId },
          );
          if (current() && mapped.code === 4001 && !signed) failed(mapped);
          // A timeout or lost connection does not prove the transaction failed.
          readyReject(mapped);
          throw mapped;
        } finally {
          active = false;
        }
      })();
      void completion.catch(() => {});
      return { ready, completion };
    } catch (error) {
      active = false;
      throw error;
    }
  }

  return {
    prepareExecute: async (input: Cip103JsPrepareSubmissionRequest) => (await start(input)).ready,
    prepareExecuteAndWait: async (input: Cip103JsPrepareSubmissionRequest) => (await start(input)).completion,
  };
}
