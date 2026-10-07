/**
 * Caret 與滑鼠點擊文字解析工具
 * 遵循 W3C CSSOM View 標準規格，現代標準優先並降級相容舊版 WebKit
 */

export interface CaretPositionStandard {
  readonly offsetNode: Node;
  readonly offset: number;
}

export interface CaretTargetResult {
  node: Text;
  offset: number;
}

/**
 * 跨瀏覽器從螢幕座標取得 Caret 目標
 * 1. 優先採用 W3C 標準 document.caretPositionFromPoint (Chrome 127+, Firefox, Safari 17+)
 * 2. 次要降級至已廢棄之 document.caretRangeFromPoint (舊版 Chromium/WebKit)
 */
export function getRawCaretFromPoint(
  x: number,
  y: number
): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => CaretPositionStandard | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  // 1. W3C 標準 API
  if (typeof doc.caretPositionFromPoint === 'function') {
    try {
      const pos = doc.caretPositionFromPoint(x, y);
      if (pos && pos.offsetNode) {
        return { node: pos.offsetNode, offset: pos.offset };
      }
    } catch {
      // 容錯防禦
    }
  }

  // 2. 舊版 WebKit / Blink 降級相容
  if (typeof doc.caretRangeFromPoint === 'function') {
    try {
      const range = doc.caretRangeFromPoint(x, y);
      if (range && range.startContainer) {
        return { node: range.startContainer, offset: range.startOffset };
      }
    } catch {
      // 容錯防禦
    }
  }

  return null;
}

/**
 * 根據點擊座標與目標元素，解析出具體之文字節點與位移 (TextTarget)
 */
export function resolveTextTargetFromPoint(
  clickX: number,
  clickY: number,
  targetEl: HTMLElement | null,
  findFirstTextNode: (root: Node) => Text | null
): CaretTargetResult | null {
  if (!targetEl) return null;

  const isGlobalContainer =
    targetEl === document.body ||
    targetEl === document.documentElement ||
    targetEl.tagName === 'BODY' ||
    targetEl.tagName === 'HTML';

  let targetNode: Text | null = null;
  let targetOffset = 0;

  // 1. 嘗試透過 Caret API 取得精確節點與字元位移
  const rawCaret = getRawCaretFromPoint(clickX, clickY);
  if (rawCaret) {
    if (rawCaret.node.nodeType === Node.TEXT_NODE) {
      targetNode = rawCaret.node as Text;
      targetOffset = rawCaret.offset;
    } else if (
      rawCaret.node.nodeType === Node.ELEMENT_NODE &&
      rawCaret.node !== document.body &&
      rawCaret.node !== document.documentElement
    ) {
      const elem = rawCaret.node as Element;
      if (elem.childNodes.length > 0) {
        const childIndex = Math.min(rawCaret.offset, elem.childNodes.length - 1);
        const child = elem.childNodes[childIndex];
        targetNode = child.nodeType === Node.TEXT_NODE ? (child as Text) : findFirstTextNode(child);
      } else {
        targetNode = findFirstTextNode(elem);
      }
      targetOffset = 0;
    }
  }

  // 2. 後備方案：純依賴 CSSOM 渲染層與視覺排版判斷，不列舉任何 HTML 標籤
  if (!targetNode && !isGlobalContainer) {
    const isVisible =
      typeof targetEl.checkVisibility === 'function'
        ? targetEl.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        : targetEl.offsetWidth > 0 || targetEl.offsetHeight > 0 || targetEl.getClientRects().length > 0;

    if (isVisible && (targetEl.innerText?.trim().length || 0) > 0) {
      try {
        const computed = window.getComputedStyle(targetEl);
        if (computed.userSelect !== 'none' && computed.pointerEvents !== 'none') {
          const firstText = findFirstTextNode(targetEl);
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

  if (!targetNode) return null;

  return { node: targetNode, offset: targetOffset };
}

/**
 * 距離防禦：確認找到的文字節點與點擊處的物理距離
 * 若點擊點距離文字過遠（如點在兩側大片空白），判定為無效點擊
 */
export function isClickWithinDistanceThreshold(
  clickX: number,
  clickY: number,
  targetNode: Text,
  maxVerticalDist = 40,
  maxHorizontalDist = 120
): boolean {
  try {
    const testRange = document.createRange();
    testRange.selectNodeContents(targetNode);
    const rect = testRange.getBoundingClientRect();

    const verticalDist = clickY < rect.top ? rect.top - clickY : clickY > rect.bottom ? clickY - rect.bottom : 0;
    const horizontalDist = clickX < rect.left ? rect.left - clickX : clickX > rect.right ? clickX - rect.right : 0;

    return verticalDist <= maxVerticalDist && horizontalDist <= maxHorizontalDist;
  } catch {
    return false;
  }
}
