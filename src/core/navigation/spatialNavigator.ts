import { CursorRect } from '../cursorStore';
import { logger } from '../../utils/logger';
import { TextTarget } from '../wordNavigator';
import {
  isOutOfNormalFlowWidget,
  isVisuallyHiddenElement,
  A11Y_HIDDEN_SELECTORS,
  isOffScreenOrZeroSize
} from '../../utils/domUtils';

/**
 * 判定文字節點是否為實質可見/可閱讀文字（相容 pre/code 保留空白與換行）
 */
export function isValidReadableTextNode(node: Text): boolean {
  const content = node.textContent;
  if (!content || content.length === 0) return false;
  const parent = node.parentElement;
  if (!parent) return false;

  const tag = parent.tagName ? parent.tagName.toUpperCase() : '';
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || parent.closest('#muzen-cursor-host-root')) {
    return false;
  }

  // 徹底排除視覺隱藏 / 螢幕閱讀器專用元素
  if (isVisuallyHiddenElement(parent) || parent.closest(A11Y_HIDDEN_SELECTORS)) {
    return false;
  }

  try {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (isOffScreenOrZeroSize(rect)) {
      return false;
    }
  } catch {}

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

/**
 * 尋找指定根節點下第一個有可見文字的 Text 節點
 */
export function findFirstTextNodeIn(root: Node): Text | null {
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

/**
 * 建立主閱讀流感知的 TreeWalker
 * 當 allowOutOfFlow 為 false 時，遇到 float 或 position: fixed/sticky 掛件直接 FILTER_REJECT 整棵子樹
 */
export function createFlowTreeWalker(rootElement: HTMLElement, allowOutOfFlow: boolean): TreeWalker {
  return document.createTreeWalker(
    rootElement,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node: Node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.id === 'muzen-cursor-host-root') {
            return NodeFilter.FILTER_REJECT;
          }
          const tag = el.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') {
            return NodeFilter.FILTER_REJECT;
          }
          // 不可見元素過濾：排除 hidden、display: none、visibility: hidden，整棵子樹直接 REJECT
          if (el.hidden) {
            return NodeFilter.FILTER_REJECT;
          }
          // 視覺隱藏 / 螢幕閱讀器專用無障礙元素 (如 Facebook 頂部 sr-only h1) 直接 REJECT
          if (isVisuallyHiddenElement(el)) {
            return NodeFilter.FILTER_REJECT;
          }
          try {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
            // 主閱讀流隔離：遇到浮動年表/固定側欄直接 REJECT 整棵子樹，0 微秒跳過龐大子節點群
            if (!allowOutOfFlow && isOutOfNormalFlowWidget(el, rootElement)) {
              return NodeFilter.FILTER_REJECT;
            }
          } catch {}

          return NodeFilter.FILTER_SKIP;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          if (!allowOutOfFlow && isOutOfNormalFlowWidget(node, rootElement)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (isValidReadableTextNode(node as Text)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }

        return NodeFilter.FILTER_SKIP;
      }
    }
  );
}

/**
 * 尋找當前節點之向下一個可閱讀 Text 節點
 */
export function findNextTextNode(
  current: Text,
  rootElement: HTMLElement,
  allowOutOfFlow = true
): Text | null {
  const walker = createFlowTreeWalker(rootElement, allowOutOfFlow);
  walker.currentNode = current;
  return walker.nextNode() as Text | null;
}

/**
 * 尋找當前節點之向上一個可閱讀 Text 節點
 */
export function findPrevTextNode(
  current: Text,
  rootElement: HTMLElement,
  allowOutOfFlow = true
): Text | null {
  const walker = createFlowTreeWalker(rootElement, allowOutOfFlow);
  walker.currentNode = current;
  return walker.previousNode() as Text | null;
}

/**
 * 尋找指定容器內第一個符合常態閱讀流且實質可見的文字節點（過濾頂部固定導覽列與隱藏節點）
 */
export function findFirstReadableTextNode(
  rootElement: HTMLElement,
  allowOutOfFlow = false
): Text | null {
  const walker = createFlowTreeWalker(rootElement, allowOutOfFlow);
  return walker.nextNode() as Text | null;
}

/**
 * 尋找指定容器內最後一個符合常態閱讀流且實質可見的文字節點（過濾底部浮動客服、Cookie列與不可見元素）
 */
