import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { defineSecret } from 'firebase-functions/params';

export const tokenEncryptionKey = defineSecret('TOKEN_ENCRYPTION_KEY');

function keyFromSecret(secret: string): Buffer {
  // Derive a 32-byte key from the secret string
  return scryptSync(secret, 'calm-money-plaid-v1', 32);
}

/** AES-256-GCM encrypt. Output: base64(iv):base64(tag):base64(ciphertext) */
export function encryptAccessToken(plaintext: string, secret: string): string {
  const key = keyFromSecret(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptAccessToken(payload: string, secret: string): string {
  // Backward compatible: if not in encrypted form, treat as legacy plaintext
  if (!payload.includes(':') || payload.split(':').length !== 3) {
    return payload;
  }
  const [ivB64, tagB64, dataB64] = payload.split(':');
  const key = keyFromSecret(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}
