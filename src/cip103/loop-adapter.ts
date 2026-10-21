import type { Account, ConnectProviderStatus, TransactionPayload } from '../types';
import { createTransactionHandlers } from './transactions';
import type { TransactionProgressListener } from '../provider';
import { generateRequestId } from '../provider';
import { UnauthorizedError } from '../errors';
import { Cip103Provider, CIP103_API_VERSION } from './provider';
import { Cip103ProviderRpcError, toCip103Error } from './errors';
import type { Cip103ConnectResult, Cip103EventMap, Cip103StatusEvent, Cip103Wallet } from './types';

export interface LoopCip103Options {
  connectTimeoutMs?: number;
  transactionTimeoutMs?: number;
}

export interface LoopCip103Bridge {
  walletUrl: string;
  restore(): Promise<void>;
  connect(timeoutMs: number): Promise<void>;
  disconnect(): Promise<void>;
  account(): Promise<Account | null>;
  providerStatus(): Promise<ConnectProviderStatus>;
  submitTransaction(payload: TransactionPayload, onProgress: TransactionProgressListener, timeout: number): Promise<unknown>;
  signMessage(message: string): Promise<unknown>;
  onSessionChanged(listener: () => void): void;
}

export function createLoopCip103Provider(bridge: LoopCip103Bridge, options: LoopCip103Options = {}): Cip103Provider {
  const config = { ...options };
  const timeout = config.connectTimeoutMs ?? 300_000;
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Cip103ProviderRpcError(-32602, 'Invalid connect timeout');
  let revision = 0;
  let previousAccounts = '';
  let previousStatus = '';
  let connectPromise: Promise<Cip103ConnectResult> | undefined;
  let disconnectPromise: Promise<null> | undefined;

  function notify<E extends keyof Cip103EventMap>(event: E, payload: Cip103EventMap[E]) {
    try { provider.emit(event, payload); } catch (error) { console.error('[LoopSDK] CIP-0103 listener failed', error); }
  }

  function mapAccount(account: Account): Cip103Wallet {
    const metadata = account.cip103;
    if (!metadata) throw new Cip103ProviderRpcError(-32002, 'Account metadata unavailable; the wallet backend requires CIP-0103 support');
    const { primary, partyId, publicKey, hint, namespace, status, networkId, signingProviderId } = metadata;
    if (primary !== true || partyId !== account.party_id || publicKey !== account.public_key
      || typeof hint !== 'string' || !hint || typeof namespace !== 'string' || !namespace
      || partyId !== `${hint}::${namespace}`
      || !['initialized', 'allocated'].includes(status)
      || typeof networkId !== 'string' || !/^canton:[a-zA-Z0-9_-]{1,32}$/.test(networkId)
      || typeof signingProviderId !== 'string' || !signingProviderId.trim()) {
      throw new Cip103ProviderRpcError(-32603, 'Invalid account metadata');
    }
    return { primary, partyId, publicKey, hint, namespace, status, networkId, signingProviderId };
  }

  async function snapshot(restore = true, retry = true): Promise<{ status: Cip103StatusEvent; accounts: Cip103Wallet[] }> {
    if (restore) await bridge.restore();
    const startRevision = revision;
    const account = await bridge.account();
    const accounts = account ? [mapAccount(account)] : [];
    let checked: ConnectProviderStatus | undefined;
    try { checked = await bridge.providerStatus(); } catch { /* Report unavailable health without losing the authorized account. */ }
    if (checked && accounts[0] && (checked.network_id !== accounts[0].networkId
      || checked.signing_provider_id !== accounts[0].signingProviderId)) {
      throw new Cip103ProviderRpcError(-32603, 'Account and provider deployment metadata do not match');
    }
    const network = checked
      ? { isNetworkConnected: checked.is_network_connected,
          ...(checked.network_reason ? { networkReason: checked.network_reason } : {}) }
      : { isNetworkConnected: false, networkReason: 'Ledger connectivity check failed' };
    if (revision !== startRevision) {
      if (retry) return snapshot(false, false);
      throw new Cip103ProviderRpcError(4100, 'Session changed during request');
    }
    const status: Cip103StatusEvent = {
      provider: { id: 'loop', version: CIP103_API_VERSION, providerType: 'remote', url: bridge.walletUrl },
      connection: { isConnected: !!account, ...network, ...(!account ? { reason: 'No authorized wallet session' } : {}) },
      ...(account ? { network: { networkId: accounts[0]!.networkId } } : {}),
    };
    const accountKey = JSON.stringify(accounts);
    const statusKey = JSON.stringify(status);
    const accountsChanged = accountKey !== previousAccounts;
    const statusChanged = statusKey !== previousStatus;
    previousAccounts = accountKey;
    previousStatus = statusKey;
    if (accountsChanged) notify('accountsChanged', accounts);
    if (statusChanged) notify('statusChanged', status);
    return { accounts, status };
  }

  const transactions = createTransactionHandlers({
    account: async () => {
      if (disconnectPromise) throw new Cip103ProviderRpcError(4100, 'Disconnect in progress');
      const account = (await snapshot()).accounts[0];
      if (!account) throw new Cip103ProviderRpcError(4100, 'No authorized account');
      return account;
    },
    submit: (payload, onProgress, timeout) => bridge.submitTransaction(payload, onProgress, timeout),
    revision: () => revision,
    notify: event => notify('txChanged', event),
  }, options.transactionTimeoutMs);
  const provider = new Cip103Provider({
    ...transactions,
    connect: () => {
      if (disconnectPromise) throw new Cip103ProviderRpcError(4100, 'Disconnect in progress');
      if (!connectPromise) {
        connectPromise = (async () => {
          await bridge.connect(timeout);
          if (disconnectPromise) throw new Cip103ProviderRpcError(4100, 'Disconnect in progress');
          const result = await snapshot(false);
          if (!result.status.connection.isConnected) throw new Cip103ProviderRpcError(4100, 'Session is not authorized');
          return result.status.connection;
        })().finally(() => { connectPromise = undefined; });
      }
      return connectPromise;
    },
    disconnect: () => {
      if (!disconnectPromise) {
        disconnectPromise = (async () => {
          await bridge.disconnect();
          await snapshot(false);
          return null;
        })().finally(() => { disconnectPromise = undefined; });
      }
      return disconnectPromise;
    },
    isConnected: async () => (await snapshot()).status.connection,
    status: async () => (await snapshot()).status,
    listAccounts: async () => (await snapshot()).accounts,
    getPrimaryAccount: async () => {
      const account = (await snapshot()).accounts[0];
      if (!account) throw new Cip103ProviderRpcError(4100, 'No authorized account');
      return account;
    },
    getActiveNetwork: async () => {
      const network = (await snapshot()).status.network;
      if (!network) throw new Cip103ProviderRpcError(4100, 'No authorized account');
      return network;
    },
    signMessage: async ({ message }) => {
      if (disconnectPromise) throw new Cip103ProviderRpcError(4100, 'Disconnect in progress');
      const account = (await snapshot()).accounts[0];
      if (!account) throw new Cip103ProviderRpcError(4100, 'No authorized account');
      const startRevision = revision;
      const messageId = generateRequestId();
      notify('messageSignature', { status: 'pending', messageId });
      try {
        const result = await bridge.signMessage(message);
        if (revision !== startRevision) throw new UnauthorizedError('Session changed while signing');
        const signature = typeof result === 'string' ? result
          : result && typeof result === 'object' && 'signature' in result ? result.signature : undefined;
        if (typeof signature !== 'string' || !signature.length) throw new Cip103ProviderRpcError(-32603, 'Invalid signature response');
        notify('messageSignature', { status: 'signed', messageId, signature });
        return { signature };
      } catch (error) {
        notify('messageSignature', { status: 'failed', messageId });
        throw toCip103Error(error);
      }
    },
  });
  bridge.onSessionChanged(() => {
    revision++;
    void snapshot(false).catch(() => {});
  });
  return provider;
}
