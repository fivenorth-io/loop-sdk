import type { Network, Account, Holding, TransferRequest, PreparedTransferPayload, ConnectTransferResponse } from './types';
import { UnauthorizedError } from './errors';


export class Connection {
    public walletUrl: string = 'https://cantonloop.com';
    public apiUrl: string = 'https://cantonloop.com';
    public ws: WebSocket | null = null;
    private network: Network = 'main';
    private ticketId: string | null = null;
    private onMessageHandler: ((event: MessageEvent) => void) | null = null;
    private reconnectPromise: Promise<void> | null = null;
    private status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

    constructor({ network, walletUrl, apiUrl }: { network?: Network, walletUrl?: string, apiUrl?: string }) {
        this.network = network || 'main';
        
        // Set default common value based on network
        switch (this.network) {
            case 'local':
                this.walletUrl = 'http://localhost:3000';
                this.apiUrl = 'http://localhost:8080';
                break;
            case 'devnet':
            case 'dev':
                this.walletUrl = 'https://devnet.cantonloop.com';
                this.apiUrl = 'https://devnet.cantonloop.com';
                break;
            case 'testnet':
            case 'test':
                this.walletUrl = 'https://testnet.cantonloop.com';
                this.apiUrl = 'https://testnet.cantonloop.com';
                break;
            case 'mainnet':
            case 'main':
                this.walletUrl = 'https://cantonloop.com';
                this.apiUrl = 'https://cantonloop.com';
                break;
        }

        // More useful when developing locally
        if (walletUrl) {
            this.walletUrl = walletUrl;
        }
        if (apiUrl) {
            this.apiUrl = apiUrl;
        }
    }

    connectInProgress(): boolean {
        return this.status === 'connecting' || this.status === 'connected';
    }

    async getTicket(appName: string, sessionId: string, version: string): Promise<{ ticket_id: string }> {
        const response = await fetch(`${this.apiUrl}/api/v1/.connect/pair/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                app_name: appName,
                session_id: sessionId,
                version: version,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to get ticket from server.');
        }

        return response.json();
    }

    async getHolding(authToken: string): Promise<Holding[]> {
        const response = await fetch(`${this.apiUrl}/api/v1/.connect/pair/account/holding`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to get holdings.');
        }

        return response.json();
    }

    async getActiveContracts(authToken: string, params?: { templateId?: string; interfaceId?: string }): Promise<any[]> {
        const url = new URL(`${this.apiUrl}/api/v1/.connect/pair/account/active-contracts`);
        if (params?.templateId) {
            url.searchParams.append('templateId', params.templateId);
        }
        if (params?.interfaceId) {
            url.searchParams.append('interfaceId', params.interfaceId);
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to get active contracts.');
        }

        return response.json();
    }

    async prepareTransfer(authToken: string, params: TransferRequest): Promise<PreparedTransferPayload> {
        const payload: Record<string, any> = {
            recipient: params.recipient,
            amount: params.amount,
        };

        if (params.instrument) {
            if (params.instrument.instrument_admin) {
                payload.instrument_admin = params.instrument.instrument_admin;
            }
            if (params.instrument.instrument_id) {
                payload.instrument_id = params.instrument.instrument_id;
            }
        }

        if (params.requested_at) {
            payload.requested_at = params.requested_at;
        }

        if (params.execute_before) {
            payload.execute_before = params.execute_before;
        }

        const response = await fetch(`${this.apiUrl}/api/v1/.connect/pair/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error('Failed to prepare transfer.');
        }

        const data: ConnectTransferResponse = await response.json();
        return data.payload;
    }

    async verifySession(authToken: string): Promise<Account> {
        const response = await fetch(`${this.apiUrl}/api/v1/.connect/pair/account`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new UnauthorizedError();
            }
            throw new Error(`Session verification failed with status ${response.status}.`);
        }

        const data = await response.json();
        const email = data?.email;

        if (!data?.party_id || !data?.public_key) {
            throw new Error('Invalid session verification response.');
        }
        // Map fields from the response to the account object, handling camelCase and snake_case.
        const account: Account = {
            party_id: data?.party_id,
            auth_token: authToken,
            public_key: data?.public_key,
            email,
            has_preapproval: data?.has_preapproval,
            has_merge_delegation: data?.has_merge_delegation,
            usdc_bridge_access: data?.usdc_bridge_access,
        };
        return account;
    }

    connectWebSocket(ticketId: string, onMessage: (event: MessageEvent) => void) {
        if (
            this.ws &&
            (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) &&
            this.ticketId !== ticketId
        ) {
            // When connecting to a new ticket, we need to close the existing socket first
            this.ws.close();
            this.ws = null;
        }

        // prevent opening multiple sockets for same ticket
        if (this.status === 'connecting' || this.status === 'connected') {
            return;
        }

        // set the message handler and ticket id to re-use for reconnecting
        this.onMessageHandler = onMessage;
        this.ticketId = ticketId;

        this.status = 'connecting';
        this.attachWebSocket(ticketId, onMessage);
    }
   
    reconnect(): Promise<void> {
        if (!this.ticketId || !this.onMessageHandler) {
            return Promise.reject(new Error('Cannot reconnect without a known ticket.'));
        }

        return new Promise<void>((resolve, reject) => {
            let opened = false;
            this.attachWebSocket(
                this.ticketId!,
                this.onMessageHandler!,
                () => {
                    opened = true;
                    resolve();
                },
                () => {
                    if (opened) {
                        return;
                    }
                    reject(new Error('Failed to reconnect to ticket server.'));
                },
                () => {
                    if (opened) {
                        return;
                    }
                    reject(new Error('Failed to reconnect to ticket server.'));
                },
            );
        });
    }

    private websocketUrl(ticketId: string): string {
        return `${this.network === 'local' ? 'ws' : 'wss'}://${this.apiUrl.replace('https://', '').replace('http://', '')}/api/v1/.connect/pair/ws/${encodeURIComponent(ticketId)}`;
    }

    // attachWebSocket is a helper function to setup even handler on a websocket object and assign to our ws 
    private attachWebSocket(
        ticketId: string,
        onMessage: (event: MessageEvent) => void,
        onOpen?: () => void,
        onError?: (event: Event) => void,
        onClose?: (event: CloseEvent) => void,
    ) {
        const wsUrl = this.websocketUrl(ticketId);
        const ws = new WebSocket(wsUrl);

        ws.onmessage = onMessage;
        ws.onopen = () => {
            this.status = 'connected';
            console.log('[LoopSDK] Connected to ticket server.');
            onOpen?.();
        };
        ws.onclose = (event: CloseEvent) => {
            this.status = 'disconnected';
            if (this.ws === ws) {
                this.ws = null;
            }
            console.log('[LoopSDK] Disconnected from ticket server.');
            onClose?.(event);
        };
        ws.onerror = (event) => {
            // if it's already close, another close is a no-op
            this.status = 'disconnected';
            ws.close();

            if (this.ws === ws) {
                this.ws = null;
            }
            onError?.(event);
        };

        this.ws = ws;
    }
}
