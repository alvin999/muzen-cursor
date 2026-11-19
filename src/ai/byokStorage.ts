import {
  EncryptedPayload,
  EncryptionMode,
  decryptSecret,
  encryptSecretTransparent,
  encryptSecretWithPassphrase
} from './cryptoVault';

export type LlmProviderId =
  | 'openai'
  | 'openrouter'
  | 'groq'
  | 'gemini'
  | 'claude'
  | 'openai-compatible';

export interface ProviderPreset {
  id: LlmProviderId;
  label: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  allowsCustomBaseUrl: boolean;
}

export const PROVIDER_PRESETS: Record<LlmProviderId, ProviderPreset> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    allowsCustomBaseUrl: false
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    allowsCustomBaseUrl: false
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    allowsCustomBaseUrl: false
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresApiKey: true,
    allowsCustomBaseUrl: false
  },
  claude: {
    id: 'claude',
    label: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    allowsCustomBaseUrl: false
  },
  'openai-compatible': {
    id: 'openai-compatible',
    label: 'OpenAI Compatible (Ollama / Custom)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
    allowsCustomBaseUrl: true
  }
};

export interface ProviderProfileConfig {
  model: string;
  baseUrl?: string;
}

export interface ByokStoredState {
  version: 1;
  activeProvider: LlmProviderId;
  encryptionMode: EncryptionMode;
  profiles: Partial<Record<LlmProviderId, ProviderProfileConfig>>;
  encryptedKeys: Partial<Record<LlmProviderId, EncryptedPayload>>;
}

const STORAGE_KEY_BYOK = 'muzen_byok_state_v1';
const SESSION_KEY_PASSPHRASE = 'muzen_byok_session_passphrase';

const DEFAULT_BYOK_STATE: ByokStoredState = {
  version: 1,
  activeProvider: 'gemini',
  encryptionMode: 'transparent',
  profiles: {},
  encryptedKeys: {}
};

// In-memory unlocked passphrase cache for the current page lifetime
let memoryPassphrase: string | null = null;

function hasChromeLocalStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

function hasChromeSessionStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.session);
}

async function readLocalState(): Promise<ByokStoredState> {
  if (hasChromeLocalStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY_BYOK], (res) => {
        const stored = res[STORAGE_KEY_BYOK] as ByokStoredState | undefined;
        resolve(stored ? { ...DEFAULT_BYOK_STATE, ...stored } : { ...DEFAULT_BYOK_STATE });
      });
    });
  }

  const raw = localStorage.getItem(STORAGE_KEY_BYOK);
  if (!raw) return { ...DEFAULT_BYOK_STATE };
  try {
    return { ...DEFAULT_BYOK_STATE, ...(JSON.parse(raw) as Partial<ByokStoredState>) };
  } catch {
    return { ...DEFAULT_BYOK_STATE };
  }
}

async function writeLocalState(state: ByokStoredState): Promise<void> {
  if (hasChromeLocalStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY_BYOK]: state }, () => resolve());
    });
  }
  localStorage.setItem(STORAGE_KEY_BYOK, JSON.stringify(state));
}

async function getSessionPassphrase(): Promise<string | null> {
  if (memoryPassphrase) return memoryPassphrase;
  if (!hasChromeSessionStorage()) return null;

  return new Promise((resolve) => {
    chrome.storage.session.get([SESSION_KEY_PASSPHRASE], (res) => {
      const val = res[SESSION_KEY_PASSPHRASE];
      if (typeof val === 'string' && val.length > 0) {
        memoryPassphrase = val;
        resolve(val);
      } else {
        resolve(null);
      }
    });
  });
}

async function setSessionPassphrase(passphrase: string | null): Promise<void> {
  memoryPassphrase = passphrase;
  if (!hasChromeSessionStorage()) return;

  return new Promise((resolve) => {
    if (passphrase) {
      chrome.storage.session.set({ [SESSION_KEY_PASSPHRASE]: passphrase }, () => resolve());
    } else {
      chrome.storage.session.remove([SESSION_KEY_PASSPHRASE], () => resolve());
    }
  });
}

export async function loadByokState(): Promise<ByokStoredState> {
  return readLocalState();
}

export async function updateActiveProviderConfig(
  provider: LlmProviderId,
  profile: ProviderProfileConfig
): Promise<ByokStoredState> {
  const state = await readLocalState();
  const nextState: ByokStoredState = {
    ...state,
    activeProvider: provider,
    profiles: {
      ...state.profiles,
      [provider]: {
        model: profile.model.trim(),
        baseUrl: profile.baseUrl?.trim() || PROVIDER_PRESETS[provider].defaultBaseUrl
      }
    }
  };
  await writeLocalState(nextState);
  return nextState;
}

