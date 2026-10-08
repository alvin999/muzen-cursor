import { cursorStore, MotionDirection, CursorRect, matchesKeybinding, DEFAULT_KEYBINDINGS, JumpMenuItem } from './cursorStore';
import { isTypingContext } from '../utils/domUtils';
import { WordNavigator, TextTarget } from './wordNavigator';
import { resolveTextTargetFromPoint, isClickWithinDistanceThreshold, getRawCaretFromPoint } from '../utils/caretUtils';
import { animateScrollTo, getScrollParent, getViewportMetrics } from '../utils/smoothScroller';
import {
  findFirstTextNodeIn,
  findNextTextNode,
  findPrevTextNode,
  getCharRectOfTarget,
  searchDownwardNextLine,
  searchUpwardPrevLine,
  computeWaypointsBetween,
  findVisualLineBoundary
} from './navigation/spatialNavigator';
import { VisualSelectionManager } from './navigation/selectionManager';

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
  private preferredX: number | null = null;
  private lastKeyTime = 0;
  private lastKey = '';
  private moveTimer: any = null;

  // Jump 歷史堆疊 (上限 30 筆) 與 Toggle 恢復點
  private jumpHistory: JumpPoint[] = [];
  private readonly MAX_JUMPS = 30;
  private lastJumpBackTarget: JumpPoint | null = null;
  private jumpMenuTimer: any = null;
  private isJumpMenuExact = false;

  private selectionManager = new VisualSelectionManager();

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private scrollHandler: (() => void) | null = null;

  constructor(options?: CursorControllerOptions) {
    this.options = options;
  }

  private get rootElement(): HTMLElement {
    return this.options?.containerRoot || document.body;
  }

  public init(): void {
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.clickHandler = (e: MouseEvent) => this.handleClick(e);

    // 視窗縮放與滾動時保持游標位置緊密貼合
    let ticking = false;
    const requestUpdate = () => {
      // 視窗縮放或折行改變時，重設水平記憶欄位，避免以縮放前的舊座標定位
      this.preferredX = null;
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

    this.resizeHandler = requestUpdate;
    this.scrollHandler = requestUpdate;

    window.addEventListener('keydown', this.keydownHandler, true);
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
  }

  /**
   * 點擊網頁文字時，自動聚焦並初始化游標定位
   */
  private handleClick(e: MouseEvent): void {
    this.closeJumpMenu();
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

    if (cursorStore.getState().mode !== 'VISUAL') {
      this.selectionManager.clearAnchor();
    }

    // 直接喚醒游標並設定為可見，狀態列同步切換為 NORMAL 模式
    cursorStore.setState({ enabled: true, visible: true });
    this.updateCursorPosition(false);
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

      const isCurrentlyActive = state.enabled && state.visible;
      if (isCurrentlyActive) {
        // 關閉：立即退回休眠狀態
        cursorStore.setState({ visible: false });
      } else {
        // 開啟：立即強制喚醒接管
        cursorStore.setState({ enabled: true, visible: true });
        if (!this.currentTarget || !document.contains(this.currentTarget.node)) {
          this.findInitialTarget();
        } else {
          this.updateCursorPosition(true);
        }
      }
      return;
    }

    // 2. 若處於輸入框或富文本編輯器打字情境，不干擾打字
    if (isTypingContext(e)) {
      return;
    }

    if (!state.enabled) {
      return;
    }

    // 3. 落實右下角「按 j 開始」：若游標處於休眠隱藏狀態 (!visible)，按下 j (moveDown) 時直接喚醒
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
        return;
      }
      // 其他單鍵與快捷鍵在休眠時 100% 自然放行給網頁原生
      return;
    }

    // 4. 游標處於喚醒接管狀態 (visible: true)：所有 Vim 按鍵全面霸道接管
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
        return;
      }
      intercept();
      this.closeJumpMenu();
      return;
    }

    // 若有掛起的單按 ' 或 ` 浮動選單計時器，非單按時予以清除
    if (this.jumpMenuTimer && e.key !== "'" && e.key !== '`') {
      clearTimeout(this.jumpMenuTimer);
      this.jumpMenuTimer = null;
    }

    // Esc: 退出選取或隱藏游標返回休眠
    if (matchesKeybinding(e, bindings.escape)) {
      this.closeJumpMenu();
      intercept();
      if (state.mode === 'VISUAL') {
        this.exitVisualMode();
      } else {
        cursorStore.setState({ visible: false });
      }
      return;
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
        this.jumpBack(false); // false: 同一行行首
        return;
      }

      // 單按 ' 鍵：啟動 400ms 計時器，若未按第二下則喚醒 Neovim 浮動選單
      if (e.key === "'" && !e.ctrlKey && !e.altKey && !e.metaKey && !isDoubleKey) {
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
        this.jumpBack(true); // true: 同一字元精確位置
        return;
      }

      // 單按 ` 鍵：啟動 400ms 計時器，若未按第二下則喚醒 Neovim 浮動選單 (精確字元模式)
      if (e.key === '`' && !e.ctrlKey && !e.altKey && !e.metaKey && !isDoubleKey) {
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
        this.jumpToDocumentStart();
        return;
      }
    }

    if (matchesKeybinding(e, bindings.visualMode)) {
      intercept();
      this.toggleVisualMode();
      return;
    }

    if (matchesKeybinding(e, bindings.yank)) {
      if (state.mode === 'VISUAL') {
        intercept();
        this.yankSelection();
      }
      return;
    }

    if (matchesKeybinding(e, bindings.moveLeft)) {
      intercept();
      this.moveHorizontal(-1);
      return;
    }

    if (matchesKeybinding(e, bindings.moveRight)) {
      intercept();
      this.moveHorizontal(1);
      return;
    }

    if (matchesKeybinding(e, bindings.moveUp)) {
      intercept();
      this.moveVertical(-1);
      return;
    }

    if (matchesKeybinding(e, bindings.moveDown)) {
      intercept();
      this.moveVertical(1);
      return;
    }

    if (matchesKeybinding(e, bindings.wordForward)) {
      intercept();
      this.moveWordForward();
      return;
    }

    if (matchesKeybinding(e, bindings.wordBackward)) {
      intercept();
      this.moveWordBackward();
      return;
    }

    if (matchesKeybinding(e, bindings.wordEnd)) {
      intercept();
      this.moveWordEnd();
      return;
    }

    if (matchesKeybinding(e, bindings.lineStart)) {
      intercept();
      this.jumpToLineBoundary(true);
      return;
    }

    if (matchesKeybinding(e, bindings.lineEnd)) {
      intercept();
      this.jumpToLineBoundary(false);
      return;
    }

    if (matchesKeybinding(e, bindings.halfPageDown)) {
      intercept();
      this.moveHalfPage(true);
      return;
    }

    if (matchesKeybinding(e, bindings.halfPageUp)) {
      intercept();
      this.moveHalfPage(false);
      return;
    }

    if (matchesKeybinding(e, bindings.docEnd)) {
      intercept();
      this.jumpToDocumentEnd();
      return;
    }
  }

  /**
   * 水平移動 (h / l)
   */
  public moveHorizontal(delta: number): void {
    this.preferredX = null;
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = this.currentTarget;
    const textLength = node.textContent?.length || 0;

    if (delta > 0) {
      // 向右移動 (l)
      const nextOffset = offset + delta;
      if (nextOffset < textLength) {
        this.currentTarget.offset = nextOffset;
        this.updateCursorPosition(true);
      } else {
        // 到達當前文字節點末尾，平滑無縫跨入下一個文字標籤之首字元
        const nextNode = findNextTextNode(node, this.rootElement);
        if (nextNode) {
          this.currentTarget = { node: nextNode, offset: 0 };
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
        const prevNode = findPrevTextNode(node, this.rootElement);
        if (prevNode) {
          const prevLen = prevNode.textContent?.length || 0;
          this.currentTarget = {
            node: prevNode,
            offset: Math.max(0, prevLen - 1)
          };
          this.updateCursorPosition(true);
        }
      }
    }
  }

  /**
   * 垂直移動 (j / k) - 穿透同行 <a>, <span>, <code> 標籤，精準鎖定下一視覺行
   */
  public moveVertical(deltaRows: number): void {
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    const steps = Math.abs(deltaRows);
    const isDownward = deltaRows > 0;
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

      const currentCharTop = charRect ? charRect.y : (baseRect.height > 0 ? baseRect.top : 0);
      const charHeight = charRect ? charRect.height : (baseRect.height > 0 ? baseRect.height : 22);
      const lineThreshold = charHeight * 0.65;

      // 2. 鎖定或保持基準水平 X 座標 (Vim 經典行為)
      if (this.preferredX === null) {
        this.preferredX = charRect ? charRect.x : (baseRect.width > 0 ? baseRect.left : 0);
      }
      const targetX = this.preferredX;

      const foundTarget: TextTarget | null = isDownward
        ? searchDownwardNextLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX, this.rootElement)
        : searchUpwardPrevLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX, this.rootElement);

      if (foundTarget) {
        this.currentTarget = foundTarget;

        // 若不是最後一步，收集中間經過的視覺行真實路徑點
        if (step < steps - 1) {
          const rect = getCharRectOfTarget(foundTarget);
          if (rect) {
            waypoints.push(rect);
          }
        }
      } else {
        break;
      }
    }

    this.updateCursorPosition(true, waypoints);
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
      const nextNode = findNextTextNode(node, this.rootElement);
      if (nextNode) {
        const nextText = nextNode.textContent || '';
        const initialOffset = WordNavigator.getNextWordOffset(nextText, -1);
        this.currentTarget = {
          node: nextNode,
          offset: initialOffset < nextText.length ? initialOffset : 0
        };
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
      const prevNode = findPrevTextNode(node, this.rootElement);
      if (prevNode) {
        const prevText = prevNode.textContent || '';
        const lastWord = WordNavigator.getPrevWordOffset(prevText, prevText.length);
        this.currentTarget = {
          node: prevNode,
          offset: lastWord
        };
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
      const nextNode = findNextTextNode(node, this.rootElement);
      if (nextNode) {
        const nextText = nextNode.textContent || '';
        const nextEnd = WordNavigator.getWordEndOffset(nextText, 0);
        this.currentTarget = {
          node: nextNode,
          offset: nextEnd
        };
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
    const boundary = findVisualLineBoundary(this.currentTarget, isStart, this.rootElement);
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
        return;
      }

      // 2. 從歷史堆疊讀取最新一筆跳轉點 (不破壞堆疊)
      if (this.jumpHistory.length === 0) {
        return;
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
   * 跳至文章頂部 (gg)
   */
  public jumpToDocumentStart(): void {
    this.pushJumpPoint();
    const firstText = findFirstTextNodeIn(this.rootElement);
    if (firstText) {
      this.currentTarget = { node: firstText, offset: 0 };
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
   * 跳至文章底部 (G)
   */
  public jumpToDocumentEnd(): void {
    this.pushJumpPoint();
    const walker = document.createTreeWalker(this.rootElement, NodeFilter.SHOW_TEXT);
    let lastTextNode: Text | null = null;
    let n = walker.nextNode();
    while (n) {
      if (n.textContent && n.textContent.trim().length > 0) {
        lastTextNode = n as Text;
      }
      n = walker.nextNode();
    }

    if (lastTextNode) {
      this.currentTarget = {
        node: lastTextNode,
        offset: lastTextNode.textContent?.length || 0
      };
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
   * 切換 Visual 模式
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
   * 探測並定位初始游標位置
   */
  public findInitialTarget(): void {
    if (this.options?.containerRoot) {
      const firstText = findFirstTextNodeIn(this.options.containerRoot);
      if (firstText) {
        this.currentTarget = { node: firstText, offset: 0 };
        this.updateCursorPosition();
        return;
      }
    }

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 3;

    // 優先使用跨瀏覽器標準 Caret 解析器 (消除 caretRangeFromPoint 廢棄警告)
    const rawCaret = getRawCaretFromPoint(cx, cy);
    if (rawCaret) {
      if (rawCaret.node.nodeType === Node.TEXT_NODE) {
        this.currentTarget = {
          node: rawCaret.node as Text,
          offset: rawCaret.offset
        };
        this.updateCursorPosition();
        return;
      } else if (rawCaret.node.nodeType === Node.ELEMENT_NODE) {
        const textNode = findFirstTextNodeIn(rawCaret.node);
        if (textNode) {
          this.currentTarget = { node: textNode, offset: 0 };
          this.updateCursorPosition();
          return;
        }
      }
    }

    // 視窗可見文字深度探測：使用 Range 精確測量文字節點在目前視窗中的座標
    const walker = document.createTreeWalker(this.rootElement, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      const text = n.textContent?.trim();
      const parent = n.parentElement;
      if (
        text &&
        text.length > 0 &&
        parent &&
        !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(parent.tagName)
      ) {
        try {
          const testRange = document.createRange();
          testRange.selectNodeContents(n);
          const rect = testRange.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight) {
            this.currentTarget = { node: n as Text, offset: 0 };
            this.updateCursorPosition();
            return;
          }
        } catch {}
      }
      n = walker.nextNode();
    }
  }

  /**
   * 計算螢幕座標與微調游標
   */
  private updateCursorPosition(scrollIntoView: boolean = false, waypoints?: CursorRect[], isScrollUpdate: boolean = false): void {
    if (!this.currentTarget) return;

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
        const text = node.textContent || '';
        const parent = node.parentElement;
        const parentRect = parent ? parent.getBoundingClientRect() : null;
        const fallbackH = 20;

        // 若當前游標在換行符號之後（即新一行的開頭）
        if (safeOffset > 0 && text[safeOffset - 1] === '\n') {
          // 若本行有可視字元，取後續字元的 top
          if (safeOffset < textLen && text[safeOffset] !== '\n') {
            range.setStart(node, safeOffset);
            range.setEnd(node, safeOffset + 1);
            const nextRect = range.getBoundingClientRect();
            rect = {
              x: nextRect.left,
              y: nextRect.top,
              left: nextRect.left,
              top: nextRect.top,
              width: 8,
              height: nextRect.height > 0 ? nextRect.height : fallbackH,
              right: nextRect.left + 8,
              bottom: nextRect.top + fallbackH
            } as DOMRect;
          } else if (parentRect) {
            // 空行：Y 軸依據上一字元遞增
            range.setStart(node, safeOffset - 1);
            range.setEnd(node, safeOffset);
            const prevRect = range.getBoundingClientRect();
            const newTop = prevRect.top > 0 ? prevRect.top + fallbackH : parentRect.top;
            rect = {
              x: parentRect.left + 8,
              y: newTop,
              left: parentRect.left + 8,
              top: newTop,
              width: 8,
              height: fallbackH,
              right: parentRect.left + 16,
              bottom: newTop + fallbackH
            } as DOMRect;
          }
        } else if (safeOffset > 0) {
          range.setStart(node, safeOffset - 1);
          range.setEnd(node, safeOffset);
          const prevRect = range.getBoundingClientRect();
          const charH = prevRect.height > 0 ? prevRect.height : fallbackH;
          rect = {
            x: prevRect.right,
            left: prevRect.right,
            y: prevRect.top,
            top: prevRect.top,
            right: prevRect.right + 8,
            bottom: prevRect.bottom > 0 ? prevRect.bottom : prevRect.top + charH,
            width: 8,
            height: charH
          } as DOMRect;
        } else if (parentRect) {
          rect = {
            x: parentRect.left,
            y: parentRect.top,
            width: 8,
            height: fallbackH,
            top: parentRect.top,
            left: parentRect.left,
            right: parentRect.left + 8,
            bottom: parentRect.top + fallbackH
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

      // 容許適度邊界緩衝，避免邊界滾動時游標閃現閃退；若座標暫未就緒，安全維持當前可見狀態
      const hasValidCoords = typeof rect.top === 'number' && typeof rect.bottom === 'number' && !isNaN(rect.top) && !isNaN(rect.bottom);
      const isVisibleInViewport = hasValidCoords
        ? (rect.bottom >= -80 && rect.top <= viewportH + 80)
        : (cursorStore.getState().visible ?? true);

      // 視窗純捲動/縮放更新：僅靜默貼齊游標位置，嚴格抑制殘影與運動序列遞增
      if (isScrollUpdate) {
        cursorStore.setState({
          visible: isVisibleInViewport,
          isMoving: false,
          motionDirection: 'none',
          isScrollUpdate: true,
          rect: {
            x: rect.left,
            y: rect.top,
            width: Math.max(rect.width, 8),
            height: Math.max(rect.height, 16)
          },
          readingProgress: progress,
          charOffset: safeOffset
        });
        this.previousTarget = { ...this.currentTarget };
        return;
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

      cursorStore.setState({
        visible: isVisibleInViewport,
        isMoving: true,
        motionDirection: motionDir,
        motionSequence: (prevState.motionSequence || 0) + 1,
        isScrollUpdate: false,
        rect: {
          x: rect.left,
          y: rect.top,
          width: Math.max(rect.width, 8),
          height: Math.max(rect.height, 16)
        },
        trailWaypoints: finalWaypoints && finalWaypoints.length > 0 ? finalWaypoints : undefined,
        readingProgress: progress,
        charOffset: safeOffset
      });

      this.previousTarget = { ...this.currentTarget };

      // Visual 模式下即時更新原生選取
      if (cursorStore.getState().mode === 'VISUAL') {
        this.selectionManager.syncNativeSelection(this.currentTarget);
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
        const scrollDuration = adv?.scrollDurationMs ?? 320;

        // 自適應字元行高緩衝：在任何縮放比例下，維持約半行字高的舒適安全視距
        const lineBuffer = Math.max(12, Math.min(36, Math.round((rect.height || 20) * 0.5)));

        if (scrollTarget) {
          // 向下閱讀超過底部邊界視野時
          if (curBottom > viewHeight - padBottom) {
            const targetScroll = currentScroll + (curBottom - (viewHeight - padBottom)) + lineBuffer;
            animateScrollTo(scrollTarget, targetScroll, scrollDuration);
          } else if (curTop < padTop) {
            // 向上閱讀低於頂部邊界視野時
            const targetScroll = Math.max(0, currentScroll - (padTop - curTop) - lineBuffer);
            animateScrollTo(scrollTarget, targetScroll, scrollDuration);
          }
        }
      }
    } catch (err) {
      console.warn('[Muzen Cursor] updateCursorPosition error:', err);
    }
  }

  /**
   * 半頁跳轉 (d 向下 / u 向上) - 保證實體翻動 50% 視窗高度並精準重錨定目標行
   */
  public moveHalfPage(isDownward: boolean): void {
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
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
    const { scrollTarget, viewHeight, currentScroll } = getViewportMetrics(node, this.options?.containerRoot);
    const jumpDistance = Math.max(viewHeight * 0.5, charHeight * 3);
    const scrollAmount = Math.round(jumpDistance) * (isDownward ? 1 : -1);

    let foundTarget: { node: Text; offset: number } | null = null;
    let accumulatedDistance = 0;
    let lastFound = this.currentTarget;
    let steps = 0;
    const maxSteps = 80;

    const tempWaypoints: CursorRect[] = [];

    // 3. 連續向下或向上推進視覺行，尋找垂直位移達約半頁之最佳目標行
    while (accumulatedDistance < jumpDistance && steps < maxSteps) {
      steps++;
      const curLen = lastFound.node.textContent?.length || 0;
      const curSafe = Math.min(lastFound.offset, Math.max(0, curLen - 1));
      const r = document.createRange();
      r.setStart(lastFound.node, curSafe);
      r.setEnd(lastFound.node, Math.min(curSafe + 1, curLen));
      const curRect = r.getBoundingClientRect();

      const nextTarget = isDownward
        ? searchDownwardNextLine(lastFound.node, lastFound.offset, curRect.top, lineThreshold, charHeight, targetX, this.rootElement)
        : searchUpwardPrevLine(lastFound.node, lastFound.offset, curRect.top, lineThreshold, charHeight, targetX, this.rootElement);

      if (!nextTarget) break;

      const nextLen = nextTarget.node.textContent?.length || 0;
      const nextSafe = Math.min(nextTarget.offset, Math.max(0, nextLen - 1));
      r.setStart(nextTarget.node, nextSafe);
      r.setEnd(nextTarget.node, Math.min(nextSafe + 1, nextLen));
      const nextRect = r.getBoundingClientRect();

      if (nextRect.width > 0 && nextRect.height > 0) {
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
    }

    // 若已無後續行可跳轉，優雅回退至全文首尾
    if (!foundTarget) {
      if (isDownward) {
        this.jumpToDocumentEnd();
      } else {
        this.jumpToDocumentStart();
      }
      return;
    }

    this.currentTarget = foundTarget;

    // 4. 執行保證幅度的 Ease-Out Cubic 物理阻尼平滑滾動
    const targetScrollTop = currentScroll + scrollAmount;
    if (scrollTarget) {
      animateScrollTo(scrollTarget, targetScrollTop, 380);
    }

    // 排除最後一個目標行，取中間經過行（最多保留 8 階代表點）
    const rawWaypoints = tempWaypoints.slice(0, -1);
    let waypoints = rawWaypoints;
    if (rawWaypoints.length > 8) {
      const stepInterval = rawWaypoints.length / 8;
      waypoints = [];
      for (let i = 0; i < 8; i++) {
        waypoints.push(rawWaypoints[Math.floor(i * stepInterval)]);
      }
    }

    // 5. 強制保持游標可見並同步更新位置
    cursorStore.setState({ visible: true });
    this.updateCursorPosition(false, waypoints);
  }
}
