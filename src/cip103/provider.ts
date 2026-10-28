import type { Cip103EventMap, Cip103MethodMap } from './types';
import { Cip103ProviderRpcError, toCip103Error } from './errors';
import { isCip103Method, isRecord, validateParams } from './validation';

export const CIP103_API_VERSION = '0.5.0' as const;
export type Cip103Method = keyof Cip103MethodMap;
export type Cip103Handlers = {
  [M in Cip103Method]?: (params: Cip103MethodMap[M]['params']) =>
    Cip103MethodMap[M]['result'] | Promise<Cip103MethodMap[M]['result']>;
};
export interface Cip103RequestPayload {
  method: string;
  params?: unknown[] | Record<string, unknown>;
}
type Listener = (...args: any[]) => void;

export class Cip103Provider {
  private readonly handlers: Cip103Handlers;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(handlers: Cip103Handlers = {}) {
    this.handlers = { ...handlers };
  }

  request<M extends Cip103Method>(args: {
    method: M;
    params?: Cip103MethodMap[M]['params'] | [Cip103MethodMap[M]['params']] | { params: Cip103MethodMap[M]['params'] };
  }): Promise<Cip103MethodMap[M]['result']>;
  request<T = unknown>(args: Cip103RequestPayload): Promise<T>;
  async request(args: Cip103RequestPayload): Promise<unknown> {
    try {
      if (!isRecord(args) || typeof args.method !== 'string' || !args.method.length ||
        Object.keys(args).some(key => key !== 'method' && key !== 'params')) {
        throw new Cip103ProviderRpcError(-32600, 'Invalid provider request');
      }
      if (!isCip103Method(args.method)) throw new Cip103ProviderRpcError(4200, `Unsupported method: ${args.method}`);
      const params = validateParams(args.method, args.params);
      const handler = this.handlers[args.method as Cip103Method] as ((params: unknown) => unknown) | undefined;
      if (typeof handler !== 'function') throw new Cip103ProviderRpcError(4200, `Method not implemented: ${args.method}`);
      const result = await handler(params);
      return result;
    } catch (error) {
      throw toCip103Error(error);
    }
  }

  on<E extends keyof Cip103EventMap>(event: E, listener: (payload: Cip103EventMap[E]) => void): this;
  on(event: string, listener: Listener): this;
  on(event: string, listener: Listener): this {
    if (typeof listener !== 'function') throw new TypeError('Listener must be a function');
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  emit<E extends keyof Cip103EventMap>(event: E, payload: Cip103EventMap[E]): boolean;
  emit(event: string, ...args: unknown[]): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    const listeners = this.listeners.get(event);
    if (!listeners?.length) return false;
    for (const listener of [...listeners]) listener(...args);
    return true;
  }

  removeListener<E extends keyof Cip103EventMap>(event: E, listener: (payload: Cip103EventMap[E]) => void): this;
  removeListener(event: string, listener: Listener): this;
  removeListener(event: string, listener: Listener): this {
    const listeners = this.listeners.get(event);
    const index = listeners?.lastIndexOf(listener) ?? -1;
    if (listeners && index >= 0) {
      listeners.splice(index, 1);
      if (!listeners.length) this.listeners.delete(event);
    }
    return this;
  }

}
