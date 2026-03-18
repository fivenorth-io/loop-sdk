import type {
    Network,
    Account,
    Holding,
    TransferRequest,
    PreparedTransferPayload,
    ConnectTransferResponse,
    ExchangeApiKeyResponse,
    TransactionPayload,
    PreparedSubmissionResponse,
    ExecuteSubmissionResquest,
    PendingGasResponse,
    EstimatedGasResponse,
} from './types';
import { PaymentRequiredError, UnauthorizedError } from './errors';
import { SessionInfo } from './session';
import { generateRequestId } from './provider';

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
            throw new Error('Failed to get holdings. ' + await response.text());
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
        if (params.memo) {
            payload.memo = params.memo;
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
            console.error('Failed to prepare transfer.', await response.text());
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

    // exchangeApiKey is used to exchange the API key for the public key and signature to use in a server session
    async exchangeApiKey({publicKey, signature, epoch}: {publicKey: string, signature: string, epoch: number}): Promise<ExchangeApiKeyResponse> {
        const response = await fetch(`${this.apiUrl}/api/v1/.connect/pair/apikey`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                public_key: publicKey,
                signature: signature,
                epoch: epoch,
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get API key from server.');
        }

        return response.json();
    }

    private async parseErrorResponse(response: Response): Promise<any> {
        const text = await response.text();
        if (!text) {
            return null;
        }
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    private errorMessage(details: any, fallback: string): string {
        if (typeof details === 'string' && details.length > 0) {
            return details;
        }
        if (typeof details?.message === 'string' && details.message.length > 0) {
            return details.message;
        }
        return fallback;
    }

    // send transaction to v2/interactive-submisison/prepare endpoint to get the prepared transaction
    async prepareTransaction(session: SessionInfo, params: TransactionPayload): Promise<PreparedSubmissionResponse> {
        const response = await fetch(`${this.apiUrl}/api/v1/.connect/tickets/prepare-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.userApiKey}`,
            },
            body: JSON.stringify({
                payload: params,
                ticket_id: session.ticketId!,
            })
        });

        if (response.status === 402) {
            throw new PaymentRequiredError(await this.parseErrorResponse(response));
        }
        if (!response.ok) {
            const details = await this.parseErrorResponse(response);
            throw new Error(this.errorMessage(details, `Failed to prepare transaction with status ${response.status}.`));
        }

        return response.json();
    }

    async estimateGas(session: SessionInfo, params: TransactionPayload): Promise<EstimatedGasResponse> {
        const response = await fetch(`${this.apiUrl}/api/v1/.connect/tickets/estimate-gas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.userApiKey}`,
            },
            body: JSON.stringify({
                ticket_id: session.ticketId!,
                request_id: generateRequestId(),
                payload: {
                    commands: params.commands,
                    disclosedContracts: params.disclosedContracts,
                    packageIdSelectionPreference: params.packageIdSelectionPreference,
                    actAs: params.actAs,
                    readAs: params.readAs,
                    synchronizerId: params.synchronizerId,
                },
            }),
        });

        if (!response.ok) {
            const details = await this.parseErrorResponse(response);
            throw new Error(this.errorMessage(details, `Failed to estimate gas with status ${response.status}.`));
        }

        const data = await response.json();
        return {
            requires_gas: data?.requiresFee,
            can_execute: data?.canExecute,
            estimated_gas_amount: data?.estimatedFeeAmount,
            estimated_gas_asset: data?.estimatedFeeAsset,
        } as EstimatedGasResponse;
    }

    async estimateGasForConnect(authToken: string, params: TransactionPayload): Promise<EstimatedGasResponse> {
        const response = await fetch(`${this.apiUrl}/api/v1/.connect/tickets/transaction/estimate-gas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                request_id: generateRequestId(),
                tx: {
                    commands: params.commands,
                    disclosedContracts: params.disclosedContracts,
                    packageIdSelectionPreference: params.packageIdSelectionPreference,
                    actAs: params.actAs,
                    readAs: params.readAs,
                    synchronizerId: params.synchronizerId,
                },
            }),
        });

        if (!response.ok) {
            const details = await this.parseErrorResponse(response);
            throw new Error(this.errorMessage(details, `Failed to estimate gas with status ${response.status}.`));
        }

        const data = await response.json();
        return {
            requires_gas: data?.requiresFee,
            can_execute: data?.canExecute,
            estimated_gas_amount: data?.estimatedFeeAmount,
            estimated_gas_asset: data?.estimatedFeeAsset,
        } as EstimatedGasResponse;
    }

    // execute a signed transaction with v2/interactive-submisison/execute endpoint
    async executeTransaction(session: SessionInfo, params: ExecuteSubmissionResquest): Promise<PreparedSubmissionResponse> {
        if (!session.ticketId) {
            throw new Error('Ticket ID is required');
        }

        const response = await fetch(`${this.apiUrl}/api/v1/.connect/tickets/execute-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.userApiKey}`,
            },
            body: JSON.stringify({
                ticket_id: session.ticketId!,
                request_id: generateRequestId(),
                command_id: params.command_id,
                signature: params.signature,
                transaction_data: params.transaction_data,
                deduplication_period: params.deduplication_period,
            }),
        });

        if (response.status === 402) {
            throw new PaymentRequiredError(await this.parseErrorResponse(response));
        }
        if (!response.ok) {
            const details = await this.parseErrorResponse(response);
            throw new Error(this.errorMessage(details, `Failed to execute transaction with status ${response.status}.`));
        }

        return response.json();
    }

    async getPendingGas(userApiKey: string, trackingId?: string): Promise<PendingGasResponse> {
        const url = new URL(`${this.apiUrl}/api/v1/transfer/pending-fee`);
        if (trackingId) {
            url.searchParams.set('tracking_id', trackingId);
        }
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userApiKey}`,
            },
        });

        if (!response.ok) {
            const details = await this.parseErrorResponse(response);
            throw new Error(this.errorMessage(details, 'Failed to get pending gas.'));
        }

        return await response.json() as PendingGasResponse;
    }

    async preparePendingGas(userApiKey: string, trackingId?: string): Promise<{ transaction_hash: string }> {
        const response = await fetch(`${this.apiUrl}/api/v1/transfer/pending-fee/prepare`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userApiKey}`,
            },
            body: JSON.stringify(trackingId ? { tracking_id: trackingId } : {}),
        });

        if (!response.ok) {
            const details = await this.parseErrorResponse(response);
            throw new Error(this.errorMessage(details, 'Failed to prepare pending gas.'));
        }

        return response.json();
    }

    async executePendingGas(userApiKey: string, params: { transaction_hash: string; signature: string }): Promise<any> {
        const response = await fetch(`${this.apiUrl}/api/v1/transfer/pending-fee/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userApiKey}`,
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const details = await this.parseErrorResponse(response);
            throw new Error(this.errorMessage(details, 'Failed to execute pending gas.'));
        }

        return response.json();
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
