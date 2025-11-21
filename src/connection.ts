import type { Network, Account, Holding } from './types';

export class Connection {
    public walletUrl: string = 'https://cantonloop.com';
    public apiUrl: string = 'https://cantonloop.com';
    public ws: WebSocket | null = null;
    private network: Network = 'main';

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

    async verifySession(authToken: string): Promise<Account> {
        const response = await fetch(`${this.apiUrl}/api/v1/.connect/pair/account`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Session verification failed.');
        }

        const data = await response.json();

        if (!data?.party_id || !data?.public_key) {
            throw new Error('Invalid session verification response.');
        }
        // Map fields from the response to the account object, handling camelCase and snake_case.
        const account: Account = {
            party_id: data?.party_id,
            auth_token: authToken,
            public_key: data?.public_key,
        };
        return account;
    }

    private websocketUrl(ticketId: string): string {
        return `${this.network === 'local' ? 'ws' : 'wss'}://${this.apiUrl.replace('https://', '').replace('http://', '')}/api/v1/.connect/pair/ws/${ticketId}`;
    }

    connectWebSocket(ticketId: string, onMessage: (event: MessageEvent) => void) {
        const wsUrl = this.websocketUrl(ticketId);
        this.ws = new WebSocket(wsUrl);
        this.ws.onmessage = onMessage;
        
        this.ws.onopen = () => {
          console.log('Connected to ticket server.');
        };
    
        this.ws.onclose = () => {
          console.log('Disconnected from ticket server.');
        };
    }
}
