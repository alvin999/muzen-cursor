import { cursorStore } from '../cursorStore';
import { animateScrollTo, cancelActiveScroll, isSmoothScrolling, getScrollParent, getViewportMetrics } from '../../utils/smoothScroller';
import { logger } from '../../utils/logger';
import { CursorHostContext, NavDirection } from './types';

/**
 * 統一執行視窗或可滾動容器的垂直位移
 * 依據是否為長按連發 (isRepeat) 自動切換零延遲 instant 推進與平滑阻尼動畫
 */
export function scrollByDelta(
  scrollTarget: Window | HTMLElement,
  currentScroll: number,
  delta: number,
  options: { isRepeat: boolean; durationMs: number }
): void {
  if (options.isRepeat) {
    // 長按 (Key Repeat) 模式：取消未完動畫，執行零延遲 instant 同步推進，確保視窗與游標 100% 鎖定不脫軌
    cancelActiveScroll();
    const isWin = scrollTarget === window || !(scrollTarget instanceof HTMLElement);
    if (isWin) {
      window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
    } else {
      (scrollTarget as HTMLElement).scrollTop += delta;
    }
    return;
  }

  // 單次按鍵模式：執行 Ease-Out 物理阻尼平滑滾動
  const targetScroll = Math.max(0, currentScroll + delta);
  animateScrollTo(scrollTarget, targetScroll, options.durationMs);
}

/**
 * 統一將視窗或滾動容器捲動至絕對 Y 座標
 */
export function scrollToPosition(
  node: Node | null,
  containerRoot: HTMLElement | undefined,
  targetScrollTop: number | 'bottom',
  durationMs: number
): void {
  const scrollParent = node ? getScrollParent(node, containerRoot) : null;
  if (scrollParent) {
    const dest = targetScrollTop === 'bottom'
      ? Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight)
      : targetScrollTop;
    animateScrollTo(scrollParent, dest, durationMs);
    return;
  }

  if (!containerRoot) {
    const dest = targetScrollTop === 'bottom'
      ? Math.max(
          0,
          Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) -
            (window.visualViewport?.height ?? window.innerHeight)
        )
      : targetScrollTop;
    animateScrollTo(window, dest, durationMs);
  }
}

/**
 * 視窗黃金視野區間跟隨捲動與停頓延遲校正 (Debounce Idle Realignment) 管理器
 */
export class ScrollFollower {
  private realignTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly REALIGN_DEBOUNCE_MS = 200;

  constructor(private readonly host: CursorHostContext) {}

  /**
   * 鍵盤主動導航時的自動跟隨捲動 (自適應黃金視野區間演算法)
   */
  public followCursorInViewport(
    node: Node,
    rect: DOMRect,
    navDirection: NavDirection | undefined,
    isRepeat: boolean
  ): void {
    const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(
      node,
      this.host.getOptions()?.containerRoot
    );
    if (!scrollTarget) return;

    const curTop = rect.top - parentTop;
    const curBottom = rect.bottom - parentTop;

    const adv = cursorStore.getState().advanced;
    // 動態安全比例閥：單邊安全邊距不超過可視高度 28%（中間保留至少 44% 黃金舒適閱讀區間，防止放大縮小時邊距擠壓導致抖動）
    const maxPad = Math.floor(viewHeight * 0.28);
    const padBottom = Math.min(maxPad, adv?.viewportPaddingBottom ?? 160);
    const padTop = Math.min(maxPad, adv?.viewportPaddingTop ?? 120);
    const scrollDuration = isRepeat ? 80 : (adv?.scrollDurationMs ?? 320);

    // 自適應字元行高緩衝：在任何縮放比例下，維持約半行字高的舒適安全視距
    const lineBuffer = Math.max(12, Math.min(36, Math.round((rect.height || 20) * 0.5)));

    if (navDirection === 'down') {
      // 向下閱讀時，只允許因超過底部視野而向下滾動，嚴禁向上反向回捲！
      if (curBottom > viewHeight - padBottom) {
        let delta = curBottom - (viewHeight - padBottom) + lineBuffer;
        // 大跨距防禦：若單步跨越大型圖片或空白區塊導致游標瞬間落於畫面外甚遠，對齊至黃金舒適區中央，消除追趕落差感
        if (curTop > viewHeight) {
          delta = curTop - Math.round(viewHeight * 0.65);
        }
        scrollByDelta(scrollTarget, currentScroll, delta, { isRepeat, durationMs: scrollDuration });
      }
      return;
    }

    if (navDirection === 'up') {
      // 向上閱讀時，只允許因超過頂部視野而向上滾動，嚴禁向下反向回捲！
      if (curTop < padTop) {
        let delta = (padTop - curTop) + lineBuffer;
        // 大跨距防禦：若向上跨越大型圖片或區塊導致游標遠超畫面頂部，對齊至黃金舒適區上緣
        if (curBottom < 0) {
          delta = Math.round(viewHeight * 0.35) - curTop;
        }
        scrollByDelta(scrollTarget, currentScroll, -delta, { isRepeat, durationMs: scrollDuration });
      }
      return;
    }

    // 一般導航 (無明確垂直方向)：僅在字元完全滑出螢幕視野時進行最小安全回拉
    if (curBottom > viewHeight - 20) {
      const targetScroll = currentScroll + (curBottom - viewHeight + 60);
      animateScrollTo(scrollTarget, targetScroll, scrollDuration);
    } else if (curTop < 56) {
      const targetScroll = Math.max(0, currentScroll - (60 - curTop));
      animateScrollTo(scrollTarget, targetScroll, scrollDuration);
    }
  }

