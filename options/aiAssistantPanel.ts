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
import { sendLlmChat, testProviderConnection } from '../src/ai/llmClient';
import {
  ValidatedTuningResponse,
  applyValidatedPatch,
  validateTuningResponse
} from '../src/ai/patchValidator';
import { ChatTurn, buildTuningPrompt } from '../src/ai/promptBuilder';
import { ConfigSnapshot } from '../src/core/configSchema';
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
}

const MAX_UNDO_STACK = 20;

interface RenderedAssistantEntry {
  kind: 'welcome' | 'assistant' | 'error';
  textEl: HTMLElement;
  diffTitleEl?: HTMLElement;
  diffEmptyEl?: HTMLElement;
  applyBtn?: HTMLButtonElement;
  applied?: boolean;
  errorPrefixKey?: 'aiErrRequestFailed';
}

/**
 * Initialize the BYOK key vault UI and conversational AI tuning panel in Options.
 */
export function initAiAssistantPanel(hooks: AiAssistantPanelHooks): AiAssistantPanelHandle {
  const detailsEl = document.getElementById('ai-byok-details') as HTMLDetailsElement | null;
  const headerBadgeEl = document.getElementById('ai-header-badge');
  const providerSel = document.getElementById('ai-provider-select') as HTMLSelectElement | null;
  const modelInput = document.getElementById('ai-model-input') as HTMLInputElement | null;
  const modelSuggestions = document.getElementById('ai-model-suggestions') as HTMLDataListElement | null;
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

  const btnUndo = document.getElementById('ai-btn-undo') as HTMLButtonElement | null;
  const btnClearChat = document.getElementById('ai-btn-clear-chat') as HTMLButtonElement | null;
  const quickChipsEl = document.getElementById('ai-quick-chips');
  const chatMessagesEl = document.getElementById('ai-chat-messages');
  const chatInputEl = document.getElementById('ai-chat-input') as HTMLTextAreaElement | null;
  const btnSend = document.getElementById('ai-btn-send') as HTMLButtonElement | null;

  let byokState: ByokStoredState | null = null;
  let chatHistory: ChatTurn[] = [];
  let undoStack: ConfigSnapshot[] = [];
  let renderedEntries: RenderedAssistantEntry[] = [];
  let activeAbortController: AbortController | null = null;
  let isSending = false;
  let hasInitializedOpenState = false;

  const dict = (): Translations => LOCALES[hooks.getLocale()] || LOCALES['zh-TW'];

  function showByokStatus(message: string, kind: 'ok' | 'error' | 'info' = 'info'): void {
    if (!byokStatusEl) return;
    byokStatusEl.textContent = message;
    byokStatusEl.classList.remove('hidden', 'is-ok', 'is-error');
    if (kind === 'ok') byokStatusEl.classList.add('is-ok');
    if (kind === 'error') byokStatusEl.classList.add('is-error');
  }

  function hideByokStatus(): void {
    byokStatusEl?.classList.add('hidden');
  }

  function formatRuntimeError(err: unknown): string {
    const d = dict();
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (rawMsg === 'VAULT_LOCKED') return d.aiErrVaultLocked;
    if (rawMsg.startsWith('API_KEY_MISSING:')) return d.aiErrApiKeyMissing;
    return rawMsg;
  }

  function getSelectedProvider(): LlmProviderId {
    return (providerSel?.value as LlmProviderId) || byokState?.activeProvider || 'gemini';
  }

  function getSelectedEncryptionMode(): EncryptionMode {
    return (encryptionSel?.value as EncryptionMode) || byokState?.encryptionMode || 'transparent';
  }

  function populateModelSuggestions(provider: LlmProviderId): void {
    if (!modelSuggestions) return;
    modelSuggestions.innerHTML = '';
    for (const modelName of PROVIDER_PRESETS[provider].suggestedModels) {
      const opt = document.createElement('option');
      opt.value = modelName;
      modelSuggestions.appendChild(opt);
    }
  }

  function syncEncryptionVisibility(): void {
    const mode = getSelectedEncryptionMode();
    passphraseGroup?.classList.toggle('hidden', mode !== 'passphrase');
  }

  function syncProviderFields(provider: LlmProviderId): void {
    const preset = PROVIDER_PRESETS[provider];
    const savedProfile = byokState?.profiles[provider];

    populateModelSuggestions(provider);

    if (modelInput) {
      modelInput.value = savedProfile?.model || preset.defaultModel;
    }

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
    renderedEntries.push({ kind: 'error', textEl: bubble, errorPrefixKey: 'aiErrRequestFailed' });
    scrollChatToBottom();
  }

  function formatDiffVal(val: number | boolean | string | undefined, unit?: string): string {
    if (val === undefined) return '—';
    return unit && typeof val === 'number' ? `${val} ${unit}` : String(val);
  }

  function appendAssistantBubble(result: ValidatedTuningResponse): void {
    if (!chatMessagesEl) return;
    const d = dict();

    const bubble = document.createElement('div');
    bubble.className = 'ai-msg ai-msg-assistant';

    const replyEl = document.createElement('div');
    replyEl.textContent = result.reply;
    bubble.appendChild(replyEl);

    const entry: RenderedAssistantEntry = {
      kind: 'assistant',
      textEl: replyEl,
      applied: false
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
      applyBtn.textContent = d.aiApplyPatchBtn;
      entry.applyBtn = applyBtn;

      applyBtn.addEventListener('click', () => {
        const currentDict = dict();
        const before = hooks.getCurrentSnapshot();
        undoStack.push(before);
        if (undoStack.length > MAX_UNDO_STACK) {
          undoStack.shift();
        }
        const nextSnapshot = applyValidatedPatch(before, result);
        hooks.applySnapshot(nextSnapshot, currentDict.aiToastApplied);

        entry.applied = true;
        applyBtn.textContent = currentDict.aiAppliedPatchBtn;
        applyBtn.classList.add('applied');
        updateUndoButton();
      });

      actionsEl.appendChild(applyBtn);
      diffCard.appendChild(actionsEl);
      bubble.appendChild(diffCard);
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
      const model = modelInput?.value.trim() || PROVIDER_PRESETS[provider].defaultModel;
      const baseUrl = baseUrlInput?.value.trim();

      const snapshot = hooks.getCurrentSnapshot();
      const prompt = buildTuningPrompt(snapshot, chatHistory, text);

      const rawOutput = await sendLlmChat(prompt, {
        provider,
        model,
        baseUrl,
        signal: activeAbortController.signal
      });

      const validated = validateTuningResponse(rawOutput, snapshot);
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
    const model = modelInput?.value.trim() || PROVIDER_PRESETS[provider].defaultModel;
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
    } catch (err) {
      showByokStatus(formatRuntimeError(err), 'error');
    }
  }

  async function handleTestConnection(): Promise<void> {
    const d = dict();
    const provider = getSelectedProvider();
    const model = modelInput?.value.trim() || PROVIDER_PRESETS[provider].defaultModel;
    const baseUrl = baseUrlInput?.value.trim() || PROVIDER_PRESETS[provider].defaultBaseUrl;
    const draftApiKey = apiKeyInput?.value.trim();

    if (btnTestConn) btnTestConn.disabled = true;
    showByokStatus(d.aiMsgTestingConn, 'info');

    try {
      await testProviderConnection({
        provider,
        model,
        baseUrl,
        apiKey: draftApiKey ? draftApiKey : undefined
      });
      showByokStatus(d.aiMsgConnOk, 'ok');
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
    if (providerSel) providerSel.value = byokState.activeProvider;
    if (encryptionSel) encryptionSel.value = byokState.encryptionMode;

    syncEncryptionVisibility();
    syncProviderFields(byokState.activeProvider);
    await refreshStatusAndBadges();
    resetChat();
    updateUndoButton();
    updateSendButtonState();
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
          entry.applyBtn.textContent = entry.applied ? d.aiAppliedPatchBtn : d.aiApplyPatchBtn;
        }
      }
      if (apiKeyInput) {
        const preset = PROVIDER_PRESETS[getSelectedProvider()];
        apiKeyInput.placeholder = preset.requiresApiKey
          ? d.aiApiKeyPlaceholder
          : d.aiApiKeyOptionalPlaceholder;
      }
      updateUndoButton();
      updateSendButtonState();
      void refreshStatusAndBadges();
    }
  };
}
