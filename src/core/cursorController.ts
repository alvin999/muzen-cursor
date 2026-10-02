import { cursorStore, MotionDirection } from './cursorStore';
import { isTypingContext } from '../utils/domUtils';
import { WordNavigator, TextTarget } from './wordNavigator';

let activeScrollRafId: number | null = null;

/**
 * 具有物理阻尼感之 Ease-Out Cubic 平滑捲動引擎 (移植自 mugen-yomu 核心演算法)
 */
function animateScrollTo(
  target: HTMLElement | Window,
  targetTop: number,
  duration = 380
): void {
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
    const progress = Math.min(1, elapsed / duration);
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

/**
 * Vim 核心游標控制器 (純邏輯運算，解除業務綁定)
 */
export class CursorController {
  private currentTarget: TextTarget | null = null;
  private visualAnchor: TextTarget | null = null;
  private preferredX: number | null = null;
  private lastKeyTime = 0;
  private lastKey = '';
  private moveTimer: any = null;

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private scrollHandler: (() => void) | null = null;

  public init(): void {
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.clickHandler = (e: MouseEvent) => this.handleClick(e);

    // 視窗縮放與滾動時保持游標位置緊密貼合
    let ticking = false;
    const requestUpdate = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (this.currentTarget && cursorStore.getState().enabled && !cursorStore.getState().isExcluded) {
            this.updateCursorPosition();
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
    if (isTypingContext(e) || cursorStore.getState().isExcluded) {
      return;
    }

    const clickX = e.clientX;
    const clickY = e.clientY;

    const rawTarget = e.composedPath ? e.composedPath()[0] : e.target;
    const targetEl = (rawTarget instanceof Element ? rawTarget : (rawTarget as Node)?.parentElement) as HTMLElement | null;

    if (!targetEl || targetEl.closest('#muzen-cursor-host-root')) {
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

    // 2. 後備方案：僅在點擊具體文字標籤（非全域容器）時才尋找其內部文字
    if (!targetNode && !isGlobalContainer) {
      const textTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'SPAN', 'A', 'STRONG', 'EM', 'BLOCKQUOTE', 'TD', 'TH', 'CODE', 'PRE'];
      if (textTags.includes(targetEl.tagName)) {
        targetNode = this.findFirstTextNodeIn(targetEl);
        targetOffset = 0;
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
    // 1. 若處於輸入模式（輸入框、編輯器）或當前網站已被排除，完全不攔截
    if (isTypingContext(e) || cursorStore.getState().isExcluded) return;

    // 2. Alt + V: 切換啟用狀態
    if (e.altKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      const current = cursorStore.getState().enabled;
      cursorStore.setState({ enabled: !current });
      return;
    }

    const state = cursorStore.getState();
    if (!state.enabled) return;

    const now = Date.now();
    const prevKey = this.lastKey;
    const isDoubleG = prevKey === 'g' && e.key === 'g' && now - this.lastKeyTime < 500;
    this.lastKey = e.key;
    this.lastKeyTime = now;

    // 3. 處理連續指令 gg (跳至全文頂部)
    if (isDoubleG) {
      e.preventDefault();
      this.jumpToDocumentStart();
      return;
    }

    // 4. Vim 快捷指令處理
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        if (state.mode === 'VISUAL') {
          this.exitVisualMode();
        } else {
          cursorStore.setState({ visible: false });
        }
        break;

      case 'v':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.toggleVisualMode();
        }
        break;

      case 'y': // Yank (複製)
        if (!e.ctrlKey && !e.metaKey && state.mode === 'VISUAL') {
          e.preventDefault();
          this.yankSelection();
        }
        break;

      case 'l': // 單字元右移
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.moveHorizontal(1);
        }
        break;

      case 'h': // 單字元左移
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.moveHorizontal(-1);
        }
        break;

      case 'j': // 下移一行
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.moveVertical(1);
        }
        break;

      case 'k': // 上移一行
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.moveVertical(-1);
        }
        break;

      case 'w': // 單字/詞彙跳躍 (Word forward)
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.moveWordForward();
        }
        break;

      case 'b': // 單字/詞彙前退 (Word backward)
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.moveWordBackward();
        }
        break;

      case 'e': // 跳至字尾 (Word end)
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.moveWordEnd();
        }
        break;

      case '0':
      case '^': // 跳至行首
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.jumpToLineBoundary(true);
        }
        break;

      case '$': // 跳至行尾
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.jumpToLineBoundary(false);
        }
        break;

      case 'd': // 單鍵向下半頁 (Half-page down)
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          this.moveHalfPage(true);
        }
        break;

      case 'u': // 單鍵向上半頁 (Half-page up)
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          this.moveHalfPage(false);
        }
        break;

      case 'G': // Shift + G (跳至全文底部)
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.jumpToDocumentEnd();
        }
        break;

      default:
        break;
    }
  }

  /**
   * 水平移動 (h / l)
   */
  private moveHorizontal(delta: number): void {
    this.preferredX = null;
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = this.currentTarget;
    const textLength = node.textContent?.length || 0;
    const nextOffset = offset + delta;

    if (nextOffset >= 0 && nextOffset <= textLength) {
      this.currentTarget.offset = nextOffset;
      this.updateCursorPosition(true);
    } else if (nextOffset > textLength) {
      const nextNode = this.findNextTextNode(node);
      if (nextNode) {
        this.currentTarget = { node: nextNode, offset: 0 };
        this.updateCursorPosition(true);
      }
    } else if (nextOffset < 0) {
      const prevNode = this.findPrevTextNode(node);
      if (prevNode) {
        this.currentTarget = {
          node: prevNode,
          offset: prevNode.textContent?.length || 0
        };
        this.updateCursorPosition(true);
      }
    }
  }

  /**
   * 垂直移動 (j / k) - 穿透同行 <a>, <span>, <code> 標籤，精準鎖定下一視覺行
   */
  private moveVertical(deltaRows: number): void {
    if (!this.currentTarget) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = this.currentTarget;
    const len = node.textContent?.length || 0;
    if (len === 0) return;

    // 1. 取得當前真實字元的螢幕基準線
    const baseRange = document.createRange();
    const safeFrom = Math.min(offset, Math.max(0, len - 1));
    baseRange.setStart(node, safeFrom);
    baseRange.setEnd(node, Math.min(safeFrom + 1, len));
    const baseRect = baseRange.getBoundingClientRect();
    const currentCharTop = baseRect.top;
    const charHeight = baseRect.height > 0 ? baseRect.height : 22;
    const lineThreshold = charHeight * 0.65;

    // 2. 鎖定或保持基準水平 X 座標 (Vim 經典行為)
    if (this.preferredX === null) {
      this.preferredX = baseRect.left;
    }
    const targetX = this.preferredX;
    const isDownward = deltaRows > 0;

    let foundTarget: { node: Text; offset: number } | null = null;

    if (isDownward) {
      foundTarget = this.searchDownwardNextLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX);
    } else {
      foundTarget = this.searchUpwardPrevLine(node, offset, currentCharTop, lineThreshold, charHeight, targetX);
    }

    if (foundTarget) {
      this.currentTarget = foundTarget;
      this.updateCursorPosition(true);
    }
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

    while (currentNode) {
      const text = currentNode.textContent || '';
      const len = text.length;

      for (let i = nodeOffsetStart; i < len; i++) {
        const char = text[i];
        if (char === '\r') continue;

        // 若已鎖定目標行且遇到 \n（如在 pre 或程式碼區塊換行），表示該行已結束
        if (targetLineTop !== null && char === '\n') {
          return this.pickBestCandidate(lineCandidates, targetX);
        }
        if (char === '\n') continue;

        range.setStart(currentNode, i);
        range.setEnd(currentNode, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        if (targetLineTop === null) {
          // 階段 1：尋找下一視覺行的第一個實體字元
          if (rect.top - currentCharTop > lineThreshold) {
            targetLineTop = rect.top;
            targetCharHeight = rect.height > 0 ? rect.height : charHeight;
            lineCandidates.push({ node: currentNode, offset: i, rect });
          }
        } else {
          // 階段 2：收集屬於該視覺行的所有字元（允許跨越 <a>, <code>, <span> 標籤）
          if (rect.top - targetLineTop > targetCharHeight * 0.6) {
            return this.pickBestCandidate(lineCandidates, targetX);
          }
          if (Math.abs(rect.top - targetLineTop) <= targetCharHeight * 0.5) {
            lineCandidates.push({ node: currentNode, offset: i, rect });
          }
        }
      }

      // 前往後續文字節點繼續收集同行跨標籤字元（穿透 <a>, <code> 等）
      currentNode = this.findNextTextNode(currentNode);
      nodeOffsetStart = 0;

      if (targetLineTop !== null && lineCandidates.length > 80) {
        break;
      }
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

    while (currentNode) {
      const text = currentNode.textContent || '';
      const startFrom = nodeOffsetStart >= 0 ? Math.min(nodeOffsetStart, text.length - 1) : -1;

      for (let i = startFrom; i >= 0; i--) {
        const char = text[i];
        if (char === '\r') continue;

        // 若已鎖定目標行且逆向遇到 \n（如在 pre 或程式碼換行），表示該行開頭已結束
        if (targetLineTop !== null && char === '\n') {
          return this.pickBestCandidate(lineCandidates, targetX);
        }
        if (char === '\n') continue;

        range.setStart(currentNode, i);
        range.setEnd(currentNode, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        if (targetLineTop === null) {
          // 階段 1：逆向尋找上一視覺行的最後一個實體字元（最右端）
          if (currentCharTop - rect.top > lineThreshold) {
            targetLineTop = rect.top;
            targetCharHeight = rect.height > 0 ? rect.height : charHeight;
            lineCandidates.unshift({ node: currentNode, offset: i, rect });
          }
        } else {
          // 階段 2：逆向收集屬於該視覺行的所有字元（保持由左至右順序）
          if (targetLineTop - rect.top > targetCharHeight * 0.6) {
            return this.pickBestCandidate(lineCandidates, targetX);
          }
          if (Math.abs(rect.top - targetLineTop) <= targetCharHeight * 0.5) {
            lineCandidates.unshift({ node: currentNode, offset: i, rect });
          }
        }
      }

      // 前往更前面的文字節點繼續收集
      currentNode = this.findPrevTextNode(currentNode);
      if (currentNode) {
        nodeOffsetStart = (currentNode.textContent?.length || 1) - 1;
      }

      if (targetLineTop !== null && lineCandidates.length > 80) {
        break;
      }
    }

    if (lineCandidates.length > 0) {
      return this.pickBestCandidate(lineCandidates, targetX);
    }

    return null;
  }

  /**
   * 在跨節點視覺行候選字元清單中，挑選與 targetX 水平最匹配的字元
   */
  private pickBestCandidate(
    candidates: { node: Text; offset: number; rect: DOMRect }[],
    targetX: number
  ): { node: Text; offset: number } | null {
    if (candidates.length === 0) return null;

    // 1. 若有字元水平涵蓋 targetX（完美命中）
    for (const item of candidates) {
      if (targetX >= item.rect.left && targetX <= item.rect.right) {
        return { node: item.node, offset: item.offset };
      }
    }

    // 2. 若整行都在 targetX 左邊（行較短，正下方為空白）：取該行最後一字
    const lastItem = candidates[candidates.length - 1];
    if (targetX > lastItem.rect.right) {
      return { node: lastItem.node, offset: lastItem.offset };
    }

    // 3. 若整行都在 targetX 右邊：取第一字
    const firstItem = candidates[0];
    if (targetX < firstItem.rect.left) {
      return { node: firstItem.node, offset: firstItem.offset };
    }

    // 4. 否則取水平距離最近之字元
    let best = candidates[0];
    let minDiff = Infinity;
    for (const item of candidates) {
      const diff = Math.abs(item.rect.left - targetX);
      if (diff < minDiff) {
        minDiff = diff;
        best = item;
      }
    }

    return { node: best.node, offset: best.offset };
  }

  /**
   * 跳至下一個詞彙 (w)
   */
  private moveWordForward(): void {
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
  private jumpToDocumentStart(): void {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      if (n.textContent && n.textContent.trim().length > 0) {
        this.currentTarget = { node: n as Text, offset: 0 };
        this.updateCursorPosition();
        animateScrollTo(window, 0, 420);
        return;
      }
      n = walker.nextNode();
    }
  }

  /**
   * 跳至文章底部 (G)
   */
  private jumpToDocumentEnd(): void {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
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
      const maxScroll = Math.max(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight);
      animateScrollTo(window, maxScroll, 420);
    }
  }

  /**
   * 切換 Visual 模式
   */
  private toggleVisualMode(): void {
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

  private exitVisualMode(): void {
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
  private async yankSelection(): Promise<void> {
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

  private findInitialTarget(): void {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 3;

    let range: Range | null = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(cx, cy);
    }

    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      this.currentTarget = {
        node: range.startContainer as Text,
        offset: range.startOffset
      };
      this.updateCursorPosition();
      return;
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      const text = n.textContent?.trim();
      if (text && text.length > 2 && n.parentElement) {
        const rect = n.parentElement.getBoundingClientRect();
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
          this.currentTarget = { node: n as Text, offset: 0 };
          this.updateCursorPosition();
          return;
        }
      }
      n = walker.nextNode();
    }
  }

  /**
   * 計算螢幕座標與微調游標
   */
  private updateCursorPosition(scrollIntoView: boolean = false): void {
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
          rect = {
            ...prevRect,
            x: prevRect.right,
            left: prevRect.right,
            width: 8,
            height: prevRect.height > 0 ? prevRect.height : fallbackH
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

      // 容許適度邊界緩衝，避免邊界滾動時游標閃現閃退
      const isVisibleInViewport = rect.bottom >= -80 && rect.top <= window.innerHeight + 80;

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

      // mugen-yomu 招牌移動避震機制：位移時保持常亮不閃爍，靜止 400ms 後平滑恢復閃爍
      if (this.moveTimer) clearTimeout(this.moveTimer);
      this.moveTimer = setTimeout(() => {
        cursorStore.setState({ isMoving: false, motionDirection: 'none' });
      }, 400);

      cursorStore.setState({
        visible: isVisibleInViewport,
        isMoving: true,
        motionDirection: motionDir,
        motionSequence: (prevState.motionSequence || 0) + 1,
        rect: {
          x: rect.left,
          y: rect.top,
          width: Math.max(rect.width, 8),
          height: Math.max(rect.height, 16)
        },
        readingProgress: progress,
        charOffset: safeOffset
      });

      // Visual 模式下即時更新原生選取
      if (cursorStore.getState().mode === 'VISUAL') {
        this.syncNativeSelection();
      }

      // 只有在鍵盤主動導航且明確要求跟隨時才執行自動捲動 (移植自 mugen-yomu 舒適黃金視野區間演算法)
      if (scrollIntoView) {
        const scrollParent = this.getScrollParent(node);
        const viewHeight = scrollParent ? scrollParent.clientHeight : window.innerHeight;
        const curTop = rect.top;
        const curBottom = rect.bottom;
        const currentScroll = scrollParent
          ? scrollParent.scrollTop
          : (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);

        // 向下閱讀超過視野 58% 時，平滑將文字推進至 45% 舒適閱讀視野
        if (curBottom > viewHeight * 0.58) {
          const targetScroll = currentScroll + curBottom - viewHeight * 0.45;
          animateScrollTo(scrollParent || window, targetScroll, 320);
        } else if (curTop < viewHeight * 0.18) {
          // 向上閱讀低於 18% 時，平滑回推至 28%
          const targetScroll = Math.max(0, currentScroll + curTop - viewHeight * 0.28);
          animateScrollTo(scrollParent || window, targetScroll, 320);
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

    // 4. 執行保證幅度的 mugen-yomu Ease-Out Cubic 物理阻尼平滑滾動
    const currentScrollTop = scrollParent
      ? scrollParent.scrollTop
      : (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);
    const targetScrollTop = currentScrollTop + scrollAmount;

    animateScrollTo(scrollParent || window, targetScrollTop, 380);

    // 5. 強制保持游標可見並同步更新位置
    cursorStore.setState({ visible: true });
    this.updateCursorPosition(false);
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
    return null;
  }

  private findNextTextNode(current: Text): Text | null {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
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
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
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
