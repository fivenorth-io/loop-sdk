import * as forge from 'node-forge';
import { Provider, type ProviderHooks } from '../provider';
import { Connection } from '../connection';
import { SessionInfo } from '../session';
import type { Network, TransferRequest, PreparedTransferPayload, TransferOptions, Instrument, TransactionPayload, PreparedSubmissionResponse, ExecuteSubmissionResquest } from '../types';
import { time } from 'console';

export const getSigner = (privateKeyHex: string, partyId: string): Signer => {
    return new Signer(privateKeyHex, partyId);
}

export class Signer {
    private privateKey: Uint8Array<ArrayBuffer>;
    private publicKey: Uint8Array<ArrayBuffer>;
    private publicKeyHex: string;
    private partyId: string;

    constructor(privateKeyHex: string, partyId: string) {
        if (!privateKeyHex || !partyId) {
            throw new Error('Private key and party ID are required');
        }

        this.privateKey = forge.util.hexToBytes(privateKeyHex);
        this.partyId = partyId;
        this.publicKey = forge.pki.ed25519.publicKeyFromPrivateKey({
            privateKey: this.privateKey,
        });
        this.publicKeyHex = forge.util.bytesToHex(this.publicKey);
    }

    public getPublicKey(): string {
        return this.publicKeyHex;
    }

    public signMessage(message: string): Uint8Array<ArrayBuffer> {
        return forge.pki.ed25519.sign({
            message: message,
            encoding: 'utf8',
            privateKey: this.privateKey,
        });
    }

    public signMessageAsHex(message: string): string {
        const signature = forge.pki.ed25519.sign({
            message: message,
            encoding: 'utf8',
            privateKey: this.privateKey,
        });
        return forge.util.bytesToHex(signature);
    }

    public getPartyId(): string {
        return this.partyId;
    }

    // sign the transaction hash in base64 format and return the signature in hex format
    public signTransactionHash(transactionHash: string): string {
        if (!transactionHash) {
            throw new Error('Transaction hash is required');
        }

        // Now we will sign the transaction hash
        const signedRequest = forge.pki.ed25519.sign({
            message: forge.util.decode64(transactionHash),
            encoding: 'binary',
            privateKey: this.privateKey,
        });   
        return forge.util.bytesToHex(signedRequest);
    }
}

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

    init({signer, network, walletUrl, apiUrl}: {signer: Signer, network?: Network, walletUrl?: string, apiUrl?: string}) {
        this.signer = signer;
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
        const preparedPayload = await this.provider?.prepareSubmission(payload);
        if (!preparedPayload) {
            throw new Error('Failed to prepare submission');
        }
        // Now we will sign the transaction hash
        const signedTransactionHash = this.getSigner().signTransactionHash(preparedPayload.transaction_hash);

        // Now we will submit the signed transaction to ledger
        const submissionResponse = await this.provider?.executeSubmission({
            command_id: preparedPayload.command_id,
            transaction_data: preparedPayload.transaction_data,
            signature: signedTransactionHash,
        });

        console.log("submittedTransaction", submissionResponse);
        return submissionResponse;
    }
}

export const loop = new LoopSDK();