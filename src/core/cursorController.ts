import { cursorStore, MotionDirection, CursorRect, matchesKeybinding, DEFAULT_KEYBINDINGS, JumpMenuItem, MediaTargetInfo } from './cursorStore';
import { LOCALES } from '../i18n/locales';
import { isTypingContext, detectReadingScope, isOutOfNormalFlowWidget, findCurrentSectionHeading, estimateReadingMinutes } from '../utils/domUtils';
import { WordNavigator, TextTarget } from './wordNavigator';
import { resolveTextTargetFromPoint, isClickWithinDistanceThreshold, getRawCaretFromPoint } from '../utils/caretUtils';
import { animateScrollTo, cancelActiveScroll, isSmoothScrolling, getScrollParent, getViewportMetrics } from '../utils/smoothScroller';
import {
  findFirstTextNodeIn,
  findFirstReadableTextNode,
  findLastReadableTextNode,
  findNextTextNode,
  findPrevTextNode,
  getCharRectOfTarget,
  searchDownwardNextLine,
  searchUpwardPrevLine,
  computeWaypointsBetween,
  findVisualLineBoundary,
  isValidReadableTextNode,
  findMediaBetweenVerticalRange,
  findNextMediaAfter
} from './navigation/spatialNavigator';
import { VisualSelectionManager } from './navigation/selectionManager';
import { collectFlashHints } from './navigation/flashNavigator';
import { LightboxCommand } from '../components/VimImageLightbox';
import { logger } from '../utils/logger';

export interface CursorControllerOptions {
  containerRoot?: HTMLElement;
  enableScroll?: boolean;
}

export interface JumpPoint {
  node: Node;
  offset: number;
  scrollX: number;
  scrollY: number;
}

/**
 * Vim 核心游標控制器 (純邏輯運算，解除業務綁定)
 */
export class CursorController {
  private options?: CursorControllerOptions;
  private currentTarget: TextTarget | null = null;
  private previousTarget: TextTarget | null = null;
  private currentMediaElement: Element | null = null;
  private mediaEntryDirection: 'down' | 'up' | null = null;
  private pendingTargetAfterMedia: TextTarget | null = null;
  private preferredX: number | null = null;
  private activeScopeElement: HTMLElement | null = null;
  private lastKeyTime = 0;
  private lastKey = '';
  private lastEscTime = 0;
  private moveTimer: any = null;
  private isRecoveringTarget = false;

  // Jump 歷史堆疊 (上限 30 筆) 與 Toggle 恢復點
  private jumpHistory: JumpPoint[] = [];
  private readonly MAX_JUMPS = 30;
  private lastJumpBackTarget: JumpPoint | null = null;
  private jumpMenuTimer: any = null;
  private isJumpMenuExact = false;

  // 按鍵輸入緩衝與次數前綴 (Count Prefix，例如 5j, 10k)
  private countPrefix: number = 0;
  private pendingKeyTimer: any = null;

  // 停頓延遲校正計時器 (Post-Navigation Debounce Realignment)
  private realignTimer: any = null;
  private readonly REALIGN_DEBOUNCE_MS = 200;

  // 長文閱讀輔助與章節快取
  private cachedTotalChars = 0;
  private lastCharCountTime = 0;
  private lastBoundaryNoticeTime = 0;
  private lastHeadingCheckTime = 0;
  private cachedHeadingTitle = '';
  private cachedReadingMinutes = 0;

  // 翻頁回溯後照鏡之背景快照快取 (0ms 零延遲)
  private cachedSnapshotUrl: string | null = null;
  private snapshotTimer: any = null;
  private lastSnapshotTime = 0;

