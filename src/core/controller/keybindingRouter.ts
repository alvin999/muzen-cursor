import { cursorStore, matchesKeybinding, DEFAULT_KEYBINDINGS, KeybindingDef } from '../cursorStore';
import { LOCALES } from '../../i18n/locales';
import { isTypingContext } from '../../utils/domUtils';
import { CursorHostContext } from './types';
import { FlashModeController } from './flashModeController';
import { JumpHistoryManager } from './jumpHistoryManager';
import { MediaController } from './mediaController';
import { PointerInteractionManager } from './pointerInteraction';
import { ScrollFollower } from './scrollFollower';
import { MotionEngine } from './motionEngine';

export interface KeybindingRouterActions {
  toggle: () => boolean;
  toggleVisualMode: () => void;
  toggleVisualLineMode: () => void;
  exitVisualMode: () => void;
  yankSelection: () => Promise<void>;
}

/**
 * 鍵盤事件路由、輸入緩衝 (Count Prefix / 雙鍵序列) 與動態輸入蓄力管理員
 */
export class KeybindingRouter {
  private lastKeyTime = 0;
  private lastKey = '';
  private lastEscTime = 0;

  // 按鍵輸入緩衝與次數前綴 (Count Prefix，例如 5j, 10k)
  private countPrefix = 0;
  private pendingKeyTimer: ReturnType<typeof setTimeout> | null = null;

  // 動態輸入蓄力與動能狀態
  private currentCharge = 0;
  private lastNavKeyTime = 0;

  constructor(
    private readonly host: CursorHostContext,
    private readonly motionEngine: MotionEngine,
    private readonly flashModeController: FlashModeController,
    private readonly jumpHistoryManager: JumpHistoryManager,
    private readonly mediaController: MediaController,
    private readonly pointerInteraction: PointerInteractionManager,
    private readonly scrollFollower: ScrollFollower,
    private readonly actions: KeybindingRouterActions
  ) {}

  public get chargeLevel(): number {
    return this.currentCharge;
  }

