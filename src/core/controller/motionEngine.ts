import { cursorStore, CursorRect } from '../cursorStore';
import { LOCALES } from '../../i18n/locales';
import { isOutOfNormalFlowWidget } from '../../utils/domUtils';
import { WordNavigator, TextTarget } from '../wordNavigator';
import { getRawCaretFromPoint } from '../../utils/caretUtils';
import { getViewportMetrics } from '../../utils/smoothScroller';
import {
  findFirstTextNodeIn,
  findFirstReadableTextNode,
  findLastReadableTextNode,
  findNextTextNode,
  findPrevTextNode,
  getCharRectOfTarget,
  searchDownwardNextLine,
  searchUpwardPrevLine,
  findVisualLineBoundary,
  findAdjacentHorizontalChar,
  isValidReadableTextNode,
  findMediaBetweenVerticalRange,
  findNextMediaAfter
} from '../navigation/spatialNavigator';
import { CursorHostContext, NavDirection } from './types';
import { MediaController } from './mediaController';
import { scrollByDelta, scrollToPosition } from './scrollFollower';

/**
 * 統一執行單步向上/向下視覺行搜尋，並包含「非對稱邊界自然逃逸 (Conditional Flow Escape)」：
 * 1. 若在當前局部作用域已抵達邊界 (找不到下一行或上一行)，且當前並非全域根節點
 * 2. 核心守護門檻：只有當前作用域屬於「正文常態流內容器 (In-Flow Container)」時才允許向外逃逸至主閱讀流；
 *    若屬於「脫離常態流之側欄/浮動掛件 (Out-of-Flow Widget)」，則嚴格封印不逃逸，100% 杜絕側欄無限延展與隨意外溢
 */
function searchLineWithFlowEscape(
  node: Text,
  offset: number,
  currentCharTop: number,
  lineThreshold: number,
  charHeight: number,
  targetX: number,
  effRoot: HTMLElement,
  rootElement: HTMLElement,
  isDownward: boolean
): TextTarget | null {
  const searchFn = isDownward ? searchDownwardNextLine : searchUpwardPrevLine;
  let found = searchFn(node, offset, currentCharTop, lineThreshold, charHeight, targetX, effRoot);

  if (!found && effRoot !== rootElement) {
    const isSidebarOrWidget = isOutOfNormalFlowWidget(effRoot, rootElement);
    if (!isSidebarOrWidget) {
      found = searchFn(node, offset, currentCharTop, lineThreshold, charHeight, targetX, rootElement);
    }
  }
  return found;
}

/**
 * 核心空間移動與目標探測引擎 (h/j/k/l, w/b/e, 0/$, gg/G, u/d, 初始定位)
 */
export class MotionEngine {
  private lastBoundaryNoticeTime = 0;

  constructor(
    private readonly host: CursorHostContext,
    private readonly mediaController: MediaController
  ) {}

