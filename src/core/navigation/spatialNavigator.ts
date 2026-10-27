import { CursorRect } from '../cursorStore';
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

    for (let i = nodeOffsetStart; i < len; i++) {
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
    const startFrom = nodeOffsetStart >= 0 ? Math.min(nodeOffsetStart, text.length - 1) : -1;

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
    console.warn('[Muzen Cursor] computeWaypointsBetween error:', err);
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
