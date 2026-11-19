import { cursorStore, CursorRect, MotionDirection } from '../cursorStore';
import { TextTarget } from '../wordNavigator';
import { findPrevTextNode } from '../navigation/spatialNavigator';
import { isOutOfNormalFlowWidget, findCurrentSectionHeading, estimateReadingMinutes } from '../../utils/domUtils';

export interface ReadingStats {
  headingTitle: string;
  readingMinutes: number;
}

/**
 * 計算全頁面閱讀進度（自適應 visualViewport 縮放高度）
 */
export function computeReadingProgress(): { scrollY: number; viewportH: number; progress: number } {
  const scrollY = window.scrollY || window.pageYOffset;
  const viewportH = window.visualViewport?.height ?? window.innerHeight;
  const totalHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  ) - viewportH;
  const progress = totalHeight > 0 ? Math.min(100, Math.max(0, (scrollY / totalHeight) * 100)) : 100;
  return { scrollY, viewportH, progress };
}

/**
 * 計算本次位移向量與方向 (提供 3D 透視梯形動態反饋使用)
 */
export function computeMotionDirection(
  rect: Pick<DOMRect, 'left' | 'top'>,
  prevRect: CursorRect,
  wasVisible: boolean
): MotionDirection {
  if (!wasVisible) return 'none';

  const dx = rect.left - prevRect.x;
  const dy = rect.top - prevRect.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx <= 1 && absDy <= 1) return 'none';
  if (absDy > 80 || absDx > 500) return 'jump';
  if (absDx >= absDy) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * 當單字元 Range 回傳寬度或高度為 0（常見於 <pre><code> 中的換行符 \n 或零寬節點）時，
 * 依序以瀏覽器已定位座標、同節點相鄰字元、前一個文字節點末尾來推算正確矩形，
 * 避免在 safeOffset === 0 時誤退回容器（如 <code>/<pre>）左上角導致游標與 Smear 特效瞬移。
 */
export function resolveZeroSizeCharRect(
  node: Text,
  safeOffset: number,
  rawRect: DOMRect,
  range: Range,
  effectiveRoot: HTMLElement
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
    } catch {
      // 忽略超出範圍或失效節點例外
    }
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
 * 量測文字目標的字元矩形，包含零尺寸節點修復與幾何異常防禦
 */
export function measureTargetRect(
  target: TextTarget,
  effectiveRoot: HTMLElement
): { rect: DOMRect; safeOffset: number } {
  const { node, offset } = target;
  const textLen = node.textContent?.length || 0;
  const range = document.createRange();
  const safeOffset = Math.min(offset, textLen);
  const endOffset = Math.min(safeOffset + 1, textLen);
  range.setStart(node, safeOffset);
  range.setEnd(node, endOffset);

  let rect = range.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) {
    rect = resolveZeroSizeCharRect(node, safeOffset, rect, range, effectiveRoot);
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

  return { rect, safeOffset };
}

/**
 * 長文閱讀輔助與章節標題快取
 */
export class ReadingStatsCache {
  private cachedTotalChars = 0;
  private lastCharCountTime = 0;
  private lastHeadingCheckTime = 0;
  private cachedHeadingTitle = '';
  private cachedReadingMinutes = 0;

  public get headingTitle(): string {
    return this.cachedHeadingTitle;
  }

  public get readingMinutes(): number {
    return this.cachedReadingMinutes;
  }

  /**
   * 更新閱讀統計快取；長按連發時跳過計算以節省主線程 CPU
   */
  public refreshIfNeeded(
    node: Text,
    previousNode: Text | undefined,
    effectiveRoot: HTMLElement,
    progress: number,
    isRepeat: boolean
  ): ReadingStats {
    if (!isRepeat) {
      const now = performance.now();
      if (now - this.lastCharCountTime > 5000 || this.cachedTotalChars === 0) {
        this.cachedTotalChars = effectiveRoot.textContent?.replace(/\s+/g, '').length || 0;
        this.lastCharCountTime = now;
      }

      if (now - this.lastHeadingCheckTime > 300 || node !== previousNode) {
        this.cachedHeadingTitle = findCurrentSectionHeading(node, effectiveRoot) || '';
        this.cachedReadingMinutes = estimateReadingMinutes(this.cachedTotalChars, progress);
        this.lastHeadingCheckTime = now;
      }
    }

    return {
      headingTitle: this.cachedHeadingTitle,
      readingMinutes: this.cachedReadingMinutes
    };
  }
}
