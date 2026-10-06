import { cursorStore, MotionDirection, CursorRect, matchesKeybinding, DEFAULT_KEYBINDINGS } from './cursorStore';
import { isTypingContext } from '../utils/domUtils';
import { WordNavigator, TextTarget } from './wordNavigator';

let activeScrollRafId: number | null = null;

/**
 * 具有物理阻尼感之 Ease-Out Cubic 平滑捲動引擎 (移植自 mugen-yomu 核心演算法)
 */
function animateScrollTo(
  target: HTMLElement | Window,
  targetTop: number,
  duration?: number
): void {
  const actualDuration = typeof duration === 'number'
    ? duration
    : (cursorStore.getState().advanced?.scrollDurationMs ?? 380);
  if (activeScrollRafId !== null) {
    cancelAnimationFrame(activeScrollRafId);
    activeScrollRafId = null;
  }

  const isWin = target === window || !(target instanceof HTMLElement);
  const startTop = isWin
    ? (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0)
    : (target as HTMLElement).scrollTop;

  const maxScroll = isWin
    ? Math.max(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight)
    : Math.max(0, (target as HTMLElement).scrollHeight - (target as HTMLElement).clientHeight);

  const clampedTarget = Math.max(0, Math.min(maxScroll, targetTop));
  const distance = clampedTarget - startTop;

  const isSmooth = cursorStore.getState().effects?.smoothScroll ?? true;
  if (!isSmooth || Math.abs(distance) < 2) {
    if (isWin) {
      window.scrollTo(0, clampedTarget);
    } else {
      (target as HTMLElement).scrollTop = clampedTarget;
    }
    return;
  }

  const startTime = performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / actualDuration);
    // Ease-Out Cubic: mugen-yomu 招牌物理阻尼曲線，確保極致絲滑
    const ease = 1 - Math.pow(1 - progress, 3);
    const currentPos = startTop + distance * ease;

    if (isWin) {
      window.scrollTo(0, currentPos);
    } else {
      (target as HTMLElement).scrollTop = currentPos;
    }

    if (progress < 1) {
      activeScrollRafId = requestAnimationFrame(step);
    } else {
      if (isWin) {
        window.scrollTo(0, clampedTarget);
      } else {
        (target as HTMLElement).scrollTop = clampedTarget;
      }
      activeScrollRafId = null;
    }
  }

  activeScrollRafId = requestAnimationFrame(step);
}

export interface CursorControllerOptions {
  containerRoot?: HTMLElement;
  enableScroll?: boolean;
}

/**
 * Vim 核心游標控制器 (純邏輯運算，解除業務綁定)
 */
