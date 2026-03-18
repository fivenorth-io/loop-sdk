import forge from 'node-forge';

export const getSigner = (privateKeyHex: string, partyId: string): Signer => {
    return new Signer(privateKeyHex, partyId);
}

export class Signer {
    private privateKey: forge.Bytes;
    private publicKey: forge.Bytes;
    private publicKeyHex: string;
    private partyId: string;

    constructor(privateKeyHex: string, partyId: string) {
        if (!privateKeyHex || !partyId) {
            throw new Error('Private key and party ID are required');
        }

        this.privateKey = forge.util.hexToBytes(privateKeyHex);
        this.partyId = partyId;
        const publicKey = forge.pki.ed25519.publicKeyFromPrivateKey({
            privateKey: this.privateKey,
        }) as unknown as forge.Bytes;
        this.publicKey = publicKey;
        this.publicKeyHex = forge.util.bytesToHex(publicKey);
    }

    public getPublicKey(): string {
        return this.publicKeyHex;
    }

    public signMessage(message: string): forge.Bytes {
        return forge.pki.ed25519.sign({
            message: message,
            encoding: 'utf8',
            privateKey: this.privateKey,
        }) as unknown as forge.Bytes;
    }

    public signMessageAsHex(message: string): string {
        const signature = forge.pki.ed25519.sign({
            message: message,
            encoding: 'utf8',
            privateKey: this.privateKey,
        }) as unknown as forge.Bytes;
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
        }) as unknown as forge.Bytes;
        return forge.util.bytesToHex(signedRequest);
    }
}
