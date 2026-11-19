import { cursorStore } from '../cursorStore';
import { TextTarget } from '../wordNavigator';
import { NavDirection } from './types';

/**
 * 翻頁回溯後照鏡 (Rearview Mirror HUD) 與 0ms 背景快照快取管理員
 */
export class RearviewManager {
  private cachedSnapshotUrl: string | null = null;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSnapshotTime = 0;

  /**
   * 預先在背景擷取當前視窗快照 (防抖 200ms)
   */
  public requestBackgroundSnapshot(): void {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
    }
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      const now = Date.now();
      if (now - this.lastSnapshotTime < 250) return;
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'CAPTURE_TAB_SNAPSHOT' }, (resp) => {
            if (resp && resp.success && resp.dataUrl) {
              this.cachedSnapshotUrl = resp.dataUrl;
              this.lastSnapshotTime = Date.now();
            }
          });
        }
      } catch {
        // 忽略通訊例外
      }
    }, 200);
  }

  /**
   * 觸發翻頁回溯後照鏡 (Rearview Mirror HUD)
   * 擷取剛才出發點的真實畫面快照與游標座標，供後照鏡 HUD 即時對齊閱讀記憶
   */
  public triggerNotice(
    target: TextTarget | null,
    direction: NavDirection,
    sectionTitle: string
  ): void {
    if (!target) return;
    const { node, offset } = target;
    const len = node.textContent?.length || 0;
    if (len === 0) return;

    try {
      const snippet = this.extractSentenceSnippet(node, offset);
      const curRect = cursorStore.getState().rect;
      const snapshot = this.cachedSnapshotUrl;
      const dpr = window.devicePixelRatio || 1;

      if (snippet && snippet.length > 0) {
        cursorStore.setState({
          rearviewNotice: {
            text: snippet,
            direction,
            sectionTitle,
            timestamp: performance.now(),
            snapshotUrl: snapshot || undefined,
            cursorRect: curRect ? { ...curRect } : undefined,
            devicePixelRatio: dpr
          }
        });
      }
    } catch {
      // 容錯防禦
    }
  }

  /**
   * 擷取游標所在位置之句子文字摘要 (前後各截取 22~32 字元)
   */
  private extractSentenceSnippet(node: Text, offset: number): string {
    const raw = node.textContent || '';
    if (!raw.trim()) return '';

    const textLen = raw.length;
    const safeOffset = Math.min(offset, Math.max(0, textLen - 1));

    const start = Math.max(0, safeOffset - 22);
    const end = Math.min(textLen, safeOffset + 32);

    let snippet = raw.slice(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) snippet = '…' + snippet;
    if (end < textLen) snippet = snippet + '…';

    return snippet;
  }

  public destroy(): void {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    this.cachedSnapshotUrl = null;
  }
}
