import { cursorStore, CursorState } from '../core/cursorStore';

/**
 * 翻頁回溯後照鏡 HUD (Rearview Mirror HUD)
 * 當觸發大幅度半頁跳轉 (u/d) 或全文跳轉時，像車用後照鏡般優雅浮現剛才出發點的句子上下文，
 * 讓讀者大腦秒速對齊閱讀記憶，徹底消除「翻了半頁不知道剛才讀到哪」的焦慮。
 */
export class VimRearviewMirror {
  private container: HTMLElement;
  private headerEl: HTMLElement;
  private titleLabel: HTMLElement;
  private sectionBadge: HTMLElement;
  private contentEl: HTMLElement;

  private unsubscribe: (() => void) | null = null;
  private hideTimer: number | null = null;
  private lastTimestamp = 0;
  private isShown = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'muzen-rearview-mirror';

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'muzen-rearview-header';

    this.titleLabel = document.createElement('span');
    this.titleLabel.className = 'muzen-rearview-title';
    this.titleLabel.textContent = '🪞 剛才讀到';

    this.sectionBadge = document.createElement('span');
    this.sectionBadge.className = 'muzen-rearview-section';
    this.sectionBadge.style.display = 'none';

    this.headerEl.appendChild(this.titleLabel);
    this.headerEl.appendChild(this.sectionBadge);

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'muzen-rearview-content';

    this.container.appendChild(this.headerEl);
    this.container.appendChild(this.contentEl);

    this.applyStyles();
    this.bindStore();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private applyStyles(): void {
    // 容器基礎樣式 (固定置中、沉浸毛玻璃深色膠囊面板)
    this.container.style.position = 'fixed';
    this.container.style.left = '50%';
    this.container.style.width = 'max-content';
    this.container.style.maxWidth = 'min(520px, calc(100vw - 40px))';
    this.container.style.padding = '8px 16px 9px 16px';
    this.container.style.boxSizing = 'border-box';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '2147483647';
    this.container.style.display = 'none';
    this.container.style.opacity = '0';
    this.container.style.borderRadius = '16px';
    this.container.style.background = 'rgba(24, 24, 24, 0.90)';
    this.container.style.backdropFilter = 'blur(16px)';
    this.container.style.setProperty('-webkit-backdrop-filter', 'blur(16px)');
    this.container.style.border = '1px solid rgba(254, 128, 25, 0.45)';
    this.container.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.60), 0 0 16px rgba(254, 128, 25, 0.22)';
    this.container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", sans-serif';
    this.container.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease';

    // 頂部徽章標籤欄
    this.headerEl.style.display = 'flex';
    this.headerEl.style.alignItems = 'center';
    this.headerEl.style.gap = '8px';
    this.headerEl.style.marginBottom = '4px';

    this.titleLabel.style.fontSize = '11px';
    this.titleLabel.style.fontWeight = '600';
    this.titleLabel.style.color = 'rgba(254, 128, 25, 0.95)';
    this.titleLabel.style.letterSpacing = '0.4px';

    this.sectionBadge.style.fontSize = '10.5px';
    this.sectionBadge.style.padding = '1px 6px';
    this.sectionBadge.style.borderRadius = '4px';
    this.sectionBadge.style.background = 'rgba(255, 255, 255, 0.10)';
    this.sectionBadge.style.color = 'rgba(235, 219, 178, 0.85)';
    this.sectionBadge.style.maxWidth = '220px';
    this.sectionBadge.style.whiteSpace = 'nowrap';
    this.sectionBadge.style.overflow = 'hidden';
    this.sectionBadge.style.textOverflow = 'ellipsis';

    // 句子本文
    this.contentEl.style.fontSize = '12.5px';
    this.contentEl.style.lineHeight = '1.45';
    this.contentEl.style.color = '#fbf1c7';
    this.contentEl.style.whiteSpace = 'normal';
    this.contentEl.style.wordBreak = 'break-word';
    this.contentEl.style.display = '-webkit-box';
    this.contentEl.style.webkitLineClamp = '2';
    this.contentEl.style.webkitBoxOrient = 'vertical';
    this.contentEl.style.overflow = 'hidden';
  }

  private bindStore(): void {
    this.unsubscribe = cursorStore.subscribe((state: CursorState) => {
      this.render(state);
    });
  }

  private render(state: CursorState): void {
    const notice = state.rearviewNotice;
    const isEnabled = state.effects?.rearviewMirror !== false;

    if (!isEnabled || !notice) {
      if (this.isShown && !notice) {
        this.hide();
      }
      return;
    }

    if (notice.timestamp !== this.lastTimestamp) {
      this.lastTimestamp = notice.timestamp;
      this.show(notice.text, notice.direction, notice.sectionTitle);
    }
  }

  private show(text: string, direction: 'up' | 'down', sectionTitle?: string): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    const dirArrow = direction === 'up' ? '▲' : '▼';
    this.titleLabel.textContent = `🪞 ${dirArrow} 剛才讀到`;
    this.contentEl.textContent = text;

    if (sectionTitle && sectionTitle.trim().length > 0) {
      this.sectionBadge.textContent = `§ ${sectionTitle.trim()}`;
      this.sectionBadge.style.display = 'inline-block';
    } else {
      this.sectionBadge.style.display = 'none';
    }

    // 固定置於螢幕頂部中央，進場時從上方微滑入
    this.container.style.top = '18px';
    this.container.style.bottom = 'auto';
    this.container.style.transform = 'translate3d(-50%, -20px, 0) scale(0.96)';

    this.container.style.display = 'block';
    this.container.style.opacity = '0';
    void this.container.offsetWidth; // 強制重繪

    this.container.style.opacity = '1';
    this.container.style.transform = 'translate3d(-50%, 0, 0) scale(1)';
    this.isShown = true;

    // 常駐 2000ms 後優雅向上滑出淡出
    this.hideTimer = window.setTimeout(() => {
      this.hide();
    }, 2000);
  }

  private hide(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.container.style.opacity = '0';
    this.container.style.transform = 'translate3d(-50%, -16px, 0) scale(0.96)';

    this.hideTimer = window.setTimeout(() => {
      this.container.style.display = 'none';
      this.isShown = false;
      this.hideTimer = null;
    }, 260);
  }

  public destroy(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.container.remove();
  }
}
