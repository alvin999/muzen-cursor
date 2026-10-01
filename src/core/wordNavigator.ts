/**
 * CJK 與英文智慧分詞導航演算法 (Intl.Segmenter)
 */

export interface TextTarget {
  node: Text;
  offset: number;
}

export class WordNavigator {
  private static segmenter: Intl.Segmenter | null = null;

  private static getSegmenter(): Intl.Segmenter | null {
    if (this.segmenter) return this.segmenter;
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      try {
        this.segmenter = new Intl.Segmenter(['zh-TW', 'en'], { granularity: 'word' });
      } catch {
        this.segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
      }
    }
    return this.segmenter;
  }

  /**
   * 計算下一個單字/詞彙的起始位置 (w)
   */
  public static getNextWordOffset(text: string, currentOffset: number): number {
    const len = text.length;
    if (currentOffset >= len) return len;

    const segmenter = this.getSegmenter();
    if (segmenter) {
      const segments = Array.from(segmenter.segment(text));
      for (const seg of segments) {
        // 找到 index 大於 currentOffset，且是詞彙或標點（非純空白）
        if (seg.index > currentOffset) {
          if (seg.isWordLike || seg.segment.trim().length > 0) {
            return seg.index;
          }
        }
      }
      return len;
    }

    // 後備正則表達式斷詞
    const sub = text.slice(currentOffset);
    const match = sub.match(/\s+\S/);
    if (match && typeof match.index === 'number') {
      return currentOffset + match.index + match[0].length - 1;
    }
    return len;
  }

  /**
   * 計算當前或前一個單字/詞彙的起始位置 (b)
   */
  public static getPrevWordOffset(text: string, currentOffset: number): number {
    if (currentOffset <= 0) return 0;

    const segmenter = this.getSegmenter();
    if (segmenter) {
      const segments = Array.from(segmenter.segment(text));
      let lastIndex = 0;
      for (const seg of segments) {
        if (seg.index < currentOffset) {
          if (seg.isWordLike || seg.segment.trim().length > 0) {
            lastIndex = seg.index;
          }
        } else {
          break;
        }
      }
      return lastIndex;
    }

    // 後備正則表達式前退
    let idx = currentOffset - 1;
    while (idx > 0 && /\s/.test(text[idx])) {
      idx--;
    }
    while (idx > 0 && !/\s/.test(text[idx - 1])) {
      idx--;
    }
    return Math.max(0, idx);
  }

  /**
   * 計算當前或下一個單字/詞彙的結尾位置 (e)
   */
  public static getWordEndOffset(text: string, currentOffset: number): number {
    const len = text.length;
    if (currentOffset >= len - 1) return len;

    const segmenter = this.getSegmenter();
    if (segmenter) {
      const segments = Array.from(segmenter.segment(text));
      for (const seg of segments) {
        const segEnd = seg.index + seg.segment.length;
        if (segEnd > currentOffset + 1 && (seg.isWordLike || seg.segment.trim().length > 0)) {
          return segEnd;
        }
      }
      return len;
    }

    let idx = currentOffset + 1;
    while (idx < len && !/\s/.test(text[idx])) {
      idx++;
    }
    return idx;
  }

  /**
   * 取得當前行首位置 (0)
   */
  public static getLineStartOffset(text: string, currentOffset: number): number {
    const prevNewline = text.lastIndexOf('\n', currentOffset - 1);
    return prevNewline === -1 ? 0 : prevNewline + 1;
  }

  /**
   * 取得當前行尾位置 ($)
   */
  public static getLineEndOffset(text: string, currentOffset: number): number {
    const nextNewline = text.indexOf('\n', currentOffset);
    return nextNewline === -1 ? text.length : nextNewline;
  }
}
