import { cursorStore, CursorState, CursorRect } from '../core/cursorStore';
import { THEME_PALETTES } from './VimCursorOverlay';

/**
 * 翻頁回溯後照鏡 HUD (Rearview Mirror HUD)
 * 當觸發大幅度半頁跳轉 (u/d) 或全文跳轉時，像車用後照鏡般優雅浮現剛才出發點的真實畫面局部截圖，
 * 並在畫面上精準標記出發時游標停駐的位置，讓讀者大腦一眼對齊視覺記憶，徹底消除認知阻礙。
 */
export class VimRearviewMirror {
  private container: HTMLElement;
  private headerEl: HTMLElement;
  private titleLabel: HTMLElement;
  private sectionBadge: HTMLElement;
  private contentEl: HTMLElement;
  private canvasEl: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D | null;

  private unsubscribe: (() => void) | null = null;
  private hideTimer: number | null = null;
  private lastTimestamp = 0;
  private isShown = false;
  private currentImageObj: HTMLImageElement | null = null;

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

    // 畫面截圖局部預覽 Canvas
    this.canvasEl = document.createElement('canvas');
    this.canvasEl.className = 'muzen-rearview-canvas';
    this.canvasCtx = this.canvasEl.getContext('2d');

    // 文字備援容器
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'muzen-rearview-content';

    this.container.appendChild(this.headerEl);
    this.container.appendChild(this.canvasEl);
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
    this.container.style.maxWidth = 'min(540px, calc(100vw - 32px))';
    this.container.style.padding = '8px 12px 10px 12px';
    this.container.style.boxSizing = 'border-box';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '2147483647';
    this.container.style.display = 'none';
    this.container.style.opacity = '0';
    this.container.style.borderRadius = '16px';
    this.container.style.background = 'rgba(20, 20, 20, 0.92)';
    this.container.style.backdropFilter = 'blur(20px)';
    this.container.style.setProperty('-webkit-backdrop-filter', 'blur(20px)');
    this.container.style.border = '1px solid rgba(254, 128, 25, 0.45)';
    this.container.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(254, 128, 25, 0.22)';
    this.container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", sans-serif';
    this.container.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease';

    // 頂部徽章標籤欄
    this.headerEl.style.display = 'flex';
    this.headerEl.style.alignItems = 'center';
    this.headerEl.style.gap = '8px';
    this.headerEl.style.marginBottom = '6px';

    this.titleLabel.style.fontSize = '11px';
    this.titleLabel.style.fontWeight = '600';
    this.titleLabel.style.color = 'rgba(254, 128, 25, 0.95)';
    this.titleLabel.style.letterSpacing = '0.4px';

    this.sectionBadge.style.fontSize = '10.5px';
    this.sectionBadge.style.padding = '1px 6px';
    this.sectionBadge.style.borderRadius = '4px';
    this.sectionBadge.style.background = 'rgba(255, 255, 255, 0.10)';
    this.sectionBadge.style.color = 'rgba(235, 219, 178, 0.85)';
    this.sectionBadge.style.maxWidth = '240px';
    this.sectionBadge.style.whiteSpace = 'nowrap';
    this.sectionBadge.style.overflow = 'hidden';
    this.sectionBadge.style.textOverflow = 'ellipsis';

    // Canvas 局部快照預覽樣式
    this.canvasEl.style.display = 'none';
    this.canvasEl.style.borderRadius = '8px';
    this.canvasEl.style.border = '1px solid rgba(255, 255, 255, 0.12)';
    this.canvasEl.style.boxShadow = 'inset 0 0 10px rgba(0, 0, 0, 0.5)';
    this.canvasEl.style.width = '100%';
    this.canvasEl.style.maxWidth = '480px';
    this.canvasEl.style.height = 'auto';

