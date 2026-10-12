import { TextTarget } from '../wordNavigator';
import { cursorStore } from '../cursorStore';
import { findVisualLineBoundary } from './spatialNavigator';
import { LOCALES } from '../../i18n/locales';

/**
 * Visual 模式與文字選取、剪貼簿管理員
 */
export class VisualSelectionManager {
  private visualAnchor: TextTarget | null = null;

  public get anchor(): TextTarget | null {
    return this.visualAnchor;
  }

  public setAnchor(target: TextTarget | null): void {
    this.visualAnchor = target;
  }

  public clearAnchor(): void {
    this.visualAnchor = null;
  }

  /**
   * 同步瀏覽器原生選取區 (Selection) - 字元模式 (Vim 閉區間包含當前游標字元)
   */
  public syncNativeSelection(currentTarget: TextTarget | null): void {
    if (!this.visualAnchor || !currentTarget) return;

    const sel = window.getSelection();
    if (!sel) return;

    try {
      let isTargetForward = true;
      if (this.visualAnchor.node === currentTarget.node) {
        isTargetForward = currentTarget.offset >= this.visualAnchor.offset;
      } else {
        const pos = this.visualAnchor.node.compareDocumentPosition(currentTarget.node);
        isTargetForward = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }

      const getSafeOffset = (target: TextTarget, addOne: boolean) => {
        const maxLen = target.node.textContent?.length || 0;
        return addOne ? Math.min(maxLen, target.offset + 1) : Math.min(maxLen, target.offset);
      };

      if (typeof sel.setBaseAndExtent === 'function') {
        if (isTargetForward) {
          // 向後選取：Base 為 Anchor 起點，Extent 包含當前游標字元 (+1)
          sel.setBaseAndExtent(
            this.visualAnchor.node,
            this.visualAnchor.offset,
            currentTarget.node,
            getSafeOffset(currentTarget, true)
          );
        } else {
          // 向前選取：Base 包含 Anchor 字元 (+1)，Extent 為當前游標起點
          sel.setBaseAndExtent(
            this.visualAnchor.node,
            getSafeOffset(this.visualAnchor, true),
            currentTarget.node,
            currentTarget.offset
          );
        }
      } else {
        const range = document.createRange();
        if (isTargetForward) {
          range.setStart(this.visualAnchor.node, this.visualAnchor.offset);
          range.setEnd(currentTarget.node, getSafeOffset(currentTarget, true));
        } else {
          range.setStart(currentTarget.node, currentTarget.offset);
          range.setEnd(this.visualAnchor.node, getSafeOffset(this.visualAnchor, true));
        }
        sel.removeAllRanges();
        sel.addRange(range);
      }

      this.updateSelectionStats(sel);
    } catch (err) {
      console.warn('[Muzen Cursor] Selection sync error:', err);
    }
  }

  /**
   * 同步瀏覽器原生選取區 (Selection) - Visual Line 整行選取模式
   * 自動涵蓋 Anchor 所在整行至當前游標所在整行
   */
  public syncVisualLineSelection(currentTarget: TextTarget | null, rootElement: HTMLElement): void {
    if (!this.visualAnchor || !currentTarget) return;

    const sel = window.getSelection();
    if (!sel) return;

    try {
      // 1. 取得 Anchor 所在視覺行的行首與行尾
      const anchorStart = findVisualLineBoundary(this.visualAnchor, true, rootElement);
      const anchorEnd = findVisualLineBoundary(this.visualAnchor, false, rootElement);

      // 2. 取得 CurrentTarget 所在視覺行的行首與行尾
      const targetStart = findVisualLineBoundary(currentTarget, true, rootElement);
      const targetEnd = findVisualLineBoundary(currentTarget, false, rootElement);

      // 計算行尾的安全 endOffset（選取包含該字元）
      const getSafeEndOffset = (t: TextTarget) => {
        const len = t.node.textContent?.length || 0;
        return Math.min(len, t.offset + 1);
      };

      // 3. 判斷 Anchor 與 Target 的前後順序
      let isTargetForward = true;
      if (anchorStart.node === targetStart.node) {
        isTargetForward = targetStart.offset >= anchorStart.offset;
      } else {
        const pos = anchorStart.node.compareDocumentPosition(targetStart.node);
        isTargetForward = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }

      if (typeof sel.setBaseAndExtent === 'function') {
        if (isTargetForward) {
          // 向下或同列選取：Base 為 Anchor 行首，Extent 為 Target 行尾
          sel.setBaseAndExtent(
            anchorStart.node,
            anchorStart.offset,
            targetEnd.node,
            getSafeEndOffset(targetEnd)
          );
        } else {
          // 向上選取：Base 為 Anchor 行尾，Extent 為 Target 行首
          sel.setBaseAndExtent(
            anchorEnd.node,
            getSafeEndOffset(anchorEnd),
            targetStart.node,
            targetStart.offset
          );
        }
      } else {
        const range = document.createRange();
        if (isTargetForward) {
          range.setStart(anchorStart.node, anchorStart.offset);
          range.setEnd(targetEnd.node, getSafeEndOffset(targetEnd));
        } else {
          range.setStart(targetStart.node, targetStart.offset);
          range.setEnd(anchorEnd.node, getSafeEndOffset(anchorEnd));
        }
        sel.removeAllRanges();
        sel.addRange(range);
      }

      this.updateSelectionStats(sel);
    } catch (err) {
      console.warn('[Muzen Cursor] Visual line selection sync error:', err);
    }
  }