  /**
   * 邊界防護與提示：若往下移動且當前位置已無法再下移，觸發狀態列 Toast 提示
   */
  private notifyBottomBoundaryIfNeeded(effRoot: HTMLElement): void {
    const now = Date.now();
    if (now - this.lastBoundaryNoticeTime <= 1500) return;

    this.lastBoundaryNoticeTime = now;
    const state = cursorStore.getState();
    const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];
    const rootElement = this.host.getRootElement();
    const isSidebarOrWidget = effRoot !== rootElement && isOutOfNormalFlowWidget(effRoot, rootElement);
    const notice = isSidebarOrWidget ? dict.noticeWidgetBottom : dict.noticePageBottom;
    cursorStore.showStatusNotice(notice, 1500);
  }

  /**
   * 水平移動 (h / l)
   */
  public moveHorizontal(delta: number): void {
    this.host.clearPreferredX();
    this.mediaController.clear();
    const current = this.host.getCurrentTarget();
    if (!current || !current.node.isConnected) {
      this.findInitialTarget();
      const recovered = this.host.getCurrentTarget();
      if (!recovered || !recovered.node.isConnected) return;
    }

    const steps = Math.abs(Math.trunc(delta));
    if (steps === 0) return;

    const direction: 1 | -1 = delta > 0 ? 1 : -1;
    const allowWrapLine = cursorStore.getState().keybindings?.horizontalWrap === true;
    const storedRect = cursorStore.getState().rect;
    const initialFallbackRect = storedRect && storedRect.height > 0
      ? { y: storedRect.y, height: storedRect.height }
      : null;

    const rootElement = this.host.getRootElement();
    let moved = false;

    for (let i = 0; i < steps; i++) {
      const target = this.host.getCurrentTarget();
      if (!target) break;

      const effectiveRoot = this.host.getEffectiveRoot();
      const searchRoot = effectiveRoot.contains(target.node)
        ? effectiveRoot
        : rootElement;
      const nextTarget = findAdjacentHorizontalChar(
        target,
        direction,
        searchRoot,
        allowWrapLine,
        i === 0 ? initialFallbackRect : null
      );
      if (!nextTarget) break;

      this.host.setCurrentTarget(nextTarget);
      this.host.updateActiveScope(nextTarget.node);
      moved = true;
    }

    if (moved) {
      this.host.updateCursorPosition(true);
    }
  }

  /**
   * 垂直移動 (j / k) - 穿透同行 <a>, <span>, <code> 標籤，精準鎖定下一視覺行
   */
  public moveVertical(deltaRows: number, isRepeat: boolean = false): void {
    const isDownward = deltaRows > 0;
    const direction: NavDirection = isDownward ? 'down' : 'up';

    // 若當前游標停駐於圖片/媒體元素上
    if (this.mediaController.handleVerticalMove(direction, isRepeat)) {
      return;
    }

    const current = this.host.getCurrentTarget();
    if (!current || !current.node.isConnected) {
      this.findInitialTarget(direction);
      const recovered = this.host.getCurrentTarget();
      if (!recovered || !recovered.node.isConnected) return;
    }

    const steps = Math.abs(deltaRows);
    const waypoints: CursorRect[] = [];
    const rootElement = this.host.getRootElement();

    for (let step = 0; step < steps; step++) {
      const target = this.host.getCurrentTarget();
      if (!target) break;

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
      if (this.host.getPreferredX() === null) {
        this.host.setPreferredX(
          charRect ? charRect.x : (baseRect.width > 0 ? baseRect.left : (storedRect?.x ?? 0))
        );
      }
      const targetX = this.host.getPreferredX()!;
      const effRoot = this.host.getEffectiveRoot();

      const foundTarget = searchLineWithFlowEscape(
        node,
        offset,
        currentCharTop,
        lineThreshold,
        charHeight,
        targetX,
        effRoot,
        rootElement,
        isDownward
      );

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
            this.mediaController.enter(mediaBetween, direction, isRepeat, foundTarget);
            return;
          }
        }

        this.host.setCurrentTarget(foundTarget);
        this.host.updateActiveScope(foundTarget.node);

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
            this.mediaController.enter(trailingMedia, direction, isRepeat, null);
            return;
          }
        }

        if (isDownward && step === 0) {
          this.notifyBottomBoundaryIfNeeded(effRoot);
        }
        break;
      }
    }

    this.host.updateCursorPosition(true, waypoints, false, true, direction, isRepeat);
  }

  /**
   * 跳至下一個詞彙 (w)
   */
  public moveWordForward(): void {
    this.host.clearPreferredX();
    const target = this.host.getCurrentTarget();
    if (!target) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = target;
    const text = node.textContent || '';
    const nextOffset = WordNavigator.getNextWordOffset(text, offset);

    if (nextOffset < text.length) {
      target.offset = nextOffset;
      this.host.updateCursorPosition(true);
    } else {
      // 跨節點尋找下一個詞首
      const effectiveRoot = this.host.getEffectiveRoot();
      const isOutOfFlow = isOutOfNormalFlowWidget(node, effectiveRoot);
      const nextNode = findNextTextNode(node, effectiveRoot, isOutOfFlow);
      if (nextNode) {
        const nextText = nextNode.textContent || '';
        const initialOffset = WordNavigator.getNextWordOffset(nextText, -1);
        this.host.setCurrentTarget({
          node: nextNode,
          offset: initialOffset < nextText.length ? initialOffset : 0
        });
        this.host.updateActiveScope(nextNode);
        this.host.updateCursorPosition(true);
      }
    }
  }

  /**
   * 前退至上一個詞彙 (b)
   */
  public moveWordBackward(): void {
    this.host.clearPreferredX();
    const target = this.host.getCurrentTarget();
    if (!target) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = target;
    const text = node.textContent || '';
    const prevOffset = WordNavigator.getPrevWordOffset(text, offset);

    if (prevOffset < offset) {
      target.offset = prevOffset;
      this.host.updateCursorPosition(true);
    } else {
      // 跨至前一個文字節點
      const effectiveRoot = this.host.getEffectiveRoot();
      const isOutOfFlow = isOutOfNormalFlowWidget(node, effectiveRoot);
      const prevNode = findPrevTextNode(node, effectiveRoot, isOutOfFlow);
      if (prevNode) {
        const prevText = prevNode.textContent || '';
        const lastWord = WordNavigator.getPrevWordOffset(prevText, prevText.length);
        this.host.setCurrentTarget({
          node: prevNode,
          offset: lastWord
        });
        this.host.updateActiveScope(prevNode);
        this.host.updateCursorPosition(true);
      }
    }
  }

  /**
   * 跳至目前詞彙尾端 (e)
   */
  public moveWordEnd(): void {
    this.host.clearPreferredX();
    const target = this.host.getCurrentTarget();
    if (!target) {
      this.findInitialTarget();
      return;
    }

    const { node, offset } = target;
    const text = node.textContent || '';
    const endOffset = WordNavigator.getWordEndOffset(text, offset);

    if (endOffset < text.length) {
      target.offset = endOffset;
      this.host.updateCursorPosition(true);
    } else {
      const effectiveRoot = this.host.getEffectiveRoot();
      const isOutOfFlow = isOutOfNormalFlowWidget(node, effectiveRoot);
      const nextNode = findNextTextNode(node, effectiveRoot, isOutOfFlow);
      if (nextNode) {
        const nextText = nextNode.textContent || '';
        const nextEnd = WordNavigator.getWordEndOffset(nextText, 0);
        this.host.setCurrentTarget({
          node: nextNode,
          offset: nextEnd
        });
        this.host.updateActiveScope(nextNode);
        this.host.updateCursorPosition(true);
      }
    }
  }

  /**
   * 跳至行首 (0) 或行尾 ($)
   */
  public jumpToLineBoundary(isStart: boolean): void {
    this.host.clearPreferredX();
    const target = this.host.getCurrentTarget();
    if (!target) {
      this.findInitialTarget();
      return;
    }

    // 透過 CSSOM 精確計算真實視覺行邊界 (穿透 <b>, <span> 等行內標籤並相容折行)
    const boundary = findVisualLineBoundary(target, isStart, this.host.getEffectiveRoot());
    this.host.setCurrentTarget(boundary);
    this.host.updateCursorPosition(true);
  }

  /**
   * 跳至文章頂部 (gg) - 排除頂部 fixed/sticky 導覽列與螢幕閱讀器隱藏元素，精準鎖定常態閱讀流首字元
   */
  public jumpToDocumentStart(): void {
    this.mediaController.clear();
    this.host.triggerRearviewNotice('up');
    this.host.pushJumpPoint();

    // 判斷作用域：若當前處於脫離常態流之側欄/浮動掛件，限定於該掛件內部，避免向外逃逸
    const rootElement = this.host.getRootElement();
    const effRoot = this.host.getEffectiveRoot();
    const isWidget = effRoot !== rootElement && isOutOfNormalFlowWidget(effRoot, rootElement);
    const targetRoot = isWidget ? effRoot : rootElement;

    // 優先使用感知主閱讀流之 TreeWalker 過濾頂部固定列與隱藏節點
    const firstText = findFirstReadableTextNode(targetRoot, isWidget) || findFirstTextNodeIn(targetRoot);
    if (firstText) {
      this.host.setCurrentTarget({ node: firstText, offset: 0 });
      this.host.updateActiveScope(firstText);
      this.host.updateCursorPosition();
      const options = this.host.getOptions();
      if (options?.enableScroll !== false) {
        const duration = cursorStore.getState().advanced?.scrollDurationMs ?? 380;
        scrollToPosition(firstText, options?.containerRoot, 0, duration);
      }
    }
  }

  /**
   * 跳至文章底部 (G) - 排除底部浮動客服、Cookie 同意橫幅與不可見元素，精準鎖定常態閱讀流尾字元
   */
  public jumpToDocumentEnd(): void {
    this.mediaController.clear();
    this.host.triggerRearviewNotice('down');
    this.host.pushJumpPoint();

    // 判斷作用域：若當前處於脫離常態流之側欄/浮動掛件，限定於該掛件內部，避免向外逃逸
    const rootElement = this.host.getRootElement();
    const effRoot = this.host.getEffectiveRoot();
    const isWidget = effRoot !== rootElement && isOutOfNormalFlowWidget(effRoot, rootElement);
    const targetRoot = isWidget ? effRoot : rootElement;

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
      this.host.setCurrentTarget({
        node: lastTextNode,
        offset: lastTextNode.textContent?.length || 0
      });
      this.host.updateActiveScope(lastTextNode);
      this.host.updateCursorPosition();
      const options = this.host.getOptions();
      if (options?.enableScroll !== false) {
        const duration = cursorStore.getState().advanced?.scrollDurationMs ?? 380;
        scrollToPosition(lastTextNode, options?.containerRoot, 'bottom', duration);
      }
    }
  }

  /**
   * 半頁跳轉 (d 向下 / u 向上) - 保證實體翻動 50% 視窗高度並精準重錨定目標行
   */
  public moveHalfPage(isDownward: boolean, isRepeat: boolean = false): void {
    const direction: NavDirection = isDownward ? 'down' : 'up';
    if (this.mediaController.handleHalfPageMove(direction, isRepeat)) {
      return;
    }

    const currentTarget = this.host.getCurrentTarget();
    if (!currentTarget) {
      this.findInitialTarget();
      return;
    }

    // 0. 記錄原地出發點之文字上下文，觸發翻頁回溯後照鏡 HUD (長按連發時跳過以維持畫面俐落)
    if (!isRepeat) {
      this.host.triggerRearviewNotice(direction);
    }

    const { node, offset } = currentTarget;
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

    if (this.host.getPreferredX() === null) {
      this.host.setPreferredX(baseRect.left);
    }
    const targetX = this.host.getPreferredX()!;

    // 2. 計算目標跳轉高度 (保證為視窗或滾動容器的 50%，自適應 visualViewport 縮放)
    const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(
      node,
      this.host.getOptions()?.containerRoot
    );
    const jumpDistance = Math.max(viewHeight * 0.5, charHeight * 3);
    const scrollAmount = Math.round(jumpDistance) * (isDownward ? 1 : -1);

    let foundTarget: TextTarget | null = null;
    let finalTargetRect: DOMRect | null = null;
    let accumulatedDistance = 0;
    let lastFound = currentTarget;
    let steps = 0;
    const maxSteps = 80;

    const tempWaypoints: CursorRect[] = [];
    const effRoot = this.host.getEffectiveRoot();
    const rootElement = this.host.getRootElement();

    // 3. 連續向下或向上推進視覺行，尋找垂直位移達約半頁之最佳目標行
    while (accumulatedDistance < jumpDistance && steps < maxSteps) {
      steps++;
      const curLen = lastFound.node.textContent?.length || 0;
      const curSafe = Math.min(lastFound.offset, Math.max(0, curLen - 1));
      const r = document.createRange();
      r.setStart(lastFound.node, curSafe);
      r.setEnd(lastFound.node, Math.min(curSafe + 1, curLen));
      const curRect = r.getBoundingClientRect();

      const nextTarget = searchLineWithFlowEscape(
        lastFound.node,
        lastFound.offset,
        curRect.top,
        lineThreshold,
        charHeight,
        targetX,
        effRoot,
        rootElement,
        isDownward
      );

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
        this.notifyBottomBoundaryIfNeeded(effRoot);
      }
      return;
    }

    this.host.setCurrentTarget(foundTarget);
    this.host.updateActiveScope(foundTarget.node);

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
      scrollByDelta(scrollTarget, currentScroll, effectiveDelta, { isRepeat, durationMs: 380 });
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
    this.host.updateCursorPosition(false, waypoints, false, true, direction, isRepeat);
  }

  /**
   * 重新綁定游標至指定容器或重新探測有效文字節點（適用於 SPA 路由切換、動態 DOM 替換或 PDF 縮放重繪）
   */
  public rebindToContainer(container?: HTMLElement | null): boolean {
    const root = container || this.host.getOptions()?.containerRoot || this.host.getEffectiveRoot();
    const firstText = findFirstTextNodeIn(root);
    if (firstText) {
      this.host.setCurrentTarget({ node: firstText, offset: 0 });
      this.host.updateActiveScope(firstText);
      this.host.updateCursorPosition();
      return true;
    }
    this.findInitialTarget();
    return false;
  }

  /**
   * 探測並定位初始游標位置（支援方向感知與元素級 Caret 解析）
   */
  public findInitialTarget(direction?: NavDirection): void {
    const containerRoot = this.host.getOptions()?.containerRoot;
    if (containerRoot) {
      const firstText = findFirstTextNodeIn(containerRoot);
      if (firstText) {
        this.host.setCurrentTarget({ node: firstText, offset: 0 });
        this.host.updateCursorPosition();
        return;
      }
    }

    const rootElement = this.host.getRootElement();
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

      if (targetNode && isValidReadableTextNode(targetNode) && !isOutOfNormalFlowWidget(targetNode, rootElement)) {
        return { node: targetNode, offset: targetOffset };
      }
      return null;
    };

    // 0. 原地重錨定防禦 (Local Anchor Recovery)：若最後游標位於目前可見視野中，優先原地就地重錨
    const prevRect = cursorStore.getState().rect;
    if (prevRect && prevRect.x > 0 && prevRect.y >= 0 && prevRect.y <= window.innerHeight) {
      const localTarget = extractTextTarget(getRawCaretFromPoint(prevRect.x, prevRect.y));
      if (localTarget) {
        this.host.setCurrentTarget(localTarget);
        this.host.updateActiveScope(localTarget.node);
        this.host.updateCursorPosition();
        return;
      }
    }

    const cx = window.innerWidth / 2;
    const viewH = window.innerHeight;
    const cyRatio = direction === 'down' ? 0.45 : (direction === 'up' ? 0.55 : 0.5);
    const cy = Math.round(viewH * cyRatio);

    // 1. 視窗中央 Caret 解析
    const centerTarget = extractTextTarget(getRawCaretFromPoint(cx, cy));
    if (centerTarget) {
      this.host.setCurrentTarget(centerTarget);
      this.host.updateActiveScope(centerTarget.node);
      this.host.updateCursorPosition();
      return;
    }

    // 2. 視窗中央元素文字探測
    const centerElements = document.elementsFromPoint ? document.elementsFromPoint(cx, cy) : [];
    for (const el of centerElements) {
      if (el.id === 'muzen-cursor-host-root' || isOutOfNormalFlowWidget(el, rootElement)) continue;
      const elRect = el.getBoundingClientRect();
      if (elRect.height >= viewH * 0.95) continue; // 排除 body, html 等全頁大容器

      const firstText = findFirstTextNodeIn(el);
      if (firstText && isValidReadableTextNode(firstText)) {
        this.host.setCurrentTarget({ node: firstText, offset: 0 });
        this.host.updateActiveScope(firstText);
        this.host.updateCursorPosition();
        return;
      }
    }

    // 3. 通用兜底：自有效閱讀容器中尋找第一個可讀文字節點
    const fallbackText = findFirstTextNodeIn(this.host.getEffectiveRoot());
    if (fallbackText && isValidReadableTextNode(fallbackText)) {
      this.host.setCurrentTarget({ node: fallbackText, offset: 0 });
      this.host.updateActiveScope(fallbackText);
      this.host.updateCursorPosition();
    }
  }
}
