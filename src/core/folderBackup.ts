import {
  ConfigSnapshot,
  computeConfigDelta,
  materializeConfigDelta,
  sanitizeDeltaRecord
} from './configSchema';
import { CursorPreset } from './presetStorage';

export type FolderPermissionState = 'granted' | 'prompt' | 'denied';

interface BackupWritableStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface BackupFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<BackupWritableStream>;
}

interface BackupDirectoryHandle {
  readonly name: string;
  queryPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<FolderPermissionState>;
  requestPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<FolderPermissionState>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<BackupFileHandle>;
}

export interface FolderBackupFile {
  version: 1;
  app: 'muzen-cursor';
  exportedAt: string;
  currentDelta: Record<string, number | boolean | string>;
  presets: CursorPreset[];
}

export interface BoundFolderStatus {
  supported: boolean;
  bound: boolean;
  folderName: string | null;
  permission: FolderPermissionState | 'none';
}

const BACKUP_DB_NAME = 'muzen-folder-backup';
const BACKUP_DB_VERSION = 1;
const BACKUP_STORE_NAME = 'handles';
const BACKUP_HANDLE_KEY = 'backup-dir-handle';
const BACKUP_FILENAME = 'muzen-cursor-backup.json';

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
  }) => Promise<BackupDirectoryHandle>;
};

export function isFolderBackupSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function' &&
    typeof indexedDB !== 'undefined'
  );
}

function openBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        db.createObjectStore(BACKUP_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open backup IndexedDB'));
  });
}

async function loadDirectoryHandle(): Promise<BackupDirectoryHandle | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openBackupDb();
  try {
    return await new Promise<BackupDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE_NAME, 'readonly');
      const req = tx.objectStore(BACKUP_STORE_NAME).get(BACKUP_HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as BackupDirectoryHandle | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('Failed to read folder handle'));
    });
  } finally {
    db.close();
  }
}

async function storeDirectoryHandle(handle: BackupDirectoryHandle): Promise<void> {
  const db = await openBackupDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE_NAME, 'readwrite');
      const req = tx.objectStore(BACKUP_STORE_NAME).put(handle, BACKUP_HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to store folder handle'));
    });
  } finally {
    db.close();
  }
}

async function deleteDirectoryHandle(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openBackupDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE_NAME, 'readwrite');
      const req = tx.objectStore(BACKUP_STORE_NAME).delete(BACKUP_HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to remove folder handle'));
    });
  } finally {
    db.close();
  }
}

async function queryHandlePermission(
  handle: BackupDirectoryHandle,
  mode: 'read' | 'readwrite'
): Promise<FolderPermissionState> {
  if (!handle.queryPermission) return 'granted';
  try {
    return await handle.queryPermission({ mode });
  } catch {
    return 'prompt';
  }
}

export async function getBoundFolderStatus(): Promise<BoundFolderStatus> {
  if (!isFolderBackupSupported()) {
    return { supported: false, bound: false, folderName: null, permission: 'none' };
  }

  try {
    const handle = await loadDirectoryHandle();
    if (!handle) {
      return { supported: true, bound: false, folderName: null, permission: 'none' };
    }
    const permission = await queryHandlePermission(handle, 'readwrite');
    return {
      supported: true,
      bound: true,
      folderName: handle.name,
      permission
    };
  } catch {
    return { supported: true, bound: false, folderName: null, permission: 'none' };
  }
}

export async function bindBackupFolder(): Promise<{ folderName: string }> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error('FOLDER_API_UNSUPPORTED');
  }

  const handle = await picker({ id: 'muzen-cursor-backup', mode: 'readwrite' });
  await storeDirectoryHandle(handle);
  return { folderName: handle.name };
}

export async function requestBoundFolderPermission(): Promise<boolean> {
  const handle = await loadDirectoryHandle();
  if (!handle) return false;

  const current = await queryHandlePermission(handle, 'readwrite');
  if (current === 'granted') return true;

  if (!handle.requestPermission) return false;
  const next = await handle.requestPermission({ mode: 'readwrite' });
  return next === 'granted';
}