export class CursorController {
  private options?: CursorControllerOptions;
  private currentTarget: TextTarget | null = null;
  private previousTarget: TextTarget | null = null;
  private visualAnchor: TextTarget | null = null;
  private preferredX: number | null = null;
  private lastKeyTime = 0;
  private lastKey = '';
  private moveTimer: any = null;

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
  }

  /**
   * 點擊網頁文字時，自動聚焦並初始化游標定位
   */
  private handleClick(e: MouseEvent): void {
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

    // 1. 排除點擊全域大背景（例如 body、html、全螢幕 wrapper）
    const isGlobalContainer =
      targetEl === document.body ||
      targetEl === document.documentElement ||
      targetEl.tagName === 'BODY' ||
      targetEl.tagName === 'HTML';

    let targetNode: Text | null = null;
    let targetOffset = 0;

    let range: Range | null = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(clickX, clickY);
    } else if ((document as unknown as { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } }).caretPositionFromPoint) {
      const pos = (document as unknown as { caretPositionFromPoint: (x: number, y: number) => { offsetNode: Node; offset: number } }).caretPositionFromPoint(clickX, clickY);
      if (pos) {
        if (pos.offsetNode.nodeType === Node.TEXT_NODE) {
          targetNode = pos.offsetNode as Text;
          targetOffset = pos.offset;
        } else if (pos.offsetNode.nodeType === Node.ELEMENT_NODE && pos.offsetNode !== document.body && pos.offsetNode !== document.documentElement) {
          targetNode = this.findFirstTextNodeIn(pos.offsetNode);
          targetOffset = 0;
        }
      }
    }

    if (range) {
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        targetNode = range.startContainer as Text;
        targetOffset = range.startOffset;
      } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
        const elem = range.startContainer as Element;
        // 只有非 body/html 的具體元素才採納
        if (elem !== document.body && elem !== document.documentElement) {
          if (elem.childNodes.length > 0) {
            const childIndex = Math.min(range.startOffset, elem.childNodes.length - 1);
            const child = elem.childNodes[childIndex];
            targetNode = child.nodeType === Node.TEXT_NODE ? (child as Text) : this.findFirstTextNodeIn(child);
          } else {
            targetNode = this.findFirstTextNodeIn(elem);
          }
          targetOffset = 0;
        }
      }
    }

    // 2. 後備方案：純依賴 CSSOM 渲染層與視覺排版判斷，不列舉任何 HTML 標籤
    if (!targetNode && !isGlobalContainer) {
      const isVisible = typeof targetEl.checkVisibility === 'function'
        ? targetEl.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        : (targetEl.offsetWidth > 0 || targetEl.offsetHeight > 0 || targetEl.getClientRects().length > 0);

      if (isVisible && (targetEl.innerText?.trim().length || 0) > 0) {
        try {
          const computed = window.getComputedStyle(targetEl);
          if (computed.userSelect !== 'none' && computed.pointerEvents !== 'none') {
            const firstText = this.findFirstTextNodeIn(targetEl);
            if (firstText) {
              targetNode = firstText;
              targetOffset = 0;
            }
          }
        } catch {
          // 容錯防禦
        }
      }
    }

    // 3. 關鍵距離防禦：確認找到的文字節點與點擊處的物理距離
    // 若點擊點距離文字過遠（點在兩側大片空白），絕不胡亂跳躍
    if (targetNode) {
      try {
        const testRange = document.createRange();
        testRange.selectNodeContents(targetNode);
        const rect = testRange.getBoundingClientRect();

        const verticalDist = clickY < rect.top ? rect.top - clickY : clickY > rect.bottom ? clickY - rect.bottom : 0;
        const horizontalDist = clickX < rect.left ? rect.left - clickX : clickX > rect.right ? clickX - rect.right : 0;

        if (verticalDist > 40 || horizontalDist > 120) {
          // 點擊距離文字過遠，屬於純空白點擊，不改變游標位置
          return;
        }
      } catch {
        return;
      }

      this.currentTarget = {
        node: targetNode,
        offset: targetOffset
      };
      if (cursorStore.getState().mode !== 'VISUAL') {
        this.visualAnchor = null;
      }
      // 直接喚醒游標並設定為可見，狀態列同步切換為 NORMAL 模式
      cursorStore.setState({ enabled: true, visible: true });
      this.updateCursorPosition(false);
    }
  }

  private findFirstTextNodeIn(root: Node): Text | null {
    if (root.nodeType === Node.TEXT_NODE && (root.textContent?.trim().length || 0) > 0) {
      return root as Text;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent && node.textContent.trim().length > 0) {
        return node as Text;
      }
      node = walker.nextNode();
    }
    return null;
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
    // 呼叫 stopImmediatePropagation 徹底壓制任何網頁原生物件監聽器
    const intercept = () => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    // Esc: 退出選取或隱藏游標返回休眠
    if (matchesKeybinding(e, bindings.escape)) {
      intercept();
      if (state.mode === 'VISUAL') {
        this.exitVisualMode();
      } else {
        cursorStore.setState({ visible: false });
      }
      return;
    }

    // 連續指令 gg (跳至全文頂部) 比對
    const now = Date.now();
    const prevKey = this.lastKey;
    const isDoubleG = prevKey === 'g' && e.key === 'g' && now - this.lastKeyTime < 500;
    this.lastKey = e.key;
    this.lastKeyTime = now;

    const docStartDef = bindings.docStart;
    if (docStartDef && docStartDef.enabled) {
      if ((docStartDef.key === 'g' && isDoubleG) || (docStartDef.key !== 'g' && matchesKeybinding(e, docStartDef))) {
        intercept();
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
        // 到達當前文字節點末尾，平滑無縫跨入下一個文字標籤（如 <code>）之首字元
        const nextNode = this.findNextTextNode(node);
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
        const prevNode = this.findPrevTextNode(node);
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
      const charRect = this.getCharRectOfTarget(target);
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
        ? this.searchDownwardNextLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX)
        : this.searchUpwardPrevLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX);

      if (foundTarget) {
        this.currentTarget = foundTarget;

        // 若不是最後一步（代表是中間經過的視覺行），由原本 j / k 演算法決定真實字元邊界（空白自動吸附至行末）
        if (step < steps - 1) {
          const rect = this.getCharRectOfTarget(foundTarget);
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
   * 向下尋找下一視覺行（跨節點完整收集整條視覺行，穿透 <a>、<span>、<code> 標籤）
   */
  private searchDownwardNextLine(
    startNode: Text,
    startOffset: number,
    currentCharTop: number,
    lineThreshold: number,
    charHeight: number,
    targetX: number
  ): { node: Text; offset: number } | null {
    const range = document.createRange();
    let targetLineTop: number | null = null;
    let targetCharHeight = charHeight;
    const lineCandidates: { node: Text; offset: number; rect: DOMRect }[] = [];

    let currentNode: Text | null = startNode;
    let nodeOffsetStart = startOffset + 1;
    let nodesScanned = 0;
    const MAX_NODES_TO_SCAN = 300;

    while (currentNode && nodesScanned < MAX_NODES_TO_SCAN) {
      nodesScanned++;
      const text = currentNode.textContent || '';
      const len = text.length;

      for (let i = nodeOffsetStart; i < len; i++) {
        const char = text[i];
        if (char === '\r') continue;

        // 若已鎖定目標行且遇到 \n（如在 pre 或程式碼區塊換行），表示該目標視覺行已結束
        if (targetLineTop !== null && char === '\n') {
          return this.pickBestCandidate(lineCandidates, targetX);
        }
        if (char === '\n') continue;

        range.setStart(currentNode, i);
        range.setEnd(currentNode, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        if (targetLineTop === null) {
          // 階段 1：尋找下一視覺行的第一個實體字元（解除原本 5 倍行高的過度防禦限制）
          const diffY = rect.top - currentCharTop;
          if (diffY > lineThreshold) {
            targetLineTop = rect.top;
            targetCharHeight = rect.height > 0 ? rect.height : charHeight;
            lineCandidates.push({ node: currentNode, offset: i, rect });
          }
        } else {
          // 階段 2：收集屬於該視覺行的所有字元（允許跨越 <a>, <code>, <span> 等 inline 標籤）
          const diffFromTarget = rect.top - targetLineTop;
          // 若明顯進入再下一行（下下行），表示目標行已完整收集結束
          if (diffFromTarget > targetCharHeight * 0.65) {
            return this.pickBestCandidate(lineCandidates, targetX);
          }
          if (Math.abs(diffFromTarget) <= targetCharHeight * 0.65) {
            lineCandidates.push({ node: currentNode, offset: i, rect });
          }
        }
      }

      currentNode = this.findNextTextNode(currentNode);
      nodeOffsetStart = 0;
    }

    if (lineCandidates.length > 0) {
      return this.pickBestCandidate(lineCandidates, targetX);
    }

    return null;
  }

  /**
   * 向上尋找上一視覺行（跨節點完整收集整條視覺行，穿透 <a>、<span>、<code> 標籤）
   */
  private searchUpwardPrevLine(
    startNode: Text,
    startOffset: number,
    currentCharTop: number,
    lineThreshold: number,
    charHeight: number,
    targetX: number
  ): { node: Text; offset: number } | null {
    const range = document.createRange();
    let targetLineTop: number | null = null;
    let targetCharHeight = charHeight;
    const lineCandidates: { node: Text; offset: number; rect: DOMRect }[] = [];

    let currentNode: Text | null = startNode;
    let nodeOffsetStart = startOffset - 1;
    let nodesScanned = 0;
    const MAX_NODES_TO_SCAN = 300;

    while (currentNode && nodesScanned < MAX_NODES_TO_SCAN) {
      nodesScanned++;
      const text = currentNode.textContent || '';
      const startFrom = nodeOffsetStart >= 0 ? Math.min(nodeOffsetStart, text.length - 1) : -1;

      for (let i = startFrom; i >= 0; i--) {
        const char = text[i];
        if (char === '\r') continue;

        // 若已鎖定目標行且逆向遇到 \n（如在 pre 或程式碼換行），表示該目標視覺行開頭已結束
        if (targetLineTop !== null && char === '\n') {
          return this.pickBestCandidate(lineCandidates, targetX);
        }
        if (char === '\n') continue;

        range.setStart(currentNode, i);
        range.setEnd(currentNode, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        if (targetLineTop === null) {
          // 階段 1：逆向尋找上一視覺行的第一個實體字元（解除原本 5 倍行高的過度防禦限制）
          const diffY = currentCharTop - rect.top;
          if (diffY > lineThreshold) {
            targetLineTop = rect.top;
            targetCharHeight = rect.height > 0 ? rect.height : charHeight;
            lineCandidates.push({ node: currentNode, offset: i, rect });
          }
        } else {
          // 階段 2：逆向收集屬於該視覺行的所有字元
          const diffFromTarget = targetLineTop - rect.top;
          // 若明顯進入更上一行（上上一行），表示目標行已逆向收集完畢
          if (diffFromTarget > targetCharHeight * 0.65) {
            return this.pickBestCandidate(lineCandidates, targetX);
          }
          if (Math.abs(diffFromTarget) <= targetCharHeight * 0.65) {
            lineCandidates.push({ node: currentNode, offset: i, rect });
          }
        }
      }

      currentNode = this.findPrevTextNode(currentNode);
      if (currentNode) {
        nodeOffsetStart = (currentNode.textContent?.length || 1) - 1;
      }
    }

    if (lineCandidates.length > 0) {
      return this.pickBestCandidate(lineCandidates, targetX);
    }

    return null;
  }

  /**
   * 在跨節點視覺行候選字元清單中，挑選與 targetX 水平最匹配的字元
   * 確保水平對齊具備嚴格一致性與對稱性，避免連續 j / k 游標漂移
   */
  private pickBestCandidate(
    candidates: { node: Text; offset: number; rect: DOMRect }[],
    targetX: number
  ): { node: Text; offset: number } | null {
    if (candidates.length === 0) return null;

    // 嚴格依水平左座標排序，消除正向/逆向掃描帶來的順序偏差
    candidates.sort((a, b) => a.rect.left - b.rect.left);

    // 1. 若整行都在 targetX 右邊（目標在整行左側之外）：取第 1 個字元
    const firstItem = candidates[0];
    if (targetX <= firstItem.rect.left) {
      return { node: firstItem.node, offset: firstItem.offset };
    }

    // 2. 若整行都在 targetX 左邊（行較短，正下方為空白）：取最後 1 個字元
    const lastItem = candidates[candidates.length - 1];
    if (targetX >= lastItem.rect.right) {
      return { node: lastItem.node, offset: lastItem.offset };
    }

    // 3. 若有字元水平涵蓋 targetX（包含 subpixel 浮點數微小容差）
    for (const item of candidates) {
      if (targetX >= item.rect.left - 0.5 && targetX <= item.rect.right + 0.5) {
        return { node: item.node, offset: item.offset };
      }
    }

    // 4. 否則取字元水平中心點（center）與 targetX 距離最近者
    let best = candidates[0];
    let minDiff = Infinity;
    for (const item of candidates) {
      const centerX = (item.rect.left + item.rect.right) / 2;
      const diff = Math.abs(centerX - targetX);
      if (diff < minDiff) {
        minDiff = diff;
        best = item;
      }
    }

    return { node: best.node, offset: best.offset };
  }

  /**
   * 取得指定 TextTarget 所對應字元的螢幕幾何矩形
   */
  private getCharRectOfTarget(target: TextTarget): CursorRect | null {
    try {
      const text = target.node.textContent || '';
      const len = text.length;
      if (len === 0) return null;
      const safe = Math.min(target.offset, Math.max(0, len - 1));
      const range = document.createRange();
      range.setStart(target.node, safe);
      range.setEnd(target.node, Math.min(safe + 1, len));
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left,
          y: rect.top,
          width: Math.max(rect.width, 8),
          height: Math.max(rect.height, 16)
        };
      }
    } catch {}
    return null;
  }

  /**
   * 使用原本判斷 j / k 位置的核心函式，計算兩目標點之間穿過每一視覺行的真實路徑點
   * （遇到空白行或短行時，自動吸附至該行行末）
   */
  private computeWaypointsBetween(
    startTarget: TextTarget,
    endTarget: TextTarget,
    targetX: number
  ): CursorRect[] {
    const waypoints: CursorRect[] = [];
    try {
      const startRect = this.getCharRectOfTarget(startTarget);
      const endRect = this.getCharRectOfTarget(endTarget);
      if (!startRect || !endRect) return waypoints;

      const dy = endRect.y - startRect.y;
      const charHeight = startRect.height > 0 ? startRect.height : 22;
      const lineThreshold = charHeight * 0.65;
      if (Math.abs(dy) < lineThreshold * 1.5) {
        return waypoints;
      }

      const isDownward = dy > 0;
      let current = startTarget;
      let lastTop = startRect.y;
      const maxSteps = 16;
      let step = 0;

      while (step < maxSteps) {
        step++;
        const nextTarget = isDownward
          ? this.searchDownwardNextLine(current.node, current.offset, lastTop, lineThreshold, charHeight, targetX)
          : this.searchUpwardPrevLine(current.node, current.offset, lastTop, lineThreshold, charHeight, targetX);

        if (!nextTarget) break;

        const nextRect = this.getCharRectOfTarget(nextTarget);
        if (!nextRect) break;

        // 若已經越過或抵達 endTarget 所在的視覺行高度，停止收集
        if (isDownward && nextRect.y >= endRect.y - lineThreshold * 0.5) break;
        if (!isDownward && nextRect.y <= endRect.y + lineThreshold * 0.5) break;

        waypoints.push(nextRect);
        current = nextTarget;
        lastTop = nextRect.y;
      }
    } catch (err) {
      console.warn('[Muzen Cursor] computeWaypointsBetween error:', err);
    }
    return waypoints;
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
      const nextNode = this.findNextTextNode(node);
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
  private moveWordBackward(): void {
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
      const prevNode = this.findPrevTextNode(node);
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
  private moveWordEnd(): void {
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
      const nextNode = this.findNextTextNode(node);
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
  private jumpToLineBoundary(isStart: boolean): void {
    this.preferredX = null;
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = this.currentTarget;
    const text = node.textContent || '';
    const targetOffset = isStart
      ? WordNavigator.getLineStartOffset(text, offset)
      : WordNavigator.getLineEndOffset(text, offset);

    this.currentTarget.offset = targetOffset;
    this.updateCursorPosition(true);
  }

  /**
   * 跳至文章頂部 (gg)
   */
  public jumpToDocumentStart(): void {
    const walker = document.createTreeWalker(this.rootElement, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      if (n.textContent && n.textContent.trim().length > 0) {
        this.currentTarget = { node: n as Text, offset: 0 };
        this.updateCursorPosition();
        if (this.options?.enableScroll !== false) {
          const scrollParent = this.getScrollParent(this.currentTarget.node);
          const duration = cursorStore.getState().advanced?.scrollDurationMs ?? 380;
          if (scrollParent) {
            animateScrollTo(scrollParent, 0, duration);
          } else if (!this.options?.containerRoot) {
            animateScrollTo(window, 0, duration);
          }
        }
        return;
      }
      n = walker.nextNode();
    }
  }

  /**
   * 跳至文章底部 (G)
   */
  public jumpToDocumentEnd(): void {
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
        const scrollParent = this.getScrollParent(this.currentTarget.node);
        const duration = cursorStore.getState().advanced?.scrollDurationMs ?? 380;
        if (scrollParent) {
          const maxScroll = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
          animateScrollTo(scrollParent, maxScroll, duration);
        } else if (!this.options?.containerRoot) {
          const maxScroll = Math.max(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight);
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
        this.visualAnchor = { ...this.currentTarget };
        cursorStore.setState({ mode: 'VISUAL' });
        this.syncNativeSelection();
      }
    } else {
      this.exitVisualMode();
    }
  }

  public exitVisualMode(): void {
    this.visualAnchor = null;
    cursorStore.setState({ mode: 'NORMAL' });
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
    }
  }

  /**
   * 同步原生選取區 (Visual Selection)
   */
  private syncNativeSelection(): void {
    if (!this.visualAnchor || !this.currentTarget) return;

    const sel = window.getSelection();
    if (!sel) return;

    try {
      if (typeof sel.setBaseAndExtent === 'function') {
        sel.setBaseAndExtent(
          this.visualAnchor.node,
          this.visualAnchor.offset,
          this.currentTarget.node,
          this.currentTarget.offset
        );
      } else {
        const range = document.createRange();
        range.setStart(this.visualAnchor.node, this.visualAnchor.offset);
        range.setEnd(this.currentTarget.node, this.currentTarget.offset);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch {
      // 跨節點順序若相反時反向設置
      try {
        const range = document.createRange();
        range.setStart(this.currentTarget.node, this.currentTarget.offset);
        range.setEnd(this.visualAnchor.node, this.visualAnchor.offset);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (err) {
        console.warn('[Muzen Cursor] Selection sync error:', err);
      }
    }
  }

  /**
   * Yank (複製) 當前選取內容
   */
  public async yankSelection(): Promise<void> {
    const sel = window.getSelection();
    const text = sel ? sel.toString() : '';

    if (text.length > 0) {
      try {
        await navigator.clipboard.writeText(text);
        console.log(`[Muzen Cursor] 已複製 ${text.length} 個字元至剪貼簿`);
      } catch (err) {
        console.warn('[Muzen Cursor] 剪貼簿寫入失敗:', err);
      }
    }

    this.exitVisualMode();
  }

  public findInitialTarget(): void {
    if (this.options?.containerRoot) {
      const firstText = this.findFirstTextNodeIn(this.options.containerRoot);
      if (firstText) {
        this.currentTarget = { node: firstText, offset: 0 };
        this.updateCursorPosition();
        return;
      }
    }

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 3;

    let range: Range | null = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(cx, cy);
    }

    if (range) {
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        this.currentTarget = {
          node: range.startContainer as Text,
          offset: range.startOffset
        };
        this.updateCursorPosition();
        return;
      } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
        const textNode = this.findFirstTextNodeIn(range.startContainer);
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

      // 計算全頁面閱讀進度
      const scrollY = window.scrollY || window.pageYOffset;
      const totalHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ) - window.innerHeight;
      const progress = totalHeight > 0 ? Math.min(100, Math.max(0, (scrollY / totalHeight) * 100)) : 100;

      // 容許適度邊界緩衝，避免邊界滾動時游標閃現閃退；若座標暫未就緒，安全維持當前可見狀態
      const hasValidCoords = typeof rect.top === 'number' && typeof rect.bottom === 'number' && !isNaN(rect.top) && !isNaN(rect.bottom);
      const isVisibleInViewport = hasValidCoords
        ? (rect.bottom >= -80 && rect.top <= window.innerHeight + 80)
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

      // 若未直接傳入 waypoints，但與前次目標跨越視覺行，自動呼叫正版 j / k 演算法補齊中間經過行
      let finalWaypoints = waypoints;
      if (!finalWaypoints && this.previousTarget && this.currentTarget) {
        finalWaypoints = this.computeWaypointsBetween(
          this.previousTarget,
          this.currentTarget,
          this.preferredX ?? rect.left
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
        this.syncNativeSelection();
      }

      // 只有在鍵盤主動導航且明確要求跟隨時才執行自動捲動 (移植自 mugen-yomu 舒適黃金視野區間演算法)
      if (scrollIntoView) {
        const scrollParent = this.getScrollParent(node);
        const viewHeight = scrollParent ? scrollParent.clientHeight : window.innerHeight;
        const parentTop = scrollParent ? scrollParent.getBoundingClientRect().top : 0;
        const curTop = rect.top - parentTop;
        const curBottom = rect.bottom - parentTop;
        const currentScroll = scrollParent
          ? scrollParent.scrollTop
          : (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);

        const adv = cursorStore.getState().advanced;
        // 若為獨立子容器，安全邊距適應容器尺度
        const maxPad = scrollParent ? Math.floor(viewHeight * 0.35) : Infinity;
        const padBottom = Math.min(maxPad, adv?.viewportPaddingBottom ?? 160);
        const padTop = Math.min(maxPad, adv?.viewportPaddingTop ?? 120);
        const scrollDuration = adv?.scrollDurationMs ?? 320;

        const scrollTarget = scrollParent || (this.options?.containerRoot ? null : window);
        if (scrollTarget) {
          // 向下閱讀超過底部邊界視野時
          if (curBottom > viewHeight - padBottom) {
            const targetScroll = currentScroll + (curBottom - (viewHeight - padBottom)) + 12;
            animateScrollTo(scrollTarget, targetScroll, scrollDuration);
          } else if (curTop < padTop) {
            // 向上閱讀低於頂部邊界視野時
            const targetScroll = Math.max(0, currentScroll - (padTop - curTop) - 12);
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
  private moveHalfPage(isDownward: boolean): void {
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

    // 2. 計算目標跳轉高度 (保證為視窗或滾動容器的 50%)
    const scrollParent = this.getScrollParent(node);
    const viewportHeight = scrollParent ? scrollParent.clientHeight : window.innerHeight;
    const jumpDistance = Math.max(viewportHeight * 0.5, charHeight * 3);
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
        ? this.searchDownwardNextLine(lastFound.node, lastFound.offset, curRect.top, lineThreshold, charHeight, targetX)
        : this.searchUpwardPrevLine(lastFound.node, lastFound.offset, curRect.top, lineThreshold, charHeight, targetX);

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
    const currentScrollTop = scrollParent
      ? scrollParent.scrollTop
      : (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);
    const targetScrollTop = currentScrollTop + scrollAmount;

    const scrollTarget = scrollParent || (this.options?.containerRoot ? null : window);
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

  /**
   * 偵測當前文字節點最近的可滾動容器（相容獨立閱讀窗格與 PDF 檢視器）
   */
  private getScrollParent(node: Node | null): HTMLElement | null {
    let el = node instanceof HTMLElement ? node : node?.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      try {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 10) {
          return el;
        }
      } catch {
        // 忽略跨域樣式讀取異常
      }
      el = el.parentElement;
    }

    // 若指定了 containerRoot，向上查找滾動容器
    if (this.options?.containerRoot) {
      let p: HTMLElement | null = this.options.containerRoot;
      while (p && p !== document.body && p !== document.documentElement) {
        try {
          const style = window.getComputedStyle(p);
          const overflowY = style.overflowY;
          if (overflowY === 'auto' || overflowY === 'scroll') {
            return p;
          }
        } catch {}
        p = p.parentElement;
      }
    }

    return null;
  }

  private findNextTextNode(current: Text): Text | null {
    const walker = document.createTreeWalker(this.rootElement, NodeFilter.SHOW_TEXT);
    walker.currentNode = current;
    let next = walker.nextNode();
    while (next) {
      if (this.isValidReadableTextNode(next as Text)) {
        return next as Text;
      }
      next = walker.nextNode();
    }
    return null;
  }

  private findPrevTextNode(current: Text): Text | null {
    const walker = document.createTreeWalker(this.rootElement, NodeFilter.SHOW_TEXT);
    walker.currentNode = current;
    let prev = walker.previousNode();
    while (prev) {
      if (this.isValidReadableTextNode(prev as Text)) {
        return prev as Text;
      }
      prev = walker.previousNode();
    }
    return null;
  }

  /**
   * 判定文字節點是否為實質可見/可閱讀文字（相容 pre/code 保留空白與換行）
   */
  private isValidReadableTextNode(node: Text): boolean {
    const content = node.textContent;
    if (!content || content.length === 0) return false;
    const parent = node.parentElement;
    if (!parent) return false;

    const tag = parent.tagName ? parent.tagName.toUpperCase() : '';
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || parent.closest('#muzen-cursor-host-root')) {
      return false;
    }

    // 若包含非空白字元，一定有效
    if (content.trim().length > 0) return true;

    // 若純空白（如 \n、空格、Tab），檢查父容器是否宣告保留空白 (pre, pre-wrap, pre-line)
    try {
      const style = window.getComputedStyle(parent);
      if (style.whiteSpace.startsWith('pre')) {
        return true;
      }
    } catch {
      // 容錯返回
    }

    return false;
  }
}
