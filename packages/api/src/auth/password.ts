/**
 * PBKDF2 password hashing for Cloudflare Workers (Web Crypto API).
 * Stores as base64salt:base64hash.
 */

const ITERATIONS = 100_000;
const HASH_ALGORITHM = 'SHA-256';
const SALT_BYTES = 16;
const KEY_LENGTH = 32;

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALGORITHM },
    keyMaterial,
    KEY_LENGTH * 8,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveKey(password, salt);
  return `${toBase64(salt.buffer)}:${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':');
  if (!saltB64 || !hashB64) return false;
  const salt = fromBase64(saltB64);
  const hash = await deriveKey(password, salt);
  const storedHash = fromBase64(hashB64);
  const derivedHash = new Uint8Array(hash);
  if (storedHash.length !== derivedHash.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < storedHash.length; i++) {
    diff |= storedHash[i] ^ derivedHash[i];
  }
  return diff === 0;
}