  public handleKeyDown(e: KeyboardEvent): void {
    const state = cursorStore.getState();

    // 0. 若當前網站在完全停用名單中，100% 不干涉
    if (state.isExcluded) return;

    const config = state.keybindings || DEFAULT_KEYBINDINGS;
    const bindings = config.bindings || DEFAULT_KEYBINDINGS.bindings;

    // 1. 全域強制主開關 (toggleCursor, alt + v)
    // 置於最頂層優先響應，無論焦點在搜尋框或頁面任何地方均可強制開關切換
    if (matchesKeybinding(e, bindings.toggleCursor)) {
      this.interceptEvent(e);
      this.actions.toggle();
      return;
    }

    // 2. 若處於輸入框或富文本編輯器打字情境，不干擾打字
    if (isTypingContext(e)) {
      return;
    }

    const isEscKey = e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey;

    // 若功能處於深層關閉狀態 (!state.enabled)：支援連按兩次 Esc 雙向重新喚醒 (無需按 Alt + V)
    if (!state.enabled) {
      if (isEscKey && bindings.escapeDouble?.enabled !== false) {
        this.handleDisabledDoubleEscape(e);
      }
      return;
    }

    // 燈箱模式開啟中：優先交由媒體控制器處理所有燈箱快捷鍵
    if (state.lightboxImage) {
      this.interceptEvent(e);
      this.mediaController.handleLightboxKey(e);
      return;
    }

    // 3. Esc 鍵處理：單按為淺層休眠 (保留狀態列)，連按為深層關閉 (關閉狀態列釋放按鍵)
    if (isEscKey) {
      this.handleEscapeKey(e, state, bindings.escape, bindings.escapeDouble);
      return;
    }

    // 4. 落實右下角「按 j 開始」：若游標處於淺層待機 (!visible)，按下移動或翻頁鍵時直接喚醒
    if (!state.visible) {
      this.handleShallowWakeup(e, bindings);
      return;
    }

    // 5. 游標處於喚醒接管狀態 (visible: true)：所有 Vim 按鍵全面接管
    const intercept = () => this.interceptEvent(e);

    // 0. 若浮動歷史選單開啟中：優先處理數字鍵 [1-9] 跳轉與 Esc 取消
    if (state.isJumpMenuOpen) {
      intercept();
      if (/^[1-9]$/.test(e.key)) {
        this.jumpHistoryManager.jumpToMenuItem(Number(e.key));
      } else {
        this.jumpHistoryManager.closeMenu();
      }
      return;
    }

    // 0.2 若 Flash 全域視覺跳轉模式開啟中：優先處理標籤選擇與即時搜尋過濾
    if (state.isFlashMode) {
      this.flashModeController.handleKey(e, intercept);
      return;
    }

    // 0.5 處理數字計數前綴 (Count Prefix，例如 5j, 10k, 3w)
    const isPlainNumber = /^[0-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey;
    if (isPlainNumber && this.handleCountPrefix(e.key, intercept)) {
      return;
    }

    // 若有掛起的單按 ' 或 ` 浮動選單計時器，非單按時予以清除
    if (e.key !== "'" && e.key !== '`') {
      this.jumpHistoryManager.cancelMenuTimer();
    }

    // 連續指令比對 (如 gg 或 '', ``)
    const now = Date.now();
    const prevKey = this.lastKey;
    const isDoubleKey = prevKey.toLowerCase() === e.key.toLowerCase() && now - this.lastKeyTime < 500;
    this.lastKey = e.key;
    this.lastKeyTime = now;

    if (this.handleDoubleKeySequences(e, bindings, config.enableJumpMenu !== false, isDoubleKey, intercept)) {
      return;
    }

    this.dispatchNormalOrVisualCommand(e, state.mode, bindings, isPlainNumber, intercept);
  }

  private interceptEvent(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  private handleDisabledDoubleEscape(e: KeyboardEvent): void {
    const now = Date.now();
    const isDoubleEsc = now - this.lastEscTime < 500;
    this.lastEscTime = now;

    if (isDoubleEsc) {
      // 連按兩次 Esc：強制重新喚醒游標與狀態列！
      this.interceptEvent(e);
      this.lastEscTime = 0;
      cursorStore.setState({ enabled: true, visible: true });
      const dict = LOCALES[cursorStore.getState().locale || 'zh-TW'] || LOCALES['zh-TW'];
      cursorStore.showStatusNotice(dict.noticeWakeUp, 1500);
      const current = this.host.getCurrentTarget();
      if (!current || !document.contains(current.node)) {
        this.motionEngine.findInitialTarget();
      } else {
        this.host.updateCursorPosition(true);
      }
    }
  }

  private handleEscapeKey(
    e: KeyboardEvent,
    state: ReturnType<typeof cursorStore.getState>,
    escapeDef?: KeybindingDef,
    escapeDoubleDef?: KeybindingDef
  ): void {
    const now = Date.now();
    const isDoubleEsc = now - this.lastEscTime < 500;
    this.lastEscTime = now;

    // 若 Flash 跳轉模式開啟中，優先關閉 Flash 層，並重置 Esc 計時器避免誤觸深層關閉
    if (state.isFlashMode) {
      this.interceptEvent(e);
      this.flashModeController.close();
      this.lastEscTime = 0;
      return;
    }

    // 若浮動選單開啟中，優先關閉選單，並重置 Esc 計時器避免誤觸深層關閉
    if (state.isJumpMenuOpen) {
      this.interceptEvent(e);
      this.jumpHistoryManager.closeMenu();
      this.lastEscTime = 0;
      return;
    }

    this.jumpHistoryManager.cancelMenuTimer();

    // 連按兩次 Esc：若 escapeDouble 啟用，深層關閉功能 (狀態列一併關閉隱藏，100% 釋放按鍵與點擊)
    if (isDoubleEsc && escapeDoubleDef?.enabled !== false) {
      this.interceptEvent(e);
      this.lastEscTime = 0;
      this.scrollFollower.cancelPendingRealignment();
      cursorStore.setState({ enabled: false, visible: false });
      const dict = LOCALES[cursorStore.getState().locale || 'zh-TW'] || LOCALES['zh-TW'];
      cursorStore.showStatusNotice(dict.noticeDeepSleep, 1800);
      return;
    }

    // 單按 Esc：若 escape 啟用
    if (escapeDef?.enabled !== false) {
      // 若有輸入緩衝或次數前綴，按 Esc 優先取消緩衝區 (攔截事件避免誤觸外層)
      if (this.countPrefix > 0 || state.pendingKeys) {
        this.interceptEvent(e);
        this.clearPendingKeys();
        return;
      }

      // 單按 Esc：若處於 VISUAL 或 VISUAL_LINE 模式，退出選取回到 NORMAL (攔截事件)
      if (state.mode === 'VISUAL' || state.mode === 'VISUAL_LINE') {
        this.interceptEvent(e);
        this.actions.exitVisualMode();
        return;
      }

      // 若原本就已處於淺層待命 (!visible)，維持待命
      if (!state.visible) {
        return;
      }

      // 單按 Esc：由活動狀態轉為淺層休眠待機 (隱藏游標，保留右下角狀態列「按 j 開始」，隨時可喚醒)
      // 注意：此處不呼叫 preventDefault / stopPropagation，允許事件穿透冒泡給網頁原生 Modal、全螢幕或彈窗響應
      this.scrollFollower.cancelPendingRealignment();
      cursorStore.setState({ visible: false });
    }
  }

  private handleShallowWakeup(
    e: KeyboardEvent,
    bindings: Record<string, KeybindingDef>
  ): void {
    const wakeupActions: Array<{ entry?: KeybindingDef; action: () => void }> = [
      { entry: bindings.moveDown, action: () => this.motionEngine.moveVertical(1) },
      { entry: bindings.halfPageDown, action: () => this.motionEngine.moveHalfPage(true, e.repeat) },
      { entry: bindings.halfPageUp, action: () => this.motionEngine.moveHalfPage(false, e.repeat) },
      { entry: bindings.moveUp, action: () => this.motionEngine.moveVertical(-1) }
    ];

    for (const item of wakeupActions) {
      if (matchesKeybinding(e, item.entry)) {
        this.interceptEvent(e);
        cursorStore.setState({ enabled: true, visible: true });
        const current = this.host.getCurrentTarget();
        if (!current || !document.contains(current.node)) {
          this.motionEngine.findInitialTarget();
        } else {
          item.action();
        }
        return;
      }
    }
    // 其他單鍵與快捷鍵在休眠時 100% 自然放行給網頁原生
  }

  private handleCountPrefix(key: string, intercept: () => void): boolean {
    // 若尚未有計數，首個數字不得為 0 (Vim 中 0 為行首指令 lineStart)
    if (this.countPrefix === 0 && key !== '0') {
      intercept();
      this.jumpHistoryManager.cancelMenuTimer();
      this.countPrefix = Number(key);
      this.setPendingKeys(String(this.countPrefix));
      return true;
    }
    if (this.countPrefix > 0) {
      intercept();
      this.jumpHistoryManager.cancelMenuTimer();
      this.countPrefix = Math.min(999, this.countPrefix * 10 + Number(key));
      this.setPendingKeys(String(this.countPrefix));
      return true;
    }
    return false;
  }

  private handleDoubleKeySequences(
    e: KeyboardEvent,
    bindings: Record<string, KeybindingDef>,
    enableJumpMenu: boolean,
    isDoubleKey: boolean,
    intercept: () => void
  ): boolean {
    // 1. 跳回前一跳轉點行首 (jumpBackLine: 預設 '') 與精確字元 (jumpBackExact: 預設 ``)
    const jumpBackPairs: Array<{ def?: KeybindingDef; exact: boolean; singleKey: string }> = [
      { def: bindings.jumpBackLine, exact: false, singleKey: "'" },
      { def: bindings.jumpBackExact, exact: true, singleKey: '`' }
    ];

    for (const pair of jumpBackPairs) {
      const def = pair.def;
      if (!def || !def.enabled) continue;

      const isConfiguredKey = def.key === e.key;
      const isDoubleBack = isConfiguredKey && isDoubleKey;
      if (def.isDouble ? isDoubleBack : matchesKeybinding(e, def)) {
        this.jumpHistoryManager.cancelMenuTimer();
        intercept();
        this.lastKey = '';
        this.clearPendingKeys();
        this.jumpHistoryManager.jumpBack(pair.exact);
        return true;
      }

      // 單按 ' 或 ` 鍵：啟動 400ms 計時器，若未按第二下則喚醒 Neovim 浮動選單
      if (e.key === pair.singleKey && !e.ctrlKey && !e.altKey && !e.metaKey && !isDoubleKey) {
        this.setPendingKeys(pair.singleKey, 500);
        if (enableJumpMenu && this.jumpHistoryManager.hasHistory) {
          this.jumpHistoryManager.scheduleMenuOpen(pair.exact, 400);
        }
      }
    }

    // 跳至全文頂部 (gg)
    const docStartDef = bindings.docStart;
    if (docStartDef && docStartDef.enabled) {
      const isConfiguredKey = docStartDef.key.toLowerCase() === e.key.toLowerCase();
      const isDoubleDocStart = isConfiguredKey && isDoubleKey;
      if (docStartDef.isDouble ? isDoubleDocStart : matchesKeybinding(e, docStartDef)) {
        intercept();
        this.lastKey = '';
        this.clearPendingKeys();
        this.motionEngine.jumpToDocumentStart();
        return true;
      }
      if (isConfiguredKey && docStartDef.isDouble && !isDoubleKey) {
        this.setPendingKeys(e.key, 500);
      }
    }

    return false;
  }

  private dispatchNormalOrVisualCommand(
    e: KeyboardEvent,
    mode: string,
    bindings: Record<string, KeybindingDef>,
    isPlainNumber: boolean,
    intercept: () => void
  ): void {
    if (matchesKeybinding(e, bindings.visualLineMode)) {
      intercept();
      this.clearPendingKeys();
      this.actions.toggleVisualLineMode();
      return;
    }

    if (matchesKeybinding(e, bindings.visualMode)) {
      intercept();
      this.clearPendingKeys();
      this.actions.toggleVisualMode();
      return;
    }

    if (matchesKeybinding(e, bindings.yank)) {
      if (mode === 'VISUAL' || mode === 'VISUAL_LINE') {
        intercept();
        this.clearPendingKeys();
        this.actions.yankSelection();
      }
      return;
    }

    // 超連結與互動元素點選處理：僅在 NORMAL 模式下響應
    if (mode === 'NORMAL' && this.handleNormalModeActivation(e, bindings, intercept)) {
      return;
    }

    const runMotionWithCount = (fn: (count: number) => void) => {
      intercept();
      this.recordNavCharge(e.repeat);
      const count = this.consumeCount();
      fn(count);
    };

    const runMotionNoCount = (fn: () => void) => {
      intercept();
      this.recordNavCharge(e.repeat);
      this.clearPendingKeys();
      fn();
    };

    if (matchesKeybinding(e, bindings.moveLeft)) {
      runMotionWithCount((c) => this.motionEngine.moveHorizontal(-c));
      return;
    }
    if (matchesKeybinding(e, bindings.moveRight)) {
      runMotionWithCount((c) => this.motionEngine.moveHorizontal(c));
      return;
    }
    if (matchesKeybinding(e, bindings.moveUp)) {
      runMotionWithCount((c) => this.motionEngine.moveVertical(-1 * c, e.repeat));
      return;
    }
    if (matchesKeybinding(e, bindings.moveDown)) {
      runMotionWithCount((c) => this.motionEngine.moveVertical(1 * c, e.repeat));
      return;
    }
    if (matchesKeybinding(e, bindings.wordForward)) {
      runMotionWithCount((c) => {
        for (let i = 0; i < c; i++) this.motionEngine.moveWordForward();
      });
      return;
    }
    if (matchesKeybinding(e, bindings.wordBackward)) {
      runMotionWithCount((c) => {
        for (let i = 0; i < c; i++) this.motionEngine.moveWordBackward();
      });
      return;
    }
    if (matchesKeybinding(e, bindings.wordEnd)) {
      runMotionWithCount((c) => {
        for (let i = 0; i < c; i++) this.motionEngine.moveWordEnd();
      });
      return;
    }
    if (matchesKeybinding(e, bindings.lineStart)) {
      runMotionNoCount(() => this.motionEngine.jumpToLineBoundary(true));
      return;
    }
    if (matchesKeybinding(e, bindings.lineEnd)) {
      runMotionNoCount(() => this.motionEngine.jumpToLineBoundary(false));
      return;
    }
    if (matchesKeybinding(e, bindings.halfPageDown)) {
      runMotionNoCount(() => this.motionEngine.moveHalfPage(true, e.repeat));
      return;
    }
    if (matchesKeybinding(e, bindings.halfPageUp)) {
      runMotionNoCount(() => this.motionEngine.moveHalfPage(false, e.repeat));
      return;
    }
    if (matchesKeybinding(e, bindings.docEnd)) {
      runMotionNoCount(() => this.motionEngine.jumpToDocumentEnd());
      return;
    }

    if (matchesKeybinding(e, bindings.flashJump)) {
      intercept();
      this.clearPendingKeys();
      this.flashModeController.open('hint');
      return;
    }
    if (matchesKeybinding(e, bindings.flashSearch)) {
      intercept();
      this.clearPendingKeys();
      this.flashModeController.open('search');
      return;
    }

    // 其他未匹配之普通按鍵，若存在計數前綴則清空重置
    if (!isPlainNumber && this.countPrefix > 0) {
      this.clearPendingKeys();
    }
  }

  private handleNormalModeActivation(
    e: KeyboardEvent,
    bindings: Record<string, KeybindingDef>,
    intercept: () => void
  ): boolean {
    const currentTarget = this.host.getCurrentTarget();
    const openLinkNewTabDef = bindings.openLinkNewTab;
    const isCmdOrCtrlEnter = e.key === 'Enter' && (e.ctrlKey || e.metaKey);
    const matchesNewTab = Boolean(
      openLinkNewTabDef?.enabled && (
        matchesKeybinding(e, openLinkNewTabDef) ||
        (openLinkNewTabDef.key === 'Enter' && isCmdOrCtrlEnter)
      )
    );

    const anchor = this.pointerInteraction.getHoveredAnchor(currentTarget);

    if (matchesNewTab && anchor) {
      intercept();
      this.clearPendingKeys();
      this.pointerInteraction.openCurrentLink(currentTarget, true);
      return true;
    }

    const openLinkDef = bindings.openLink;
    if (openLinkDef?.enabled && matchesKeybinding(e, openLinkDef)) {
      // 若當前游標停駐於圖片上，按 Enter 開啟燈箱放大檢視
      if (this.mediaController.openLightbox()) {
        intercept();
        this.clearPendingKeys();
        return true;
      }

      if (anchor) {
        intercept();
        this.clearPendingKeys();
        this.pointerInteraction.openCurrentLink(currentTarget, false);
        return true;
      }

      // 若非 <a> 但為標準可點選/切換之 Toggle、按鈕或 ARIA 控制項，亦模擬點選
      const interactiveEl = this.pointerInteraction.getHoveredInteractiveElement(currentTarget);
      if (interactiveEl) {
        intercept();
        this.clearPendingKeys();
        interactiveEl.click();
        return true;
      }
    }

    return false;
  }

  private setPendingKeys(keys: string, timeoutMs: number = 0): void {
    if (this.pendingKeyTimer) {
      clearTimeout(this.pendingKeyTimer);
      this.pendingKeyTimer = null;
    }
    cursorStore.setState({ pendingKeys: keys });
    if (timeoutMs > 0) {
      this.pendingKeyTimer = setTimeout(() => {
        this.clearPendingKeys();
      }, timeoutMs);
    }
  }

  private clearPendingKeys(): void {
    if (this.pendingKeyTimer) {
      clearTimeout(this.pendingKeyTimer);
      this.pendingKeyTimer = null;
    }
    this.countPrefix = 0;
    if (cursorStore.getState().pendingKeys) {
      cursorStore.setState({ pendingKeys: '' });
    }
  }

  private consumeCount(): number {
    const count = this.countPrefix > 0 ? this.countPrefix : 1;
    this.clearPendingKeys();
    return count;
  }

  private recordNavCharge(isRepeat: boolean = false): void {
    const now = performance.now();
    const dt = now - this.lastNavKeyTime;
    this.lastNavKeyTime = now;

    const adv = cursorStore.getState().advanced;
    const impulse = typeof adv?.chargeStepImpulse === 'number' ? adv.chargeStepImpulse : 0.035;

    if (dt <= 260 || isRepeat) {
      this.currentCharge = Math.min(1.0, this.currentCharge + impulse);
    } else {
      this.currentCharge = Math.max(0.03, Math.min(1.0, this.currentCharge * 0.4 + impulse));
    }
  }

  public destroy(): void {
    if (this.pendingKeyTimer) {
      clearTimeout(this.pendingKeyTimer);
      this.pendingKeyTimer = null;
    }
  }
}
