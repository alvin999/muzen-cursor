import {
  ByokStoredState,
  LlmProviderId,
  PROVIDER_PRESETS,
  isVaultUnlocked,
  loadByokState,
  lockVault,
  saveApiKey,
  switchEncryptionMode,
  unlockVaultWithPassphrase,
  updateActiveProviderConfig
} from '../src/ai/byokStorage';
import { EncryptionMode } from '../src/ai/cryptoVault';
import {
  RemoteModelOption,
  fetchAvailableModels,
  sendLlmChat,
  testProviderConnection
} from '../src/ai/llmClient';
import {
  ValidatedPresetAction,
  ValidatedTuningResponse,
  applyValidatedPatch,
  validateTuningResponse
} from '../src/ai/patchValidator';
import { ChatTurn, buildTuningPrompt } from '../src/ai/promptBuilder';
import { ConfigSnapshot } from '../src/core/configSchema';
import {
  bindBackupFolder,
  getBoundFolderStatus,
  readBackupFromBoundFolder,
  requestBoundFolderPermission,
  unbindBackupFolder,
  writeBackupToBoundFolder
} from '../src/core/folderBackup';
import {
  CursorPreset,
  deletePreset,
  loadPresets,
  presetToSnapshot,
  replaceAllPresets,
  savePreset,
  toPresetSummaries
} from '../src/core/presetStorage';
import { LOCALES, Locale, Translations } from '../src/i18n/locales';

export interface AiAssistantPanelHooks {
  getLocale: () => Locale;
  getCurrentSnapshot: () => ConfigSnapshot;
  applySnapshot: (snapshot: ConfigSnapshot, toastMessage?: string) => void;
  showToast: (message?: string) => void;
  confirmAction: (title: string, message: string) => Promise<boolean>;
}

export interface AiAssistantPanelHandle {
  refreshLocale: () => void;
  notifySettingsChanged: () => void;
}

const MAX_UNDO_STACK = 20;
const AUTO_SYNC_DEBOUNCE_MS = 800;

interface RenderedAssistantEntry {
  kind: 'welcome' | 'assistant' | 'error';
  textEl: HTMLElement;
  diffTitleEl?: HTMLElement;
  diffEmptyEl?: HTMLElement;
  applyBtn?: HTMLButtonElement;
  applied?: boolean;
  hasDiffs?: boolean;
  presetAction?: ValidatedPresetAction;
  actionBtn?: HTMLButtonElement;
  actionDone?: boolean;
}

/**
 * Initialize the BYOK key vault UI, presets/folder auto-backup, and conversational AI tuning panel.
 */
