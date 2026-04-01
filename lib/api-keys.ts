/**
 * API Key Management
 *
 * Keys are stored in a JSON file locally and in Upstash Redis on Vercel.
 * Format: swdc_<32 hex chars>
 * Storage: only the SHA-256 hash is persisted — the raw key is shown once on creation.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const KEYS_FILE = path.join(process.cwd(), 'data', 'api-keys.json');

export interface ApiKeyMeta {
  id: string;
  name: string;
  keyPrefix: string; // first 8 chars for display
  keyHash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface KeyStore {
  keys: ApiKeyMeta[];
}

// --- Storage layer (JSON file for now, can swap to Redis later) ---

async function loadStore(): Promise<KeyStore> {
  try {
    const data = await fs.readFile(KEYS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { keys: [] };
  }
}

async function saveStore(store: KeyStore): Promise<void> {
  const dir = path.dirname(KEYS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(KEYS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// --- Public API ---

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generate a new API key. Returns the raw key (shown once) and the metadata.
 */
export async function createApiKey(name: string): Promise<{ rawKey: string; meta: ApiKeyMeta }> {
  const rawKey = `swdc_${crypto.randomBytes(32).toString('hex')}`;
  const meta: ApiKeyMeta = {
    id: crypto.randomUUID(),
    name,
    keyPrefix: rawKey.slice(0, 13) + '...', // "swdc_ab12cd34..."
    keyHash: hashKey(rawKey),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };

  const store = await loadStore();
  store.keys.push(meta);
  await saveStore(store);

  return { rawKey, meta };
}

/**
 * Validate a raw API key. Returns the key metadata if valid, null otherwise.
 */
export async function validateApiKey(rawKey: string): Promise<ApiKeyMeta | null> {
  if (!rawKey.startsWith('swdc_')) return null;

  const keyHash = hashKey(rawKey);
  const store = await loadStore();

  const key = store.keys.find((k) => k.keyHash === keyHash);
  if (!key) return null;

  // Update last used timestamp
  key.lastUsedAt = new Date().toISOString();
  await saveStore(store).catch(() => {}); // best-effort on Vercel

  return key;
}

/**
 * List all API keys (metadata only — never returns raw keys).
 */
export async function listApiKeys(): Promise<ApiKeyMeta[]> {
  const store = await loadStore();
  return store.keys;
}

/**
 * Revoke an API key by ID.
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  const store = await loadStore();
  const before = store.keys.length;
  store.keys = store.keys.filter((k) => k.id !== id);
  if (store.keys.length === before) return false;
  await saveStore(store);
  return true;
}
