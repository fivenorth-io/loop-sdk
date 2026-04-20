import type { Connection } from './connection';
import type {
  Holding,
  ActiveContract,
  TransferRequest,
  PreparedTransferPayload,
  TransferOptions,
  InstrumentSpec,
  RunTransactionResponse,
  TransactionPayload,
  EstimatedGasResponse,
  DeduplicationPeriodInput,
} from './types';
import { MessageType, type Account } from './types';
import { PopupClosedError, RejectRequestError, RequestTimeoutError, UnauthorizedError, extractErrorCode, isUnauthCode } from './errors';

export const DEFAULT_REQUEST_TIMEOUT_MS = 300000; // 5 minutes
export type RequestFinishStatus = 'success' | 'rejected' | 'timeout' | 'error';
export type RequestFinishArgs = {
  status: RequestFinishStatus;
  messageType: MessageType;
  requestLabel?: string;
  requestContext?: unknown;
  errorCode?: string;
};
export type ProviderHooks = {
  onRequestStart?: (messageType: MessageType, requestLabel?: string) => unknown | Promise<unknown>;
  onRequestFinish?: (args: RequestFinishArgs) => void;
  onTransactionUpdate?: (payload: RunTransactionResponse, message: any) => void;
};

type SubmitOptions = {
  requestTimeout?: number;
  message?: string;
  requestLabel?: string;
  estimateTraffic?: boolean;
  executionMode?: 'async' | 'wait';
  deduplicationPeriod?: DeduplicationPeriodInput;
};

// Use polyfill only on HTTP (crypt.randomUUID requires HTTPS or localhost)
// In production (HTTPS), native randomUUID will be used
function generateUUID(): string {
  return '10000000-1000-4000-8000-100000000000'.replace(
    /[018]/g,
    (c) => {
      const gCrypto = globalThis.crypto as Crypto | undefined;

      if (!gCrypto?.getRandomValues) { // fallback for if crypto is not available
        const n = Number(c);
        return ((n ^ (Math.random() * 16) >> (n / 4))).toString(16);
      }

      // use crypto API
      const arr = gCrypto.getRandomValues(new Uint8Array(1));
      const byte = arr[0]!;
      const n = Number(c);

      return ((n ^ ((byte & 15) >> (n / 4)))).toString(16);
    },
  );
}

export function generateRequestId(): string {
  const gCrypto = globalThis.crypto as Crypto | undefined;

  if (gCrypto?.randomUUID) {
    return gCrypto.randomUUID();
  }

  return generateUUID();
}

export class Provider {
    public connection: Connection;
    public party_id: string;
    public public_key: string;
    public email?: string;
    private auth_token: string;
    private requests: Map<string, any> = new Map();
    private requestTimeout: number = DEFAULT_REQUEST_TIMEOUT_MS;
    private hooks?: ProviderHooks;

    constructor({ connection, party_id, public_key, auth_token, email, hooks }: { connection: Connection, party_id: string, public_key: string, auth_token: string, email?: string, hooks?: ProviderHooks }) {
        if (!connection) {
            throw new Error('Provider requires a connection object.');
        }
        this.connection = connection;
        this.party_id = party_id;
        this.public_key = public_key;
        this.email = email;
        this.auth_token = auth_token; 
        this.hooks = hooks;
    }

    public getAuthToken(): string {
        return this.auth_token;
    }

    // handle all responses from the websocket except for handshake_accept, handshake_reject
    public handleResponse(message: any) {
        console.log('Received response:', message);

        if (
            message?.type === MessageType.TRANSACTION_COMPLETED &&
            (message?.payload?.update_id || message?.payload?.update_data || message?.payload?.status)
        ) {
            if (message?.payload?.error_message) {
                message.payload.error = { error_message: message.payload.error_message };
                delete message.payload.error_message;
            }
            this.hooks?.onTransactionUpdate?.(message.payload as RunTransactionResponse, message);
        }

        if (message.request_id) {
            this.requests.set(message.request_id, message);
        }
    }

    getHolding(): Promise<Holding[]> {
        return this.connection.getHolding(this.auth_token);
    }

    // get the current account connected to the provider
    // This is useful for dApps to know if the user has pre approval or merge delegation permissions to ensure UTXO consolidation is in place
    getAccount(): Promise<Account> {
        return this.connection.verifySession(this.auth_token);
    }

