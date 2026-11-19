/**
 * Local Web Crypto API vault supporting both transparent (non-extractable IndexedDB key)
 * and passphrase-derived (PBKDF2 + AES-GCM-256) encryption for API keys.
 */

export type EncryptionMode = 'transparent' | 'passphrase';

export interface EncryptedPayload {
  version: 1;
  mode: EncryptionMode;
  iv: string;          // Base64-encoded 12-byte AES-GCM IV
  ciphertext: string;  // Base64-encoded encrypted bytes
  salt?: string;       // Base64-encoded 16-byte PBKDF2 salt (passphrase mode only)
  iterations?: number; // PBKDF2 iteration count (passphrase mode only)
}

const VAULT_DB_NAME = 'muzen-ai-vault';
const VAULT_DB_VERSION = 1;
const VAULT_STORE_NAME = 'keys';
const TRANSPARENT_KEY_ID = 'device-aes-gcm-key';
const PBKDF2_ITERATIONS = 210_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
        db.createObjectStore(VAULT_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open vault IndexedDB'));
  });
}

async function idbGetKey(db: IDBDatabase, id: string): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
    const req = tx.objectStore(VAULT_STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error ?? new Error('Failed to read key from IndexedDB'));
  });
}

async function idbPutKey(db: IDBDatabase, id: string, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
    const req = tx.objectStore(VAULT_STORE_NAME).put(key, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('Failed to store key in IndexedDB'));
  });
}

/**
 * Retrieve or lazily create a non-extractable AES-GCM-256 key stored in IndexedDB.
 */
async function getOrCreateTransparentKey(): Promise<CryptoKey> {
  const db = await openVaultDb();
  try {
    const existing = await idbGetKey(db, TRANSPARENT_KEY_ID);
    if (existing) {
      return existing;
    }

    // extractable: false prevents reading raw key material via JS
    const newKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    await idbPutKey(db, TRANSPARENT_KEY_ID, newKey);
    return newKey;
  } finally {
    db.close();
  }
}

/**
 * Derive an AES-GCM-256 key from a user passphrase using PBKDF2-SHA256.
 */
async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptWithKey(plaintext: string, key: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer))
  };
}

async function decryptWithKey(ivB64: string, ciphertextB64: string, key: CryptoKey): Promise<string> {
  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(ciphertextB64);
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plainBuffer);
}

export async function encryptSecretTransparent(plaintext: string): Promise<EncryptedPayload> {
  const key = await getOrCreateTransparentKey();
  const { iv, ciphertext } = await encryptWithKey(plaintext, key);
  return {
    version: 1,
    mode: 'transparent',
    iv,
    ciphertext
  };
}

export async function encryptSecretWithPassphrase(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
  if (!passphrase) {
    throw new Error('Passphrase must not be empty');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyFromPassphrase(passphrase, salt, PBKDF2_ITERATIONS);
  const { iv, ciphertext } = await encryptWithKey(plaintext, key);
  return {
    version: 1,
    mode: 'passphrase',
    iv,
    ciphertext,
    salt: bytesToBase64(salt),
    iterations: PBKDF2_ITERATIONS
  };
}

export async function decryptSecret(payload: EncryptedPayload, passphrase?: string): Promise<string> {
  if (payload.mode === 'transparent') {
    const key = await getOrCreateTransparentKey();
    return decryptWithKey(payload.iv, payload.ciphertext, key);
  }

  if (!passphrase) {
    throw new Error('Passphrase required to unlock encrypted secret');
  }
  if (!payload.salt) {
    throw new Error('Missing PBKDF2 salt in encrypted payload');
  }

  const salt = base64ToBytes(payload.salt);
  const iterations = payload.iterations ?? PBKDF2_ITERATIONS;
  const key = await deriveKeyFromPassphrase(passphrase, salt, iterations);
  return decryptWithKey(payload.iv, payload.ciphertext, key);
}
