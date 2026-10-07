import { TextTarget } from '../wordNavigator';
import { cursorStore } from '../cursorStore';

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
   * 同步瀏覽器原生選取區 (Selection)
   */
  public syncNativeSelection(currentTarget: TextTarget | null): void {
    if (!this.visualAnchor || !currentTarget) return;

    const sel = window.getSelection();
    if (!sel) return;

    try {
      if (typeof sel.setBaseAndExtent === 'function') {
        sel.setBaseAndExtent(
          this.visualAnchor.node,
          this.visualAnchor.offset,
          currentTarget.node,
          currentTarget.offset
        );
      } else {
        const range = document.createRange();
        range.setStart(this.visualAnchor.node, this.visualAnchor.offset);
        range.setEnd(currentTarget.node, currentTarget.offset);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch {
      // 跨節點順序相反時反向設置
      try {
        const range = document.createRange();
        range.setStart(currentTarget.node, currentTarget.offset);
        range.setEnd(this.visualAnchor.node, this.visualAnchor.offset);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (err) {
        console.warn('[Muzen Cursor] Selection sync error:', err);
      }
    }
  }

  /**
   * 退出 Visual 模式並清除原生反白選取
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
}
