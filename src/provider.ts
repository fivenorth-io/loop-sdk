import type { Connection } from './connection';
import type { Holding, ActiveContract } from './types';
import { MessageType } from './types';
import { RejectRequestError, RequestTimeoutError } from './errors';

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
    private requestTimeout: number = 30000; // 30 seconds

    constructor({ connection, party_id, public_key, auth_token, email, requestTimeout }: { connection: Connection, party_id: string, public_key: string, auth_token: string, email?: string, requestTimeout?: number }) {
        if (!connection) {
            throw new Error('Provider requires a connection object.');
        }
        this.connection = connection;
        this.party_id = party_id;
        this.public_key = public_key;
        this.email = email;
        this.auth_token = auth_token;
        this.requestTimeout = requestTimeout || 30000; // 30 seconds
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
    async submitTransaction(payload: { commands: any[]; disclosedContracts: any[] }): Promise<any> {
        return this.sendRequest(MessageType.RUN_TRANSACTION, payload);
    }

    // submit a raw message to be signed by the wallet to the websocket
    async signMessage(message: string): Promise<any> {
        return this.sendRequest(MessageType.SIGN_RAW_MESSAGE, message);
    }

    private sendRequest(messageType: MessageType, params: any = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.connection.ws || this.connection.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error("Not connected."));
            }

            const requestId = generateRequestId();

            this.connection.ws.send(JSON.stringify({
                request_id: requestId,
                type: messageType,
                payload: params,
            }));

            const intervalTime = 300; // 300ms
            let elapsedTime = 0;

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
                    if (elapsedTime >= this.requestTimeout) {
                        clearInterval(intervalId);
                        this.requests.delete(requestId);
                        reject(new RequestTimeoutError(this.requestTimeout));
                    }
                }
            }, intervalTime);
        });
    }
}