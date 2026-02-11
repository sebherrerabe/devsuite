import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export class TokenCipher {
  private constructor(private readonly key: Buffer) {}

  static fromBase64(encodedKey: string): TokenCipher {
    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== 32) {
      throw new Error(
        'DEVSUITE_GH_SERVICE_ENCRYPTION_KEY must decode to exactly 32 bytes'
      );
    }

    return new TokenCipher(key);
  }

  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty token');
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      VERSION,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted token format');
    }

    const [version, ivB64, authTagB64, ciphertextB64] = parts;
    if (!version || !ivB64 || !authTagB64 || !ciphertextB64) {
      throw new Error('Encrypted token payload is missing parts');
    }

    if (version !== VERSION) {
      throw new Error(`Unsupported encrypted token version: ${version}`);
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');

    if (!plaintext) {
      throw new Error('Decrypted token is empty');
    }

    return plaintext;
  }
}