  /**
   * 排程停頓延遲校正 (Debounce Idle Realignment)
   * 當使用者連續按鍵結束、停頓超過預設毫秒時，檢測游標是否因 DOM 突變或動態載入脫出死區
   */
  public scheduleDebounceRealignment(): void {
    const state = cursorStore.getState();
    if (!state.enabled || !state.visible || state.isExcluded) {
      this.cancelPendingRealignment();
      return;
    }

    this.cancelPendingRealignment();
    this.realignTimer = setTimeout(() => {
      this.realignTimer = null;
      this.performDebounceRealignment();
    }, this.REALIGN_DEBOUNCE_MS);
  }

  public cancelPendingRealignment(): void {
    if (this.realignTimer) {
      clearTimeout(this.realignTimer);
      this.realignTimer = null;
    }
  }

  /**
   * 執行停頓校正：針對動態插入 DOM /虛擬列表環境，平滑校正視窗捲動對齊
   */
  private performDebounceRealignment(): void {
    const state = cursorStore.getState();
    if (!state.enabled || !state.visible || state.isExcluded) return;

    // 若仍在進行平滑滾動，稍後再檢測避免打架
    if (isSmoothScrolling()) {
      return;
    }

    // 1. 節點失效防禦：若節點已自 DOM 脫離 (被虛擬列表卸載)，走重錨邏輯
    if (!this.host.ensureValidTarget()) return;

    const currentTarget = this.host.getCurrentTarget();
    if (!currentTarget) return;

    const { node, offset } = currentTarget;
    const textLen = node.textContent?.length || 0;
    const range = document.createRange();
    try {
      const safeOffset = Math.min(offset, textLen);
      range.setStart(node, safeOffset);
      range.setEnd(node, Math.min(safeOffset + 1, textLen));
      const rect = range.getBoundingClientRect();

      // 若元素隱藏或無寬高則不處理
      if (rect.width === 0 && rect.height === 0) return;

      const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(
        node,
        this.host.getOptions()?.containerRoot
      );
      if (!scrollTarget) return;

      const curTop = rect.top - parentTop;
      const curBottom = rect.bottom - parentTop;

      // 定義死區 (Deadzone / Safe zone)：
      // 頂部死區邊界 (考慮導航列固定遮蔽)：70px
      // 底部死區邊界：視窗底部往上 80px
      const deadzoneTop = 70;
      const deadzoneBottom = viewHeight - 80;

      // 若游標穩穩位於安全視野內，完全不作任何捲動 (零干擾原則)
      if (curTop >= deadzoneTop && curBottom <= deadzoneBottom) {
        return;
      }

      // 若游標超出死區 (被 Facebook 突變擠壓到頂部/底部外，或極度貼邊)：
      // 計算平滑補償量，將游標帶回舒適視野 (頂部偏向 28% 視野高度，底部偏向 70% 視野高度)
      let targetScroll: number | null = null;
      if (curTop < deadzoneTop) {
        // 游標在頂部死區外或在視野上方：拉動視窗使游標落在約 28% 高度處
        const desiredTop = Math.round(viewHeight * 0.28);
        const delta = curTop - desiredTop;
        targetScroll = Math.max(0, currentScroll + delta);
      } else if (curBottom > deadzoneBottom) {
        // 游標在底部死區外或在視野下方：拉動視窗使游標落在約 70% 高度處
        const desiredBottom = Math.round(viewHeight * 0.70);
        const delta = curBottom - desiredBottom;
        targetScroll = Math.max(0, currentScroll + delta);
      }

      if (targetScroll !== null && Math.abs(targetScroll - currentScroll) > 10) {
        // 220ms 柔和阻尼校正
        animateScrollTo(scrollTarget, targetScroll, 220);
      }
    } catch (err) {
      logger.warn('performDebounceRealignment error:', err);
    }
  }

  public destroy(): void {
    this.cancelPendingRealignment();
  }
}
