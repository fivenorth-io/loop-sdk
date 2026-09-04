import { Provider, type ProviderHooks } from '../provider';
import { Connection } from '../connection';
import { SessionInfo } from '../session';
import type { Network, TransferRequest, PreparedTransferPayload, TransferOptions, Instrument, TransactionPayload, PreparedSubmissionResponse, ExecuteSubmissionRequest, ExecuteSubmissionResponse, PendingGasResponse, EstimatedGasResponse, FeeBalanceResponse, FeeBalanceTopUpExecuteResponse, EnsureFeeBalanceOptions, EnsureFeeBalanceResponse } from '../types';
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
        });
    }

    public async prepareSubmission(payload: TransactionPayload): Promise<PreparedSubmissionResponse> {
        return await this.connection.prepareTransaction(this.session, payload);
    }

    public async executeSubmission(payload: ExecuteSubmissionRequest): Promise<ExecuteSubmissionResponse> {
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

    public async prepareSubmission(payload: TransactionPayload): Promise<PreparedSubmissionResponse> {
        if (!this.provider) {
            throw new Error('Provider is required');
        }

        return await this.provider.prepareSubmission(payload);
    }

    public async executeSubmission(payload: ExecuteSubmissionRequest): Promise<ExecuteSubmissionResponse> {
        if (!this.provider) {
            throw new Error('Provider is required');
        }

        return await this.provider.executeSubmission(payload);
    }

    public async executeTransaction(payload: TransactionPayload): Promise<ExecuteSubmissionResponse> {
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

    public async getFeeBalance(): Promise<FeeBalanceResponse> {
        if (!this.connection || !this.session) {
            throw new Error('Provider and session are required');
        }

        return await this.connection.getTrafficAccount(this.session.userApiKey!);
    }

    public async getGasBalance(): Promise<FeeBalanceResponse> {
        return await this.getFeeBalance();
    }

    public async topUpFeeBalance(amountCC: string | number): Promise<FeeBalanceTopUpExecuteResponse> {
        if (!this.connection || !this.session || !this.signer) {
            throw new Error('Provider and signer are required');
        }

        const preparedTopUp = await this.connection.prepareTrafficTopUp(this.session.userApiKey!, amountCC);
        if (!preparedTopUp?.hash) {
            throw new Error('Failed to prepare Fee Balance top-up.');
        }

        const signedTransactionHash = this.getSigner().signTransactionHash(preparedTopUp.hash);

        return await this.connection.executeTrafficTopUp(this.session.userApiKey!, {
            transaction_hash: preparedTopUp.hash,
            signature: signedTransactionHash,
        });
    }

    public async ensureFeeBalance(options: EnsureFeeBalanceOptions): Promise<EnsureFeeBalanceResponse> {
        const requiredCC = Number(options.requiredCC);
        const reserveCC = options.reserveCC === undefined ? 10 : Number(options.reserveCC);
        const topUpAmountCC = options.topUpAmountCC === undefined ? 25 : Number(options.topUpAmountCC);

        if (!Number.isFinite(requiredCC) || requiredCC < 0) {
            throw new Error('requiredCC must be a non-negative number.');
        }
        if (!Number.isFinite(reserveCC) || reserveCC < 0) {
            throw new Error('reserveCC must be a non-negative number.');
        }
        if (!Number.isFinite(topUpAmountCC) || topUpAmountCC <= 0) {
            throw new Error('topUpAmountCC must be greater than 0.');
        }

        const balanceBefore = await this.getFeeBalance();
        const currentBalanceCC = Number(balanceBefore.balance_cc);
        if (!Number.isFinite(currentBalanceCC)) {
            throw new Error('Could not determine current Fee Balance.');
        }

        const requiredWithReserveCC = requiredCC + reserveCC;
        if (currentBalanceCC >= requiredWithReserveCC) {
            return {
                topped_up: false,
                required_cc: requiredCC.toString(),
                reserve_cc: reserveCC.toString(),
                top_up_amount_cc: topUpAmountCC.toString(),
                balance_before: balanceBefore,
            };
        }

        const shortfallCC = requiredWithReserveCC - currentBalanceCC;
        const amountToTopUpCC = Math.max(topUpAmountCC, shortfallCC + reserveCC);
        const topUpResult = await this.topUpFeeBalance(amountToTopUpCC);
        const balanceAfter = await this.getFeeBalance();
        const balanceAfterCC = Number(balanceAfter.balance_cc);
        if (!Number.isFinite(balanceAfterCC) || balanceAfterCC < requiredWithReserveCC) {
            throw new Error('Fee Balance is still below the required amount after top-up.');
        }

        return {
            topped_up: true,
            required_cc: requiredCC.toString(),
            reserve_cc: reserveCC.toString(),
            top_up_amount_cc: amountToTopUpCC.toString(),
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            top_up_result: topUpResult,
        };
    }

    public async topUpGas(amountCC: string | number): Promise<FeeBalanceTopUpExecuteResponse> {
        return await this.topUpFeeBalance(amountCC);
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
            throw new Error('Failed to prepare legacy pending gas.');
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
