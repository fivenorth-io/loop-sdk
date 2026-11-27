import { expect, test } from 'bun:test';
import forge from 'node-forge';
import { Signer } from '../src/server/signer';

const keys = forge.pki.ed25519.generateKeyPair({ seed: 'loop-sdk-signer-test-seed-32byte' });
const signer = new Signer(Buffer.from(keys.privateKey).toString('hex'), `alice::1220${'ab'.repeat(32)}`);
const base64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

test('signs a 32-byte transaction hash', () => {
  const hash = Array.from({ length: 32 }, (_, i) => i * 7);
  const signature = signer.signTransactionHash(base64(hash));
  expect(forge.pki.ed25519.verify({
    message: Buffer.from(hash),
    signature: Buffer.from(signature, 'hex'),
    publicKey: keys.publicKey,
  })).toBe(true);
});

test('throws when the transaction hash is not 32 bytes', () => {
  for (let length = 1; length <= 64; length++) {
    if (length === 32) continue;
    expect(() => signer.signTransactionHash(base64(Array(length).fill(1)))).toThrow('Transaction hash must be 32 bytes');
  }
});