    // 句子純文字備援
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
      this.show(notice, state);
    }
  }

  private show(
    notice: NonNullable<CursorState['rearviewNotice']>,
    state: CursorState
  ): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    const dirArrow = notice.direction === 'up' ? '▲' : '▼';
    this.titleLabel.textContent = `🪞 ${dirArrow} 剛才讀到`;

    if (notice.sectionTitle && notice.sectionTitle.trim().length > 0) {
      this.sectionBadge.textContent = `§ ${notice.sectionTitle.trim()}`;
      this.sectionBadge.style.display = 'inline-block';
    } else {
      this.sectionBadge.style.display = 'none';
    }

    // 若有真實畫面快照與游標座標，以 Canvas 繪製局部畫面
    if (notice.snapshotUrl && notice.cursorRect && this.canvasCtx) {
      this.contentEl.style.display = 'none';
      this.canvasEl.style.display = 'block';
      this.renderSnapshot(notice.snapshotUrl, notice.cursorRect, notice.devicePixelRatio || 1, state);
    } else {
      // 否則退回文字摘要
      this.canvasEl.style.display = 'none';
      this.contentEl.style.display = '-webkit-box';
      this.contentEl.textContent = notice.text;
    }

    // 依據跳轉方向微調進場位置：往下跳時後照鏡置頂（剛才在上方）；往上跳時也可置頂但標明向上
    this.container.style.top = '18px';
    this.container.style.bottom = 'auto';
    this.container.style.transform = 'translate3d(-50%, -20px, 0) scale(0.96)';

    this.container.style.display = 'block';
    this.container.style.opacity = '0';
    void this.container.offsetWidth; // 強制重繪

    this.container.style.opacity = '1';
    this.container.style.transform = 'translate3d(-50%, 0, 0) scale(1)';
    this.isShown = true;

    // 常駐 2400ms 後優雅向上滑出淡出
    this.hideTimer = window.setTimeout(() => {
      this.hide();
    }, 2400);
  }

  /**
   * 將快照中游標上下周圍的真實網頁畫面裁切繪製至 Canvas，並標註游標外框
   */
  private renderSnapshot(
    snapshotUrl: string,
    cursorRect: CursorRect,
    dpr: number,
    state: CursorState
  ): void {
    const img = new Image();
    this.currentImageObj = img;
    img.onload = () => {
      if (this.currentImageObj !== img || !this.canvasCtx) return;

      const canvas = this.canvasEl;
      const ctx = this.canvasCtx;

      // 預覽視窗尺寸 (CSS 像素)
      const targetW = Math.min(480, window.innerWidth - 60);
      const targetH = 92;

      // Canvas 真實物理像素
      canvas.width = targetW * dpr;
      canvas.height = targetH * dpr;
      canvas.style.width = `${targetW}px`;
      canvas.style.height = `${targetH}px`;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 來源截圖像素座標 (img 物理像素 = 視窗 CSS 像素 * dpr)
      const cursorX = cursorRect.x;
      const cursorY = cursorRect.y;
      const cursorW = cursorRect.width;
      const cursorH = cursorRect.height;

      // 計算以游標中心為基準的截取範圍 (CSS 座標)
      let srcCropX = (cursorX + cursorW / 2) - targetW / 2;
      let srcCropY = (cursorY + cursorH / 2) - targetH / 2;

      // 避免超出視窗左側或頂部
      srcCropX = Math.max(0, Math.min(window.innerWidth - targetW, srcCropX));
      srcCropY = Math.max(0, Math.min(window.innerHeight - targetH, srcCropY));

      // 轉換成圖片物理像素
      const sx = srcCropX * dpr;
      const sy = srcCropY * dpr;
      const sw = targetW * dpr;
      const sh = targetH * dpr;

      // 繪製截圖局部
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

      // 在裁切畫面上繪製「剛才游標所在的位置與高亮外框」
      const markX = cursorX - srcCropX;
      const markY = cursorY - srcCropY;

      // 取得當前主題色
      const themePalette = THEME_PALETTES[state.theme] || THEME_PALETTES['gruvbox-dark'];
      const cursorColor = state.dynamicPalette?.normal?.hex || themePalette.normal.hex;

      // 1. 繪製半透明文字高亮底色
      ctx.fillStyle = cursorColor;
      ctx.globalAlpha = 0.28;
      ctx.fillRect(markX - 2, markY - 1, cursorW + 4, cursorH + 2);

      // 2. 繪製精緻的游標邊框
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(markX - 2, markY - 1, cursorW + 4, cursorH + 2);

      // 3. 在兩側加上柔和暗角 (Vignette) 強化聚焦點
      const grad = ctx.createLinearGradient(0, 0, targetW, 0);
      grad.addColorStop(0, 'rgba(20, 20, 20, 0.45)');
      grad.addColorStop(0.12, 'rgba(20, 20, 20, 0)');
      grad.addColorStop(0.88, 'rgba(20, 20, 20, 0)');
      grad.addColorStop(1, 'rgba(20, 20, 20, 0.45)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 1.0;
      ctx.fillRect(0, 0, targetW, targetH);

      ctx.restore();
    };
    img.src = snapshotUrl;
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
