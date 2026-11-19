import {
  ConfigSnapshot,
  computeConfigDelta,
  materializeConfigDelta,
  sanitizeDeltaRecord
} from './configSchema';

export interface CursorPreset {
  id: string;
  name: string;
  description?: string;
  delta: Record<string, number | boolean | string>;
  updatedAt: number;
}

export interface PresetSummary {
  id: string;
  name: string;
  description?: string;
}

const STORAGE_KEY_PRESETS = 'muzen_presets_v1';
const MAX_PRESETS = 20;
// Keep a comfortable safety margin under Chrome's 8,192-byte QUOTA_BYTES_PER_ITEM limit
const MAX_SYNC_ITEM_BYTES = 7400;

function hasChromeSyncStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.sync);
}

function normalizePresetRecord(raw: unknown): CursorPreset | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const name = typeof item.name === 'string' ? item.name.trim().slice(0, 40) : '';
  if (!id || !name) return null;

  const description =
    typeof item.description === 'string' && item.description.trim().length > 0
      ? item.description.trim().slice(0, 100)
      : undefined;
  const updatedAt =
    typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : Date.now();

  return {
    id,
    name,
    ...(description ? { description } : {}),
    delta: sanitizeDeltaRecord(item.delta),
    updatedAt
  };
}

function sortPresetsByUpdated(presets: CursorPreset[]): CursorPreset[] {
  return [...presets].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function readRawPresets(): Promise<unknown[]> {
  if (hasChromeSyncStorage()) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_KEY_PRESETS], (res) => {
        const stored = res[STORAGE_KEY_PRESETS];
        resolve(Array.isArray(stored) ? stored : []);
      });
    });
  }

  const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePresetsChecked(presets: CursorPreset[]): Promise<CursorPreset[]> {
  if (presets.length > MAX_PRESETS) {
    throw new Error('PRESET_LIMIT_REACHED');
  }

  const serialized = JSON.stringify(presets);
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  if (byteLength > MAX_SYNC_ITEM_BYTES) {
    throw new Error('PRESET_SYNC_QUOTA_EXCEEDED');
  }

  if (hasChromeSyncStorage()) {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.sync.set({ [STORAGE_KEY_PRESETS]: presets }, () => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  } else {
    localStorage.setItem(STORAGE_KEY_PRESETS, serialized);
  }

  return presets;
}

/**
 * Load all saved cursor presets sorted by most recently updated.
 */
export async function loadPresets(): Promise<CursorPreset[]> {
  const rawList = await readRawPresets();
  const normalized: CursorPreset[] = [];
  for (const item of rawList) {
    const clean = normalizePresetRecord(item);
    if (clean) normalized.push(clean);
  }
  return sortPresetsByUpdated(normalized);
}

/**
 * Save a new preset or update an existing preset (by ID or case-insensitive name).
 */
export async function savePreset(
  name: string,
  snapshot: ConfigSnapshot,
  description?: string,
  overwriteId?: string
): Promise<CursorPreset[]> {
  const cleanName = name.trim().slice(0, 40);
  if (!cleanName) {
    throw new Error('PRESET_NAME_REQUIRED');
  }

  const cleanDesc = description?.trim().slice(0, 100);
  const delta = sanitizeDeltaRecord(computeConfigDelta(snapshot));
  const current = await loadPresets();
  const now = Date.now();

  const existingIndex = current.findIndex(
    (p) =>
      (overwriteId && p.id === overwriteId) ||
      p.name.toLowerCase() === cleanName.toLowerCase()
  );

  let nextList: CursorPreset[];
  if (existingIndex !== -1) {
    const target = current[existingIndex];
    const updated: CursorPreset = {
      id: target.id,
      name: cleanName,
      ...(cleanDesc ? { description: cleanDesc } : {}),
      delta,
      updatedAt: now
    };
    nextList = [updated, ...current.filter((_, idx) => idx !== existingIndex)];
  } else {
    const newPreset: CursorPreset = {
      id: `preset_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      ...(cleanDesc ? { description: cleanDesc } : {}),
      delta,
      updatedAt: now
    };
    nextList = [newPreset, ...current];
  }

  return writePresetsChecked(sortPresetsByUpdated(nextList));
}

export async function deletePreset(id: string): Promise<CursorPreset[]> {
  const current = await loadPresets();
  const nextList = current.filter((p) => p.id !== id);
  return writePresetsChecked(nextList);
}

/**
 * Replace all presets in sync storage (e.g. when restoring from a backup folder).
 */
export async function replaceAllPresets(rawPresets: readonly CursorPreset[]): Promise<CursorPreset[]> {
  const dedupedById = new Map<string, CursorPreset>();
  for (const raw of rawPresets) {
    const clean = normalizePresetRecord(raw);
    if (clean) {
      dedupedById.set(clean.id, clean);
    }
  }
  const sorted = sortPresetsByUpdated(Array.from(dedupedById.values())).slice(0, MAX_PRESETS);
  return writePresetsChecked(sorted);
}

export function presetToSnapshot(preset: CursorPreset): ConfigSnapshot {
  return materializeConfigDelta(preset.delta);
}

export function toPresetSummaries(presets: readonly CursorPreset[]): PresetSummary[] {
  return presets.map((p) => ({
    id: p.id,
    name: p.name,
    ...(p.description ? { description: p.description } : {})
  }));
}
