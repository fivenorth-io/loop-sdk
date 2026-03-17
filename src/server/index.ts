import { Provider, type ProviderHooks } from '../provider';
import { Connection } from '../connection';
import { SessionInfo } from '../session';
import type { Network, TransferRequest, PreparedTransferPayload, TransferOptions, Instrument, TransactionPayload, PreparedSubmissionResponse, ExecuteSubmissionResquest, PendingGasResponse, EstimatedGasResponse } from '../types';
import { time } from 'console';
import { getSigner, Signer } from './signer';

const PAY_GAS_WAIT_MS = 10_000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
class RpcProvider extends Provider {
    private ticket_id: string;
    private user_api_key: string;
    private session: SessionInfo;

    constructor({ connection, party_id, public_key, auth_token, ticket_id, user_api_key, email, hooks }: { connection: Connection, party_id: string, public_key: string, auth_token: string, ticket_id: string, user_api_key: string, email?: string, hooks?: ProviderHooks }) {
        super({ connection, party_id, public_key, auth_token, email, hooks });
        this.ticket_id = ticket_id;
        this.user_api_key = user_api_key;

        this.session = new SessionInfo({
            userApiKey: user_api_key,
            ticketId: ticket_id,
            partyId: party_id,
            publicKey: public_key,
            email: email,
            sessionId: "",
        });
    }

    public async prepareSubmission(payload: TransactionPayload): Promise<PreparedSubmissionResponse> {
        return await this.connection.prepareTransaction(this.session, payload);
    }

    public async executeSubmission(payload: ExecuteSubmissionResquest): Promise<PreparedSubmissionResponse> {
        return await this.connection.executeTransaction(this.session, payload);
    }

    public override async transfer(recipient: string, amount: string | number, instrument?: Instrument, options?: TransferOptions): Promise<any> {
        return await this.connection.prepareTransfer(this.getAuthToken(), {
            recipient,
            amount: amount.toString(),
            instrument: {
                instrument_admin: instrument?.instrument_admin,
                instrument_id: instrument?.instrument_id || 'Amulet',
            },
            requested_at: options?.requestedAt instanceof Date ? options?.requestedAt.toISOString() : options?.requestedAt || undefined,
            execute_before: options?.executeBefore instanceof Date ? options?.executeBefore.toISOString() : options?.executeBefore || undefined,
        });
    }
}

export class LoopSDK {
    private signer?: Signer;
    private provider?: RpcProvider;
    private connection?: Connection;
    private isAuthenticated: boolean = false;
    private session?: SessionInfo;

    init({privateKey, partyId, network, walletUrl, apiUrl}: { privateKey: string, partyId: string, network?: Network, walletUrl?: string, apiUrl?: string}) {
        this.signer = getSigner(privateKey, partyId);
        this.connection = new Connection({ network: network || 'local', walletUrl, apiUrl });

        this.isAuthenticated = false;
    }

    // authenticate the user with the signer
    // upon succesfully authenticated, the provider will be initialized and ready to send and sign tx
    public async authenticate(): Promise<void> {
        if (!this.signer || !this.connection) {
            throw new Error('Signer and connection are required');
        }

        const publicKey = this.signer.getPublicKey();
        const epoch = Date.now();
        const signature = this.signer.signMessageAsHex(`Exchange API Key for ${this.signer.getPartyId()}\nTimestamp: ${epoch}`);
        const apiKey = await this.connection.exchangeApiKey({publicKey, signature, epoch});

        if (!apiKey?.api_key) {
            throw new Error('Failed to get API key from server.');
        }
        this.isAuthenticated = true;

        this.session = new SessionInfo({
            userApiKey: apiKey?.api_key,
            authToken: apiKey?.auth_token,
            email: apiKey?.email,
            ticketId: apiKey?.ticket_id,
            sessionId: apiKey?.session_id,
            partyId: this.signer.getPartyId(),
            publicKey: publicKey,
        });

        this.provider = new RpcProvider({
            ticket_id: this.session?.ticketId!,
            connection: this.connection,
            party_id: this.signer.getPartyId(),
            user_api_key: apiKey?.api_key,
            auth_token: this.session?.authToken!,
            public_key: publicKey,
			email: this.session?.email,
        });
    }

    public getSigner(): Signer {
        if (!this.signer) {
            throw new Error('Signer not initialized');
        }
        return this.signer;
    }

    public getProvider(): Provider {
        if (!this.provider) {
            throw new Error('Provider not initialized');
        }
        return this.provider;
    }

    public async executeTransaction(payload: TransactionPayload): Promise<any> {
        if (!this.provider || !this.signer) {
            throw new Error('Provider and signer are required');
        }

        // Prepare the transaction with interactive submission to get unsigned transaction hash
        const preparedPayload = await this.provider?.prepareSubmission(payload);
        if (!preparedPayload) {
            throw new Error('Failed to prepare submission');
        }

        // now we sign the transaction hash which is base64 encoded from the response
        const signedTransactionHash = this.getSigner().signTransactionHash(preparedPayload.transaction_hash);

        // Combine the signed transaction hash with the transaction data to submit to the ledger
        const submissionResponse = await this.provider?.executeSubmission({
            command_id: preparedPayload.command_id,
            transaction_data: preparedPayload.transaction_data,
            signature: signedTransactionHash,
            deduplication_period: payload.deduplicationPeriod,
        });

        return submissionResponse;
    }

    public async checkDueGas(trackingId?: string): Promise<PendingGasResponse> {
        if (!this.connection || !this.session) {
            throw new Error('Provider and session are required');
        }

        return await this.connection.getPendingGas(this.session.userApiKey!, trackingId);
    }

    public async estimateGas(payload: TransactionPayload): Promise<EstimatedGasResponse> {
        if (!this.connection || !this.session) {
            throw new Error('Provider and session are required');
        }

        return await this.connection.estimateGas(this.session, payload);
    }

    public async payGas(trackingId: string): Promise<any> {
        if (!this.provider || !this.signer || !this.connection || !this.session) {
            throw new Error('Provider and signer are required');
        }

        const pendingGas = await this.checkDueGas(trackingId);
        if (!pendingGas.pending) {
            throw new Error(`Pending gas not found for tracking_id ${trackingId}.`);
        }

        const preparedGas = await this.connection.preparePendingGas(this.session.userApiKey!, trackingId);
        if (!preparedGas?.transaction_hash) {
            throw new Error('Failed to prepare pending gas.');
        }

        const signedTransactionHash = this.getSigner().signTransactionHash(preparedGas.transaction_hash);

        const result = await this.connection.executePendingGas(this.session.userApiKey!, {
            transaction_hash: preparedGas.transaction_hash,
            signature: signedTransactionHash,
        });

        await wait(PAY_GAS_WAIT_MS);

        return result;
    }
}

export const loop = new LoopSDK();
export * from '../errors';
export * from '../types';
