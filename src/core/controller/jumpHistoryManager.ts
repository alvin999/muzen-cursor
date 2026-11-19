import { cursorStore, JumpMenuItem } from '../cursorStore';
import { TextTarget } from '../wordNavigator';
import { findVisualLineBoundary } from '../navigation/spatialNavigator';
import { getScrollParent } from '../../utils/smoothScroller';
import { CursorHostContext, JumpPoint } from './types';
import { scrollToPosition } from './scrollFollower';

/**
 * 跳轉歷史堆疊 (上限 30 筆)、Toggle 雙點互換與 Neovim 風格浮動跳轉選單管理員
 */
export class JumpHistoryManager {
  private jumpHistory: JumpPoint[] = [];
  private readonly MAX_JUMPS = 30;
  private lastJumpBackTarget: JumpPoint | null = null;
  private jumpMenuTimer: ReturnType<typeof setTimeout> | null = null;
  private isJumpMenuExact = false;

  constructor(private readonly host: CursorHostContext) {}

  public get hasHistory(): boolean {
    return this.jumpHistory.length > 0;
  }

  /**
   * 擷取當前游標位置（文字節點或媒體元素）與捲動座標作為跳轉點
   */
  public captureCurrentPoint(): JumpPoint | null {
    const containerRoot = this.host.getOptions()?.containerRoot;
    const mediaEl = this.host.getMediaElement();

    if (mediaEl && mediaEl.isConnected) {
      const scrollParent = getScrollParent(mediaEl, containerRoot);
      const scrollX = scrollParent ? scrollParent.scrollLeft : (window.scrollX ?? window.pageXOffset ?? 0);
      const scrollY = scrollParent ? scrollParent.scrollTop : (window.scrollY ?? window.pageYOffset ?? 0);

      return {
        node: mediaEl,
        offset: 0,
        scrollX,
        scrollY,
        mediaElement: mediaEl
      };
    }

    const currentTarget = this.host.getCurrentTarget();
    if (!currentTarget || !currentTarget.node) return null;

    const scrollParent = getScrollParent(currentTarget.node, containerRoot);
    const scrollX = scrollParent ? scrollParent.scrollLeft : (window.scrollX ?? window.pageXOffset ?? 0);
    const scrollY = scrollParent ? scrollParent.scrollTop : (window.scrollY ?? window.pageYOffset ?? 0);

    return {
      node: currentTarget.node,
      offset: currentTarget.offset,
      scrollX,
      scrollY
    };
  }

  /**
   * 記錄當前游標與視窗捲動位置至 Jump 歷史堆疊
   */
  public push(customPoint?: JumpPoint): void {
    const pointToPush = customPoint ?? this.captureCurrentPoint() ?? undefined;
    if (!pointToPush) return;

    const last = this.jumpHistory[this.jumpHistory.length - 1];
    if (
      last &&
      last.mediaElement === pointToPush.mediaElement &&
      last.node === pointToPush.node &&
      Math.abs(last.offset - pointToPush.offset) <= 2
    ) {
      this.lastJumpBackTarget = null;
      return;
    }

    if (this.jumpHistory.length >= this.MAX_JUMPS) {
      this.jumpHistory.shift();
    }

    this.jumpHistory.push(pointToPush);
    this.lastJumpBackTarget = null;
  }

  /**
   * 跳回前一跳轉點 / 復原位置
   * @param exact true 為精確字元 (``)，false 為跳至該行行首 ('')
   * 支援兩種模式：
   * 1. 'toggle' (預設)：Vim 經典雙點來回切換，在跳轉前與跳轉後兩點間反覆互換
   * 2. 'history'：沿著跳轉歷史堆疊依序回溯 (最多 30 步)
   */
  public jumpBack(exact: boolean = false): void {
    const jumpMode = cursorStore.getState().keybindings?.jumpMode || 'toggle';

    if (jumpMode === 'toggle') {
      // 1. 若已有 Toggle 恢復點 (剛才跳回前的位置)，切換回該位置
      if (this.lastJumpBackTarget) {
        const toggleTarget = this.lastJumpBackTarget;
        // 保存跳轉前當前位置作為下次 Toggle 目標
        this.lastJumpBackTarget = this.captureCurrentPoint();
        this.restoreJumpPoint(toggleTarget, exact);
        return;
      }

      // 2. 從歷史堆疊讀取最新一筆跳轉點 (不破壞堆疊)
      if (this.jumpHistory.length === 0) {
        return;
      }

      const targetPoint = this.jumpHistory[this.jumpHistory.length - 1];

      // 保存跳轉前當前位置作為 Toggle 目標
      this.lastJumpBackTarget = this.captureCurrentPoint();

      this.restoreJumpPoint(targetPoint, exact);
      return;
    }

    // History 模式：依序從堆疊回溯
    if (this.jumpHistory.length === 0) {
      return;
    }

    const targetPoint = this.jumpHistory.pop()!;
    this.restoreJumpPoint(targetPoint, exact);
  }