    getActiveContracts(params?: { templateId?: string; interfaceId?: string }): Promise<ActiveContract[]> {
        return this.connection.getActiveContracts(this.auth_token, params);
    }

    async estimateGas(payload: TransactionPayload): Promise<EstimatedGasResponse> {
        return this.connection.estimateGasForConnect(this.auth_token, payload);
    }

    // submit a transaction to be signed by the wallet to the websocket
    async submitTransaction(
      payload: TransactionPayload, 
      options?: SubmitOptions
    ): Promise<any> {
        const requestPayload: Record<string, unknown> = {
          ...payload,
          ...(options?.deduplicationPeriod ? { deduplicationPeriod: toLedgerDeduplicationPeriod(options.deduplicationPeriod) } : {}),
        };
        const requestPayloadWithTraffic = options?.estimateTraffic ? { ...requestPayload, estimate_traffic: true } : requestPayload;
        const executionMode = options?.executionMode;
        const finalPayload = executionMode === 'wait'
          ? { ...requestPayloadWithTraffic, execution_mode: 'wait' }
          : requestPayloadWithTraffic;
        return this.sendRequest(MessageType.RUN_TRANSACTION, finalPayload, options);
    }

    async submitAndWaitForTransaction(
      payload: TransactionPayload,
      options?: SubmitOptions
    ): Promise<any> {
        const requestPayload: Record<string, unknown> = {
          ...payload,
          ...(options?.deduplicationPeriod ? { deduplicationPeriod: toLedgerDeduplicationPeriod(options.deduplicationPeriod) } : {}),
        };
        const requestPayloadWithTraffic = options?.estimateTraffic ? { ...requestPayload, estimate_traffic: true } : requestPayload;
        return this.sendRequest(
          MessageType.RUN_TRANSACTION,
          { ...requestPayloadWithTraffic, execution_mode: 'wait' },
          options,
        );
    }

    async transfer(
      recipient: string,
      amount: string | number,
      instrument?: InstrumentSpec,
      options?: TransferOptions & { executionMode?: 'async' | 'wait' },
    ): Promise<any> {
        const amountStr = typeof amount === 'number' ? amount.toString() : amount;
        const { requestedAt, executeBefore, requestTimeout, estimateTraffic, memo } = options || {};
        const message = options?.message;
        const resolveDate = (value?: string | Date, fallbackMs?: number) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          if (typeof value === 'string' && value.length > 0) {
            return value;
          }
          if (fallbackMs) {
            return new Date(Date.now() + fallbackMs).toISOString();
          }
          return new Date().toISOString();
        };

        const requestedAtIso = resolveDate(requestedAt);
        const executeBeforeIso = resolveDate(executeBefore, 24 * 60 * 60 * 1000);

        const transferRequest: TransferRequest = {
          recipient,
          amount: amountStr,
          instrument: {
            instrument_admin: instrument?.instrument_admin,
            instrument_id: instrument?.instrument_id || 'Amulet',
          },
          requested_at: requestedAtIso,
          execute_before: executeBeforeIso,
        };
        if (memo) {
          transferRequest.memo = memo;
        }

        const preparedPayload: PreparedTransferPayload = await this.connection.prepareTransfer(this.auth_token, transferRequest);

        const submitFn = options?.executionMode === 'wait'
          ? this.submitAndWaitForTransaction.bind(this)
          : this.submitTransaction.bind(this);