  /**
   * 預先在背景擷取當前視窗快照 (防抖 200ms)
   */
  private requestBackgroundSnapshot(): void {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
    }
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      const now = Date.now();
      if (now - this.lastSnapshotTime < 250) return;
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'CAPTURE_TAB_SNAPSHOT' }, (resp) => {
            if (resp && resp.success && resp.dataUrl) {
              this.cachedSnapshotUrl = resp.dataUrl;
              this.lastSnapshotTime = Date.now();
            }
          });
        }
      } catch {
        // 忽略通訊例外
      }
    }, 200);
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

  private selectionManager = new VisualSelectionManager();

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private scrollHandler: (() => void) | null = null;

  // 動態輸入蓄力與動能狀態
  private currentCharge = 0;
  private lastNavKeyTime = 0;

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

  constructor(options?: CursorControllerOptions) {
    this.options = options;
  }

  private get rootElement(): HTMLElement {
    return this.options?.containerRoot || document.body;
  }

  /**
   * 取得當前導航的作用域根節點
   * 若已鎖定閱讀區塊且該區塊仍在 DOM 中，優先作為邊界；否則回退至全域 rootElement
   */
  private getEffectiveRoot(): HTMLElement {
    if (this.activeScopeElement && this.activeScopeElement.isConnected) {
      return this.activeScopeElement;
    }
    return this.rootElement;
  }

  private updateActiveScope(targetNode?: Node | null): void {
    if (this.options?.containerRoot) {
      this.activeScopeElement = this.options.containerRoot;
      return;
    }
    const node = targetNode || this.currentTarget?.node;
    const parentEl = node ? (node instanceof Element ? (node as HTMLElement) : node.parentElement) : null;
    if (parentEl) {
      this.activeScopeElement = detectReadingScope(parentEl, this.rootElement);
    }
  }

  public init(): void {
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.keyupHandler = (e: KeyboardEvent) => this.handleKeyUp(e);
    this.clickHandler = (e: MouseEvent) => this.handleClick(e);

    // 視窗縮放與滾動時保持游標位置緊密貼合
    let ticking = false;
    const requestScrollUpdate = () => {
      if (cursorStore.getState().isFlashMode) {
        this.closeFlashMode();
      }
      // 純滾動時保持 preferredX 鎖定，絕不清除水平記憶欄，避免換行與抖動
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (this.currentTarget && cursorStore.getState().enabled && !cursorStore.getState().isExcluded) {
            this.updateCursorPosition(false, undefined, true);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    const requestResizeUpdate = () => {
      // 僅在視窗寬高尺寸真正改變時，才重設水平記憶欄
      this.preferredX = null;
      requestScrollUpdate();
    };

    this.resizeHandler = requestResizeUpdate;
    this.scrollHandler = requestScrollUpdate;

    window.addEventListener('keydown', this.keydownHandler, true);
    window.addEventListener('keyup', this.keyupHandler, true);
    window.addEventListener('click', this.clickHandler, true);
    window.addEventListener('resize', this.resizeHandler, { passive: true });
    window.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.resizeHandler, { passive: true });
      window.visualViewport.addEventListener('scroll', this.scrollHandler, { passive: true });
    }
  }

  public destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    if (this.keyupHandler) {
      window.removeEventListener('keyup', this.keyupHandler, true);
      this.keyupHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
    if (window.visualViewport) {
      if (this.resizeHandler) {
        window.visualViewport.removeEventListener('resize', this.resizeHandler);
      }
      if (this.scrollHandler) {
        window.visualViewport.removeEventListener('scroll', this.scrollHandler);
      }
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, { capture: true } as EventListenerOptions);
      this.scrollHandler = null;
    }
    if (this.moveTimer) {
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }
    if (this.jumpMenuTimer) {
      clearTimeout(this.jumpMenuTimer);
      this.jumpMenuTimer = null;
    }
    if (this.realignTimer) {
      clearTimeout(this.realignTimer);
      this.realignTimer = null;
    }
    this.closeFlashMode();
  }

  /**
   * 點擊網頁文字時，自動聚焦並初始化游標定位
   */
  private handleClick(e: MouseEvent): void {
    this.closeJumpMenu();
    this.closeFlashMode();
    this.preferredX = null;
    const state = cursorStore.getState();

    // 1. 若處於打字情境、完全停用名單、或擴充功能未啟用，直接忽略
    if (isTypingContext(e) || state.isExcluded || state.enabled === false) {
      return;
    }

    const clickX = e.clientX;
    const clickY = e.clientY;

    const rawTarget = e.composedPath ? e.composedPath()[0] : e.target;
    const targetEl = (rawTarget instanceof Element ? rawTarget : (rawTarget as Node)?.parentElement) as HTMLElement | null;

    if (!targetEl || targetEl.closest('#muzen-cursor-host-root')) {
      return;
    }

    // 2. 智慧防誤觸：點擊按鈕、超連結、下拉選單、分頁標籤、導覽列等互動元件時，100% 保持網頁原生功能，不召喚游標
    if (targetEl.closest('button, a, summary, [role="button"], [role="tab"], [role="menuitem"], .btn, nav, header')) {
      return;
    }

    // 若限定作用容器，非容器內部的點擊一律忽略
    if (this.options?.containerRoot && !this.options.containerRoot.contains(targetEl)) {
      return;
    }

    // 3. 標準 Caret 解析器 (解決 L199 Deprecated 問題，標準優先並兼顧相容性)
    const resolved = resolveTextTargetFromPoint(clickX, clickY, targetEl, (root) => findFirstTextNodeIn(root));
    if (!resolved) {
      return;
    }

    // 4. 關鍵距離防禦：確認找到的文字節點與點擊處的物理距離
    if (!isClickWithinDistanceThreshold(clickX, clickY, resolved.node)) {
      return;
    }

    // 若原本已有游標定位，且點擊處造成實質位移，推入跳轉堆疊 (方便誤觸時按 '' 回復)
    if (this.currentTarget && this.currentTarget.node && this.currentTarget.node.isConnected) {
      if (this.currentTarget.node !== resolved.node || Math.abs(this.currentTarget.offset - resolved.offset) > 3) {
        this.pushJumpPoint();
      }
    }

    this.currentTarget = {
      node: resolved.node,
      offset: resolved.offset
    };
    this.updateActiveScope(resolved.node);

    const curMode = cursorStore.getState().mode;
    if (curMode !== 'VISUAL' && curMode !== 'VISUAL_LINE') {
      this.selectionManager.clearAnchor();
    }

    // 直接喚醒游標並設定為可見，狀態列同步切換為 NORMAL 模式
    cursorStore.setState({ enabled: true, visible: true });
    this.updateCursorPosition(false);
  }

  /**
   * 切換游標啟用 / 深層休眠狀態 (供 Alt + V 全域快捷鍵、內部熱鍵或 Popup 通訊調用)
   */
  public toggle(forceEnabled?: boolean): boolean {
    const state = cursorStore.getState();
    const nextEnabled = typeof forceEnabled === 'boolean' ? forceEnabled : !state.enabled;
    const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];

    if (nextEnabled) {
      cursorStore.setState({ enabled: true, visible: true });
      cursorStore.showStatusNotice(dict.noticeWakeUp, 1500);
      if (!this.currentTarget || !document.contains(this.currentTarget.node)) {
        this.findInitialTarget();
      } else {
        this.updateCursorPosition(true);
      }
    } else {
      this.closeJumpMenu();
      cursorStore.setState({ enabled: false, visible: false });
      cursorStore.showStatusNotice(dict.noticeDeepSleep, 1800);
    }

    return nextEnabled;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const state = cursorStore.getState();

    // 0. 若當前網站在完全停用名單中，100% 不干涉
    if (state.isExcluded) return;

    const config = state.keybindings || DEFAULT_KEYBINDINGS;
    const bindings = config.bindings || DEFAULT_KEYBINDINGS.bindings;

    // 1. 全域強制主開關 (toggleCursor, alt + v)
    // 置於最頂層優先響應，無論焦點在搜尋框或頁面任何地方均可強制開關切換
    if (matchesKeybinding(e, bindings.toggleCursor)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      this.toggle();
      return;
    }

    // 2. 若處於輸入框或富文本編輯器打字情境，不干擾打字
    if (isTypingContext(e)) {
      return;
    }

    const isEscKey = e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey;
    const escapeDoubleDef = bindings.escapeDouble;
    const escapeDef = bindings.escape;

    // 若功能處於深層關閉狀態 (!state.enabled)：支援連按兩次 Esc 雙向重新喚醒 (無需按 Alt + V)
    if (!state.enabled) {
      if (isEscKey && escapeDoubleDef?.enabled !== false) {
        const now = Date.now();
        const isDoubleEsc = now - this.lastEscTime < 500;
        this.lastEscTime = now;

        if (isDoubleEsc) {
          // 連按兩次 Esc：強制重新喚醒游標與狀態列！
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.lastEscTime = 0;
          cursorStore.setState({ enabled: true, visible: true });
          const dict = LOCALES[cursorStore.getState().locale || 'zh-TW'] || LOCALES['zh-TW'];
          cursorStore.showStatusNotice(dict.noticeWakeUp, 1500);
          if (!this.currentTarget || !document.contains(this.currentTarget.node)) {
            this.findInitialTarget();
          } else {
            this.updateCursorPosition(true);
          }

        }
      }
      return;
    }

    // 3. Esc 鍵處理：單按為淺層休眠 (保留狀態列)，連按為深層關閉 (關閉狀態列釋放按鍵)
    if (state.lightboxImage) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.handleLightboxKey(e);
      return;
    }

    if (isEscKey) {
      const now = Date.now();
      const isDoubleEsc = now - this.lastEscTime < 500;
      this.lastEscTime = now;

      // 若 Flash 跳轉模式開啟中，優先關閉 Flash 層，並重置 Esc 計時器避免誤觸深層關閉
      if (state.isFlashMode) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.closeFlashMode();
        this.lastEscTime = 0;
        return;
      }

      // 若浮動選單開啟中，優先關閉選單，並重置 Esc 計時器避免誤觸深層關閉
      if (state.isJumpMenuOpen) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.closeJumpMenu();
        this.lastEscTime = 0;

      }

      if (this.jumpMenuTimer) {
        clearTimeout(this.jumpMenuTimer);
        this.jumpMenuTimer = null;
      }

      // 連按兩次 Esc：若 escapeDouble 啟用，深層關閉功能 (狀態列一併關閉隱藏，100% 釋放按鍵與點擊)
      if (isDoubleEsc && escapeDoubleDef?.enabled !== false) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.lastEscTime = 0;
        if (this.realignTimer) {
          clearTimeout(this.realignTimer);
          this.realignTimer = null;
        }
        cursorStore.setState({ enabled: false, visible: false });
        const dict = LOCALES[cursorStore.getState().locale || 'zh-TW'] || LOCALES['zh-TW'];
        cursorStore.showStatusNotice(dict.noticeDeepSleep, 1800);

      }

      // 單按 Esc：若 escape 啟用
      if (escapeDef?.enabled !== false) {
        // 若有輸入緩衝或次數前綴，按 Esc 優先取消緩衝區 (攔截事件避免誤觸外層)
        if (this.countPrefix > 0 || state.pendingKeys) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.clearPendingKeys();

        }

        // 單按 Esc：若處於 VISUAL 或 VISUAL_LINE 模式，退出選取回到 NORMAL (攔截事件)
        if (state.mode === 'VISUAL' || state.mode === 'VISUAL_LINE') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.exitVisualMode();

        }

        // 若原本就已處於淺層待命 (!visible)，維持待命
        if (!state.visible) {

        }

        // 單按 Esc：由活動狀態轉為淺層休眠待機 (隱藏游標，保留右下角狀態列「按 j 開始」，隨時可喚醒)
        // 注意：此處不呼叫 preventDefault / stopPropagation，允許事件穿透冒泡給網頁原生 Modal、全螢幕或彈窗響應
        if (this.realignTimer) {
          clearTimeout(this.realignTimer);
          this.realignTimer = null;
        }
        cursorStore.setState({ visible: false });

      }
    }

    // 4. 落實右下角「按 j 開始」：若游標處於淺層待機 (!visible)，按下移動或翻頁鍵時直接喚醒
    if (!state.visible) {
      if (matchesKeybinding(e, bindings.moveDown)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cursorStore.setState({ enabled: true, visible: true });
        if (!this.currentTarget || !document.contains(this.currentTarget.node)) {
          this.findInitialTarget();
        } else {
          this.moveVertical(1);
        }

      }
      if (matchesKeybinding(e, bindings.halfPageDown)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cursorStore.setState({ enabled: true, visible: true });
        if (!this.currentTarget || !document.contains(this.currentTarget.node)) {
          this.findInitialTarget();
        } else {
          this.moveHalfPage(true, e.repeat);
        }

      }
      if (matchesKeybinding(e, bindings.halfPageUp)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cursorStore.setState({ enabled: true, visible: true });
        if (!this.currentTarget || !document.contains(this.currentTarget.node)) {
          this.findInitialTarget();
        } else {
          this.moveHalfPage(false, e.repeat);
        }

      }
      if (matchesKeybinding(e, bindings.moveUp)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cursorStore.setState({ enabled: true, visible: true });
        if (!this.currentTarget || !document.contains(this.currentTarget.node)) {
          this.findInitialTarget();
        } else {
          this.moveVertical(-1);
        }

      }
      // 其他單鍵與快捷鍵在休眠時 100% 自然放行給網頁原生
      return;
    }

    // 5. 游標處於喚醒接管狀態 (visible: true)：所有 Vim 按鍵全面接管
    const intercept = () => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    // 0. 若浮動歷史選單開啟中：優先處理數字鍵 [1-9] 跳轉與 Esc 取消
    if (state.isJumpMenuOpen) {
      if (/^[1-9]$/.test(e.key)) {
        intercept();
        this.jumpToMenuItem(Number(e.key));

      }
      intercept();
      this.closeJumpMenu();
      return;
    }

    // 0.2 若 Flash 全域視覺跳轉模式開啟中：優先處理標籤選擇與即時搜尋過濾
    if (state.isFlashMode) {
      this.handleFlashKey(e, intercept);
      return;
    }

    // 0.5 處理數字計數前綴 (Count Prefix，例如 5j, 10k, 3w)
    const isPlainNumber = /^[0-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey;
    if (isPlainNumber) {
      // 若尚未有計數，首個數字不得為 0 (Vim 中 0 為行首指令 lineStart)
      if (this.countPrefix === 0 && e.key !== '0') {
        intercept();
        this.countPrefix = Number(e.key);
        this.setPendingKeys(String(this.countPrefix));

      } else if (this.countPrefix > 0) {
        intercept();
        this.countPrefix = Math.min(999, this.countPrefix * 10 + Number(e.key));
        this.setPendingKeys(String(this.countPrefix));

      }
    }

    // 若有掛起的單按 ' 或 ` 浮動選單計時器，非單按時予以清除
    if (this.jumpMenuTimer && e.key !== "'" && e.key !== '`') {
      clearTimeout(this.jumpMenuTimer);
      this.jumpMenuTimer = null;
    }

    // 連續指令比對 (如 gg 或 '', ``)
    const now = Date.now();
    const prevKey = this.lastKey;
    const isDoubleKey = prevKey.toLowerCase() === e.key.toLowerCase() && now - this.lastKeyTime < 500;
    this.lastKey = e.key;
    this.lastKeyTime = now;

    // 1. 跳回前一跳轉點行首 (jumpBackLine: 預設 '')
    const jumpBackLineDef = bindings.jumpBackLine;
    if (jumpBackLineDef && jumpBackLineDef.enabled) {
      const isConfiguredKey = jumpBackLineDef.key === e.key;
      const isDoubleBack = isConfiguredKey && isDoubleKey;
      if (jumpBackLineDef.isDouble ? isDoubleBack : matchesKeybinding(e, jumpBackLineDef)) {
        if (this.jumpMenuTimer) {
          clearTimeout(this.jumpMenuTimer);
          this.jumpMenuTimer = null;
        }
        intercept();
        this.lastKey = '';
        this.clearPendingKeys();
        this.jumpBack(false); // false: 同一行行首

      }

      // 單按 ' 鍵：啟動 400ms 計時器，若未按第二下則喚醒 Neovim 浮動選單
      if (e.key === "'" && !e.ctrlKey && !e.altKey && !e.metaKey && !isDoubleKey) {
        this.setPendingKeys("'", 500);
        if (config.enableJumpMenu !== false && this.jumpHistory.length > 0) {
          this.jumpMenuTimer = setTimeout(() => {
            this.openJumpMenu();
          }, 400);
        }
      }
    }

    // 2. 跳回前一跳轉點精確字元 (jumpBackExact: 預設 ``)
    const jumpBackExactDef = bindings.jumpBackExact;
    if (jumpBackExactDef && jumpBackExactDef.enabled) {
      const isConfiguredKey = jumpBackExactDef.key === e.key;
      const isDoubleBack = isConfiguredKey && isDoubleKey;
      if (jumpBackExactDef.isDouble ? isDoubleBack : matchesKeybinding(e, jumpBackExactDef)) {
        if (this.jumpMenuTimer) {
          clearTimeout(this.jumpMenuTimer);
          this.jumpMenuTimer = null;
        }
        intercept();
        this.lastKey = '';
        this.clearPendingKeys();
        this.jumpBack(true); // true: 同一字元精確位置

      }

      // 單按 ` 鍵：啟動 400ms 計時器，若未按第二下則喚醒 Neovim 浮動選單 (精確字元模式)
      if (e.key === '`' && !e.ctrlKey && !e.altKey && !e.metaKey && !isDoubleKey) {
        this.setPendingKeys('`', 500);
        if (config.enableJumpMenu !== false && this.jumpHistory.length > 0) {
          this.jumpMenuTimer = setTimeout(() => {
            this.openJumpMenu(true);
          }, 400);
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
        this.jumpToDocumentStart();

      } else if (isConfiguredKey && docStartDef.isDouble && !isDoubleKey) {
        this.setPendingKeys(e.key, 500);
      }
    }

    if (matchesKeybinding(e, bindings.visualLineMode)) {
      intercept();
      this.clearPendingKeys();
      this.toggleVisualLineMode();
      return;
    }

    if (matchesKeybinding(e, bindings.visualMode)) {
      intercept();
      this.clearPendingKeys();
      this.toggleVisualMode();
      return;
    }

    if (matchesKeybinding(e, bindings.yank)) {
      if (state.mode === 'VISUAL' || state.mode === 'VISUAL_LINE') {
        intercept();
        this.clearPendingKeys();
        this.yankSelection();
      }
      return;
    }

    // 超連結與互動元素點選處理：僅在 NORMAL 模式下響應
    if (state.mode === 'NORMAL') {
      const openLinkNewTabDef = bindings.openLinkNewTab;
      const isCmdOrCtrlEnter = e.key === 'Enter' && (e.ctrlKey || e.metaKey);
      const matchesNewTab = Boolean(
        openLinkNewTabDef?.enabled && (
          matchesKeybinding(e, openLinkNewTabDef) ||
          (openLinkNewTabDef.key === 'Enter' && isCmdOrCtrlEnter)
        )
      );

      const anchor = this.getHoveredAnchor(this.currentTarget);

      if (matchesNewTab && anchor) {
        intercept();
        this.clearPendingKeys();
        this.openCurrentLink(true);
        return;
      }

      const openLinkDef = bindings.openLink;
      if (openLinkDef?.enabled && matchesKeybinding(e, openLinkDef)) {
        // 若當前游標停駐於圖片上，按 Enter 開啟燈箱放大檢視
        if (this.currentMediaElement && this.openCurrentImageLightbox()) {
          intercept();
          this.clearPendingKeys();
          return;
        }

        if (anchor) {
          intercept();
          this.clearPendingKeys();
          this.openCurrentLink(false);
          return;
        }

        // 若非 <a> 但為標準可點選/切換之 Toggle、按鈕或 ARIA 控制項，亦模擬點選
        const interactiveEl = this.getHoveredInteractiveElement(this.currentTarget);
        if (interactiveEl) {
          intercept();
          this.clearPendingKeys();
          interactiveEl.click();
          return;
        }
      }
    }

    if (matchesKeybinding(e, bindings.moveLeft)) {
      intercept();
      this.recordNavCharge(e.repeat);
      const count = this.consumeCount();
      for (let i = 0; i < count; i++) this.moveHorizontal(-1);
      return;
    }

    if (matchesKeybinding(e, bindings.moveRight)) {
      intercept();
      this.recordNavCharge(e.repeat);
      const count = this.consumeCount();
      for (let i = 0; i < count; i++) this.moveHorizontal(1);
      return;
    }

    if (matchesKeybinding(e, bindings.moveUp)) {
      intercept();
      this.recordNavCharge(e.repeat);
      const count = this.consumeCount();
      this.moveVertical(-1 * count, e.repeat);
      return;
    }

    if (matchesKeybinding(e, bindings.moveDown)) {
      intercept();
      this.recordNavCharge(e.repeat);
      const count = this.consumeCount();
      this.moveVertical(1 * count, e.repeat);
      return;
    }

    if (matchesKeybinding(e, bindings.wordForward)) {
      intercept();
      this.recordNavCharge(e.repeat);
      const count = this.consumeCount();
      for (let i = 0; i < count; i++) this.moveWordForward();
      return;
    }

    if (matchesKeybinding(e, bindings.wordBackward)) {
      intercept();
      this.recordNavCharge(e.repeat);
      const count = this.consumeCount();
      for (let i = 0; i < count; i++) this.moveWordBackward();
      return;
    }

    if (matchesKeybinding(e, bindings.wordEnd)) {
      intercept();
      this.recordNavCharge(e.repeat);
      const count = this.consumeCount();
      for (let i = 0; i < count; i++) this.moveWordEnd();
      return;
    }

    if (matchesKeybinding(e, bindings.lineStart)) {
      intercept();
      this.recordNavCharge(e.repeat);
      this.clearPendingKeys();
      this.jumpToLineBoundary(true);
      return;
    }

    if (matchesKeybinding(e, bindings.lineEnd)) {
      intercept();
      this.recordNavCharge(e.repeat);
      this.clearPendingKeys();
      this.jumpToLineBoundary(false);
      return;
    }

    if (matchesKeybinding(e, bindings.halfPageDown)) {
      intercept();
      this.recordNavCharge(e.repeat);
      this.clearPendingKeys();
      this.moveHalfPage(true, e.repeat);
      return;
    }

    if (matchesKeybinding(e, bindings.halfPageUp)) {
      intercept();
      this.recordNavCharge(e.repeat);
      this.clearPendingKeys();
      this.moveHalfPage(false, e.repeat);
      return;
    }

    if (matchesKeybinding(e, bindings.docEnd)) {
      intercept();
      this.recordNavCharge(e.repeat);
      this.clearPendingKeys();
      this.jumpToDocumentEnd();
      return;
    }

    if (matchesKeybinding(e, bindings.flashJump)) {
      intercept();
      this.clearPendingKeys();
      this.openFlashMode('hint');
      return;
    }

    if (matchesKeybinding(e, bindings.flashSearch)) {
      intercept();
      this.clearPendingKeys();
      this.openFlashMode('search');
      return;
    }

    // 其他未匹配之普通按鍵，若存在計數前綴則清空重置
    if (!isPlainNumber && this.countPrefix > 0) {
      this.clearPendingKeys();
    }
  }

  /**
   * 鍵盤放開事件 (KeyUp)：通知冷卻衰減
   */
  private handleKeyUp(_e: KeyboardEvent): void {
    // 釋放按鍵時，由 VimCursorOverlay 之 RAF 散熱冷卻引擎平滑衰減
  }

  /**
   * 取得當前文字目標所處的超連結元素 (a[href])
   */
  public getHoveredAnchor(target: TextTarget | null): HTMLAnchorElement | null {
    if (!target || !target.node) return null;
    const parent = target.node.parentElement || (target.node instanceof HTMLElement ? target.node : null);
    if (!parent) return null;
    return parent.closest('a[href]') as HTMLAnchorElement | null;
  }

  /**
   * 取得當前文字目標所處的標準互動/切換元素 (Button / Summary / ARIA 控制項)
   * 依循 W3C/ARIA 規範，並設有最大面積限制以防誤觸外層大容器
   */
  public getHoveredInteractiveElement(target: TextTarget | null): HTMLElement | null {
    if (!target || !target.node) return null;
    const parent = target.node.parentElement || (target.node instanceof HTMLElement ? target.node : null);
    if (!parent) return null;

    const INTERACTIVE_SELECTOR = [
      'button:not([disabled])',
      'summary',
      'input[type="checkbox"]',
      'input[type="button"]',
      'input[type="submit"]',
      '[role="button"]',
      '[role="switch"]',
      '[role="tab"]',
      '[role="checkbox"]',
      '[aria-expanded]',
      '[aria-pressed]'
    ].join(',');

    const el = parent.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
    if (!el) return null;

    // 防誤觸機制：過濾掉面積過大的外層容器 (例如寬高超過視窗 70% 的版面區塊)
    const rect = el.getBoundingClientRect();
    const maxW = window.innerWidth * 0.7;
    const maxH = window.innerHeight * 0.7;
    if (rect.width > maxW && rect.height > maxH) {
      return null;
    }

    return el;
  }

  /**
   * 點選或在背景新分頁開啟當前超連結
   */
  public openCurrentLink(inNewTab: boolean = false): boolean {
    const anchor = this.getHoveredAnchor(this.currentTarget);
    if (!anchor || !anchor.href) return false;

    const href = anchor.href;
    const dict = LOCALES[cursorStore.getState().locale || 'zh-TW'] || LOCALES['zh-TW'];

    if (inNewTab) {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'OPEN_TAB',
            url: href,
            active: false
          });
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      } catch {
        window.open(href, '_blank', 'noopener,noreferrer');
      }

      cursorStore.showStatusNotice(`↗ ${dict.actionOpenLinkNewTab || '新分頁已開啟'}`, 1200);
      return true;
    }

    // 當前分頁點選開啟
    anchor.click();
    return true;
  }

  /**
   * 水平移動 (h / l)
   */
  public moveHorizontal(delta: number): void {
    this.preferredX = null;
    this.clearMediaTarget();
    if (!this.currentTarget || !this.currentTarget.node.isConnected) {
      this.findInitialTarget();
      if (!this.currentTarget || !this.currentTarget.node.isConnected) return;
    }

    const { node, offset } = this.currentTarget;
    const textLength = node.textContent?.length || 0;

    const effectiveRoot = this.getEffectiveRoot();
    const isOutOfFlow = isOutOfNormalFlowWidget(node, effectiveRoot);

    if (delta > 0) {
      // 向右移動 (l)
      const nextOffset = offset + delta;
      if (nextOffset < textLength) {
        this.currentTarget.offset = nextOffset;
        this.updateCursorPosition(true);
      } else {
        // 到達當前文字節點末尾，平滑無縫跨入下一個文字標籤之首字元
        const nextNode = findNextTextNode(node, effectiveRoot, isOutOfFlow);
        if (nextNode) {
          this.currentTarget = { node: nextNode, offset: 0 };
          this.updateActiveScope(nextNode);
          this.updateCursorPosition(true);
        }
      }
    } else if (delta < 0) {
      // 向左移動 (h)
      const nextOffset = offset + delta;
      if (nextOffset >= 0) {
        this.currentTarget.offset = nextOffset;
        this.updateCursorPosition(true);
      } else {
        // 到達當前文字節點開頭，平滑跨入前一個文字節點之末尾字元
        const prevNode = findPrevTextNode(node, effectiveRoot, isOutOfFlow);
        if (prevNode) {
          const prevLen = prevNode.textContent?.length || 0;
          this.currentTarget = {
            node: prevNode,
            offset: Math.max(0, prevLen - 1)
          };
          this.updateActiveScope(prevNode);
          this.updateCursorPosition(true);
        }
      }
    }
  }

  /**
   * 垂直移動 (j / k) - 穿透同行 <a>, <span>, <code> 標籤，精準鎖定下一視覺行
   */
  public moveVertical(deltaRows: number, isRepeat: boolean = false): void {
    const isDownward = deltaRows > 0;
    const direction = isDownward ? 'down' : 'up';

    // 若當前游標停駐於圖片/媒體元素上
    if (this.currentMediaElement) {
      if (this.handleMediaVerticalStep(direction, false, isRepeat)) {
        return;
      }

      const prevMedia = this.currentMediaElement;
      const prevEntryDir = this.mediaEntryDirection;
      const pendingTarget = this.pendingTargetAfterMedia;
      const prevRect = prevMedia.getBoundingClientRect();
      this.clearMediaTarget();

      // 同方向離開圖片：若有下一張相鄰媒體優先停駐，否則直接落地於圖片後方的文字行
      const effRoot = this.getEffectiveRoot();
      const allowOut = isOutOfNormalFlowWidget(prevMedia, effRoot);
      const nextMedia = findNextMediaAfter(
        isDownward ? prevRect.bottom : prevRect.top,
        direction,
        effRoot,
        allowOut,
        prevMedia
      );

      if (prevEntryDir === direction && pendingTarget && pendingTarget.node.isConnected) {
        const pendingRect = getCharRectOfTarget(pendingTarget);
        const mediaBetween = nextMedia ? nextMedia.getBoundingClientRect() : null;
        const isMediaBeforePending = mediaBetween && pendingRect
          ? (isDownward ? mediaBetween.top < pendingRect.y - 6 : mediaBetween.bottom > pendingRect.y + 6)
          : false;

        if (isMediaBeforePending && nextMedia) {
          this.enterMediaTarget(nextMedia, direction, isRepeat, pendingTarget);
          return;
        }
        this.currentTarget = pendingTarget;
        this.updateActiveScope(pendingTarget.node);
        this.updateCursorPosition(true, undefined, false, true, direction, isRepeat);
        return;
      }

      // 反向按鍵（例如向下進入圖片後立刻按 k 回頭）：回到原本圖片前的文字行
      if (prevEntryDir && prevEntryDir !== direction && this.currentTarget && this.currentTarget.node.isConnected) {
        this.updateCursorPosition(true, undefined, false, true, direction, isRepeat);
        return;
      }

      // 從 f 跳轉進入圖片後首次按 j/k：以圖片鄰近位置作為起點尋找文字或下一張圖片
      if (nextMedia && Math.abs((isDownward ? nextMedia.getBoundingClientRect().top - prevRect.bottom : prevRect.top - nextMedia.getBoundingClientRect().bottom)) < 40) {
        this.enterMediaTarget(nextMedia, direction, isRepeat);
        return;
      }
    }

    if (!this.currentTarget || !this.currentTarget.node.isConnected) {
      this.findInitialTarget(direction);
      if (!this.currentTarget || !this.currentTarget.node.isConnected) return;
    }

    const steps = Math.abs(deltaRows);
    const waypoints: CursorRect[] = [];

    for (let step = 0; step < steps; step++) {
      if (!this.currentTarget) break;
      const target: TextTarget = this.currentTarget;
      const { node, offset } = target;
      const len = node.textContent?.length || 0;
      if (len === 0) break;

      // 1. 取得當前真實字元的螢幕基準線
      const charRect = getCharRectOfTarget(target);
      const baseRange = document.createRange();
      const safeFrom = Math.min(offset, Math.max(0, len - 1));
      baseRange.setStart(node, safeFrom);
      baseRange.setEnd(node, Math.min(safeFrom + 1, len));
      const baseRect = baseRange.getBoundingClientRect();

      const storedRect = cursorStore.getState().rect;
      const hasValidBaseRect = baseRect.height > 0 && (baseRect.left !== 0 || baseRect.top !== 0);
      const currentCharTop = charRect
        ? charRect.y
        : (hasValidBaseRect ? baseRect.top : (storedRect?.y ?? 0));
      const charHeight = charRect
        ? charRect.height
        : (baseRect.height > 0 ? baseRect.height : (storedRect?.height > 0 ? storedRect.height : 22));
      const lineThreshold = charHeight * 0.65;

      // 2. 鎖定或保持基準水平 X 座標 (Vim 經典行為)
      if (this.preferredX === null) {
        this.preferredX = charRect
          ? charRect.x
          : (baseRect.width > 0 ? baseRect.left : (storedRect?.x ?? 0));
      }
      const targetX = this.preferredX;

      const effRoot = this.getEffectiveRoot();
      let foundTarget: TextTarget | null = isDownward
        ? searchDownwardNextLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX, effRoot)
        : searchUpwardPrevLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX, effRoot);

      // 非對稱邊界自然逃逸 (Conditional Flow Escape)：
      // 1. 若在當前局部作用域已抵達邊界 (找不到下一行或上一行)，且當前並非全域根節點
      // 2. 核心守護門檻：只有當前作用域屬於「正文常態流內容器 (In-Flow Container)」時才允許向外逃逸至主閱讀流；
      //    若屬於「脫離常態流之側欄/浮動掛件 (Out-of-Flow Widget)」，則嚴格封印不逃逸，100% 杜絕側欄無限延展與隨意外溢
      if (!foundTarget && effRoot !== this.rootElement) {
        const isSidebarOrWidget = isOutOfNormalFlowWidget(effRoot, this.rootElement);
        if (!isSidebarOrWidget) {
          foundTarget = isDownward
            ? searchDownwardNextLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX, this.rootElement)
            : searchUpwardPrevLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX, this.rootElement);
        }
      }

      if (foundTarget) {
        // 偵測從目前文字行到目標文字行之間是否有跨過大型可視圖片/媒體元素
        const foundRect = getCharRectOfTarget(foundTarget);
        if (foundRect && step === steps - 1) {
          const allowOut = isOutOfNormalFlowWidget(node, effRoot);
          const mediaBetween = findMediaBetweenVerticalRange(
            isDownward ? (currentCharTop + charHeight * 0.5) : currentCharTop,
            foundRect.y,
            direction,
            effRoot,
            allowOut
          );
          if (mediaBetween) {
            this.enterMediaTarget(mediaBetween, direction, isRepeat, foundTarget);
            return;
          }
        }

        this.currentTarget = foundTarget;
        this.updateActiveScope(foundTarget.node);

        // 若不是最後一步，收集中間經過的視覺行真實路徑點
        if (step < steps - 1) {
          const rect = getCharRectOfTarget(foundTarget);
          if (rect) {
            waypoints.push(rect);
          }
        }
      } else {
        // 若無後續文字，檢查上方或下方是否還有大型圖片（例如純圖片區或文末大圖）
        if (step === 0) {
          const allowOut = isOutOfNormalFlowWidget(node, effRoot);
          const trailingMedia = findNextMediaAfter(
            isDownward ? (currentCharTop + charHeight) : currentCharTop,
            direction,
            effRoot,
            allowOut
          );
          if (trailingMedia) {
            this.enterMediaTarget(trailingMedia, direction, isRepeat, null);
            return;
          }
        }

        // 邊界防護與提示：若往下移動且當前位置已無法再下移，觸發狀態列 Toast 提示
        if (isDownward && step === 0) {
          const now = Date.now();
          if (now - this.lastBoundaryNoticeTime > 1500) {
            this.lastBoundaryNoticeTime = now;
            const state = cursorStore.getState();
            const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];
            const isSidebarOrWidget = effRoot !== this.rootElement && isOutOfNormalFlowWidget(effRoot, this.rootElement);
            const notice = isSidebarOrWidget ? dict.noticeWidgetBottom : dict.noticePageBottom;
            cursorStore.showStatusNotice(notice, 1500);
          }
        }
        break;
      }
    }

    this.updateCursorPosition(true, waypoints, false, true, isDownward ? 'down' : 'up', isRepeat);
  }

  /**
   * 跳至下一個詞彙 (w)
   */
  public moveWordForward(): void {
    this.preferredX = null;
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = this.currentTarget;
    const text = node.textContent || '';
    const nextOffset = WordNavigator.getNextWordOffset(text, offset);

    if (nextOffset < text.length) {
      this.currentTarget.offset = nextOffset;
      this.updateCursorPosition(true);
    } else {
      // 跨節點尋找下一個詞首
      const effectiveRoot = this.getEffectiveRoot();
      const isOutOfFlow = isOutOfNormalFlowWidget(node, effectiveRoot);
      const nextNode = findNextTextNode(node, effectiveRoot, isOutOfFlow);
      if (nextNode) {
        const nextText = nextNode.textContent || '';
        const initialOffset = WordNavigator.getNextWordOffset(nextText, -1);
        this.currentTarget = {
          node: nextNode,
          offset: initialOffset < nextText.length ? initialOffset : 0
        };
        this.updateActiveScope(nextNode);
        this.updateCursorPosition(true);
      }
    }
  }

  /**
   * 前退至上一個詞彙 (b)
   */
  public moveWordBackward(): void {
    this.preferredX = null;
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = this.currentTarget;
    const text = node.textContent || '';
    const prevOffset = WordNavigator.getPrevWordOffset(text, offset);

    if (prevOffset < offset) {
      this.currentTarget.offset = prevOffset;
      this.updateCursorPosition(true);
    } else {
      // 跨至前一個文字節點
      const effectiveRoot = this.getEffectiveRoot();
      const isOutOfFlow = isOutOfNormalFlowWidget(node, effectiveRoot);
      const prevNode = findPrevTextNode(node, effectiveRoot, isOutOfFlow);
      if (prevNode) {
        const prevText = prevNode.textContent || '';
        const lastWord = WordNavigator.getPrevWordOffset(prevText, prevText.length);
        this.currentTarget = {
          node: prevNode,
          offset: lastWord
        };
        this.updateActiveScope(prevNode);
        this.updateCursorPosition(true);
      }
    }
  }

  /**
   * 跳至目前詞彙尾端 (e)
   */
  public moveWordEnd(): void {
    this.preferredX = null;
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = this.currentTarget;
    const text = node.textContent || '';
    const endOffset = WordNavigator.getWordEndOffset(text, offset);

    if (endOffset < text.length) {
      this.currentTarget.offset = endOffset;
      this.updateCursorPosition(true);
    } else {
      const effectiveRoot = this.getEffectiveRoot();
      const isOutOfFlow = isOutOfNormalFlowWidget(node, effectiveRoot);
      const nextNode = findNextTextNode(node, effectiveRoot, isOutOfFlow);
      if (nextNode) {
        const nextText = nextNode.textContent || '';
        const nextEnd = WordNavigator.getWordEndOffset(nextText, 0);
        this.currentTarget = {
          node: nextNode,
          offset: nextEnd
        };
        this.updateActiveScope(nextNode);
        this.updateCursorPosition(true);
      }
    }
  }

  /**
   * 跳至行首 (0) 或行尾 ($)
   */
  public jumpToLineBoundary(isStart: boolean): void {
    this.preferredX = null;
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    // 透過 CSSOM 精確計算真實視覺行邊界 (穿透 <b>, <span> 等行內標籤並相容折行)
    const boundary = findVisualLineBoundary(this.currentTarget, isStart, this.getEffectiveRoot());
    this.currentTarget = boundary;
    this.updateCursorPosition(true);
  }

  /**
   * 記錄當前游標與視窗捲動位置至 Jump 歷史堆疊
   */
  private pushJumpPoint(customPoint?: JumpPoint): void {
    let pointToPush = customPoint;
    if (!pointToPush) {
      if (!this.currentTarget || !this.currentTarget.node) return;
      const scrollParent = getScrollParent(this.currentTarget.node, this.options?.containerRoot);
      const scrollX = scrollParent ? scrollParent.scrollLeft : (window.scrollX ?? window.pageXOffset ?? 0);
      const scrollY = scrollParent ? scrollParent.scrollTop : (window.scrollY ?? window.pageYOffset ?? 0);

      pointToPush = {
        node: this.currentTarget.node,
        offset: this.currentTarget.offset,
        scrollX,
        scrollY
      };
    }

    const last = this.jumpHistory[this.jumpHistory.length - 1];
    if (last && last.node === pointToPush.node && Math.abs(last.offset - pointToPush.offset) <= 2) {
      return;
    }

    if (this.jumpHistory.length >= this.MAX_JUMPS) {
      this.jumpHistory.shift();
    }

    this.jumpHistory.push(pointToPush);
    this.lastJumpBackTarget = null;
  }

  /**
   * 跳回前一跳轉點 / 復原位置
   * @param exact true 為精確字元 (``)，false 為跳至該行行首 ('')
   * 支援兩種模式：
   * 1. 'toggle' (預設)：Vim 經典雙點來回切換，在跳轉前與跳轉後兩點間反覆互換
   * 2. 'history'：沿著跳轉歷史堆疊依序回溯 (最多 30 步)
   */
  public jumpBack(exact: boolean = false): void {
    const jumpMode = cursorStore.getState().keybindings?.jumpMode || 'toggle';

    if (jumpMode === 'toggle') {
      // 1. 若已有 Toggle 恢復點 (剛才跳回前的位置)，切換回該位置
      if (this.lastJumpBackTarget) {
        const toggleTarget = this.lastJumpBackTarget;
        this.lastJumpBackTarget = null;

        if (this.currentTarget && this.currentTarget.node) {
          const scrollParent = getScrollParent(this.currentTarget.node, this.options?.containerRoot);
          const scrollX = scrollParent ? scrollParent.scrollLeft : (window.scrollX ?? window.pageXOffset ?? 0);
          const scrollY = scrollParent ? scrollParent.scrollTop : (window.scrollY ?? window.pageYOffset ?? 0);
          this.lastJumpBackTarget = {
            node: this.currentTarget.node,
            offset: this.currentTarget.offset,
            scrollX,
            scrollY
          };
        }

        this.restoreJumpPoint(toggleTarget, exact);

      }

      // 2. 從歷史堆疊讀取最新一筆跳轉點 (不破壞堆疊)
      if (this.jumpHistory.length === 0) {

      }

      const targetPoint = this.jumpHistory[this.jumpHistory.length - 1];

      // 保存跳轉前當前位置作為 Toggle 目標
      if (this.currentTarget && this.currentTarget.node) {
        const scrollParent = getScrollParent(this.currentTarget.node, this.options?.containerRoot);
        const scrollX = scrollParent ? scrollParent.scrollLeft : (window.scrollX ?? window.pageXOffset ?? 0);
        const scrollY = scrollParent ? scrollParent.scrollTop : (window.scrollY ?? window.pageYOffset ?? 0);
        this.lastJumpBackTarget = {
          node: this.currentTarget.node,
          offset: this.currentTarget.offset,
          scrollX,
          scrollY
        };
      }

      this.restoreJumpPoint(targetPoint, exact);
      return;
    }

    // History 模式：依序從堆疊回溯
    if (this.jumpHistory.length === 0) {
      return;
    }

    const targetPoint = this.jumpHistory.pop()!;
    this.restoreJumpPoint(targetPoint, exact);
  }

  private restoreJumpPoint(point: JumpPoint, exact: boolean = false): void {
    const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    this.triggerRearviewNotice(point.scrollY < currentScroll ? 'up' : 'down');
    const duration = cursorStore.getState().advanced?.scrollDurationMs ?? 380;

    if (point.node && point.node.isConnected) {
      let target: TextTarget = {
        node: point.node as Text,
        offset: Math.min(point.offset, point.node.textContent?.length || 0)
      };

      // 若為行首模式 (如 '')，透過 CSSOM 精確計算真實視覺行首 (穿透 <b>, <span> 等標籤)
      if (!exact) {
        target = findVisualLineBoundary(target, true, this.rootElement);
      }

      this.currentTarget = target;
      this.updateCursorPosition(true);

      if (this.options?.enableScroll !== false) {
        const scrollParent = getScrollParent(this.currentTarget.node, this.options?.containerRoot);
        if (scrollParent) {
          animateScrollTo(scrollParent, point.scrollY, duration);
        } else if (!this.options?.containerRoot) {
          animateScrollTo(window, point.scrollY, duration);
        }
      }
    } else {
      if (this.options?.enableScroll !== false) {
        if (!this.options?.containerRoot) {
          animateScrollTo(window, point.scrollY, duration);
        }
      }
    }
  }

  public openJumpMenu(exact: boolean = false): void {
    const config = cursorStore.getState().keybindings;
    if (config?.enableJumpMenu === false || this.jumpHistory.length === 0) {
      return;
    }

    this.isJumpMenuExact = exact;
    const recent = this.jumpHistory.slice(-9).reverse();
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    const items: JumpMenuItem[] = recent.map((p, idx) => {
      const raw = p.node?.textContent || '';
      const snippet = raw.slice(p.offset, p.offset + 25).trim() || raw.slice(0, 25).trim() || '(位置錨點)';
      const scrollPercent = Math.min(100, Math.max(0, Math.round((p.scrollY / maxScroll) * 100)));
      return {
        index: idx + 1,
        textPreview: snippet,
        scrollPercent,
        point: p
      };
    });

    cursorStore.setState({ isJumpMenuOpen: true, jumpMenuItems: items });
  }

  public closeJumpMenu(): void {
    if (this.jumpMenuTimer) {
      clearTimeout(this.jumpMenuTimer);
      this.jumpMenuTimer = null;
    }
    if (cursorStore.getState().isJumpMenuOpen) {
      cursorStore.setState({ isJumpMenuOpen: false });
    }
  }

  public jumpToMenuItem(index: number): void {
    const items = cursorStore.getState().jumpMenuItems || [];
    const item = items.find((it) => it.index === index);
    if (item && item.point) {
      const exact = this.isJumpMenuExact;
      this.closeJumpMenu();
      this.restoreJumpPoint(item.point, exact);
    }
  }

  /**
   * 開啟 Flash 全域視覺跳轉模式 (hint: 區塊標籤直達 / search: flash.nvim 搜尋過濾)
   */
  public openFlashMode(mode: 'hint' | 'search' = 'hint'): void {
    this.closeJumpMenu();
    if (mode === 'search') {
      cursorStore.setState({
        isFlashMode: true,
        flashInputMode: 'search',
        flashQuery: '',
        flashHints: [],
        pendingKeys: ''
      });
      return;
    }

    const hints = collectFlashHints(this.rootElement, '');
    if (hints.length === 0) {
      const dict = LOCALES[cursorStore.getState().locale || 'zh-TW'] || LOCALES['zh-TW'];
      cursorStore.showStatusNotice(dict.noticeFlashEmpty, 1500);
      return;
    }
    cursorStore.setState({
      isFlashMode: true,
      flashInputMode: 'hint',
      flashQuery: '',
      flashHints: hints,
      pendingKeys: ''
    });
  }

  /**
   * 關閉 Flash 全域視覺跳轉模式
   */
  public closeFlashMode(): void {
    const state = cursorStore.getState();
    if (state.isFlashMode || state.flashQuery || state.flashHints.length > 0) {
      cursorStore.setState({
        isFlashMode: false,
        flashInputMode: 'hint',
        flashQuery: '',
        flashHints: [],
        pendingKeys: state.pendingKeys.startsWith('f:') ? '' : state.pendingKeys
      });
    }
  }

  private handleFlashKey(e: KeyboardEvent, intercept: () => void): void {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.isComposing) {
      return;
    }

    intercept();
    const state = cursorStore.getState();
    const currentPrefix = state.pendingKeys.startsWith('f:') ? state.pendingKeys.slice(2) : '';

    if (e.key === 'Backspace') {
      if (currentPrefix.length > 0) {
        cursorStore.setState({ pendingKeys: '' });
        return;
      }
      if (state.flashInputMode === 'search' && state.flashQuery.length > 0) {
        const nextQuery = state.flashQuery.slice(0, -1);
        const hints = nextQuery ? collectFlashHints(this.rootElement, nextQuery) : [];
        cursorStore.setState({ flashQuery: nextQuery, flashHints: hints, pendingKeys: '' });
        return;
      }
      this.closeFlashMode();
      return;
    }

    // 在 Hint 模式下按 '/' 切換為 Flash 搜尋過濾模式
    if (state.flashInputMode === 'hint' && e.key === '/' && !currentPrefix) {
      cursorStore.setState({
        flashInputMode: 'search',
        flashQuery: '',
        flashHints: [],
        pendingKeys: ''
      });
      return;
    }

    // 在 Flash 搜尋模式下按 Enter 直接跳至第一個符合結果
    if (state.flashInputMode === 'search' && e.key === 'Enter' && state.flashHints.length > 0) {
      this.jumpToFlashHint(state.flashHints[0]);
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const ch = e.key.toLowerCase();
      const nextPrefix = currentPrefix + ch;

      // 1. 若目前已有顯示標籤，優先比對跳轉標籤 (在 search 模式下，標籤已自動避開下一個可能輸入的搜尋字元)
      if (state.flashHints.length > 0) {
        const matchingHints = state.flashHints.filter((h) => h.label.startsWith(nextPrefix));
        const exactHint = matchingHints.find((h) => h.label === nextPrefix);
        if (exactHint && matchingHints.length === 1) {
          this.jumpToFlashHint(exactHint);
          return;
        }
        if (matchingHints.length > 0) {
          cursorStore.setState({ pendingKeys: `f:${nextPrefix}` });
          return;
        }
      }

      // 2. 在 Flash 搜尋模式下，累加輸入字元進行即時過濾
      if (state.flashInputMode === 'search' && !currentPrefix) {
        const nextQuery = state.flashQuery + e.key;
        const nextHints = collectFlashHints(this.rootElement, nextQuery);
        if (nextHints.length === 0) {
          const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];
          cursorStore.showStatusNotice(dict.noticeFlashNoMatch, 1200);
          return;
        }
        cursorStore.setState({
          flashQuery: nextQuery,
          flashHints: nextHints,
          pendingKeys: ''
        });
      }
    }
  }

  private jumpToFlashHint(hint: { node: Text | null; element?: HTMLElement; offset: number }): void {
    this.closeFlashMode();

    // 若跳轉目標為大型圖片/媒體元素
    if (hint.element && hint.element.isConnected) {
      this.pushJumpPoint();
      this.preferredX = null;
      this.enterMediaTarget(hint.element, undefined, false);
      return;
    }

    if (!hint.node || !hint.node.isConnected) return;

    // 記錄跳轉前位置，支援 '' / `` 隨時返回
    this.pushJumpPoint();
    this.preferredX = null;
    this.clearMediaTarget();

    this.currentTarget = {
      node: hint.node,
      offset: Math.min(hint.offset, Math.max(0, (hint.node.textContent?.length || 1) - 1))
    };
    this.updateActiveScope(hint.node);
    this.updateCursorPosition(true, undefined, false, true);
  }

  private dispatchLightboxCommand(command: LightboxCommand): void {
    window.dispatchEvent(new CustomEvent('muzen-lightbox-command', { detail: { command } }));
  }

  private handleLightboxKey(e: KeyboardEvent): void {
    const key = e.key;
    if (key === 'Escape') {
      this.dispatchLightboxCommand('close');
      return;
    }
    const lower = key.toLowerCase();
    if (lower === 'h' || key === 'ArrowLeft') {
      this.dispatchLightboxCommand('panLeft');
    } else if (lower === 'l' || key === 'ArrowRight') {
      this.dispatchLightboxCommand('panRight');
    } else if (lower === 'k' || key === 'ArrowUp') {
      this.dispatchLightboxCommand('panUp');
    } else if (lower === 'j' || key === 'ArrowDown') {
      this.dispatchLightboxCommand('panDown');
    } else if (lower === 'd' || key === '+' || key === '=') {
      this.dispatchLightboxCommand('zoomIn');
    } else if (lower === 'u' || key === '-') {
      this.dispatchLightboxCommand('zoomOut');
    }
  }

  private openCurrentImageLightbox(): boolean {
    if (!this.currentMediaElement || !this.currentMediaElement.isConnected) return false;
    if (this.currentMediaElement.tagName.toUpperCase() !== 'IMG') return false;

    const img = this.currentMediaElement as HTMLImageElement;
    const src = img.currentSrc || img.src;
    if (!src) return false;

    cursorStore.setState({
      lightboxImage: {
        src,
        alt: img.alt || '',
        naturalWidth: img.naturalWidth || Math.round(img.getBoundingClientRect().width),
        naturalHeight: img.naturalHeight || Math.round(img.getBoundingClientRect().height)
      }
    });
    return true;
  }

  private clearMediaTarget(): void {
    this.currentMediaElement = null;
    this.mediaEntryDirection = null;
    this.pendingTargetAfterMedia = null;
  }

  private enterMediaTarget(
    mediaEl: Element,
    navDirection?: 'down' | 'up',
    isRepeat: boolean = false,
    pendingTarget?: TextTarget | null
  ): void {
    this.currentMediaElement = mediaEl;
    this.mediaEntryDirection = navDirection || null;
    this.pendingTargetAfterMedia = pendingTarget || null;
    this.scrollMediaIntoView(mediaEl, navDirection, isRepeat);
    this.updateCursorPosition(false, undefined, false, true, navDirection, isRepeat);
  }

  private scrollMediaIntoView(mediaEl: Element, navDirection?: 'down' | 'up', isRepeat: boolean = false): void {
    const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(mediaEl, this.options?.containerRoot);
    if (!scrollTarget) return;

    const rect = mediaEl.getBoundingClientRect();
    const adv = cursorStore.getState().advanced;
    const maxPad = Math.floor(viewHeight * 0.28);
    const padTop = Math.min(maxPad, adv?.viewportPaddingTop ?? 120);
    const padBottom = Math.min(maxPad, adv?.viewportPaddingBottom ?? 160);
    const scrollDuration = isRepeat ? 80 : (adv?.scrollDurationMs ?? 360);

    let delta = 0;
    // 1. 若圖片未超過視窗高度，將圖片垂直置中
    if (rect.height <= viewHeight * 0.86) {
      const rectCenterY = (rect.top - parentTop) + rect.height / 2;
      const viewCenterY = viewHeight / 2;
      delta = rectCenterY - viewCenterY;
    } else {
      // 2. 若圖片超過視窗高度，對齊起點邊緣以便分段往下/往上瀏覽
      if (navDirection === 'up') {
        delta = (rect.bottom - parentTop) - (viewHeight - padBottom);
      } else {
        delta = (rect.top - parentTop) - padTop;
      }
    }

    if (Math.abs(delta) > 6) {
      if (isRepeat) {
        cancelActiveScroll();
        const isWin = scrollTarget === window || !(scrollTarget instanceof HTMLElement);
        if (isWin) {
          window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
        } else {
          (scrollTarget as HTMLElement).scrollTop += delta;
        }
      } else {
        animateScrollTo(scrollTarget, Math.max(0, currentScroll + delta), scrollDuration);
      }
    }
  }

  /**
   * 當游標停駐在大圖上並按 j/k/d/u 時，若大圖尚未看完則在圖片內部平滑捲動；
   * 若大圖已到達邊緣，回傳 false 讓控制器自然跨往下一個文字節點。
   */
  private handleMediaVerticalStep(direction: 'down' | 'up', isHalfPage: boolean, isRepeat: boolean): boolean {
    if (!this.currentMediaElement || !this.currentMediaElement.isConnected) {
      this.clearMediaTarget();
      return false;
    }

    const mediaEl = this.currentMediaElement;
    const rect = mediaEl.getBoundingClientRect();
    const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(mediaEl, this.options?.containerRoot);
    if (!scrollTarget) return false;

    const adv = cursorStore.getState().advanced;
    const maxPad = Math.floor(viewHeight * 0.28);
    const padTop = Math.min(maxPad, adv?.viewportPaddingTop ?? 120);
    const padBottom = Math.min(maxPad, adv?.viewportPaddingBottom ?? 160);
    const scrollDuration = isRepeat ? 80 : (adv?.scrollDurationMs ?? 320);

    const stepSize = isHalfPage ? viewHeight * 0.5 : viewHeight * 0.28;

    if (direction === 'down') {
      const remaining = (rect.bottom - parentTop) - (viewHeight - padBottom);
      if (remaining > 10) {
        const delta = Math.min(stepSize, remaining);
        if (isRepeat) {
          cancelActiveScroll();
          if (scrollTarget === window || !(scrollTarget instanceof HTMLElement)) {
            window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
          } else {
            (scrollTarget as HTMLElement).scrollTop += delta;
          }
        } else {
          animateScrollTo(scrollTarget, Math.max(0, currentScroll + delta), scrollDuration);
        }
        this.updateCursorPosition(false, undefined, true, true, 'down', isRepeat);
        return true;
      }
    } else {
      const remaining = padTop - (rect.top - parentTop);
      if (remaining > 10) {
        const delta = Math.min(stepSize, remaining);
        if (isRepeat) {
          cancelActiveScroll();
          if (scrollTarget === window || !(scrollTarget instanceof HTMLElement)) {
            window.scrollBy({ top: -delta, behavior: 'instant' as ScrollBehavior });
          } else {
            (scrollTarget as HTMLElement).scrollTop -= delta;
          }
        } else {
          animateScrollTo(scrollTarget, Math.max(0, currentScroll - delta), scrollDuration);
        }
        this.updateCursorPosition(false, undefined, true, true, 'up', isRepeat);
        return true;
      }
    }

    return false;
  }

  /**
   * 觸發翻頁回溯後照鏡 (Rearview Mirror HUD)
   * 擷取剛才出發點的真實畫面快照與游標座標，供後照鏡 HUD 即時對齊閱讀記憶
   */
  private triggerRearviewNotice(direction: 'up' | 'down'): void {
    if (!this.currentTarget) return;
    const { node, offset } = this.currentTarget;
    const len = node.textContent?.length || 0;
    if (len === 0) return;

    try {
      const snippet = this.extractSentenceSnippet(node, offset);
      const curRect = cursorStore.getState().rect;
      const snapshot = this.cachedSnapshotUrl;
      const dpr = window.devicePixelRatio || 1;

      if (snippet && snippet.length > 0) {
        cursorStore.setState({
          rearviewNotice: {
            text: snippet,
            direction,
            sectionTitle: this.cachedHeadingTitle,
            timestamp: performance.now(),
            snapshotUrl: snapshot || undefined,
            cursorRect: curRect ? { ...curRect } : undefined,
            devicePixelRatio: dpr
          }
        });
      }
    } catch {
      // 容錯防禦
    }
  }

  /**
   * 擷取游標所在位置之句子文字摘要 (前後各截取 25~32 字元)
   */
  private extractSentenceSnippet(node: Text, offset: number): string {
    const raw = node.textContent || '';
    if (!raw.trim()) return '';

    const textLen = raw.length;
    const safeOffset = Math.min(offset, Math.max(0, textLen - 1));

    const start = Math.max(0, safeOffset - 22);
    const end = Math.min(textLen, safeOffset + 32);

    let snippet = raw.slice(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) snippet = '…' + snippet;
    if (end < textLen) snippet = snippet + '…';

    return snippet;
  }

  /**
   * 跳至文章頂部 (gg) - 排除頂部 fixed/sticky 導覽列與螢幕閱讀器隱藏元素，精準鎖定常態閱讀流首字元
   */
  public jumpToDocumentStart(): void {
    this.clearMediaTarget();
    this.triggerRearviewNotice('up');
    this.pushJumpPoint();

    // 判斷作用域：若當前處於脫離常態流之側欄/浮動掛件，限定於該掛件內部，避免向外逃逸
    const effRoot = this.getEffectiveRoot();
    const isWidget = effRoot !== this.rootElement && isOutOfNormalFlowWidget(effRoot, this.rootElement);
    const targetRoot = isWidget ? effRoot : this.rootElement;

    // 優先使用感知主閱讀流之 TreeWalker 過濾頂部固定列與隱藏節點
    const firstText = findFirstReadableTextNode(targetRoot, isWidget) || findFirstTextNodeIn(targetRoot);
    if (firstText) {
      this.currentTarget = { node: firstText, offset: 0 };
      this.updateActiveScope(firstText);
      this.updateCursorPosition();
      if (this.options?.enableScroll !== false) {
        const scrollParent = getScrollParent(this.currentTarget.node, this.options?.containerRoot);
        const duration = cursorStore.getState().advanced?.scrollDurationMs ?? 380;
        if (scrollParent) {
          animateScrollTo(scrollParent, 0, duration);
        } else if (!this.options?.containerRoot) {
          animateScrollTo(window, 0, duration);
        }
      }
    }
  }

  /**
   * 跳至文章底部 (G) - 排除底部浮動客服、Cookie 同意橫幅與不可見元素，精準鎖定常態閱讀流尾字元
   */
  public jumpToDocumentEnd(): void {
    this.clearMediaTarget();
    this.triggerRearviewNotice('down');
    this.pushJumpPoint();

    // 判斷作用域：若當前處於脫離常態流之側欄/浮動掛件，限定於該掛件內部，避免向外逃逸
    const effRoot = this.getEffectiveRoot();
    const isWidget = effRoot !== this.rootElement && isOutOfNormalFlowWidget(effRoot, this.rootElement);
    const targetRoot = isWidget ? effRoot : this.rootElement;

    // 優先使用感知主閱讀流之 TreeWalker 排除底部浮動掛件、固定客服窗、<script> 與不可見元素
    let lastTextNode = findLastReadableTextNode(targetRoot, isWidget);
    if (!lastTextNode) {
      // 容錯 Fallback
      const walker = document.createTreeWalker(targetRoot, NodeFilter.SHOW_TEXT);
      let n = walker.nextNode();
      while (n) {
        if (n.textContent && n.textContent.trim().length > 0) {
          lastTextNode = n as Text;
        }
        n = walker.nextNode();
      }
    }

    if (lastTextNode) {
      this.currentTarget = {
        node: lastTextNode,
        offset: lastTextNode.textContent?.length || 0
      };
      this.updateActiveScope(lastTextNode);
      this.updateCursorPosition();
      if (this.options?.enableScroll !== false) {
        const scrollParent = getScrollParent(this.currentTarget.node, this.options?.containerRoot);
        const duration = cursorStore.getState().advanced?.scrollDurationMs ?? 380;
        if (scrollParent) {
          const maxScroll = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
          animateScrollTo(scrollParent, maxScroll, duration);
        } else if (!this.options?.containerRoot) {
          const viewportH = window.visualViewport?.height ?? window.innerHeight;
          const maxScroll = Math.max(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - viewportH);
          animateScrollTo(window, maxScroll, duration);
        }
      }
    }
  }

  /**
   * 切換 Visual (字元) 模式
   */
  public toggleVisualMode(): void {
    const currentMode = cursorStore.getState().mode;
    if (currentMode === 'NORMAL') {
      if (!this.currentTarget) {
        this.findInitialTarget();
      }
      if (this.currentTarget) {
        this.selectionManager.setAnchor({ ...this.currentTarget });
        cursorStore.setState({ mode: 'VISUAL' });
        this.selectionManager.syncNativeSelection(this.currentTarget);
      }
    } else if (currentMode === 'VISUAL_LINE') {
      // 從整行選取切換為字元選取 (對齊 Vim 行為：保留 Anchor)
      cursorStore.setState({ mode: 'VISUAL' });
      this.selectionManager.syncNativeSelection(this.currentTarget);
    } else {
      this.exitVisualMode();
    }
  }

  /**
   * 切換 Visual Line (整行) 模式 (Shift + V)
   */
  public toggleVisualLineMode(): void {
    const currentMode = cursorStore.getState().mode;
    if (currentMode === 'NORMAL') {
      if (!this.currentTarget) {
        this.findInitialTarget();
      }
      if (this.currentTarget) {
        this.selectionManager.setAnchor({ ...this.currentTarget });
        cursorStore.setState({ mode: 'VISUAL_LINE' });
        this.selectionManager.syncVisualLineSelection(this.currentTarget, this.getEffectiveRoot());
      }
    } else if (currentMode === 'VISUAL') {
      // 從字元選取切換為整行選取 (對齊 Vim 行為：保留 Anchor 並展開整行)
      cursorStore.setState({ mode: 'VISUAL_LINE' });
      this.selectionManager.syncVisualLineSelection(this.currentTarget, this.getEffectiveRoot());
    } else {
      this.exitVisualMode();
    }
  }

  public exitVisualMode(): void {
    this.selectionManager.exitVisualMode();
  }

  /**
   * Yank (複製) 當前選取內容
   */
  public async yankSelection(): Promise<void> {
    await this.selectionManager.yankSelection();
  }

  /**
   * 取得當前游標鎖定的文字目標
   */
  public getCurrentTarget(): TextTarget | null {
    return this.currentTarget;
  }

  /**
   * 重新綁定游標至指定容器或重新探測有效文字節點（適用於 SPA 路由切換、動態 DOM 替換或 PDF 縮放重繪）
   */
  public rebindToContainer(container?: HTMLElement | null): boolean {
    const root = container || this.options?.containerRoot || this.getEffectiveRoot();
    const firstText = findFirstTextNodeIn(root);
    if (firstText) {
      this.currentTarget = { node: firstText, offset: 0 };
      this.updateActiveScope(firstText);
      this.updateCursorPosition();
      return true;
    }
    this.findInitialTarget();
    return false;
  }

  /**
   * 探測並定位初始游標位置（支援方向感知與元素級 Caret 解析）
   */
  public findInitialTarget(direction?: 'down' | 'up'): void {
    if (this.options?.containerRoot) {
      const firstText = findFirstTextNodeIn(this.options.containerRoot);
      if (firstText) {
        this.currentTarget = { node: firstText, offset: 0 };
        this.updateCursorPosition();

      }
    }

    const extractTextTarget = (caret: { node: Node; offset: number } | null): TextTarget | null => {
      if (!caret) return null;
      let targetNode: Text | null = null;
      let targetOffset = 0;

      if (caret.node.nodeType === Node.TEXT_NODE) {
        targetNode = caret.node as Text;
        targetOffset = caret.offset;
      } else if (caret.node.nodeType === Node.ELEMENT_NODE) {
        const el = caret.node as Element;
        if (el.childNodes.length > 0) {
          const childIndex = Math.min(caret.offset, el.childNodes.length - 1);
          const child = el.childNodes[childIndex];
          targetNode = child.nodeType === Node.TEXT_NODE ? (child as Text) : findFirstTextNodeIn(child);
        }
        if (!targetNode) {
          targetNode = findFirstTextNodeIn(el);
        }
        targetOffset = 0;
      }

      if (targetNode && isValidReadableTextNode(targetNode) && !isOutOfNormalFlowWidget(targetNode, this.rootElement)) {
        return { node: targetNode, offset: targetOffset };
      }
      return null;
    };

    // 0. 原地重錨定防禦 (Local Anchor Recovery)：若最後游標位於目前可見視野中，優先原地就地重錨
    const prevRect = cursorStore.getState().rect;
    if (prevRect && prevRect.x > 0 && prevRect.y >= 0 && prevRect.y <= window.innerHeight) {
      const localTarget = extractTextTarget(getRawCaretFromPoint(prevRect.x, prevRect.y));
      if (localTarget) {
        this.currentTarget = localTarget;
        this.updateActiveScope(localTarget.node);
        this.updateCursorPosition();

      }
    }

    const cx = window.innerWidth / 2;
    const viewH = window.innerHeight;
    const cyRatio = direction === 'down' ? 0.45 : (direction === 'up' ? 0.55 : 0.5);
    const cy = Math.round(viewH * cyRatio);

    // 1. 視窗中央 Caret 解析
    const centerTarget = extractTextTarget(getRawCaretFromPoint(cx, cy));
    if (centerTarget) {
      this.currentTarget = centerTarget;
      this.updateActiveScope(centerTarget.node);
      this.updateCursorPosition();
      return;
    }

    // 2. 視窗中央元素文字探測
    const centerElements = document.elementsFromPoint ? document.elementsFromPoint(cx, cy) : [];
    for (const el of centerElements) {
      if (el.id === 'muzen-cursor-host-root' || isOutOfNormalFlowWidget(el, this.rootElement)) continue;
      const elRect = el.getBoundingClientRect();
      if (elRect.height >= viewH * 0.95) continue; // 排除 body, html 等全頁大容器

      const firstText = findFirstTextNodeIn(el);
      if (firstText && isValidReadableTextNode(firstText)) {
        this.currentTarget = { node: firstText, offset: 0 };
        this.updateActiveScope(firstText);
        this.updateCursorPosition();

      }
    }

    // 3. 通用兜底：自有效閱讀容器中尋找第一個可讀文字節點
    const fallbackText = findFirstTextNodeIn(this.getEffectiveRoot());
    if (fallbackText && isValidReadableTextNode(fallbackText)) {
      this.currentTarget = { node: fallbackText, offset: 0 };
      this.updateActiveScope(fallbackText);
      this.updateCursorPosition();
    }
  }

  /**
   * 當單字元 Range 回傳寬度或高度為 0（常見於 <pre><code> 中的換行符 \n 或零寬節點）時，
   * 依序以瀏覽器已定位座標、同節點相鄰字元、前一個文字節點末尾來推算正確矩形，
   * 避免在 safeOffset === 0 時誤退回容器（如 <code>/<pre>）左上角導致游標與 Smear 特效瞬移。
   */
  private resolveZeroSizeCharRect(
    node: Text,
    safeOffset: number,
    rawRect: DOMRect,
    range: Range
  ): DOMRect {
    const fallbackH = 20;
    const makeRect = (left: number, top: number, width: number, height: number): DOMRect =>
      ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height
      }) as DOMRect;

    const hasNonZeroOrigin = rawRect.left !== 0 || rawRect.top !== 0;
    if (rawRect.height > 0 && hasNonZeroOrigin) {
      return makeRect(rawRect.left, rawRect.top, Math.max(8, rawRect.width), rawRect.height);
    }
    if (rawRect.width > 0 && hasNonZeroOrigin) {
      return makeRect(rawRect.left, rawRect.top, rawRect.width, fallbackH);
    }

    const text = node.textContent || '';
    const textLen = text.length;
    const parent = node.parentElement;
    const parentRect = parent ? parent.getBoundingClientRect() : null;

    const measureChar = (targetNode: Text, idx: number): DOMRect | null => {
      try {
        range.setStart(targetNode, idx);
        range.setEnd(targetNode, idx + 1);
        const r = range.getBoundingClientRect();
        if (r.height > 0 && (r.width > 0 || r.left !== 0 || r.top !== 0)) {
          return r;
        }
      } catch {}
      return null;
    };

    // 情況 1：游標在換行符號之後（新行開頭）
    if (safeOffset > 0 && text[safeOffset - 1] === '\n') {
      if (safeOffset < textLen && text[safeOffset] !== '\n') {
        const nextRect = measureChar(node, safeOffset);
        if (nextRect) {
          return makeRect(nextRect.left, nextRect.top, 8, nextRect.height || fallbackH);
        }
      }
      // 空行：往回找同節點內最近的非換行字元，依經過的換行數推算 Y 軸
      let newlines = 0;
      for (let i = safeOffset - 1; i >= 0; i--) {
        if (text[i] === '\n') {
          newlines++;
          continue;
        }
        const prevRect = measureChar(node, i);
        if (prevRect) {
          const lineH = prevRect.height || fallbackH;
          const left = parentRect ? parentRect.left + 8 : prevRect.left;
          return makeRect(left, prevRect.top + newlines * lineH, 8, lineH);
        }
      }
    } else if (safeOffset > 0) {
      // 情況 2：游標在同節點某個字元之後（例如停在行尾 \n 上）
      for (let i = safeOffset - 1; i >= 0; i--) {
        if (text[i] === '\n') continue;
        const prevRect = measureChar(node, i);
        if (prevRect) {
          const charH = prevRect.height || fallbackH;
          return makeRect(prevRect.right, prevRect.top, 8, charH);
        }
      }
    }

    // 情況 3：safeOffset === 0（如獨立 "\n" 節點）或同節點前無可視字元，往回追溯前一個文字節點末尾
    const effectiveRoot = this.getEffectiveRoot();
    const isOutOfFlow = isOutOfNormalFlowWidget(node, effectiveRoot);
    let cursorNode: Text | null = node;
    let extraNewlines = 0;

    for (let step = 0; step < 5; step++) {
      const prevNode = findPrevTextNode(cursorNode, effectiveRoot, isOutOfFlow);
      if (!prevNode) break;
      const prevText = prevNode.textContent || '';
      let foundNonNewline = false;

      for (let i = prevText.length - 1; i >= 0; i--) {
        if (prevText[i] === '\n') {
          extraNewlines++;
          continue;
        }
        const prevCharRect = measureChar(prevNode, i);
        if (prevCharRect) {
          const lineH = prevCharRect.height || fallbackH;
          if (extraNewlines === 0) {
            return makeRect(prevCharRect.right, prevCharRect.top, 8, lineH);
          }
          const left = parentRect ? parentRect.left + 8 : prevCharRect.left;
          return makeRect(left, prevCharRect.top + extraNewlines * lineH, 8, lineH);
        }
        foundNonNewline = true;
      }

      if (foundNonNewline) break;
      cursorNode = prevNode;
    }

    // 情況 4：若前方無可參考節點，嘗試同節點後續可視字元或上一刻合法游標座標
    for (let i = safeOffset; i < textLen; i++) {
      if (text[i] === '\n') continue;
      const nextRect = measureChar(node, i);
      if (nextRect) {
        return makeRect(nextRect.left, nextRect.top, 8, nextRect.height || fallbackH);
      }
    }

    const storedRect = cursorStore.getState().rect;
    if (storedRect && (storedRect.x !== 0 || storedRect.y !== 0)) {
      return makeRect(storedRect.x, storedRect.y, storedRect.width || 8, storedRect.height || fallbackH);
    }

    if (parentRect) {
      return makeRect(parentRect.left, parentRect.top, 8, fallbackH);
    }

    return rawRect;
  }

  /**
   * 計算螢幕座標與微調游標
   */
  private updateCursorPosition(
    scrollIntoView: boolean = false,
    waypoints?: CursorRect[],
    isScrollUpdate: boolean = false,
    forceVisible: boolean = false,
    navDirection?: 'down' | 'up',
    isRepeat: boolean = false
  ): void {
    // 若當前停駐於大型圖片/媒體元素上，直接以元素外框作為游標位置
    if (this.currentMediaElement && this.currentMediaElement.isConnected) {
      const mediaEl = this.currentMediaElement;
      const mediaRect = mediaEl.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const viewportH = window.visualViewport?.height ?? window.innerHeight;
      const totalHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ) - viewportH;
      const progress = totalHeight > 0 ? Math.min(100, Math.max(0, (scrollY / totalHeight) * 100)) : 100;
      const isVisibleInViewport = forceVisible || (mediaRect.bottom >= -80 && mediaRect.top <= viewportH + 80);

      const tag = mediaEl.tagName.toUpperCase();
      const mediaInfo: MediaTargetInfo = {
        tagName: tag,
        width: Math.round(mediaRect.width),
        height: Math.round(mediaRect.height)
      };
      if (tag === 'IMG') {
        const img = mediaEl as HTMLImageElement;
        mediaInfo.naturalWidth = img.naturalWidth;
        mediaInfo.naturalHeight = img.naturalHeight;
        mediaInfo.alt = img.alt || '';
        mediaInfo.src = img.currentSrc || img.src || '';
      }

      const prevState = cursorStore.getState();
      if (!isScrollUpdate) {
        const settleDelay = prevState.advanced?.moveSettleDelayMs ?? 400;
        if (this.moveTimer) clearTimeout(this.moveTimer);
        this.moveTimer = setTimeout(() => {
          cursorStore.setState({ isMoving: false, motionDirection: 'none' });
        }, settleDelay);
      }

      cursorStore.setState({
        visible: isVisibleInViewport,
        isMoving: isScrollUpdate ? isSmoothScrolling() : true,
        motionDirection: isScrollUpdate ? 'none' : 'jump',
        motionSequence: isScrollUpdate ? prevState.motionSequence : (prevState.motionSequence || 0) + 1,
        isScrollUpdate,
        isMediaTarget: true,
        mediaInfo,
        hoveredLinkUrl: null,
        rect: {
          x: mediaRect.left,
          y: mediaRect.top,
          width: Math.max(8, mediaRect.width),
          height: Math.max(8, mediaRect.height)
        },
        trailWaypoints: undefined,
        readingProgress: progress
      });
      return;
    } else if (this.currentMediaElement) {
      this.clearMediaTarget();
    }

    if (!this.currentTarget || !this.currentTarget.node.isConnected) {
      if (this.isRecoveringTarget) return;
      this.isRecoveringTarget = true;
      try {
        this.findInitialTarget();
      } finally {
        this.isRecoveringTarget = false;
      }
      if (!this.currentTarget || !this.currentTarget.node.isConnected) return;
    }

    const { node, offset } = this.currentTarget;
    const textLen = node.textContent?.length || 0;

    const range = document.createRange();
    try {
      const safeOffset = Math.min(offset, textLen);
      const endOffset = Math.min(safeOffset + 1, textLen);
      range.setStart(node, safeOffset);
      range.setEnd(node, endOffset);

      let rect = range.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        rect = this.resolveZeroSizeCharRect(node, safeOffset, rect, range);
      }

      // 幾何異常防禦：若計算出的座標為 (0,0) 且長寬為 0，嚴格阻絕游標飛向螢幕最左上方
      const isBogusZeroRect = (rect.width === 0 || rect.height === 0) && rect.left === 0 && rect.top === 0;
      if (isBogusZeroRect) {
        const prevRect = cursorStore.getState().rect;
        if (prevRect && (prevRect.x !== 0 || prevRect.y !== 0)) {
          const defaultH = 20;
          rect = {
            x: prevRect.x,
            y: prevRect.y,
            left: prevRect.x,
            top: prevRect.y,
            width: prevRect.width > 0 ? prevRect.width : 8,
            height: prevRect.height > 0 ? prevRect.height : defaultH,
            right: prevRect.x + (prevRect.width > 0 ? prevRect.width : 8),
            bottom: prevRect.y + (prevRect.height > 0 ? prevRect.height : defaultH)
          } as DOMRect;
        }
      }

      // 計算全頁面閱讀進度（自適應 visualViewport 縮放高度）
      const scrollY = window.scrollY || window.pageYOffset;
      const viewportH = window.visualViewport?.height ?? window.innerHeight;
      const totalHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ) - viewportH;
      const progress = totalHeight > 0 ? Math.min(100, Math.max(0, (scrollY / totalHeight) * 100)) : 100;

      // 輔助閱讀：長按時跳過純字元數與標題計算，節省主線程 CPU
      if (!isRepeat) {
        const now = performance.now();
        if (now - this.lastCharCountTime > 5000 || this.cachedTotalChars === 0) {
          const root = this.getEffectiveRoot();
          this.cachedTotalChars = root.textContent?.replace(/\s+/g, '').length || 0;
          this.lastCharCountTime = now;
        }

        if (now - this.lastHeadingCheckTime > 300 || node !== this.previousTarget?.node) {
          this.cachedHeadingTitle = findCurrentSectionHeading(node, this.getEffectiveRoot()) || '';
          this.cachedReadingMinutes = estimateReadingMinutes(this.cachedTotalChars, progress);
          this.lastHeadingCheckTime = now;
        }
      }

      // 容許適度邊界緩衝，避免邊界滾動時游標閃現閃退；若座標暫未就緒，安全維持當前可見狀態
      const hasValidCoords = typeof rect.top === 'number' && typeof rect.bottom === 'number' && !isNaN(rect.top) && !isNaN(rect.bottom);
      const isVisibleInViewport = forceVisible || (hasValidCoords
        ? (rect.bottom >= -80 && rect.top <= viewportH + 80)
        : (cursorStore.getState().visible ?? true));

      const isMoving = cursorStore.getState().isMoving ?? false;

      // 視窗純捲動/縮放更新：僅靜默貼齊游標位置，嚴格抑制殘影與運動序列遞增
      if (isScrollUpdate) {
        // 若游標正處於平滑運動 (isMoving)、滾動中 (isSmoothScrolling) 或目標在視野內，滾動途中嚴格保持可見
        const isScrolling = isSmoothScrolling();
        const shouldKeepVisible = isMoving || isVisibleInViewport || isScrolling;
        const nextMoving = isScrolling ? true : (isVisibleInViewport ? false : isMoving);

        cursorStore.setState({
          visible: shouldKeepVisible,
          isMoving: nextMoving,
          motionDirection: nextMoving ? cursorStore.getState().motionDirection : 'none',
          isScrollUpdate: true,
          isMediaTarget: false,
          mediaInfo: null,
          rect: {
            x: rect.left,
            y: rect.top,
            width: rect.width > 0 ? rect.width : 8,
            height: rect.height > 0 ? rect.height : 16
          },
          readingProgress: progress,
          charOffset: safeOffset,
          currentSectionTitle: this.cachedHeadingTitle,
          estimatedMinutesLeft: this.cachedReadingMinutes
        });
        this.previousTarget = { ...this.currentTarget };

      }

      // 計算本次位移向量與方向 (提供 3D 透視梯形動態反饋使用)
      const prevState = cursorStore.getState();
      const prevRect = prevState.rect;
      let motionDir: MotionDirection = 'none';

      if (prevState.visible) {
        const dx = rect.left - prevRect.x;
        const dy = rect.top - prevRect.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx > 1 || absDy > 1) {
          if (absDy > 80 || absDx > 500) {
            motionDir = 'jump';
          } else if (absDx >= absDy) {
            motionDir = dx > 0 ? 'right' : 'left';
          } else {
            motionDir = dy > 0 ? 'down' : 'up';
          }
        }
      }

      // 若未直接傳入 waypoints，但與前次目標跨越視覺行，自動補齊中間經過行
      let finalWaypoints = waypoints;
      if (!finalWaypoints && this.previousTarget && this.currentTarget) {
        finalWaypoints = computeWaypointsBetween(
          this.previousTarget,
          this.currentTarget,
          this.preferredX ?? rect.left,
          this.rootElement
        );
      }

      // 移動避震機制：位移時保持常亮不閃爍，靜止一段時間後平滑恢復閃爍/呼吸
      const settleDelay = cursorStore.getState().advanced?.moveSettleDelayMs ?? 400;
      if (this.moveTimer) clearTimeout(this.moveTimer);
      this.moveTimer = setTimeout(() => {
        cursorStore.setState({ isMoving: false, motionDirection: 'none' });
      }, settleDelay);

      // 當游標移動停頓時，預先在背景非同步更新當前視窗快照 (以備翻頁回溯 0ms 呈現)
      this.requestBackgroundSnapshot();

      cursorStore.setState({
        visible: forceVisible || isVisibleInViewport,
        isMoving: true,
        motionDirection: motionDir,
        motionSequence: (prevState.motionSequence || 0) + 1,
        chargeLevel: this.currentCharge,
        isScrollUpdate: false,
        isMediaTarget: false,
        mediaInfo: null,
        hoveredLinkUrl: this.getHoveredAnchor(this.currentTarget)?.href || null,
        rect: {
          x: rect.left,
          y: rect.top,
          width: rect.width > 0 ? rect.width : 8,
          height: rect.height > 0 ? rect.height : 16
        },
        trailWaypoints: finalWaypoints && finalWaypoints.length > 0 ? finalWaypoints : undefined,
        readingProgress: progress,
        charOffset: safeOffset,
        currentSectionTitle: this.cachedHeadingTitle,
        estimatedMinutesLeft: this.cachedReadingMinutes
      });

      this.previousTarget = { ...this.currentTarget };

      // Visual 與 Visual Line 模式下即時更新原生選取
      const currentMode = cursorStore.getState().mode;
      if (currentMode === 'VISUAL') {
        this.selectionManager.syncNativeSelection(this.currentTarget);
      } else if (currentMode === 'VISUAL_LINE') {
        this.selectionManager.syncVisualLineSelection(this.currentTarget, this.getEffectiveRoot());
      }

      // 只有在鍵盤主動導航且明確要求跟隨時才執行自動捲動 (自適應黃金視野區間演算法)
      if (scrollIntoView) {
        const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(node, this.options?.containerRoot);
        const curTop = rect.top - parentTop;
        const curBottom = rect.bottom - parentTop;

        const adv = cursorStore.getState().advanced;
        // 動態安全比例閥：單邊安全邊距不超過可視高度 28%（中間保留至少 44% 黃金舒適閱讀區間，防止放大縮小時邊距擠壓導致抖動）
        const maxPad = Math.floor(viewHeight * 0.28);
        const padBottom = Math.min(maxPad, adv?.viewportPaddingBottom ?? 160);
        const padTop = Math.min(maxPad, adv?.viewportPaddingTop ?? 120);
        const scrollDuration = isRepeat ? 80 : (adv?.scrollDurationMs ?? 320);

        // 自適應字元行高緩衝：在任何縮放比例下，維持約半行字高的舒適安全視距
        const lineBuffer = Math.max(12, Math.min(36, Math.round((rect.height || 20) * 0.5)));

        if (scrollTarget) {
          if (navDirection === 'down') {
            // 向下閱讀時，只允許因超過底部視野而向下滾動，嚴禁向上反向回捲！
            if (curBottom > viewHeight - padBottom) {
              let delta = curBottom - (viewHeight - padBottom) + lineBuffer;
              // 大跨距防禦：若單步跨越大型圖片或空白區塊導致游標瞬間落於畫面外甚遠，對齊至黃金舒適區中央，消除追趕落差感
              if (curTop > viewHeight) {
                delta = curTop - Math.round(viewHeight * 0.65);
              }
              if (isRepeat) {
                // 長按 (Key Repeat) 模式：極速零延遲幀同步推進，游標緊貼黃金舒適線，視窗絲滑滾動絕不脫軌！
                cancelActiveScroll();
                const isWin = scrollTarget === window || !(scrollTarget instanceof HTMLElement);
                if (isWin) {
                  window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
                } else {
                  (scrollTarget as HTMLElement).scrollTop += delta;
                }
              } else {
                // 單次按鍵模式：享受頂級 Ease-Out 物理阻尼平滑滾動
                const targetScroll = currentScroll + delta;
                animateScrollTo(scrollTarget, targetScroll, scrollDuration);
              }
            }
          } else if (navDirection === 'up') {
            // 向上閱讀時，只允許因超過頂部視野而向上滾動，嚴禁向下反向回捲！
            if (curTop < padTop) {
              let delta = (padTop - curTop) + lineBuffer;
              // 大跨距防禦：若向上跨越大型圖片或區塊導致游標遠超畫面頂部，對齊至黃金舒適區上緣
              if (curBottom < 0) {
                delta = Math.round(viewHeight * 0.35) - curTop;
              }
              if (isRepeat) {
                cancelActiveScroll();
                const isWin = scrollTarget === window || !(scrollTarget instanceof HTMLElement);
                if (isWin) {
                  window.scrollBy({ top: -delta, behavior: 'instant' as ScrollBehavior });
                } else {
                  (scrollTarget as HTMLElement).scrollTop -= delta;
                }
              } else {
                const targetScroll = Math.max(0, currentScroll - delta);
                animateScrollTo(scrollTarget, targetScroll, scrollDuration);
              }
            }
          } else {
            // 一般導航 (無明確垂直方向)：僅在字元完全滑出螢幕視野時進行最小安全回拉
            if (curBottom > viewHeight - 20) {
              const targetScroll = currentScroll + (curBottom - viewHeight + 60);
              animateScrollTo(scrollTarget, targetScroll, scrollDuration);
            } else if (curTop < 56) {
              const targetScroll = Math.max(0, currentScroll - (60 - curTop));
              animateScrollTo(scrollTarget, targetScroll, scrollDuration);
            }
          }
        }
      }

      // 連續移動停手後的延遲校正排程 (Debounce Realignment)
      if (!isScrollUpdate) {
        this.scheduleDebounceRealignment();
      }
    } catch (err) {
      logger.warn('updateCursorPosition error:', err);
    }
  }

  /**
   * 排程停頓延遲校正 (Debounce Idle Realignment)
   * 當使用者連續按鍵結束、停頓超過預設毫秒時，檢測游標是否因 DOM 突變或動態載入脫出死區
   */
  private scheduleDebounceRealignment(): void {
    const state = cursorStore.getState();
    if (!state.enabled || !state.visible || state.isExcluded) {
      if (this.realignTimer) {
        clearTimeout(this.realignTimer);
        this.realignTimer = null;
      }
      return;
    }

    if (this.realignTimer) {
      clearTimeout(this.realignTimer);
    }

    this.realignTimer = setTimeout(() => {
      this.realignTimer = null;
      this.performDebounceRealignment();
    }, this.REALIGN_DEBOUNCE_MS);
  }

  /**
   * 執行停頓校正：針對動態插入 DOM /虛擬列表環境，平滑校正視窗捲動對齊
   */
  private performDebounceRealignment(): void {
    const state = cursorStore.getState();
    if (!state.enabled || !state.visible || state.isExcluded) return;

    // 若仍在進行平滑滾動，稍後再檢測避免打架
    if (isSmoothScrolling()) {
      return;
    }

    // 1. 節點失效防禦：若節點已自 DOM 脫離 (被虛擬列表卸載)，走重錨邏輯
    if (!this.currentTarget || !this.currentTarget.node.isConnected) {
      if (this.isRecoveringTarget) return;
      this.isRecoveringTarget = true;
      try {
        this.findInitialTarget();
      } finally {
        this.isRecoveringTarget = false;
      }
      if (!this.currentTarget || !this.currentTarget.node.isConnected) return;
    }

    const { node, offset } = this.currentTarget;
    const textLen = node.textContent?.length || 0;
    const range = document.createRange();
    try {
      const safeOffset = Math.min(offset, textLen);
      range.setStart(node, safeOffset);
      range.setEnd(node, Math.min(safeOffset + 1, textLen));
      const rect = range.getBoundingClientRect();

      // 若元素隱藏或無寬高則不處理
      if (rect.width === 0 && rect.height === 0) return;

      const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(node, this.options?.containerRoot);
      if (!scrollTarget) return;

      const curTop = rect.top - parentTop;
      const curBottom = rect.bottom - parentTop;

      // 定義死區 (Deadzone / Safe zone)：
      // 頂部死區邊界 (考慮導航列固定遮蔽)：70px
      // 底部死區邊界：視窗底部往上 80px
      const deadzoneTop = 70;
      const deadzoneBottom = viewHeight - 80;

      // 若游標穩穩位於安全視野內，完全不作任何捲動 (零干擾原則)
      if (curTop >= deadzoneTop && curBottom <= deadzoneBottom) {
        return;
      }

      // 若游標超出死區 (被 Facebook 突變擠壓到頂部/底部外，或極度貼邊)：
      // 計算平滑補償量，將游標帶回舒適視野 (頂部偏向 28% 視野高度，底部偏向 70% 視野高度)
      let targetScroll: number | null = null;
      if (curTop < deadzoneTop) {
        // 游標在頂部死區外或在視野上方：拉動視窗使游標落在約 28% 高度處
        const desiredTop = Math.round(viewHeight * 0.28);
        const delta = curTop - desiredTop;
        targetScroll = Math.max(0, currentScroll + delta);
      } else if (curBottom > deadzoneBottom) {
        // 游標在底部死區外或在視野下方：拉動視窗使游標落在約 70% 高度處
        const desiredBottom = Math.round(viewHeight * 0.70);
        const delta = curBottom - desiredBottom;
        targetScroll = Math.max(0, currentScroll + delta);
      }

      if (targetScroll !== null && Math.abs(targetScroll - currentScroll) > 10) {
        // 220ms 柔和阻尼校正
        animateScrollTo(scrollTarget, targetScroll, 220);
      }
    } catch (err) {
      logger.warn('performDebounceRealignment error:', err);
    }
  }

  /**
   * 半頁跳轉 (d 向下 / u 向上) - 保證實體翻動 50% 視窗高度並精準重錨定目標行
   */
  public moveHalfPage(isDownward: boolean, isRepeat: boolean = false): void {
    const direction = isDownward ? 'down' : 'up';
    if (this.currentMediaElement) {
      if (this.handleMediaVerticalStep(direction, true, isRepeat)) {
        return;
      }
      const prevEntryDir = this.mediaEntryDirection;
      const pendingTarget = this.pendingTargetAfterMedia;
      this.clearMediaTarget();
      if (prevEntryDir === direction && pendingTarget && pendingTarget.node.isConnected) {
        this.currentTarget = pendingTarget;
        this.updateActiveScope(pendingTarget.node);
      }
    }

    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    // 0. 記錄原地出發點之文字上下文，觸發翻頁回溯後照鏡 HUD (長按連發時跳過以維持畫面俐落)
    if (!isRepeat) {
      this.triggerRearviewNotice(isDownward ? 'down' : 'up');
    }

    const { node, offset } = this.currentTarget;
    const len = node.textContent?.length || 0;
    if (len === 0) return;

    // 1. 取得當前真實字元的螢幕基準座標
    const baseRange = document.createRange();
    const safeFrom = Math.min(offset, Math.max(0, len - 1));
    baseRange.setStart(node, safeFrom);
    baseRange.setEnd(node, Math.min(safeFrom + 1, len));
    const baseRect = baseRange.getBoundingClientRect();
    const charHeight = baseRect.height > 0 ? baseRect.height : 22;
    const lineThreshold = charHeight * 0.65;

    if (this.preferredX === null) {
      this.preferredX = baseRect.left;
    }
    const targetX = this.preferredX;

    // 2. 計算目標跳轉高度 (保證為視窗或滾動容器的 50%，自適應 visualViewport 縮放)
    const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(node, this.options?.containerRoot);
    const jumpDistance = Math.max(viewHeight * 0.5, charHeight * 3);
    const scrollAmount = Math.round(jumpDistance) * (isDownward ? 1 : -1);

    let foundTarget: { node: Text; offset: number } | null = null;
    let finalTargetRect: DOMRect | null = null;
    let accumulatedDistance = 0;
    let lastFound = this.currentTarget;
    let steps = 0;
    const maxSteps = 80;

    const tempWaypoints: CursorRect[] = [];
    const effRoot = this.getEffectiveRoot();

    // 3. 連續向下或向上推進視覺行，尋找垂直位移達約半頁之最佳目標行
    while (accumulatedDistance < jumpDistance && steps < maxSteps) {
      steps++;
      const curLen = lastFound.node.textContent?.length || 0;
      const curSafe = Math.min(lastFound.offset, Math.max(0, curLen - 1));
      const r = document.createRange();
      r.setStart(lastFound.node, curSafe);
      r.setEnd(lastFound.node, Math.min(curSafe + 1, curLen));
      const curRect = r.getBoundingClientRect();

      let nextTarget = isDownward
        ? searchDownwardNextLine(lastFound.node, lastFound.offset, curRect.top, lineThreshold, charHeight, targetX, effRoot)
        : searchUpwardPrevLine(lastFound.node, lastFound.offset, curRect.top, lineThreshold, charHeight, targetX, effRoot);

      // 非對稱邊界自然逃逸 (Conditional Flow Escape)：
      // 1. 若在當前局部作用域已抵達邊界 (找不到下一行或上一行)，且當前並非全域根節點
      // 2. 核心守護門檻：只有當前作用域屬於「正文常態流內容器 (In-Flow Container)」時才允許向外逃逸至主閱讀流；
      //    若屬於「脫離常態流之側欄/浮動掛件 (Out-of-Flow Widget)」，則嚴格封印不逃逸，100% 杜絕側欄無限延展與隨意外溢
      if (!nextTarget && effRoot !== this.rootElement) {
        const isSidebarOrWidget = isOutOfNormalFlowWidget(effRoot, this.rootElement);
        if (!isSidebarOrWidget) {
          nextTarget = isDownward
            ? searchDownwardNextLine(lastFound.node, lastFound.offset, curRect.top, lineThreshold, charHeight, targetX, this.rootElement)
            : searchUpwardPrevLine(lastFound.node, lastFound.offset, curRect.top, lineThreshold, charHeight, targetX, this.rootElement);
        }
      }

      if (!nextTarget) break;

      const nextLen = nextTarget.node.textContent?.length || 0;
      const nextSafe = Math.min(nextTarget.offset, Math.max(0, nextLen - 1));
      r.setStart(nextTarget.node, nextSafe);
      r.setEnd(nextTarget.node, Math.min(nextSafe + 1, nextLen));
      const nextRect = r.getBoundingClientRect();

      if (!isRepeat && nextRect.width > 0 && nextRect.height > 0) {
        tempWaypoints.push({
          x: nextRect.left,
          y: nextRect.top,
          width: nextRect.width,
          height: nextRect.height
        });
      }

      const stepDist = Math.abs(nextRect.top - curRect.top);
      accumulatedDistance += stepDist > 0 ? stepDist : charHeight;
      lastFound = nextTarget;
      foundTarget = nextTarget;
      finalTargetRect = nextRect;
    }

    // 若已無後續行可跳轉（原地即為頂端或底端），保持在原位並觸發邊界提示，避免突兀瞬移回全文首尾
    if (!foundTarget) {
      if (isDownward) {
        const now = Date.now();
        if (now - this.lastBoundaryNoticeTime > 1500) {
          this.lastBoundaryNoticeTime = now;
          const state = cursorStore.getState();
          const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];
          const isSidebarOrWidget = effRoot !== this.rootElement && isOutOfNormalFlowWidget(effRoot, this.rootElement);
          const notice = isSidebarOrWidget ? dict.noticeWidgetBottom : dict.noticePageBottom;
          cursorStore.showStatusNotice(notice, 1500);
        }
      }
      return;
    }

    this.currentTarget = foundTarget;
    this.updateActiveScope(foundTarget.node);

    // 4. 對齊游標實際位移與視窗捲動量，並加上黃金視野區間夾限 (Viewport Clamping)，徹底防止長按或跨大圖時游標超出畫面
    const adv = cursorStore.getState().advanced;
    const maxPad = Math.floor(viewHeight * 0.28);
    const padBottom = Math.min(maxPad, adv?.viewportPaddingBottom ?? 160);
    const padTop = Math.min(maxPad, adv?.viewportPaddingTop ?? 120);
    const actualCursorDelta = finalTargetRect ? (finalTargetRect.top - baseRect.top) : scrollAmount;

    let effectiveDelta = isDownward
      ? Math.max(scrollAmount, actualCursorDelta)
      : Math.min(scrollAmount, actualCursorDelta);

    if (finalTargetRect) {
      const expectedTop = (finalTargetRect.top - parentTop) - effectiveDelta;
      const expectedBottom = (finalTargetRect.bottom - parentTop) - effectiveDelta;
      if (expectedBottom > viewHeight - padBottom) {
        effectiveDelta += expectedBottom - (viewHeight - padBottom);
      } else if (expectedTop < padTop) {
        effectiveDelta -= padTop - expectedTop;
      }
    }

    if (scrollTarget) {
      if (isRepeat) {
        // 長按連發模式：取消未完動畫，執行零延遲 instant 同步捲動，確保視窗與游標 100% 鎖定不脫軌
        cancelActiveScroll();
        const isWin = scrollTarget === window || !(scrollTarget instanceof HTMLElement);
        if (isWin) {
          window.scrollBy({ top: effectiveDelta, behavior: 'instant' as ScrollBehavior });
        } else {
          (scrollTarget as HTMLElement).scrollTop += effectiveDelta;
        }
      } else {
        // 單次按鍵模式：執行 Ease-Out Cubic 物理阻尼平滑滾動
        const targetScrollTop = Math.max(0, currentScroll + effectiveDelta);
        animateScrollTo(scrollTarget, targetScrollTop, 380);
      }
    }

    // 排除最後一個目標行，取中間經過行（最多保留 8 階代表點；長按時不產生殘影以維持最佳效能）
    let waypoints: CursorRect[] | undefined;
    if (!isRepeat) {
      const rawWaypoints = tempWaypoints.slice(0, -1);
      waypoints = rawWaypoints;
      if (rawWaypoints.length > 8) {
        const stepInterval = rawWaypoints.length / 8;
        waypoints = [];
        for (let i = 0; i < 8; i++) {
          waypoints.push(rawWaypoints[Math.floor(i * stepInterval)]);
        }
      }
    }

    // 5. 強制保持游標可見並同步更新位置 (保護翻頁動畫啟動瞬間目標行尚在可見視窗外而不被誤判熄滅)
    cursorStore.setState({ visible: true });
    this.updateCursorPosition(false, waypoints, false, true, isDownward ? 'down' : 'up', isRepeat);
  }
}
