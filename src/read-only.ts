import { Connection } from './connection';
import type { Holding, Network } from './types';

/** A client for a separately issued Loop read-only key. No signer or wallet session is needed. */
export class ReadOnlyLoopSDK {
  readonly #apiKey: string;
  readonly #apiUrl: string;

  constructor({ apiKey, apiUrl, network }: { apiKey: string; apiUrl?: string; network?: Network }) {
    if (!apiKey.startsWith('loop_ro_')) throw new Error('A Loop read-only API key is required');
    this.#apiKey = apiKey;
    this.#apiUrl = new Connection({ apiUrl, network }).apiUrl.replace(/\/$/, '');
  }

  getHolding(): Promise<Holding[]> {
    return this.read('/holding');
  }

  getActiveContracts(filter: { templateId?: string; interfaceId?: string }): Promise<unknown[]> {
    if (!filter.templateId && !filter.interfaceId) throw new Error('templateId or interfaceId is required');
    const query = new URLSearchParams();
    if (filter.templateId) query.set('templateId', filter.templateId);
    if (filter.interfaceId) query.set('interfaceId', filter.interfaceId);
    return this.read(`/active-contracts?${query}`);
  }

  private async read<T>(resource: string): Promise<T> {
    const response = await fetch(`${this.#apiUrl}/api/v1/.connect/pair/account${resource}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.#apiKey}` },
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Loop read failed (${response.status})`);
    return response.json();
  }
}