export async function saveApiKey(
  provider: LlmProviderId,
  apiKey: string,
  mode: EncryptionMode,
  passphrase?: string
): Promise<ByokStoredState> {
  const trimmed = apiKey.trim();
  const state = await readLocalState();

  const nextEncryptedKeys = { ...state.encryptedKeys };
  if (!trimmed) {
    delete nextEncryptedKeys[provider];
  } else if (mode === 'transparent') {
    nextEncryptedKeys[provider] = await encryptSecretTransparent(trimmed);
  } else {
    const activePassphrase = passphrase || (await getSessionPassphrase());
    if (!activePassphrase) {
      throw new Error('Passphrase is required to encrypt API key in passphrase mode');
    }
    nextEncryptedKeys[provider] = await encryptSecretWithPassphrase(trimmed, activePassphrase);
    await setSessionPassphrase(activePassphrase);
  }

  const nextState: ByokStoredState = {
    ...state,
    encryptionMode: mode,
    encryptedKeys: nextEncryptedKeys
  };
  await writeLocalState(nextState);
  return nextState;
}

export async function getDecryptedApiKey(provider: LlmProviderId): Promise<string | null> {
  const state = await readLocalState();
  const payload = state.encryptedKeys[provider];
  if (!payload) return null;

  if (payload.mode === 'transparent') {
    return decryptSecret(payload);
  }

  const passphrase = await getSessionPassphrase();
  if (!passphrase) {
    throw new Error('VAULT_LOCKED');
  }
  return decryptSecret(payload, passphrase);
}

/**
 * Unlock passphrase-encrypted keys and cache the passphrase in session memory.
 * Verifies against at least one stored passphrase-encrypted key if present.
 */
export async function unlockVaultWithPassphrase(passphrase: string): Promise<boolean> {
  if (!passphrase) return false;
  const state = await readLocalState();
  const passphraseEntries = Object.values(state.encryptedKeys).filter(
    (item): item is EncryptedPayload => Boolean(item && item.mode === 'passphrase')
  );

  for (const payload of passphraseEntries) {
    try {
      await decryptSecret(payload, passphrase);
    } catch {
      return false;
    }
  }

  await setSessionPassphrase(passphrase);
  return true;
}

export async function isVaultUnlocked(provider?: LlmProviderId): Promise<boolean> {
  const state = await readLocalState();
  const target = provider ?? state.activeProvider;
  const payload = state.encryptedKeys[target];
  if (!payload || payload.mode === 'transparent') return true;
  const passphrase = await getSessionPassphrase();
  return Boolean(passphrase);
}

export async function lockVault(): Promise<void> {
  await setSessionPassphrase(null);
}

/**
 * Re-encrypt all stored API keys when switching between transparent and passphrase modes.
 */
export async function switchEncryptionMode(
  targetMode: EncryptionMode,
  newPassphrase?: string,
  currentPassphrase?: string
): Promise<ByokStoredState> {
  const state = await readLocalState();
  const activeCurrentPass = currentPassphrase || (await getSessionPassphrase());
  const nextKeys: Partial<Record<LlmProviderId, EncryptedPayload>> = {};

  for (const [providerKey, payload] of Object.entries(state.encryptedKeys)) {
    if (!payload) continue;
    const providerId = providerKey as LlmProviderId;
    const plaintext =
      payload.mode === 'transparent'
        ? await decryptSecret(payload)
        : await decryptSecret(payload, activeCurrentPass ?? undefined);

    if (targetMode === 'transparent') {
      nextKeys[providerId] = await encryptSecretTransparent(plaintext);
    } else {
      if (!newPassphrase) {
        throw new Error('New passphrase is required');
      }
      nextKeys[providerId] = await encryptSecretWithPassphrase(plaintext, newPassphrase);
    }
  }

  if (targetMode === 'passphrase' && newPassphrase) {
    await setSessionPassphrase(newPassphrase);
  } else if (targetMode === 'transparent') {
    await setSessionPassphrase(null);
  }

  const nextState: ByokStoredState = {
    ...state,
    encryptionMode: targetMode,
    encryptedKeys: nextKeys
  };
  await writeLocalState(nextState);
  return nextState;
}

export async function clearAllByokKeys(): Promise<ByokStoredState> {
  await setSessionPassphrase(null);
  const state = await readLocalState();
  const nextState: ByokStoredState = {
    ...state,
    encryptedKeys: {}
  };
  await writeLocalState(nextState);
  return nextState;
}
