import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const DEFAULT_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

interface TokenCipherOptions {
  keyVersion?: string;
  legacyKeys?: Record<string, string>;
}

export class TokenCipher {
  private constructor(
    private readonly activeVersion: string,
    private readonly keys: Map<string, Buffer>
  ) {}

  get version(): string {
    return this.activeVersion;
  }

  private static decodePrimaryKey(encodedKey: string): Buffer {
    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== 32) {
      throw new Error(
        'DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY must decode to exactly 32 bytes'
      );
    }
    return key;
  }

  private static decodeLegacyKey(version: string, encodedKey: string): Buffer {
    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== 32) {
      throw new Error(
        `Legacy encryption key "${version}" must decode to exactly 32 bytes`
      );
    }
    return key;
  }

  static fromBase64(
    encodedKey: string,
    options: TokenCipherOptions = {}
  ): TokenCipher {
    const keyVersion = options.keyVersion?.trim() || DEFAULT_VERSION;
    if (!/^[A-Za-z0-9._-]+$/.test(keyVersion)) {
      throw new Error(
        'DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY_VERSION contains invalid characters'
      );
    }

    const keys = new Map<string, Buffer>();
    keys.set(keyVersion, this.decodePrimaryKey(encodedKey));
    for (const [version, legacyKey] of Object.entries(
      options.legacyKeys ?? {}
    )) {
      if (!version || version === keyVersion) {
        continue;
      }
      keys.set(version, this.decodeLegacyKey(version, legacyKey));
    }

    return new TokenCipher(keyVersion, keys);
  }

  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty token');
    }

    const iv = randomBytes(IV_BYTES);
    const key = this.keys.get(this.activeVersion);
    if (!key) {
      throw new Error('Active encryption key is not configured');
    }
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      this.activeVersion,
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

    const key = this.keys.get(version);
    if (!key) {
      throw new Error(`Unsupported encrypted token version: ${version}`);
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
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
