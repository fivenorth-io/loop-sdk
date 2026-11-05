import { PaymentRequiredError, PopupClosedError, RejectRequestError, RequestTimeoutError, UnauthorizedError } from '../errors';

export const CIP103_ERROR_CODES = {
  USER_REJECTED: 4001, UNAUTHORIZED: 4100, UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900, CHAIN_DISCONNECTED: 4901,
  PARSE_ERROR: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602, INTERNAL_ERROR: -32603, INVALID_INPUT: -32000,
  RESOURCE_NOT_FOUND: -32001, RESOURCE_UNAVAILABLE: -32002,
  TRANSACTION_REJECTED: -32003, METHOD_NOT_SUPPORTED: -32004, LIMIT_EXCEEDED: -32005,
} as const;

export class Cip103ProviderRpcError extends Error {
  constructor(public readonly code: number, message: string, public readonly data?: unknown) {
    super(message);
    this.name = 'Cip103ProviderRpcError';
  }
}

export function toCip103Error(error: unknown): Cip103ProviderRpcError {
  if (error instanceof Cip103ProviderRpcError) return error;
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : undefined;
  const message = typeof record?.message === 'string' ? record.message : 'Internal provider error';
  if (typeof record?.code === 'number' && Number.isInteger(record.code)) {
    return new Cip103ProviderRpcError(record.code, message, record.data);
  }
  const code = record?.code;
  if (error instanceof UnauthorizedError || ['UNAUTHORIZED', 'UNAUTHENTICATED', 'SESSION_EXPIRED', 'LOGGED_OUT'].includes(String(code))) {
    return new Cip103ProviderRpcError(4100, message);
  }
  if (code === 'DISCONNECTED') return new Cip103ProviderRpcError(4900, message);
  if (code === 'CHAIN_DISCONNECTED') return new Cip103ProviderRpcError(4901, message);
  if (error instanceof RequestTimeoutError || error instanceof PopupClosedError || code === 'POPUP_CLOSED') {
    return new Cip103ProviderRpcError(-32002, message);
  }
  if (error instanceof PaymentRequiredError) return new Cip103ProviderRpcError(-32002, message);
  if (error instanceof RejectRequestError) return new Cip103ProviderRpcError(4001, message);
  return new Cip103ProviderRpcError(-32603, message);
}