export async function unbindBackupFolder(): Promise<void> {
  await deleteDirectoryHandle();
}

/**
 * Write sanitized delta snapshot and presets (never API keys) to muzen-cursor-backup.json
 * inside the bound directory.
 */
export async function writeBackupToBoundFolder(
  snapshot: ConfigSnapshot,
  presets: readonly CursorPreset[],
  options?: { requestPermissionIfNeeded?: boolean }
): Promise<{
  written: boolean;
  reason?: 'unsupported' | 'not-bound' | 'needs-permission';
  folderName?: string;
}> {
  if (!isFolderBackupSupported()) {
    return { written: false, reason: 'unsupported' };
  }

  const handle = await loadDirectoryHandle();
  if (!handle) {
    return { written: false, reason: 'not-bound' };
  }

  let perm = await queryHandlePermission(handle, 'readwrite');
  if (perm !== 'granted') {
    if (options?.requestPermissionIfNeeded && handle.requestPermission) {
      perm = await handle.requestPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') {
      return { written: false, reason: 'needs-permission', folderName: handle.name };
    }
  }

  const payload: FolderBackupFile = {
    version: 1,
    app: 'muzen-cursor',
    exportedAt: new Date().toISOString(),
    currentDelta: sanitizeDeltaRecord(computeConfigDelta(snapshot)),
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      ...(p.description ? { description: p.description } : {}),
      delta: sanitizeDeltaRecord(p.delta),
      updatedAt: p.updatedAt
    }))
  };

  const fileHandle = await handle.getFileHandle(BACKUP_FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();

  return { written: true, folderName: handle.name };
}

/**
 * Read and validate muzen-cursor-backup.json from the bound directory.
 */
export async function readBackupFromBoundFolder(): Promise<{
  snapshot: ConfigSnapshot;
  presets: CursorPreset[];
  exportedAt?: string;
  folderName: string;
}> {
  if (!isFolderBackupSupported()) {
    throw new Error('FOLDER_API_UNSUPPORTED');
  }

  const handle = await loadDirectoryHandle();
  if (!handle) {
    throw new Error('FOLDER_NOT_BOUND');
  }

  let perm = await queryHandlePermission(handle, 'read');
  if (perm !== 'granted' && handle.requestPermission) {
    perm = await handle.requestPermission({ mode: 'read' });
  }
  if (perm !== 'granted') {
    throw new Error('FOLDER_PERMISSION_DENIED');
  }

  const fileHandle = await handle.getFileHandle(BACKUP_FILENAME, { create: false });
  const file = await fileHandle.getFile();
  const rawText = await file.text();
  const parsed = JSON.parse(rawText) as Partial<FolderBackupFile>;

  if (!parsed || parsed.app !== 'muzen-cursor' || parsed.version !== 1) {
    throw new Error('INVALID_BACKUP_FILE');
  }

  const snapshot = materializeConfigDelta(parsed.currentDelta);
  const rawPresets = Array.isArray(parsed.presets) ? parsed.presets : [];
  const cleanPresets: CursorPreset[] = [];

  for (const item of rawPresets) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<CursorPreset>;
    const id = typeof rec.id === 'string' ? rec.id.trim() : '';
    const name = typeof rec.name === 'string' ? rec.name.trim().slice(0, 40) : '';
    if (!id || !name) continue;

    cleanPresets.push({
      id,
      name,
      ...(typeof rec.description === 'string' && rec.description.trim()
        ? { description: rec.description.trim().slice(0, 100) }
        : {}),
      delta: sanitizeDeltaRecord(rec.delta),
      updatedAt:
        typeof rec.updatedAt === 'number' && Number.isFinite(rec.updatedAt)
          ? rec.updatedAt
          : Date.now()
    });
  }

  return {
    snapshot,
    presets: cleanPresets,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
    folderName: handle.name
  };
}
