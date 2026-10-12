import { TextTarget } from '../wordNavigator';
import { cursorStore } from '../cursorStore';
import { findVisualLineBoundary } from './spatialNavigator';

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
    } catch (err) {
      console.warn('[Muzen Cursor] Visual line selection sync error:', err);
    }
  }

  /**
   * 退出 Visual / Visual Line 模式並清除原生反白選取
   */
  public exitVisualMode(): void {
    this.clearAnchor();
    cursorStore.setState({ mode: 'NORMAL' });
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
        console.log(`[Muzen Cursor] 已複製 ${text.length} 個字元至剪貼簿 (${isLineMode ? '整行' : '字元'})`);
      } catch (err) {
        console.warn('[Muzen Cursor] 剪貼簿寫入失敗:', err);
      }
    }

    this.exitVisualMode();
  }
}