  private restoreJumpPoint(point: JumpPoint, exact: boolean = false): void {
    const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    this.host.triggerRearviewNotice(point.scrollY < currentScroll ? 'up' : 'down');
    const duration = cursorStore.getState().advanced?.scrollDurationMs ?? 380;
    this.host.clearPreferredX();

    if (point.mediaElement && point.mediaElement.isConnected) {
      this.host.enterMediaTarget(point.mediaElement, undefined, false);
      return;
    }

    this.host.clearMediaTarget();

    const options = this.host.getOptions();
    if (point.node && point.node.isConnected) {
      let target: TextTarget = {
        node: point.node as Text,
        offset: Math.min(point.offset, point.node.textContent?.length || 0)
      };

      // 若為行首模式 (如 '')，透過 CSSOM 精確計算真實視覺行首 (穿透 <b>, <span> 等標籤)
      if (!exact) {
        target = findVisualLineBoundary(target, true, this.host.getRootElement());
      }

      this.host.setCurrentTarget(target);
      this.host.updateActiveScope(target.node);
      this.host.updateCursorPosition(false, undefined, false, true);

      if (options?.enableScroll !== false) {
        scrollToPosition(target.node, options?.containerRoot, point.scrollY, duration);
      }
    } else if (options?.enableScroll !== false) {
      scrollToPosition(null, options?.containerRoot, point.scrollY, duration);
    }
  }

  public scheduleMenuOpen(exact: boolean, delayMs: number = 400): void {
    this.cancelMenuTimer();
    if (cursorStore.getState().keybindings?.enableJumpMenu === false || this.jumpHistory.length === 0) {
      return;
    }
    this.jumpMenuTimer = setTimeout(() => {
      this.jumpMenuTimer = null;
      this.openMenu(exact);
    }, delayMs);
  }

  public cancelMenuTimer(): void {
    if (this.jumpMenuTimer) {
      clearTimeout(this.jumpMenuTimer);
      this.jumpMenuTimer = null;
    }
  }

  public openMenu(exact: boolean = false): void {
    const config = cursorStore.getState().keybindings;
    if (config?.enableJumpMenu === false || this.jumpHistory.length === 0) {
      return;
    }

    this.isJumpMenuExact = exact;
    const recent = this.jumpHistory.slice(-9).reverse();
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    const items: JumpMenuItem[] = recent.map((p, idx) => {
      let snippet = '';
      if (p.mediaElement) {
        const tag = p.mediaElement.tagName.toUpperCase();
        const alt = (p.mediaElement as HTMLImageElement).alt?.trim();
        snippet = alt ? `[${tag}] ${alt.slice(0, 22)}` : `[${tag}]`;
      } else {
        const raw = p.node?.textContent || '';
        snippet = raw.slice(p.offset, p.offset + 25).trim() || raw.slice(0, 25).trim() || '(位置錨點)';
      }
      const scrollPercent = Math.min(100, Math.max(0, Math.round((p.scrollY / maxScroll) * 100)));
      return {
        index: idx + 1,
        textPreview: snippet,
        scrollPercent,
        point: p
      };
    });

    cursorStore.setState({ isJumpMenuOpen: true, jumpMenuItems: items });
  }

  public closeMenu(): void {
    this.cancelMenuTimer();
    if (cursorStore.getState().isJumpMenuOpen) {
      cursorStore.setState({ isJumpMenuOpen: false });
    }
  }

  public jumpToMenuItem(index: number): void {
    const items = cursorStore.getState().jumpMenuItems || [];
    const item = items.find((it) => it.index === index);
    if (item && item.point) {
      const exact = this.isJumpMenuExact;
      this.closeMenu();
      this.restoreJumpPoint(item.point, exact);
    }
  }

  public destroy(): void {
    this.cancelMenuTimer();
  }
}
