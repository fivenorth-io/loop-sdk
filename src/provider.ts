import type { Connection } from './connection';
import type { Holding, ActiveContract, TransferRequest, PreparedTransferPayload, TransferOptions, InstrumentSpec } from './types';
import { MessageType } from './types';
import { RejectRequestError, RequestTimeoutError } from './errors';

export const DEFAULT_REQUEST_TIMEOUT_MS = 300000; // 5 minutes

type TransactionPayload = {
  commands: any[];
  disclosedContracts: any[];
  packageIdSelectionPreference?: string[];
  actAs?: string[];
  readAs?: string[];
  synchronizerId?: string;
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

    constructor({ connection, party_id, public_key, auth_token, email }: { connection: Connection, party_id: string, public_key: string, auth_token: string, email?: string }) {
        if (!connection) {
            throw new Error('Provider requires a connection object.');
        }
        this.connection = connection;
        this.party_id = party_id;
        this.public_key = public_key;
        this.email = email;
        this.auth_token = auth_token; 
    }

    public getAuthToken(): string {
        return this.auth_token;
    }

    // handle all responses from the websocket except for handshake_accept, handshake_reject
    public handleResponse(message: any) {
        console.log('Received response:', message);
        if (message.request_id) {
            this.requests.set(message.request_id, message);
        }
    }

    async getHolding(): Promise<Holding[]> {
        return this.connection.getHolding(this.auth_token);
    }

    async getActiveContracts(params?: { templateId?: string; interfaceId?: string }): Promise<ActiveContract[]> {
        return this.connection.getActiveContracts(this.auth_token, params);
    }

    // submit a transaction to be signed by the wallet to the websocket
    async submitTransaction(
      payload: TransactionPayload, 
      options?: { requestTimeout?: number; message?: string }
    ): Promise<any> {
        return this.sendRequest(MessageType.RUN_TRANSACTION, payload, options);
    }

    async transfer(
      recipient: string,
      amount: string | number,
      instrument?: InstrumentSpec,
      options?: TransferOptions,
    ): Promise<any> {
        const amountStr = typeof amount === 'number' ? amount.toString() : amount;
        const { requestedAt, executeBefore, requestTimeout } = options || {};
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

        const preparedPayload: PreparedTransferPayload = await this.connection.prepareTransfer(this.auth_token, transferRequest);

        return this.submitTransaction({
            commands: preparedPayload.commands,
            disclosedContracts: preparedPayload.disclosedContracts,
            packageIdSelectionPreference: preparedPayload.packageIdSelectionPreference,
            actAs: preparedPayload.actAs,
            readAs: preparedPayload.readAs,
            synchronizerId: preparedPayload.synchronizerId,
        }, { requestTimeout, message });
    }

    // submit a raw message to be signed by the wallet to the websocket
    async signMessage(message: string): Promise<any> {
        return this.sendRequest(MessageType.SIGN_RAW_MESSAGE, message);
    }

    private async ensureConnected(): Promise<void> {
        if (this.connection.ws && this.connection.ws.readyState === WebSocket.OPEN) {
            return;
        }

        if (typeof this.connection.reconnectWebSocket === 'function') {
            await this.connection.reconnectWebSocket();
            if (this.connection.ws && this.connection.ws.readyState === WebSocket.OPEN) {
                return;
            }
        }

        throw new Error('Not connected.');
    }

    private sendRequest(
      messageType: MessageType, 
      params: any = {}, 
      options?: { requestTimeout?: number; message?: string }
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const requestId = generateRequestId();

            const ensure = async () => {
                try {
                    await this.ensureConnected();
                } catch (error) {
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

                this.connection.ws!.send(JSON.stringify(requestBody));

                const intervalTime = 300; // 300ms
                let elapsedTime = 0;
                const timeoutMs = options?.requestTimeout ?? this.requestTimeout;

                const intervalId = setInterval(() => {
                    const response = this.requests.get(requestId);
                    if (response) {
                        clearInterval(intervalId);
                        this.requests.delete(requestId);
                        if (response.type === MessageType.REJECT_REQUEST) {
                            reject(new RejectRequestError());
                        } else {
                            resolve(response.payload);
                        }
                    } else {
                        elapsedTime += intervalTime;
                        if (elapsedTime >= timeoutMs) {
                            clearInterval(intervalId);
                            this.requests.delete(requestId);
                            reject(new RequestTimeoutError(timeoutMs));
                        }
                    }
                }, intervalTime);
            };

            void ensure();
        });
    }
}
