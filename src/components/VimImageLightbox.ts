import { cursorStore, CursorState } from '../core/cursorStore';

export type LightboxCommand = 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'zoomIn' | 'zoomOut' | 'close';

/**
 * 沉浸式圖片燈箱檢視器 (Shadow DOM 隔離樣式)
 * 沿用 Vim 直覺鍵位：h/j/k/l 平移、d/u 縮放、Esc 關閉
 */
export class VimImageLightbox {
  private container: HTMLElement;
  private imgEl: HTMLImageElement;
  private infoEl: HTMLElement;
  private unsubscribe: (() => void) | null = null;
  private commandListener: ((e: Event) => void) | null = null;

  private isOpen = false;
  private scale = 1; // 1 = fit-to-screen, >1 = zoomed
  private isZoomed = false;
  private panX = 0;
  private panY = 0;
  private naturalWidth = 0;
  private naturalHeight = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = [
      'position: fixed',
      'inset: 0',
      'z-index: 2147483647',
      'background: rgba(12, 12, 16, 0.92)',
      'backdrop-filter: blur(8px)',
      '-webkit-backdrop-filter: blur(8px)',
      'display: none',
      'align-items: center',
      'justify-content: center',
      'flex-direction: column',
      'pointer-events: auto',
      'overflow: hidden',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ].join(';');

    this.imgEl = document.createElement('img');
    this.imgEl.style.cssText = [
      'max-width: 92vw',
      'max-height: 86vh',
      'object-fit: contain',
      'border-radius: 6px',
      'box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65)',
      'transition: transform 0.14s cubic-bezier(0.22, 1, 0.36, 1)',
      'user-select: none',
      'will-change: transform'
    ].join(';');

    this.infoEl = document.createElement('div');
    this.infoEl.style.cssText = [
      'position: fixed',
      'bottom: 20px',
      'left: 50%',
      'transform: translateX(-50%)',
      'padding: 6px 14px',
      'border-radius: 999px',
      'background: rgba(24, 24, 30, 0.85)',
      'border: 1px solid rgba(255, 255, 255, 0.14)',
      'color: #e4e4e7',
      'font-size: 12px',
      'letter-spacing: 0.3px',
      'white-space: nowrap',
      'pointer-events: none',
      'box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4)'
    ].join(';');

    this.container.appendChild(this.imgEl);
    this.container.appendChild(this.infoEl);

    // 點擊背景遮罩關閉燈箱
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        cursorStore.setState({ lightboxImage: null });
      }
    });

    this.commandListener = (e: Event) => {
      const customEvent = e as CustomEvent<{ command: LightboxCommand }>;
      if (!this.isOpen || !customEvent.detail) return;
      this.handleCommand(customEvent.detail.command);
    };
    window.addEventListener('muzen-lightbox-command', this.commandListener);

    this.unsubscribe = cursorStore.subscribe((state) => {
      this.render(state);
    });
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private render(state: CursorState): void {
    const imgState = state.lightboxImage;
    if (!imgState || !imgState.src) {
      if (this.isOpen) {
        this.isOpen = false;
        this.container.style.display = 'none';
        this.imgEl.src = '';
        this.resetTransform();
      }
      return;
    }

    if (!this.isOpen || this.imgEl.src !== imgState.src) {
      this.isOpen = true;
      this.naturalWidth = imgState.naturalWidth || 0;
      this.naturalHeight = imgState.naturalHeight || 0;
      this.resetTransform();
      this.imgEl.src = imgState.src;
      this.imgEl.alt = imgState.alt || '';
      this.container.style.display = 'flex';
      this.updateInfoBar(imgState.alt);
    }
  }

  private resetTransform(): void {
    this.isZoomed = false;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  private handleCommand(cmd: LightboxCommand): void {
    const panStep = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.14);

    if (cmd === 'close') {
      cursorStore.setState({ lightboxImage: null });
      return;
    }

    if (cmd === 'zoomIn') {
      if (!this.isZoomed) {
        this.isZoomed = true;
        // 若原圖比目前 fit 顯示大很多，計算接近 1:1 或至少 1.8 倍放大
        const rect = this.imgEl.getBoundingClientRect();
        const fitRatio = rect.width > 0 && this.naturalWidth > 0 ? this.naturalWidth / rect.width : 1.8;
        this.scale = Math.max(1.8, Math.min(4, fitRatio));
      } else {
        this.scale = Math.min(4, Number((this.scale + 0.6).toFixed(2)));
      }
      this.clampPan();
      this.applyTransform();
      this.updateInfoBar(this.imgEl.alt);
      return;
    }

    if (cmd === 'zoomOut') {
      if (!this.isZoomed) return;
      const nextScale = Number((this.scale - 0.6).toFixed(2));
      if (nextScale <= 1.15) {
        this.resetTransform();
      } else {
        this.scale = nextScale;
        this.clampPan();
        this.applyTransform();
      }
      this.updateInfoBar(this.imgEl.alt);
      return;
    }

    // 平移操作：以當前可視內容方向移動（按 j 往下看圖，畫面往上移）
    if (cmd === 'panLeft') this.panX += panStep;
    else if (cmd === 'panRight') this.panX -= panStep;
    else if (cmd === 'panUp') this.panY += panStep;
    else if (cmd === 'panDown') this.panY -= panStep;

    this.clampPan();
    this.applyTransform();
  }

  private clampPan(): void {
    if (!this.isZoomed || this.scale <= 1) {
      this.panX = 0;
      this.panY = 0;
      return;
    }
    const baseW = this.imgEl.clientWidth || window.innerWidth * 0.8;
    const baseH = this.imgEl.clientHeight || window.innerHeight * 0.8;
    const maxPanX = Math.max(0, (baseW * this.scale - window.innerWidth * 0.85) / 2);
    const maxPanY = Math.max(0, (baseH * this.scale - window.innerHeight * 0.85) / 2);

    this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
    this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));
  }

  private applyTransform(): void {
    this.imgEl.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.scale})`;
    this.imgEl.style.cursor = this.isZoomed ? 'grab' : 'zoom-in';
  }

  private updateInfoBar(alt?: string): void {
    const dimText = this.naturalWidth > 0 && this.naturalHeight > 0
      ? `${this.naturalWidth}×${this.naturalHeight}`
      : '';
    const zoomText = this.isZoomed ? `${Math.round(this.scale * 100)}%` : 'Fit';
    const altText = alt ? ` · ${alt.slice(0, 32)}${alt.length > 32 ? '…' : ''}` : '';
    const prefix = [dimText, zoomText].filter(Boolean).join(' · ');
    this.infoEl.textContent = `${prefix}${altText}  |  h/j/k/l 平移 · d/u 縮放 · Esc 關閉`;
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.commandListener) {
      window.removeEventListener('muzen-lightbox-command', this.commandListener);
      this.commandListener = null;
    }
    this.container.remove();
  }
}