export function initAiAssistantPanel(hooks: AiAssistantPanelHooks): AiAssistantPanelHandle {
  const detailsEl = document.getElementById('ai-byok-details') as HTMLDetailsElement | null;
  const headerBadgeEl = document.getElementById('ai-header-badge');
  const providerSel = document.getElementById('ai-provider-select') as HTMLSelectElement | null;
  const modelInput = document.getElementById('ai-model-input') as HTMLInputElement | null;
  const modelSuggestions = document.getElementById('ai-model-suggestions') as HTMLDataListElement | null;
  const modelSelect = document.getElementById('ai-model-select') as HTMLSelectElement | null;
  const btnFetchModels = document.getElementById('ai-btn-fetch-models') as HTMLButtonElement | null;
  const baseUrlGroup = document.getElementById('ai-base-url-group');
  const baseUrlInput = document.getElementById('ai-base-url-input') as HTMLInputElement | null;
  const apiKeyInput = document.getElementById('ai-api-key-input') as HTMLInputElement | null;
  const keyStatusBadge = document.getElementById('ai-key-status-badge');
  const encryptionSel = document.getElementById('ai-encryption-mode') as HTMLSelectElement | null;
  const passphraseGroup = document.getElementById('ai-passphrase-group');
  const passphraseInput = document.getElementById('ai-passphrase-input') as HTMLInputElement | null;
  const btnSaveByok = document.getElementById('ai-btn-save-byok') as HTMLButtonElement | null;
  const btnTestConn = document.getElementById('ai-btn-test-conn') as HTMLButtonElement | null;
  const btnLockVault = document.getElementById('ai-btn-lock-vault') as HTMLButtonElement | null;
  const btnClearKey = document.getElementById('ai-btn-clear-key') as HTMLButtonElement | null;
  const byokStatusEl = document.getElementById('ai-byok-status');

  const unlockBanner = document.getElementById('ai-unlock-banner');
  const unlockPassInput = document.getElementById('ai-unlock-passphrase-input') as HTMLInputElement | null;
  const btnUnlockVault = document.getElementById('ai-btn-unlock-vault') as HTMLButtonElement | null;

  const presetCountBadge = document.getElementById('ai-preset-count-badge');
  const folderBadge = document.getElementById('ai-folder-badge');
  const presetNameInput = document.getElementById('ai-preset-name-input') as HTMLInputElement | null;
  const btnSavePreset = document.getElementById('ai-btn-save-preset') as HTMLButtonElement | null;
  const presetListEl = document.getElementById('ai-preset-list');
  const btnBindFolder = document.getElementById('ai-btn-bind-folder') as HTMLButtonElement | null;
  const btnReauthFolder = document.getElementById('ai-btn-reauth-folder') as HTMLButtonElement | null;
  const btnSyncFolder = document.getElementById('ai-btn-sync-folder') as HTMLButtonElement | null;
  const btnRestoreFolder = document.getElementById('ai-btn-restore-folder') as HTMLButtonElement | null;
  const btnUnbindFolder = document.getElementById('ai-btn-unbind-folder') as HTMLButtonElement | null;
  const folderStatusEl = document.getElementById('ai-folder-status');

  const btnUndo = document.getElementById('ai-btn-undo') as HTMLButtonElement | null;
  const btnClearChat = document.getElementById('ai-btn-clear-chat') as HTMLButtonElement | null;
  const quickChipsEl = document.getElementById('ai-quick-chips');
  const chatMessagesEl = document.getElementById('ai-chat-messages');
  const chatInputEl = document.getElementById('ai-chat-input') as HTMLTextAreaElement | null;
  const btnSend = document.getElementById('ai-btn-send') as HTMLButtonElement | null;

  let byokState: ByokStoredState | null = null;
  let presets: CursorPreset[] = [];
  const loadedModelsByProvider = new Map<LlmProviderId, RemoteModelOption[]>();
  let chatHistory: ChatTurn[] = [];
  let undoStack: ConfigSnapshot[] = [];
  let renderedEntries: RenderedAssistantEntry[] = [];
  let activeAbortController: AbortController | null = null;
  let autoSyncTimer: number | null = null;
  let isSending = false;
  let hasInitializedOpenState = false;

  const dict = (): Translations => LOCALES[hooks.getLocale()] || LOCALES['zh-TW'];

  function showStatusBanner(
    el: HTMLElement | null,
    message: string,
    kind: 'ok' | 'error' | 'info' = 'info'
  ): void {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden', 'is-ok', 'is-error');
    if (kind === 'ok') el.classList.add('is-ok');
    if (kind === 'error') el.classList.add('is-error');
  }

  function showByokStatus(message: string, kind: 'ok' | 'error' | 'info' = 'info'): void {
    showStatusBanner(byokStatusEl, message, kind);
  }

  function hideByokStatus(): void {
    byokStatusEl?.classList.add('hidden');
  }

  function showFolderStatus(message: string, kind: 'ok' | 'error' | 'info' = 'info'): void {
    showStatusBanner(folderStatusEl, message, kind);
  }

  function formatRuntimeError(err: unknown): string {
    const d = dict();
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (rawMsg === 'VAULT_LOCKED') return d.aiErrVaultLocked;
    if (rawMsg.startsWith('API_KEY_MISSING:')) return d.aiErrApiKeyMissing;
    if (rawMsg.startsWith('MODEL_MISSING:')) return d.aiErrModelMissing;
    if (rawMsg === 'PRESET_LIMIT_REACHED' || rawMsg === 'PRESET_SYNC_QUOTA_EXCEEDED') {
      return d.aiPresetQuotaErr;
    }
    return rawMsg;
  }

  function getSelectedProvider(): LlmProviderId {
    return (providerSel?.value as LlmProviderId) || byokState?.activeProvider || 'gemini';
  }

  function getSelectedEncryptionMode(): EncryptionMode {
    return (encryptionSel?.value as EncryptionMode) || byokState?.encryptionMode || 'transparent';
  }

  function renderLoadedModels(models: RemoteModelOption[]): void {
    const d = dict();

    if (modelSuggestions) {
      modelSuggestions.innerHTML = '';
      for (const m of models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        if (m.label) opt.textContent = m.label;
        modelSuggestions.appendChild(opt);
      }
    }

    if (!modelSelect) return;
    modelSelect.innerHTML = '';

    if (models.length === 0) {
      modelSelect.classList.add('hidden');
      return;
    }

    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent = d.aiModelsSelectPlaceholder.replace('{count}', String(models.length));
    modelSelect.appendChild(placeholderOpt);

    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label && m.label !== m.id ? `${m.label} (${m.id})` : m.id;
      modelSelect.appendChild(opt);
    }

    const currentModel = modelInput?.value.trim() || '';
    const hasMatch = currentModel.length > 0 && models.some((m) => m.id === currentModel);
    modelSelect.value = hasMatch ? currentModel : '';
    modelSelect.classList.remove('hidden');
  }

  function syncEncryptionVisibility(): void {
    const mode = getSelectedEncryptionMode();
    passphraseGroup?.classList.toggle('hidden', mode !== 'passphrase');
  }

  function syncProviderFields(provider: LlmProviderId): void {
    const preset = PROVIDER_PRESETS[provider];
    const savedProfile = byokState?.profiles[provider];

    if (modelInput) {
      modelInput.value = savedProfile?.model || '';
    }

    renderLoadedModels(loadedModelsByProvider.get(provider) ?? []);

    if (baseUrlGroup && baseUrlInput) {
      baseUrlGroup.classList.toggle('hidden', !preset.allowsCustomBaseUrl);
      baseUrlInput.value = savedProfile?.baseUrl || preset.defaultBaseUrl;
    }

    if (apiKeyInput) {
      const d = dict();
      apiKeyInput.value = '';
      apiKeyInput.placeholder = preset.requiresApiKey
        ? d.aiApiKeyPlaceholder
        : d.aiApiKeyOptionalPlaceholder;
    }
  }

  async function handleFetchModels(opts?: { silent?: boolean }): Promise<void> {
    const d = dict();
    const provider = getSelectedProvider();
    const preset = PROVIDER_PRESETS[provider];
    const baseUrl = baseUrlInput?.value.trim() || preset.defaultBaseUrl;
    const draftApiKey = apiKeyInput?.value.trim();

    if (opts?.silent) {
      const hasStoredKey = Boolean(byokState?.encryptedKeys[provider]);
      const unlocked = await isVaultUnlocked(provider);
      const canFetch = !preset.requiresApiKey || Boolean(draftApiKey) || (hasStoredKey && unlocked);
      if (!canFetch) return;
    } else {
      showByokStatus(d.aiFetchingModels, 'info');
      if (btnFetchModels) btnFetchModels.disabled = true;
    }

    try {
      const models = await fetchAvailableModels({
        provider,
        baseUrl,
        apiKey: draftApiKey ? draftApiKey : undefined
      });
      loadedModelsByProvider.set(provider, models);
      if (getSelectedProvider() === provider) {
        renderLoadedModels(models);
      }
      if (!opts?.silent) {
        if (models.length > 0) {
          showByokStatus(d.aiModelsLoaded.replace('{count}', String(models.length)), 'ok');
        } else {
          showByokStatus(d.aiModelsEmpty, 'info');
        }
      }
    } catch (err) {
      if (!opts?.silent) {
        showByokStatus(formatRuntimeError(err), 'error');
      }
    } finally {
      if (!opts?.silent && btnFetchModels) {
        btnFetchModels.disabled = false;
      }
    }
  }

  async function refreshStatusAndBadges(): Promise<void> {
    if (!byokState) return;
    const d = dict();
    const provider = getSelectedProvider();
    const preset = PROVIDER_PRESETS[provider];
    const storedKey = byokState.encryptedKeys[provider];
    const unlocked = await isVaultUnlocked(provider);

    let badgeText = d.aiStatusNotConfigured;
    let badgeClass: 'ai-badge-ok' | 'ai-badge-warn' | 'ai-badge-locked' = 'ai-badge-warn';

    if (storedKey) {
      if (storedKey.mode === 'transparent') {
        badgeText = d.aiStatusSavedTransparent;
        badgeClass = 'ai-badge-ok';
      } else if (unlocked) {
        badgeText = d.aiStatusSavedPassphraseUnlocked;
        badgeClass = 'ai-badge-ok';
      } else {
        badgeText = d.aiStatusLocked;
        badgeClass = 'ai-badge-locked';
      }
    } else if (!preset.requiresApiKey) {
      badgeText = d.aiStatusOptionalNoKey;
      badgeClass = 'ai-badge-ok';
    }

    for (const el of [headerBadgeEl, keyStatusBadge]) {
      if (!el) continue;
      el.textContent = badgeText;
      el.classList.remove('ai-badge-ok', 'ai-badge-warn', 'ai-badge-locked');
      el.classList.add(badgeClass);
    }

    const isLocked = Boolean(storedKey && storedKey.mode === 'passphrase' && !unlocked);
    unlockBanner?.classList.toggle('hidden', !isLocked);

    const hasAnyPassphraseKey = Object.values(byokState.encryptedKeys).some(
      (item) => item?.mode === 'passphrase'
    );
    btnLockVault?.classList.toggle('hidden', !(hasAnyPassphraseKey && unlocked));

    if (!hasInitializedOpenState && detailsEl) {
      hasInitializedOpenState = true;
      const isReady = unlocked && (Boolean(storedKey) || !preset.requiresApiKey);
      detailsEl.open = !isReady;
    }
  }

  function pushUndoSnapshot(snapshot?: ConfigSnapshot): void {
    const snap = snapshot ?? hooks.getCurrentSnapshot();
    undoStack.push(snap);
    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.shift();
    }
    updateUndoButton();
  }

  function updateUndoButton(): void {
    if (!btnUndo) return;
    const d = dict();
    btnUndo.disabled = undoStack.length === 0;
    btnUndo.textContent = undoStack.length > 0 ? `${d.aiUndoBtn} (${undoStack.length})` : d.aiUndoBtn;
  }

  function updateSendButtonState(): void {
    if (!btnSend) return;
    const d = dict();
    btnSend.textContent = isSending ? d.aiCancelBtn : d.aiSendBtn;
    btnSend.classList.toggle('btn-danger', isSending);
    btnSend.classList.toggle('btn-primary', !isSending);
  }

  function scheduleFolderAutoSync(): void {
    if (autoSyncTimer !== null) {
      window.clearTimeout(autoSyncTimer);
    }
    autoSyncTimer = window.setTimeout(async () => {
      autoSyncTimer = null;
      try {
        const res = await writeBackupToBoundFolder(hooks.getCurrentSnapshot(), presets, {
          requestPermissionIfNeeded: false
        });
        if (!res.written && res.reason === 'needs-permission') {
          await refreshFolderStatus();
        }
      } catch {
        // Silent background sync must not interrupt manual slider tuning
      }
    }, AUTO_SYNC_DEBOUNCE_MS);
  }

  async function refreshFolderStatus(): Promise<void> {
    const d = dict();
    const status = await getBoundFolderStatus();

    if (folderBadge) {
      folderBadge.classList.remove('ai-badge-ok', 'ai-badge-warn', 'ai-badge-locked');
      if (!status.supported) {
        folderBadge.textContent = d.aiFolderStatusUnsupported;
        folderBadge.classList.add('ai-badge-warn');
      } else if (!status.bound) {
        folderBadge.textContent = d.aiFolderStatusUnbound;
        folderBadge.classList.add('ai-badge-warn');
      } else if (status.permission === 'granted') {
        folderBadge.textContent = d.aiFolderStatusActive.replace('{name}', status.folderName || '');
        folderBadge.classList.add('ai-badge-ok');
      } else {
        folderBadge.textContent = d.aiFolderStatusNeedsAuth.replace('{name}', status.folderName || '');
        folderBadge.classList.add('ai-badge-locked');
      }
    }

    if (btnBindFolder) {
      btnBindFolder.disabled = !status.supported;
    }
    btnReauthFolder?.classList.toggle(
      'hidden',
      !(status.supported && status.bound && status.permission !== 'granted')
    );
    btnSyncFolder?.classList.toggle(
      'hidden',
      !(status.supported && status.bound && status.permission === 'granted')
    );
    btnRestoreFolder?.classList.toggle('hidden', !(status.supported && status.bound));
    btnUnbindFolder?.classList.toggle('hidden', !(status.supported && status.bound));
  }

  function renderPresetList(): void {
    const d = dict();
    if (presetCountBadge) {
      presetCountBadge.textContent = d.aiPresetCountBadge.replace('{count}', String(presets.length));
    }

    if (!presetListEl) return;
    presetListEl.innerHTML = '';

    if (presets.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'ai-preset-empty';
      emptyEl.textContent = d.aiPresetEmpty;
      presetListEl.appendChild(emptyEl);
      return;
    }

    for (const preset of presets) {
      const itemEl = document.createElement('div');
      itemEl.className = 'ai-preset-item';

      const metaEl = document.createElement('div');
      metaEl.className = 'ai-preset-meta';

      const nameEl = document.createElement('span');
      nameEl.className = 'ai-preset-name';
      nameEl.textContent = preset.name;
      metaEl.appendChild(nameEl);

      if (preset.description) {
        const descEl = document.createElement('span');
        descEl.className = 'ai-preset-desc';
        descEl.textContent = preset.description;
        metaEl.appendChild(descEl);
      }

      const actionsEl = document.createElement('div');
      actionsEl.className = 'ai-preset-actions';

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn btn-secondary';
      applyBtn.textContent = d.aiPresetApplyBtn;
      applyBtn.addEventListener('click', () => {
        pushUndoSnapshot();
        hooks.applySnapshot(
          presetToSnapshot(preset),
          dict().aiPresetLoadedToast.replace('{name}', preset.name)
        );
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger';
      delBtn.textContent = d.aiPresetDeleteBtn;
      delBtn.addEventListener('click', () => {
        void handleDeletePresetById(preset.id, preset.name);
      });

      actionsEl.append(applyBtn, delBtn);
      itemEl.append(metaEl, actionsEl);
      presetListEl.appendChild(itemEl);
    }
  }

  async function performSavePreset(
    name: string,
    snapshot: ConfigSnapshot,
    description?: string
  ): Promise<boolean> {
    const d = dict();
    try {
      presets = await savePreset(name, snapshot, description);
      renderPresetList();
      scheduleFolderAutoSync();
      hooks.showToast(d.aiPresetSavedToast);
      return true;
    } catch (err) {
      showFolderStatus(formatRuntimeError(err), 'error');
      return false;
    }
  }

  async function handleDeletePresetById(presetId: string, presetName: string): Promise<boolean> {
    const d = dict();
    const confirmed = await hooks.confirmAction(
      d.aiPresetDeleteConfirmTitle,
      d.aiPresetDeleteConfirmMsg.replace('{name}', presetName)
    );
    if (!confirmed) return false;

    presets = await deletePreset(presetId);
    renderPresetList();
    scheduleFolderAutoSync();
    hooks.showToast(d.aiPresetDeletedToast);
    return true;
  }

  async function handleManualSavePreset(): Promise<void> {
    const name = presetNameInput?.value.trim() || '';
    if (!name) return;
    const saved = await performSavePreset(name, hooks.getCurrentSnapshot());
    if (saved && presetNameInput) {
      presetNameInput.value = '';
    }
  }

  async function handleBindFolder(): Promise<void> {
    const d = dict();
    try {
      await bindBackupFolder();
      await writeBackupToBoundFolder(hooks.getCurrentSnapshot(), presets, {
        requestPermissionIfNeeded: true
      });
      await refreshFolderStatus();
      showFolderStatus(d.aiFolderMsgSynced, 'ok');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showFolderStatus(`${d.aiFolderMsgFailed}${formatRuntimeError(err)}`, 'error');
    }
  }

  async function handleReauthFolder(): Promise<void> {
    const d = dict();
    try {
      const granted = await requestBoundFolderPermission();
      if (granted) {
        await writeBackupToBoundFolder(hooks.getCurrentSnapshot(), presets, {
          requestPermissionIfNeeded: false
        });
        showFolderStatus(d.aiFolderMsgSynced, 'ok');
      }
      await refreshFolderStatus();
    } catch (err) {
      showFolderStatus(`${d.aiFolderMsgFailed}${formatRuntimeError(err)}`, 'error');
    }
  }

  async function handleSyncFolderNow(): Promise<void> {
    const d = dict();
    try {
      const res = await writeBackupToBoundFolder(hooks.getCurrentSnapshot(), presets, {
        requestPermissionIfNeeded: true
      });
      await refreshFolderStatus();
      if (res.written) {
        showFolderStatus(d.aiFolderMsgSynced, 'ok');
      }
    } catch (err) {
      showFolderStatus(`${d.aiFolderMsgFailed}${formatRuntimeError(err)}`, 'error');
    }
  }

  async function handleRestoreFolder(): Promise<void> {
    const d = dict();
    const confirmed = await hooks.confirmAction(
      d.aiFolderRestoreConfirmTitle,
      d.aiFolderRestoreConfirmMsg
    );
    if (!confirmed) return;

    try {
      const backup = await readBackupFromBoundFolder();
      pushUndoSnapshot();
      presets = await replaceAllPresets(backup.presets);
      renderPresetList();
      hooks.applySnapshot(backup.snapshot, d.aiFolderMsgRestored);
      await refreshFolderStatus();
      showFolderStatus(d.aiFolderMsgRestored, 'ok');
    } catch (err) {
      showFolderStatus(`${d.aiFolderMsgFailed}${formatRuntimeError(err)}`, 'error');
    }
  }

  async function handleUnbindFolder(): Promise<void> {
    const d = dict();
    await unbindBackupFolder();
    await refreshFolderStatus();
    showFolderStatus(d.aiFolderMsgUnbound, 'info');
  }

  function scrollChatToBottom(): void {
    if (chatMessagesEl) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
  }

  function appendUserBubble(text: string): void {
    if (!chatMessagesEl) return;
    const bubble = document.createElement('div');
    bubble.className = 'ai-msg ai-msg-user';
    bubble.textContent = text;
    chatMessagesEl.appendChild(bubble);
    scrollChatToBottom();
  }

  function appendWelcomeBubble(): void {
    if (!chatMessagesEl) return;
    const d = dict();
    const bubble = document.createElement('div');
    bubble.className = 'ai-msg ai-msg-assistant';
    const textEl = document.createElement('div');
    textEl.textContent = d.aiChatWelcome;
    bubble.appendChild(textEl);
    chatMessagesEl.appendChild(bubble);
    renderedEntries.push({ kind: 'welcome', textEl });
  }

  function appendErrorBubble(message: string): void {
    if (!chatMessagesEl) return;
    const d = dict();
    const bubble = document.createElement('div');
    bubble.className = 'ai-msg ai-msg-error';
    bubble.textContent = `${d.aiErrRequestFailed}${message}`;
    chatMessagesEl.appendChild(bubble);
    renderedEntries.push({ kind: 'error', textEl: bubble });
    scrollChatToBottom();
  }

  function formatDiffVal(val: number | boolean | string | undefined, unit?: string): string {
    if (val === undefined) return '—';
    return unit && typeof val === 'number' ? `${val} ${unit}` : String(val);
  }

  function getDiffButtonLabel(entry: RenderedAssistantEntry): string {
    const d = dict();
    if (entry.applied) return d.aiAppliedPatchBtn;
    if (entry.presetAction?.type === 'save') {
      return d.aiActionApplyAndSavePresetBtn.replace('{name}', entry.presetAction.name);
    }
    if (entry.presetAction?.type === 'load') {
      return d.aiActionLoadAndTunePresetBtn.replace('{name}', entry.presetAction.presetName);
    }
    return d.aiApplyPatchBtn;
  }

  function getStandaloneActionLabel(action: ValidatedPresetAction, done: boolean): string {
    const d = dict();
    if (done) return d.aiActionDoneBtn;
    if (action.type === 'save') {
      return d.aiActionSavePresetBtn.replace('{name}', action.name);
    }
    if (action.type === 'load') {
      return d.aiActionLoadPresetBtn.replace('{name}', action.presetName);
    }
    return d.aiActionDeletePresetBtn.replace('{name}', action.presetName);
  }

  function appendAssistantBubble(result: ValidatedTuningResponse): void {
    if (!chatMessagesEl) return;
    const d = dict();

    const bubble = document.createElement('div');
    bubble.className = 'ai-msg ai-msg-assistant';

    const replyEl = document.createElement('div');
    replyEl.textContent = result.reply;
    bubble.appendChild(replyEl);

    const candidateAction = result.presetAction;
    const validAction =
      candidateAction?.type === 'load' &&
      !presets.some((p) => p.id === candidateAction.presetId)
        ? undefined
        : candidateAction;

    const entry: RenderedAssistantEntry = {
      kind: 'assistant',
      textEl: replyEl,
      applied: false,
      hasDiffs: result.diffs.length > 0,
      presetAction: validAction,
      actionDone: false
    };

    if (result.diffs.length > 0) {
      const diffCard = document.createElement('div');
      diffCard.className = 'ai-diff-card';

      const diffTitle = document.createElement('div');
      diffTitle.className = 'ai-diff-title';
      diffTitle.textContent = d.aiDiffHeader;
      diffCard.appendChild(diffTitle);
      entry.diffTitleEl = diffTitle;

      const diffList = document.createElement('div');
      diffList.className = 'ai-diff-list';

      for (const item of result.diffs) {
        const row = document.createElement('div');
        row.className = 'ai-diff-row';

        const keyEl = document.createElement('span');
        keyEl.className = 'ai-diff-key';
        keyEl.textContent = `${item.section}.${item.key}`;

        const valsEl = document.createElement('span');
        valsEl.className = 'ai-diff-values';

        const oldEl = document.createElement('span');
        oldEl.className = 'ai-diff-old';
        oldEl.textContent = formatDiffVal(item.oldValue, item.unit);

        const arrowEl = document.createElement('span');
        arrowEl.className = 'ai-diff-arrow';
        arrowEl.textContent = '→';

        const newEl = document.createElement('span');
        newEl.className = 'ai-diff-new';
        newEl.textContent = formatDiffVal(item.newValue, item.unit);

        valsEl.append(oldEl, arrowEl, newEl);
        row.append(keyEl, valsEl);
        diffList.appendChild(row);
      }

      diffCard.appendChild(diffList);

      const actionsEl = document.createElement('div');
      actionsEl.className = 'ai-diff-actions';

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn btn-primary ai-diff-apply-btn';
      applyBtn.textContent = getDiffButtonLabel(entry);
      entry.applyBtn = applyBtn;

      applyBtn.addEventListener('click', async () => {
        const currentDict = dict();
        const before = hooks.getCurrentSnapshot();
        pushUndoSnapshot(before);

        let baseSnapshot = before;
        if (validAction?.type === 'load') {
          const target = presets.find((p) => p.id === validAction.presetId);
          if (target) {
            baseSnapshot = presetToSnapshot(target);
          }
        }

        const nextSnapshot = applyValidatedPatch(baseSnapshot, result);
        hooks.applySnapshot(nextSnapshot, currentDict.aiToastApplied);

        if (validAction?.type === 'save') {
          await performSavePreset(validAction.name, nextSnapshot, validAction.description);
        }

        entry.applied = true;
        applyBtn.textContent = getDiffButtonLabel(entry);
        applyBtn.classList.add('applied');
      });

      actionsEl.appendChild(applyBtn);
      diffCard.appendChild(actionsEl);
      bubble.appendChild(diffCard);

      // Keep delete action separate so applying diffs and deleting a preset remain explicit
      if (validAction?.type === 'delete') {
        const actionCard = document.createElement('div');
        actionCard.className = 'ai-action-card';
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-danger';
        delBtn.textContent = getStandaloneActionLabel(validAction, false);
        entry.actionBtn = delBtn;

        delBtn.addEventListener('click', async () => {
          const deleted = await handleDeletePresetById(validAction.presetId, validAction.presetName);
          if (deleted) {
            entry.actionDone = true;
            delBtn.textContent = getStandaloneActionLabel(validAction, true);
            delBtn.disabled = true;
          }
        });

        actionCard.appendChild(delBtn);
        bubble.appendChild(actionCard);
      }
    } else if (validAction) {
      const actionCard = document.createElement('div');
      actionCard.className = 'ai-action-card';

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className =
        validAction.type === 'delete'
          ? 'btn btn-danger'
          : 'btn btn-primary ai-diff-apply-btn';
      actionBtn.textContent = getStandaloneActionLabel(validAction, false);
      entry.actionBtn = actionBtn;

      actionBtn.addEventListener('click', async () => {
        const currentDict = dict();
        if (validAction.type === 'save') {
          const ok = await performSavePreset(
            validAction.name,
            hooks.getCurrentSnapshot(),
            validAction.description
          );
          if (ok) {
            entry.actionDone = true;
            actionBtn.textContent = getStandaloneActionLabel(validAction, true);
            actionBtn.classList.add('applied');
          }
        } else if (validAction.type === 'load') {
          const target = presets.find((p) => p.id === validAction.presetId);
          if (!target) return;
          pushUndoSnapshot();
          hooks.applySnapshot(
            presetToSnapshot(target),
            currentDict.aiPresetLoadedToast.replace('{name}', target.name)
          );
          entry.actionDone = true;
          actionBtn.textContent = getStandaloneActionLabel(validAction, true);
          actionBtn.classList.add('applied');
        } else if (validAction.type === 'delete') {
          const deleted = await handleDeletePresetById(validAction.presetId, validAction.presetName);
          if (deleted) {
            entry.actionDone = true;
            actionBtn.textContent = getStandaloneActionLabel(validAction, true);
            actionBtn.disabled = true;
          }
        }
      });

      actionCard.appendChild(actionBtn);
      bubble.appendChild(actionCard);
    } else {
      const noDiffEl = document.createElement('div');
      noDiffEl.className = 'ai-diff-empty-note';
      noDiffEl.textContent = d.aiDiffNoChanges;
      bubble.appendChild(noDiffEl);
      entry.diffEmptyEl = noDiffEl;
    }

    chatMessagesEl.appendChild(bubble);
    renderedEntries.push(entry);
    scrollChatToBottom();
  }

  async function handleSendPrompt(overrideText?: string): Promise<void> {
    if (isSending) {
      activeAbortController?.abort();
      return;
    }

    const text = (overrideText ?? chatInputEl?.value ?? '').trim();
    if (!text) return;

    if (!overrideText && chatInputEl) {
      chatInputEl.value = '';
    }

    const d = dict();
    appendUserBubble(text);

    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'ai-msg ai-msg-assistant ai-msg-thinking';
    thinkingBubble.textContent = d.aiThinkingText;
    chatMessagesEl?.appendChild(thinkingBubble);
    scrollChatToBottom();

    isSending = true;
    activeAbortController = new AbortController();
    updateSendButtonState();

    try {
      const provider = getSelectedProvider();
      const model = modelInput?.value.trim() || '';
      const baseUrl = baseUrlInput?.value.trim();

      const snapshot = hooks.getCurrentSnapshot();
      const presetSummaries = toPresetSummaries(presets);
      const prompt = buildTuningPrompt(snapshot, chatHistory, text, presetSummaries);

      const rawOutput = await sendLlmChat(prompt, {
        provider,
        model,
        baseUrl,
        signal: activeAbortController.signal
      });

      const validated = validateTuningResponse(rawOutput, snapshot, presetSummaries);
      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'assistant', content: validated.reply });

      thinkingBubble.remove();
      appendAssistantBubble(validated);
    } catch (err) {
      thinkingBubble.remove();
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      appendErrorBubble(formatRuntimeError(err));
    } finally {
      isSending = false;
      activeAbortController = null;
      updateSendButtonState();
    }
  }

  async function handleSaveByok(): Promise<void> {
    const d = dict();
    hideByokStatus();

    const provider = getSelectedProvider();
    const targetMode = getSelectedEncryptionMode();
    const model = modelInput?.value.trim() || '';
    const baseUrl = baseUrlInput?.value.trim() || PROVIDER_PRESETS[provider].defaultBaseUrl;
    const newApiKey = apiKeyInput?.value.trim() || '';
    const passphrase = passphraseInput?.value || '';

    try {
      byokState = await updateActiveProviderConfig(provider, { model, baseUrl });

      const hasAnyStoredKeys = Object.keys(byokState.encryptedKeys).length > 0;
      if (byokState.encryptionMode !== targetMode && hasAnyStoredKeys) {
        if (targetMode === 'passphrase' && !passphrase) {
          showByokStatus(d.aiMsgPassphraseRequired, 'error');
          return;
        }
        try {
          byokState = await switchEncryptionMode(targetMode, passphrase || undefined);
        } catch {
          showByokStatus(d.aiMsgUnlockBeforeSwitch, 'error');
          return;
        }
      }

      if (newApiKey) {
        if (targetMode === 'passphrase' && !passphrase && !(await isVaultUnlocked(provider))) {
          showByokStatus(d.aiMsgPassphraseRequired, 'error');
          return;
        }
        byokState = await saveApiKey(provider, newApiKey, targetMode, passphrase || undefined);
        if (apiKeyInput) apiKeyInput.value = '';
      }

      if (passphraseInput) passphraseInput.value = '';
      await refreshStatusAndBadges();
      showByokStatus(d.aiMsgByokSaved, 'ok');

      if (
        newApiKey ||
        (byokState.encryptedKeys[provider] &&
          (await isVaultUnlocked(provider)) &&
          !loadedModelsByProvider.has(provider))
      ) {
        void handleFetchModels({ silent: true });
      }
    } catch (err) {
      showByokStatus(formatRuntimeError(err), 'error');
    }
  }

  async function handleTestConnection(): Promise<void> {
    const d = dict();
    const provider = getSelectedProvider();
    const model = modelInput?.value.trim() || '';
    const baseUrl = baseUrlInput?.value.trim() || PROVIDER_PRESETS[provider].defaultBaseUrl;
    const draftApiKey = apiKeyInput?.value.trim();

    if (btnTestConn) btnTestConn.disabled = true;
    showByokStatus(d.aiMsgTestingConn, 'info');

    try {
      if (!model) {
        const models = await fetchAvailableModels({
          provider,
          baseUrl,
          apiKey: draftApiKey ? draftApiKey : undefined
        });
        loadedModelsByProvider.set(provider, models);
        if (getSelectedProvider() === provider) {
          renderLoadedModels(models);
        }
        showByokStatus(
          models.length > 0
            ? d.aiModelsLoaded.replace('{count}', String(models.length))
            : d.aiModelsEmpty,
          'ok'
        );
      } else {
        await testProviderConnection({
          provider,
          model,
          baseUrl,
          apiKey: draftApiKey ? draftApiKey : undefined
        });
        showByokStatus(d.aiMsgConnOk, 'ok');
      }
    } catch (err) {
      showByokStatus(`${d.aiMsgConnFail}${formatRuntimeError(err)}`, 'error');
    } finally {
      if (btnTestConn) btnTestConn.disabled = false;
    }
  }

  async function handleUnlock(): Promise<void> {
    const d = dict();
    const pass = unlockPassInput?.value || '';
    const ok = await unlockVaultWithPassphrase(pass);
    if (!ok) {
      showByokStatus(d.aiMsgUnlockFailed, 'error');
      return;
    }
    if (unlockPassInput) unlockPassInput.value = '';
    await refreshStatusAndBadges();
    showByokStatus(d.aiMsgUnlocked, 'ok');

    const provider = getSelectedProvider();
    if (!loadedModelsByProvider.has(provider)) {
      void handleFetchModels({ silent: true });
    }
  }

  async function handleLock(): Promise<void> {
    const d = dict();
    await lockVault();
    await refreshStatusAndBadges();
    showByokStatus(d.aiMsgLocked, 'info');
  }

  async function handleClearKey(): Promise<void> {
    const d = dict();
    const provider = getSelectedProvider();
    const confirmed = await hooks.confirmAction(d.aiClearKeyConfirmTitle, d.aiClearKeyConfirmMsg);
    if (!confirmed) return;

    const mode = byokState?.encryptionMode ?? getSelectedEncryptionMode();
    byokState = await saveApiKey(provider, '', mode);
    if (apiKeyInput) apiKeyInput.value = '';
    await refreshStatusAndBadges();
    showByokStatus(d.aiMsgKeyCleared, 'ok');
  }

  function resetChat(): void {
    chatHistory = [];
    renderedEntries = [];
    if (chatMessagesEl) chatMessagesEl.innerHTML = '';
    appendWelcomeBubble();
  }

  function bindEvents(): void {
    providerSel?.addEventListener('change', async () => {
      const provider = getSelectedProvider();
      syncProviderFields(provider);
      hideByokStatus();
      await refreshStatusAndBadges();
      if (
        PROVIDER_PRESETS[provider].requiresApiKey &&
        byokState?.encryptedKeys[provider] &&
        !loadedModelsByProvider.has(provider)
      ) {
        void handleFetchModels({ silent: true });
      }
    });

    btnFetchModels?.addEventListener('click', () => {
      void handleFetchModels({ silent: false });
    });

    modelSelect?.addEventListener('change', () => {
      if (modelSelect.value && modelInput) {
        modelInput.value = modelSelect.value;
      }
    });

    modelInput?.addEventListener('input', () => {
      if (!modelSelect) return;
      const models = loadedModelsByProvider.get(getSelectedProvider()) ?? [];
      const val = modelInput.value.trim();
      modelSelect.value = val.length > 0 && models.some((m) => m.id === val) ? val : '';
    });

    apiKeyInput?.addEventListener('change', () => {
      if (apiKeyInput.value.trim().length > 0) {
        void handleFetchModels({ silent: false });
      }
    });

    encryptionSel?.addEventListener('change', () => {
      syncEncryptionVisibility();
      hideByokStatus();
    });

    btnSaveByok?.addEventListener('click', () => {
      void handleSaveByok();
    });

    btnTestConn?.addEventListener('click', () => {
      void handleTestConnection();
    });

    btnLockVault?.addEventListener('click', () => {
      void handleLock();
    });

    btnClearKey?.addEventListener('click', () => {
      void handleClearKey();
    });

    btnUnlockVault?.addEventListener('click', () => {
      void handleUnlock();
    });

    unlockPassInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        void handleUnlock();
      }
    });

    btnSavePreset?.addEventListener('click', () => {
      void handleManualSavePreset();
    });

    presetNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        void handleManualSavePreset();
      }
    });

    btnBindFolder?.addEventListener('click', () => {
      void handleBindFolder();
    });

    btnReauthFolder?.addEventListener('click', () => {
      void handleReauthFolder();
    });

    btnSyncFolder?.addEventListener('click', () => {
      void handleSyncFolderNow();
    });

    btnRestoreFolder?.addEventListener('click', () => {
      void handleRestoreFolder();
    });

    btnUnbindFolder?.addEventListener('click', () => {
      void handleUnbindFolder();
    });

    btnSend?.addEventListener('click', () => {
      void handleSendPrompt();
    });

    chatInputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        void handleSendPrompt();
      }
    });

    quickChipsEl?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('.ai-chip-btn');
      if (!btn || isSending) return;
      const chipText = btn.textContent?.trim();
      if (chipText) {
        void handleSendPrompt(chipText);
      }
    });

    btnUndo?.addEventListener('click', () => {
      const prev = undoStack.pop();
      if (!prev) return;
      hooks.applySnapshot(prev, dict().aiToastUndone);
      updateUndoButton();
    });

    btnClearChat?.addEventListener('click', () => {
      resetChat();
    });
  }

  async function hydrate(): Promise<void> {
    byokState = await loadByokState();
    presets = await loadPresets();
    if (providerSel) providerSel.value = byokState.activeProvider;
    if (encryptionSel) encryptionSel.value = byokState.encryptionMode;

    syncEncryptionVisibility();
    syncProviderFields(byokState.activeProvider);
    await refreshStatusAndBadges();
    renderPresetList();
    await refreshFolderStatus();
    resetChat();
    updateUndoButton();
    updateSendButtonState();

    if (
      PROVIDER_PRESETS[byokState.activeProvider].requiresApiKey &&
      byokState.encryptedKeys[byokState.activeProvider]
    ) {
      void handleFetchModels({ silent: true });
    }
  }

  bindEvents();
  void hydrate();

  return {
    refreshLocale(): void {
      const d = dict();
      for (const entry of renderedEntries) {
        if (entry.kind === 'welcome') {
          entry.textEl.textContent = d.aiChatWelcome;
        }
        if (entry.diffTitleEl) {
          entry.diffTitleEl.textContent = d.aiDiffHeader;
        }
        if (entry.diffEmptyEl) {
          entry.diffEmptyEl.textContent = d.aiDiffNoChanges;
        }
        if (entry.applyBtn) {
          entry.applyBtn.textContent = getDiffButtonLabel(entry);
        }
        if (entry.actionBtn && entry.presetAction) {
          entry.actionBtn.textContent = getStandaloneActionLabel(
            entry.presetAction,
            Boolean(entry.actionDone)
          );
        }
      }
      if (apiKeyInput) {
        const preset = PROVIDER_PRESETS[getSelectedProvider()];
        apiKeyInput.placeholder = preset.requiresApiKey
          ? d.aiApiKeyPlaceholder
          : d.aiApiKeyOptionalPlaceholder;
      }
      const cachedModels = loadedModelsByProvider.get(getSelectedProvider());
      if (cachedModels) {
        renderLoadedModels(cachedModels);
      }
      renderPresetList();
      updateUndoButton();
      updateSendButtonState();
      void refreshStatusAndBadges();
      void refreshFolderStatus();
    },
    notifySettingsChanged(): void {
      scheduleFolderAutoSync();
    }
  };
}