        return submitFn({
            commands: preparedPayload.commands,
            disclosedContracts: preparedPayload.disclosedContracts,
            packageIdSelectionPreference: preparedPayload.packageIdSelectionPreference,
            actAs: preparedPayload.actAs,
            readAs: preparedPayload.readAs,
            synchronizerId: preparedPayload.synchronizerId,
        }, {
            requestTimeout,
            message,
            estimateTraffic,
            deduplicationPeriod: options?.deduplicationPeriod,
        });
    }

    // submit a raw message to be signed by the wallet to the websocket
    async signMessage(message: string): Promise<any> {
        return this.sendRequest(MessageType.SIGN_RAW_MESSAGE, message);
    }

    private async ensureConnected(): Promise<void> {
        if (this.connection.ws && this.connection.ws.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        await this.connection.reconnect();
        if (this.connection.ws && this.connection.ws.readyState === WebSocket.OPEN) {
            return;
        }

        throw new Error('Not connected.');
    }

    private sendRequest(
      messageType: MessageType, 
      params: any = {}, 
      options?: { requestTimeout?: number; message?: string; requestLabel?: string }
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const requestId = generateRequestId();
            let requestContext: unknown;

            const ensure = async () => {
                try {
                    await this.ensureConnected();

                    requestContext = await this.hooks?.onRequestStart?.(messageType, options?.requestLabel);
                } catch (error) {
                    console.error('[LoopSDK] error when checking connection status', error);
                    this.hooks?.onRequestFinish?.({
                        status: 'error',
                        messageType,
                        requestLabel: options?.requestLabel,
                        requestContext,
                    });
                    reject(error);
                    return;
                }

                const requestBody: any = {
                    request_id: requestId,
                    type: messageType,
                    payload: params,
                };

                if (options?.message) {
                    requestBody.ticket = { message: options.message };

                    if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
                        requestBody.payload = {
                            ...params,
                            ticket: { message: options.message },
                        };
                    }
                }

                try {
                  this.connection.ws!.send(JSON.stringify(requestBody));
                } catch (error) {
                  console.error('[LoopSDK] error when sending request', error);
                  reject(error);
                  return;
                }

                const intervalTime = 300; // 300ms
                let elapsedTime = 0;
                const timeoutMs = options?.requestTimeout ?? this.requestTimeout;

                const intervalId = setInterval(() => {
                    const response = this.requests.get(requestId);
                    if (response) {
                        clearInterval(intervalId);
                        this.requests.delete(requestId);
                        const code = extractErrorCode(response);
                        if (isUnauthCode(code)) {
                            this.hooks?.onRequestFinish?.({
                                status: 'error',
                                messageType,
                                requestLabel: options?.requestLabel,
                                requestContext,
                                errorCode: code,
                            });
                            reject(new UnauthorizedError(code));
                            return;
                        }
                        if (response.type === MessageType.REJECT_REQUEST) {
                            const rejectMessage = response?.payload?.message;
                            const rejectCode = response?.payload?.code;
                            this.hooks?.onRequestFinish?.({
                                status: 'rejected',
                                messageType,
                                requestLabel: options?.requestLabel,
                                requestContext,
                            });
                            reject(new RejectRequestError(rejectMessage, rejectCode));
                        } else {
                            this.hooks?.onRequestFinish?.({
                                status: 'success',
                                messageType,
                                requestLabel: options?.requestLabel,
                                requestContext,
                            });
                            resolve(response.payload);
                        }
                    } else {
                        if (isClosedWindow(requestContext)) {
                            clearInterval(intervalId);
                            this.requests.delete(requestId);
                            this.rejectPendingRequest(requestId, 'POPUP_CLOSED', 'Wallet popup was closed before the request completed.');
                            this.hooks?.onRequestFinish?.({
                                status: 'error',
                                messageType,
                                requestLabel: options?.requestLabel,
                                requestContext,
                                errorCode: 'POPUP_CLOSED',
                            });
                            reject(new PopupClosedError());
                            return;
                        }

                        elapsedTime += intervalTime;
                        if (elapsedTime >= timeoutMs) {
                            clearInterval(intervalId);
                            this.requests.delete(requestId);
                            this.hooks?.onRequestFinish?.({
                                status: 'timeout',
                                messageType,
                                requestLabel: options?.requestLabel,
                                requestContext,
                            });
                            reject(new RequestTimeoutError(timeoutMs));
                        }
                    }
                }, intervalTime);
            };

            void ensure();
        });
    }

    private rejectPendingRequest(requestId: string, code: string, message: string): void {
        if (!this.connection.ws || this.connection.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            this.connection.ws.send(JSON.stringify({
                request_id: requestId,
                type: MessageType.REJECT_REQUEST,
                payload: {
                    code,
                    message,
                },
            }));
        } catch (error) {
            console.warn('[LoopSDK] failed to reject pending request', error);
        }
    }
}

function isClosedWindow(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
        return false;
    }

    return 'closed' in value && value.closed === true;
}

function toLedgerDeduplicationPeriod(input: DeduplicationPeriodInput) {
    if ('empty' in input) {
        return { Empty: {} };
    }

    return {
        DeduplicationDuration: {
            value: {
                seconds: input.seconds,
                nanos: input.nanos ?? 0,
            },
        },
    };
}
