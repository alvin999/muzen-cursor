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

  private resolveTheme(state: CursorState) {
    const themeKey = state.theme || 'gruvbox-dark';
    const palette = (state.autoTheme && state.dynamicPalette)
      ? state.dynamicPalette
      : (THEME_PALETTES[themeKey] || THEME_PALETTES['gruvbox-dark']);
    const isLight = state.autoTheme
      ? state.detectedPageTheme === 'light'
      : (themeKey === 'gruvbox-light' || themeKey === 'intellij-light');
    return { palette, isLight };
  }

  private applyStyles(): void {
    // 容器基礎樣式 (頂部滿版寬度、沉浸毛玻璃膠囊面板，維持與網頁 1:1 水平相對位置)
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.right = '0';
    this.container.style.width = '100%';
    this.container.style.maxWidth = 'none';
    this.container.style.padding = '8px 0 10px 0';
    this.container.style.boxSizing = 'border-box';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '2147483647';
    this.container.style.display = 'none';
    this.container.style.opacity = '0';
    this.container.style.borderRadius = '0 0 14px 14px';
    this.container.style.backdropFilter = 'blur(20px)';
    this.container.style.setProperty('-webkit-backdrop-filter', 'blur(20px)');
    this.container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", sans-serif';
    this.container.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease';

    // 頂部徽章標籤欄
    this.headerEl.style.display = 'flex';
    this.headerEl.style.alignItems = 'center';
    this.headerEl.style.gap = '8px';
    this.headerEl.style.padding = '0 16px';
    this.headerEl.style.marginBottom = '6px';

    this.titleLabel.style.fontSize = '11px';
    this.titleLabel.style.fontWeight = '600';
    this.titleLabel.style.letterSpacing = '0.4px';

    this.sectionBadge.style.fontSize = '10.5px';
    this.sectionBadge.style.padding = '1px 6px';
    this.sectionBadge.style.borderRadius = '4px';
    this.sectionBadge.style.maxWidth = '360px';
    this.sectionBadge.style.whiteSpace = 'nowrap';
    this.sectionBadge.style.overflow = 'hidden';
    this.sectionBadge.style.textOverflow = 'ellipsis';

    // Canvas 局部快照預覽樣式 (與視窗等寬，不裁切左右邊界)
    this.canvasEl.style.display = 'none';
    this.canvasEl.style.borderRadius = '0';
    this.canvasEl.style.borderLeft = 'none';
    this.canvasEl.style.borderRight = 'none';
    this.canvasEl.style.width = '100%';
    this.canvasEl.style.maxWidth = 'none';
    this.canvasEl.style.height = 'auto';

    // 句子純文字備援
    this.contentEl.style.padding = '0 16px';
    this.contentEl.style.fontSize = '12.5px';
    this.contentEl.style.lineHeight = '1.45';
    this.contentEl.style.whiteSpace = 'normal';
    this.contentEl.style.wordBreak = 'break-word';
    this.contentEl.style.display = '-webkit-box';
    this.contentEl.style.webkitLineClamp = '2';
    this.contentEl.style.webkitBoxOrient = 'vertical';
    this.contentEl.style.overflow = 'hidden';

    this.applyThemeStyles(cursorStore.getState());
  }

  private applyThemeStyles(state: CursorState): void {
    const { palette, isLight } = this.resolveTheme(state);
    const { r, g, b } = palette.normal;

    this.container.style.background = isLight ? 'rgba(250, 248, 245, 0.92)' : 'rgba(20, 20, 20, 0.92)';
    this.container.style.border = 'none';
    this.container.style.borderBottom = `1px solid rgba(${r}, ${g}, ${b}, ${isLight ? 0.5 : 0.45})`;
    this.container.style.boxShadow = isLight
      ? `0 8px 28px rgba(0, 0, 0, 0.12), 0 0 16px rgba(${r}, ${g}, ${b}, 0.16)`
      : `0 16px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(${r}, ${g}, ${b}, 0.22)`;

    this.titleLabel.style.color = `rgba(${r}, ${g}, ${b}, 0.95)`;

    this.sectionBadge.style.background = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.10)';
    this.sectionBadge.style.color = isLight ? 'rgba(40, 40, 40, 0.85)' : 'rgba(235, 219, 178, 0.85)';

    const canvasBorder = isLight ? '1px solid rgba(0, 0, 0, 0.10)' : '1px solid rgba(255, 255, 255, 0.12)';
    this.canvasEl.style.borderTop = canvasBorder;
    this.canvasEl.style.borderBottom = canvasBorder;
    this.canvasEl.style.boxShadow = isLight ? 'inset 0 0 8px rgba(0, 0, 0, 0.08)' : 'inset 0 0 10px rgba(0, 0, 0, 0.5)';

    this.contentEl.style.color = isLight ? '#282828' : '#fbf1c7';
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
    } else if (this.isShown) {
      // 主題或智慧調色盤變更時即時更新外觀
      this.applyThemeStyles(state);
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

    this.applyThemeStyles(state);

    const dirArrow = notice.direction === 'up' ? '▲' : '▼';
    this.titleLabel.textContent = `🪞 ${dirArrow} 剛才讀到`;

    if (notice.sectionTitle && notice.sectionTitle.trim().length > 0) {
      this.sectionBadge.textContent = `§ ${notice.sectionTitle.trim()}`;
      this.sectionBadge.style.display = 'inline-block';
    } else {
      this.sectionBadge.style.display = 'none';
    }

    // 頂部滿版對齊，維持與視窗 1:1 水平位置
    this.container.style.top = '0';
    this.container.style.bottom = 'auto';
    this.container.style.transform = 'translate3d(0, -16px, 0)';

    this.container.style.display = 'block';
    this.container.style.opacity = '0';

    // 若有真實畫面快照與游標座標，以 Canvas 繪製與視窗等寬的局部畫面
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

    void this.container.offsetWidth; // 強制重繪

    this.container.style.opacity = '1';
    this.container.style.transform = 'translate3d(0, 0, 0)';
    this.isShown = true;

    // 常駐 2400ms 後優雅向上滑出淡出
    this.hideTimer = window.setTimeout(() => {
      this.hide();
    }, 2400);
  }

  /**
   * 將快照中游標上下周圍的真實網頁畫面裁切繪製至 Canvas（與視窗等寬以維持 1:1 水平相對位置），並標註游標外框
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

      // 預覽視窗尺寸 (CSS 像素，與視窗等寬)
      const targetW = this.container.clientWidth || window.innerWidth;
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

      // 水平方向不裁切 (srcCropX = 0)，確保與網頁維持 1:1 相對位置；僅垂直以游標為中心截取
      const srcCropX = 0;
      let srcCropY = (cursorY + cursorH / 2) - targetH / 2;
      srcCropY = Math.max(0, Math.min(window.innerHeight - targetH, srcCropY));

      // 轉換成圖片物理像素
      const sx = srcCropX * dpr;
      const sy = srcCropY * dpr;
      const sw = Math.min(img.naturalWidth, targetW * dpr);
      const sh = Math.min(img.naturalHeight - sy, targetH * dpr);
      const drawW = sw / dpr;
      const drawH = sh / dpr;

      // 繪製截圖局部
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, drawW, drawH);

      // 在裁切畫面上繪製「剛才游標所在的位置與高亮外框」
      const markX = cursorX - srcCropX;
      const markY = cursorY - srcCropY;

      // 取得當前主題色與明暗狀態
      const { palette, isLight } = this.resolveTheme(state);
      const cursorColor = palette.normal.hex;

      // 1. 繪製半透明文字高亮底色
      ctx.fillStyle = cursorColor;
      ctx.globalAlpha = 0.28;
      ctx.fillRect(markX - 2, markY - 1, cursorW + 4, cursorH + 2);

      // 2. 繪製精緻的游標邊框
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(markX - 2, markY - 1, cursorW + 4, cursorH + 2);

      // 3. 在兩側加上柔和暗角 (Vignette) 依明暗主題自動適配
      const vignetteRgb = isLight ? '250, 248, 245' : '20, 20, 20';
      const grad = ctx.createLinearGradient(0, 0, targetW, 0);
      grad.addColorStop(0, `rgba(${vignetteRgb}, 0.35)`);
      grad.addColorStop(0.06, `rgba(${vignetteRgb}, 0)`);
      grad.addColorStop(0.94, `rgba(${vignetteRgb}, 0)`);
      grad.addColorStop(1, `rgba(${vignetteRgb}, 0.35)`);
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
    this.container.style.transform = 'translate3d(0, -16px, 0)';

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