export function findLastReadableTextNode(
  rootElement: HTMLElement,
  allowOutOfFlow = false
): Text | null {
  const walker = createFlowTreeWalker(rootElement, allowOutOfFlow);
  let lastNode: Text | null = null;
  let cur = walker.nextNode();
  while (cur) {
    lastNode = cur as Text;
    cur = walker.nextNode();
  }
  return lastNode;
}

/**
 * 取得指定 TextTarget 所對應字元的螢幕幾何矩形
 */
export function getCharRectOfTarget(target: TextTarget): CursorRect | null {
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

export interface CandidateCharacter {
  node: Text;
  offset: number;
  rect: DOMRect;
}

/**
 * 在跨節點視覺行候選字元清單中，挑選與 targetX 水平最匹配的字元
 * 確保水平對齊具備嚴格一致性與對稱性，避免連續 j / k 游標漂移
 */
export function pickBestCandidate(
  candidates: CandidateCharacter[],
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

  // 3. 若有字元水平涵蓋 targetX（左閉右開區間，嚴格避免相鄰字元邊界重疊誤選前一字元）
  for (const item of candidates) {
    if (targetX >= item.rect.left - 0.5 && targetX < item.rect.right - 0.5) {
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
 * 向下尋找下一視覺行（跨節點完整收集整條視覺行，穿透 <a>、<span>、<code> 標籤）
 */
export function searchDownwardNextLine(
  startNode: Text,
  startOffset: number,
  currentCharTop: number,
  lineThreshold: number,
  charHeight: number,
  targetX: number,
  rootElement: HTMLElement
): { node: Text; offset: number } | null {
  const range = document.createRange();
  let targetLineTop: number | null = null;
  let targetCharHeight = charHeight;
  const lineCandidates: CandidateCharacter[] = [];

  const isStartOutOfFlow = isOutOfNormalFlowWidget(startNode, rootElement);
  const walker = createFlowTreeWalker(rootElement, isStartOutOfFlow);
  walker.currentNode = startNode;

  let currentNode: Text | null = startNode;
  let nodeOffsetStart = startOffset + 1;
  let nodesScanned = 0;
  const MAX_NODES_TO_SCAN = 300;

  while (currentNode && nodesScanned < MAX_NODES_TO_SCAN) {
    nodesScanned++;

    const text = currentNode.textContent || '';
    const len = text.length;

    // 超大純文字節點加速：當尚未鎖定下一視覺行且剩餘字元較多時，先以二分搜尋跳過同一視覺行的前段字元
    let scanStart = nodeOffsetStart;
    if (targetLineTop === null && len - scanStart > 64) {
      let low = scanStart;
      let high = len - 1;
      let firstNextLineIdx = -1;
      let abortedEarly = false;

      while (low <= high) {
        const mid = (low + high) >>> 1;
        // 若剛好落在換行符號上，微調至鄰近有效字元量測
        let probe = mid;
        while (probe < high && (text[probe] === '\r' || text[probe] === '\n')) {
          probe++;
        }
        range.setStart(currentNode, probe);
        range.setEnd(currentNode, Math.min(len, probe + 1));
        const midRect = range.getBoundingClientRect();

        if (midRect.width > 0 && midRect.height > 0) {
          if (midRect.top - currentCharTop > lineThreshold) {
            firstNextLineIdx = probe;
            high = mid - 1;
          } else {
            low = probe + 1;
          }
        } else {
          abortedEarly = true;
          break;
        }
      }

      if (!abortedEarly && firstNextLineIdx > scanStart) {
        // 退回安全緩衝字元數以確保完整收集目標視覺行首字元
        scanStart = Math.max(scanStart, firstNextLineIdx - 8);
      }
    }

    for (let i = scanStart; i < len; i++) {
      const char = text[i];
      if (char === '\r' || char === '\n') continue;

      range.setStart(currentNode, i);
      range.setEnd(currentNode, i + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      if (targetLineTop === null) {
        // 階段 1：尋找下一視覺行的第一個實體字元
        const diffY = rect.top - currentCharTop;
        if (diffY > lineThreshold) {
          targetLineTop = rect.top;
          targetCharHeight = rect.height > 0 ? rect.height : charHeight;
          lineCandidates.push({ node: currentNode, offset: i, rect });
        }
      } else {
        // 階段 2：收集屬於該視覺行的所有字元（允許跨越 inline 標籤）
        const diffFromTarget = rect.top - targetLineTop;
        // 若先前提早鎖定到 DOM 錯位的浮動標籤，而後續出現更接近起點行的合法視覺行，則改鎖定較近行
        if (targetLineTop - rect.top > targetCharHeight * 0.7 && rect.top - currentCharTop > lineThreshold) {
          targetLineTop = rect.top;
          targetCharHeight = rect.height > 0 ? rect.height : charHeight;
          lineCandidates.length = 0;
          lineCandidates.push({ node: currentNode, offset: i, rect });
          continue;
        }
        // 若明顯進入再下一行（下下行），表示目標行已完整收集結束
        if (diffFromTarget > targetCharHeight * 0.7) {
          return pickBestCandidate(lineCandidates, targetX);
        }
        if (Math.abs(diffFromTarget) <= targetCharHeight * 0.7) {
          lineCandidates.push({ node: currentNode, offset: i, rect });
        }
      }
    }

    currentNode = walker.nextNode() as Text | null;
    nodeOffsetStart = 0;
  }

  if (lineCandidates.length > 0) {
    return pickBestCandidate(lineCandidates, targetX);
  }

  return null;
}

/**
 * 向上尋找上一視覺行（跨節點完整收集整條視覺行，穿透 <a>、<span>、<code> 標籤）
 */
export function searchUpwardPrevLine(
  startNode: Text,
  startOffset: number,
  currentCharTop: number,
  lineThreshold: number,
  charHeight: number,
  targetX: number,
  rootElement: HTMLElement
): { node: Text; offset: number } | null {
  const range = document.createRange();
  let targetLineTop: number | null = null;
  let targetCharHeight = charHeight;
  const lineCandidates: CandidateCharacter[] = [];

  const isStartOutOfFlow = isOutOfNormalFlowWidget(startNode, rootElement);
  const walker = createFlowTreeWalker(rootElement, isStartOutOfFlow);
  walker.currentNode = startNode;

  let currentNode: Text | null = startNode;
  let nodeOffsetStart = startOffset - 1;
  let nodesScanned = 0;
  const MAX_NODES_TO_SCAN = 300;

  while (currentNode && nodesScanned < MAX_NODES_TO_SCAN) {
    nodesScanned++;

    const text = currentNode.textContent || '';
    let startFrom = nodeOffsetStart >= 0 ? Math.min(nodeOffsetStart, text.length - 1) : -1;

    // 超大純文字節點加速：當尚未鎖定上一視覺行且前方字元較多時，先以二分搜尋跳過同一視覺行的後段字元
    if (targetLineTop === null && startFrom > 64) {
      const isInFixedHeader = !isStartOutOfFlow && !!currentNode.parentElement?.closest('[role="banner"], header');
      if (!isInFixedHeader) {
        let low = 0;
        let high = startFrom;
        let lastPrevLineIdx = -1;
        let abortedEarly = false;

        while (low <= high) {
          const mid = (low + high) >>> 1;
          let probe = mid;
          while (probe > low && (text[probe] === '\r' || text[probe] === '\n')) {
            probe--;
          }
          range.setStart(currentNode, probe);
          range.setEnd(currentNode, Math.min(text.length, probe + 1));
          const midRect = range.getBoundingClientRect();

          if (midRect.width > 0 && midRect.height > 0) {
            if (currentCharTop - midRect.top > lineThreshold) {
              lastPrevLineIdx = probe;
              low = mid + 1;
            } else {
              high = probe - 1;
            }
          } else {
            abortedEarly = true;
            break;
          }
        }

        if (!abortedEarly && lastPrevLineIdx >= 0 && lastPrevLineIdx < startFrom) {
          // 保留安全緩衝字元數以確保完整收集目標視覺行尾端字元
          startFrom = Math.min(startFrom, lastPrevLineIdx + 8);
        }
      }
    }

    for (let i = startFrom; i >= 0; i--) {
      const char = text[i];
      if (char === '\r' || char === '\n') continue;

      range.setStart(currentNode, i);
      range.setEnd(currentNode, i + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      if (targetLineTop === null) {
        const diffY = currentCharTop - rect.top;
        const isInFixedHeader = !isStartOutOfFlow && !!currentNode.parentElement?.closest('[role="banner"], header');
        if (diffY > lineThreshold && !isInFixedHeader) {
          targetLineTop = rect.top;
          targetCharHeight = rect.height > 0 ? rect.height : charHeight;
          lineCandidates.push({ node: currentNode, offset: i, rect });
        }
      } else {
        // 階段 2：逆向收集屬於該視覺行的所有字元
        const diffFromTarget = targetLineTop - rect.top;
        // 若先前提早鎖定到 DOM 錯位的絕對定位標籤（例如 code 區塊右上角的語言標籤），改鎖定更接近起點行的實際視覺行
        if (rect.top - targetLineTop > targetCharHeight * 0.7 && currentCharTop - rect.top > lineThreshold) {
          const isInFixedHeader = !isStartOutOfFlow && !!currentNode.parentElement?.closest('[role="banner"], header');
          if (!isInFixedHeader) {
            targetLineTop = rect.top;
            targetCharHeight = rect.height > 0 ? rect.height : charHeight;
            lineCandidates.length = 0;
            lineCandidates.push({ node: currentNode, offset: i, rect });
            continue;
          }
        }
        if (diffFromTarget > targetCharHeight * 0.7) {
          return pickBestCandidate(lineCandidates, targetX);
        }
        if (Math.abs(diffFromTarget) <= targetCharHeight * 0.7) {
          lineCandidates.push({ node: currentNode, offset: i, rect });
        }
      }
    }

    currentNode = walker.previousNode() as Text | null;
    if (currentNode) {
      nodeOffsetStart = (currentNode.textContent?.length || 1) - 1;
    }
  }

  if (lineCandidates.length > 0) {
    return pickBestCandidate(lineCandidates, targetX);
  }

  return null;
}

/**
 * 計算兩目標點之間穿過每一視覺行的真實路徑點（用於平滑連貫軌跡或殘影）
 */
export function computeWaypointsBetween(
  startTarget: TextTarget,
  endTarget: TextTarget,
  targetX: number,
  rootElement: HTMLElement
): CursorRect[] {
  const waypoints: CursorRect[] = [];
  try {
    const startRect = getCharRectOfTarget(startTarget);
    const endRect = getCharRectOfTarget(endTarget);
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
        ? searchDownwardNextLine(current.node, current.offset, lastTop, lineThreshold, charHeight, targetX, rootElement)
        : searchUpwardPrevLine(current.node, current.offset, lastTop, lineThreshold, charHeight, targetX, rootElement);

      if (!nextTarget) break;

      const nextRect = getCharRectOfTarget(nextTarget);
      if (!nextRect) break;

      // 若已經越過或抵達 endTarget 所在的視覺行高度，停止收集
      if (isDownward && nextRect.y >= endRect.y - lineThreshold * 0.5) break;
      if (!isDownward && nextRect.y <= endRect.y + lineThreshold * 0.5) break;

      waypoints.push(nextRect);
      current = nextTarget;
      lastTop = nextRect.y;
    }
  } catch (err) {
    logger.warn('computeWaypointsBetween error:', err);
  }
  return waypoints;
}

/**
 * 使用 CSSOM 螢幕幾何座標計算真實的視覺行邊界
 * 支援向左穿透至行首 (isStart = true) 或向右穿透至行尾 (isStart = false)
 * 自動穿透 <b>, <span>, <a>, <code> 等行內標籤，並相容無 \n 的自動折行段落
 */
export function findVisualLineBoundary(
  target: TextTarget,
  isStart: boolean,
  rootElement: HTMLElement
): TextTarget {
  try {
    const charRect = getCharRectOfTarget(target);
    if (!charRect) return target;

    const lineTop = charRect.y;
    const charHeight = charRect.height > 0 ? charRect.height : 20;
    const tolerance = charHeight * 0.55;
    const range = document.createRange();

    const isOutOfFlow = isOutOfNormalFlowWidget(target.node, rootElement);
    let bestTarget: TextTarget = { node: target.node, offset: target.offset };
    let currentNode: Text | null = target.node;
    let offset = target.offset;

    if (isStart) {
      // 往左掃描行首
      while (currentNode) {
        const text = currentNode.textContent || '';
        const startIdx = Math.min(offset - 1, text.length - 1);

        for (let i = startIdx; i >= 0; i--) {
          const ch = text[i];
          if (ch === '\n' || ch === '\r') {
            return bestTarget;
          }

          range.setStart(currentNode, i);
          range.setEnd(currentNode, i + 1);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          // 比對是否在同一水平視覺行
          if (Math.abs(rect.top - lineTop) <= tolerance) {
            bestTarget = { node: currentNode, offset: i };
          } else {
            // 已向上折入上一行
            return bestTarget;
          }
        }

        // 穿透至前一個文字節點 (如 <b>, <span> 前方)
        const prevNode = findPrevTextNode(currentNode, rootElement, isOutOfFlow);
        if (!prevNode) break;

        currentNode = prevNode;
        offset = currentNode.textContent?.length || 0;
      }
    } else {
      // 往右掃描行尾
      while (currentNode) {
        const text = currentNode.textContent || '';
        const len = text.length;

        for (let i = offset; i < len; i++) {
          const ch = text[i];
          if (ch === '\n' || ch === '\r') {
            return bestTarget;
          }

          range.setStart(currentNode, i);
          range.setEnd(currentNode, i + 1);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          // 比對是否在同一水平視覺行
          if (Math.abs(rect.top - lineTop) <= tolerance) {
            bestTarget = { node: currentNode, offset: i };
          } else {
            // 已向下折入下一行
            return bestTarget;
          }
        }

        // 穿透至下一個文字節點
        const nextNode = findNextTextNode(currentNode, rootElement, isOutOfFlow);
        if (!nextNode) break;

        currentNode = nextNode;
        offset = 0;
      }
    }

    return bestTarget;
  } catch (err) {
    return target;
  }
}

function textNodePreservesNewline(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;
  try {
    const ws = window.getComputedStyle(parent).whiteSpace;
    return ws === 'pre' || ws === 'pre-wrap' || ws === 'pre-line' || ws === 'break-spaces';
  } catch {
    return false;
  }
}

/**
 * 尋找水平方向相鄰的下一個（或前一個）實體可見字元
 * - 自動略過折疊空白與零寬字元，並穿透 <a>、<span>、<code>、<b> 等行內標籤
 * - 當 allowWrapLine 為 false 時（正統 Vim 預設），若相鄰字元跨出當前視覺行或遇保留換行符，回傳 null 停留在行邊界
 */
export function findAdjacentHorizontalChar(
  target: TextTarget,
  direction: 1 | -1,
  rootElement: HTMLElement,
  allowWrapLine: boolean,
  fallbackLineRect?: { y: number; height: number } | null
): TextTarget | null {
  try {
    const range = document.createRange();
    const startText = target.node.textContent || '';
    const startLen = startText.length;

    let lineTop: number | null = null;
    let charHeight = 20;

    if (startLen > 0) {
      const safeOffset = Math.min(Math.max(0, target.offset), startLen - 1);
      range.setStart(target.node, safeOffset);
      range.setEnd(target.node, Math.min(safeOffset + 1, startLen));
      const startRect = range.getBoundingClientRect();
      if (startRect.width > 0 && startRect.height > 0) {
        lineTop = startRect.top;
        charHeight = startRect.height;
      }
    }

    if (lineTop === null && fallbackLineRect && fallbackLineRect.height > 0) {
      lineTop = fallbackLineRect.y;
      charHeight = fallbackLineRect.height;
    }

    const currentCenterY = lineTop !== null ? lineTop + charHeight / 2 : null;
    const isOutOfFlow = isOutOfNormalFlowWidget(target.node, rootElement);
    const walker = createFlowTreeWalker(rootElement, isOutOfFlow);
    walker.currentNode = target.node;

    let currentNode: Text | null = target.node;
    let nodesScanned = 0;
    const MAX_NODES_TO_SCAN = 100;

    while (currentNode && nodesScanned < MAX_NODES_TO_SCAN) {
      nodesScanned++;
      const text = currentNode.textContent || '';
      const len = text.length;
      const preservesNewline = textNodePreservesNewline(currentNode);

      const startIdx = direction > 0
        ? (currentNode === target.node ? target.offset + 1 : 0)
        : (currentNode === target.node ? Math.min(target.offset - 1, len - 1) : len - 1);

      for (let i = startIdx; direction > 0 ? i < len : i >= 0; i += direction) {
        const ch = text[i];
        if ((ch === '\n' || ch === '\r') && preservesNewline) {
          if (!allowWrapLine) return null;
          continue;
        }

        range.setStart(currentNode, i);
        range.setEnd(currentNode, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        if (!allowWrapLine && currentCenterY !== null) {
          const candCenterY = rect.top + rect.height / 2;
          const tolerance = Math.max(charHeight, rect.height) * 0.55;
          if (Math.abs(candCenterY - currentCenterY) > tolerance) {
            return null;
          }
        }

        return { node: currentNode, offset: i };
      }

      currentNode = (direction > 0 ? walker.nextNode() : walker.previousNode()) as Text | null;
    }

    return null;
  } catch {
    return null;
  }
}


const MIN_MEDIA_WIDTH = 120;
const MIN_MEDIA_HEIGHT = 80;

/**
 * 判斷元素是否為適合游標停駐的大型可視圖片/媒體元素
 * 過濾掉裝飾性小圖示、按鈕 icon、隱藏元素或側欄懸浮掛件
 */
export function isNavigableMediaElement(
  el: Element,
  rootElement: HTMLElement,
  allowOutOfFlow: boolean = false
): boolean {
  if (!el.isConnected) return false;
  if (el.closest('#muzen-cursor-host-root')) return false;

  const tag = el.tagName.toUpperCase();
  if (tag !== 'IMG' && tag !== 'CANVAS' && tag !== 'VIDEO' && tag !== 'SVG') {
    return false;
  }

  // 避免抓到按鈕或導航列裡的小 SVG 圖示
  if (tag === 'SVG' && el.closest('button, [role="button"], nav, header')) {
    return false;
  }

  if (el instanceof HTMLElement && (el.hidden || isVisuallyHiddenElement(el))) return false;
  if (el.closest(A11Y_HIDDEN_SELECTORS)) return false;

  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    if (!allowOutOfFlow && isOutOfNormalFlowWidget(el, rootElement)) {
      return false;
    }
  } catch {
    return false;
  }

  if (tag === 'IMG') {
    const img = el as HTMLImageElement;
    if (img.complete && img.naturalWidth === 0) return false;
  }

  const rect = el.getBoundingClientRect();
  if (isOffScreenOrZeroSize(rect)) return false;
  if (rect.width < MIN_MEDIA_WIDTH || rect.height < MIN_MEDIA_HEIGHT) return false;

  return true;
}

/**
 * 在指定的垂直座標區間內尋找下一個應停駐的大型媒體元素
 */
export function findMediaBetweenVerticalRange(
  fromEdge: number,
  toEdge: number,
  direction: 'down' | 'up',
  rootElement: HTMLElement,
  allowOutOfFlow: boolean,
  excludeEl?: Element | null
): Element | null {
  const candidates = rootElement.querySelectorAll('img, canvas, video, svg');
  let best: Element | null = null;
  let bestEdge = direction === 'down' ? Infinity : -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    if (el === excludeEl) continue;
    if (!isNavigableMediaElement(el, rootElement, allowOutOfFlow)) continue;

    const rect = el.getBoundingClientRect();
    if (direction === 'down') {
      if (rect.top >= fromEdge - 6 && rect.top < toEdge - 6) {
        if (rect.top < bestEdge) {
          bestEdge = rect.top;
          best = el;
        }
      }
    } else {
      if (rect.bottom <= fromEdge + 6 && rect.bottom > toEdge + 6) {
        if (rect.bottom > bestEdge) {
          bestEdge = rect.bottom;
          best = el;
        }
      }
    }
  }

  return best;
}

/**
 * 在沒有後續文字節點時，尋找指定位置之後（或之前）的第一個大型媒體元素
 */
export function findNextMediaAfter(
  anchorEdge: number,
  direction: 'down' | 'up',
  rootElement: HTMLElement,
  allowOutOfFlow: boolean,
  excludeEl?: Element | null
): Element | null {
  const candidates = rootElement.querySelectorAll('img, canvas, video, svg');
  let best: Element | null = null;
  let bestEdge = direction === 'down' ? Infinity : -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    if (el === excludeEl) continue;
    if (!isNavigableMediaElement(el, rootElement, allowOutOfFlow)) continue;

    const rect = el.getBoundingClientRect();
    if (direction === 'down') {
      if (rect.top >= anchorEdge - 6 && rect.top < bestEdge) {
        bestEdge = rect.top;
        best = el;
      }
    } else {
      if (rect.bottom <= anchorEdge + 6 && rect.bottom > bestEdge) {
        bestEdge = rect.bottom;
        best = el;
      }
    }
  }

  return best;
}
