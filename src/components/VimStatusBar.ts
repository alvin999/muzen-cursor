import { cursorStore, CursorState } from '../core/cursorStore';

/**
 * 底部沉浸式 Vim 狀態列 (Shadow DOM 內部渲染)
 */
export class VimStatusBar {
  private element: HTMLElement;
  private modeEl: HTMLElement;
  private infoEl: HTMLElement;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'muzen-status-bar';

    this.modeEl = document.createElement('span');
    this.modeEl.className = 'muzen-mode-badge';

    this.infoEl = document.createElement('span');
    this.infoEl.className = 'muzen-info-badge';

    this.element.appendChild(this.modeEl);
    this.element.appendChild(this.infoEl);

    this.applyStyles();
    this.bindStore();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  private applyStyles(): void {
    this.element.style.position = 'fixed';
    this.element.style.bottom = '16px';
    this.element.style.right = '20px';
    this.element.style.zIndex = '2147483646';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.gap = '8px';
    this.element.style.fontFamily = 'monospace, ui-monospace, SFMono-Regular, Menlo, Consolas';
    this.element.style.fontSize = '12px';
    this.element.style.lineHeight = '1';
    this.element.style.padding = '4px 10px';
    this.element.style.borderRadius = '4px';
    this.element.style.background = 'rgba(40, 40, 40, 0.85)';
    this.element.style.backdropFilter = 'blur(6px)';
    this.element.style.border = '1px solid rgba(235, 219, 178, 0.15)';
    this.element.style.color = '#ebdbb2';
    this.element.style.pointerEvents = 'none';
    this.element.style.userSelect = 'none';
    this.element.style.opacity = '0';
    this.element.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    this.element.style.transform = 'translateY(4px)';

    this.modeEl.style.fontWeight = 'bold';
    this.modeEl.style.letterSpacing = '1px';

    this.infoEl.style.opacity = '0.7';
  }

  private bindStore(): void {
    this.unsubscribe = cursorStore.subscribe((state: CursorState) => {
      this.render(state);
    });
  }

  private render(state: CursorState): void {
    if (!state.enabled || state.showStatusBar === false) {
      this.element.style.opacity = '0';
      this.element.style.transform = 'translateY(4px)';
      return;
    }

    this.element.style.opacity = '1';
    this.element.style.transform = 'translateY(0)';

    if (!state.visible) {
      this.modeEl.textContent = 'MUZEN';
      this.modeEl.style.color = '#fe8019';
      this.infoEl.textContent = '點擊文字或按 j 開始';
      return;
    }

    if (state.mode === 'VISUAL') {
      this.modeEl.textContent = '-- VISUAL --';
      this.modeEl.style.color = '#fabd2f'; // Gruvbox Yellow
    } else {
      this.modeEl.textContent = '-- NORMAL --';
      this.modeEl.style.color = '#b8bb26'; // Gruvbox Green
    }

    this.infoEl.textContent = `[${Math.round(state.readingProgress)}%]`;
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.element.remove();
  }
}
