import { cursorStore, CursorState } from '../core/cursorStore';

/**
 * 沉浸式 Vim 游標覆蓋層 (Shadow DOM 內部渲染)
 */
export class VimCursorOverlay {
  private element: HTMLElement;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'muzen-cursor-overlay';
    this.applyStyles();
    this.bindStore();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  private applyStyles(): void {
    // 注入游標 CSS 樣式至內部
    this.element.style.position = 'fixed';
    this.element.style.pointerEvents = 'none';
    this.element.style.zIndex = '2147483647';
    this.element.style.top = '0px';
    this.element.style.left = '0px';
    this.element.style.boxSizing = 'border-box';
    this.element.style.borderRadius = '2px';
    this.element.style.willChange = 'transform, width, height, opacity';
    this.element.style.transition = 'transform 0.08s cubic-bezier(0.2, 0, 0, 1), width 0.08s ease, height 0.08s ease, opacity 0.15s ease';
    this.element.style.opacity = '0';
    this.element.style.display = 'none';
  }

  private bindStore(): void {
    this.unsubscribe = cursorStore.subscribe((state: CursorState) => {
      this.render(state);
    });
  }

  private render(state: CursorState): void {
    if (!state.enabled || !state.visible) {
      this.element.style.opacity = '0';
      this.element.style.display = 'none';
      return;
    }

    this.element.style.display = 'block';
    this.element.style.opacity = '0.9';

    // 依據模式與主題配置顏色
    if (state.mode === 'VISUAL') {
      this.element.style.background = 'rgba(215, 153, 33, 0.4)'; // Gruvbox Yellow
      this.element.style.border = '1px solid #d79921';
      this.element.style.boxShadow = '0 0 10px rgba(215, 153, 33, 0.5)';
    } else {
      // NORMAL MODE (Gruvbox Orange / Zen Amber)
      this.element.style.background = 'rgba(254, 128, 25, 0.75)'; // Gruvbox Orange
      this.element.style.border = '1px solid #fe8019';
      this.element.style.boxShadow = '0 0 8px rgba(254, 128, 25, 0.6)';
    }

    // 利用 translate3d 走 GPU 合成層渲染
    this.element.style.width = `${Math.max(state.rect.width, 2)}px`;
    this.element.style.height = `${state.rect.height}px`;
    this.element.style.transform = `translate3d(${state.rect.x}px, ${state.rect.y}px, 0)`;
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.element.remove();
  }
}