  /**
   * 基於 W3C Range.getClientRects() 標準行盒幾何聚類，計算選取範圍內真實的視覺行數
   * 即使遇到大圖片、大字級標題或自動折行，圖片與大物件在行盒中永遠只佔 1 個行盒，避免高度誤差
   */
  private computeVisualLines(sel: Selection | null): number {
    if (!sel || sel.rangeCount === 0) return 1;
    try {
      const range = sel.getRangeAt(0);
      const rects = Array.from(range.getClientRects()).filter(
        (r) => r.width > 0.5 && r.height > 0.5
      );
      if (rects.length === 0) {
        const text = sel.toString();
        return text ? text.split('\n').filter(Boolean).length || 1 : 1;
      }

      // 由上至下排序並聚類：同一個水平視覺行合併為 1，垂直分開則 +1
      rects.sort((a, b) => a.top - b.top);
      let lines = 0;
      let lastBottom = -999999;

      for (const r of rects) {
        // 若當前行框頂部已低於上一行底部的一半以上，代表進入新的一行
        if (r.top > lastBottom - r.height * 0.4) {
          lines++;
          lastBottom = r.bottom;
        } else {
          lastBottom = Math.max(lastBottom, r.bottom);
        }
      }
      return Math.max(lines, 1);
    } catch {
      const text = sel.toString();
      return text ? text.split('\n').filter(Boolean).length || 1 : 1;
    }
  }

  /**
   * 計算目前反白選取之字元數與行數，同步至全域 Store
   */
  private updateSelectionStats(sel: Selection | null): void {
    if (!sel || sel.rangeCount === 0) {
      cursorStore.setState({ selectionStats: null });
      return;
    }
    const text = sel.toString();
    const chars = text.length;
    const lines = this.computeVisualLines(sel);
    cursorStore.setState({ selectionStats: { chars, lines } });
  }

  /**
   * 退出 Visual / Visual Line 模式並清除原生反白選取
   */
  public exitVisualMode(): void {
    this.clearAnchor();
    cursorStore.setState({ mode: 'NORMAL', selectionStats: null });
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
    }
  }

  /**
   * 複製當前選取文字至系統剪貼簿 (Yank)
   */
  public async yankSelection(): Promise<void> {
    const isLineMode = cursorStore.getState().mode === 'VISUAL_LINE';
    const sel = window.getSelection();
    let text = sel ? sel.toString() : '';

    if (text.length > 0) {
      // 整行模式下若結尾無換行，自動補充換行以符合 Vim 行選取 yank 規格
      if (isLineMode && !text.endsWith('\n')) {
        text += '\n';
      }

      try {
        await navigator.clipboard.writeText(text);
        const state = cursorStore.getState();
        const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];
        const lineCount = state.selectionStats?.lines || text.split('\n').filter(Boolean).length || 1;
        const notice = isLineMode
          ? dict.statusCopiedLines.replace('{count}', String(lineCount))
          : dict.statusCopiedChars.replace('{count}', String(text.length));
        cursorStore.showStatusNotice(notice, 1600);
        console.log(`[Muzen Cursor] 已複製 ${text.length} 個字元至剪貼簿 (${isLineMode ? '整行' : '字元'})`);
      } catch (err) {
        console.warn('[Muzen Cursor] 剪貼簿寫入失敗:', err);
      }
    }

    this.exitVisualMode();
  }
}
