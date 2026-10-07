import { CursorRect } from '../cursorStore';
import { TextTarget } from '../wordNavigator';

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
 * 尋找當前節點之向下一個可閱讀 Text 節點
 */
export function findNextTextNode(current: Text, rootElement: HTMLElement): Text | null {
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
  walker.currentNode = current;
  let next = walker.nextNode();
  while (next) {
    if (isValidReadableTextNode(next as Text)) {
      return next as Text;
    }
    next = walker.nextNode();
  }
  return null;
}

/**
 * 尋找當前節點之向上一個可閱讀 Text 節點
 */
export function findPrevTextNode(current: Text, rootElement: HTMLElement): Text | null {
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
  walker.currentNode = current;
  let prev = walker.previousNode();
  while (prev) {
    if (isValidReadableTextNode(prev as Text)) {
      return prev as Text;
    }
    prev = walker.previousNode();
  }
  return null;
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

    currentNode = findNextTextNode(currentNode, rootElement);
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
        // 階段 1：逆向尋找上一視覺行的第一個實體字元
        const diffY = currentCharTop - rect.top;
        if (diffY > lineThreshold) {
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

    currentNode = findPrevTextNode(currentNode, rootElement);
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
