import { cursorStore, CursorState, CursorTheme } from '../core/cursorStore';

interface ThemeColorSet {
  normal: { r: number; g: number; b: number; hex: string };
  visual: { r: number; g: number; b: number; hex: string };
}

const THEME_PALETTES: Record<CursorTheme, ThemeColorSet> = {
  'gruvbox-dark': {
    normal: { r: 254, g: 128, b: 25, hex: '#fe8019' }, // Gruvbox Orange
    visual: { r: 250, g: 189, b: 47, hex: '#fabd2f' }  // Gruvbox Yellow
  },
  'gruvbox-light': {
    normal: { r: 175, g: 58, b: 3, hex: '#af3a03' },   // Gruvbox Dark Rust
    visual: { r: 181, g: 118, b: 20, hex: '#b57614' }  // Gruvbox Dark Yellow
  },
  'tokyo-night': {
    normal: { r: 122, g: 162, b: 247, hex: '#7aa2f7' }, // Tokyo Blue
    visual: { r: 187, g: 154, b: 247, hex: '#bb9af7' }  // Tokyo Purple
  },
  'nord': {
    normal: { r: 136, g: 192, b: 208, hex: '#88c0d0' }, // Nord Frost Cyan
    visual: { r: 235, g: 203, b: 139, hex: '#ebcb8b' }  // Nord Aurora Yellow
  },
  'catppuccin': {
    normal: { r: 245, g: 194, b: 231, hex: '#f5c2e7' }, // Catppuccin Pink
    visual: { r: 203, g: 166, b: 247, hex: '#cba6f7' }  // Catppuccin Mauve
  },
  'everforest': {
    normal: { r: 167, g: 192, b: 128, hex: '#a7c080' }, // Everforest Green
    visual: { r: 219, g: 188, b: 127, hex: '#dbbc7f' }  // Everforest Gold
  }
};

/**
 * 沉浸式 Vim 游標覆蓋層 (Shadow DOM 內部渲染，支援呼吸燈與空心形態)
 */
export class VimCursorOverlay {
  private element: HTMLElement;
  private styleSheet: HTMLStyleElement;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'muzen-cursor-overlay';

    this.styleSheet = document.createElement('style');
    this.styleSheet.textContent = `
      @keyframes muzen-breathe {
        0%, 100% {
          opacity: 0.92;
          filter: drop-shadow(0 0 3px var(--muzen-glow, rgba(254, 128, 25, 0.6)));
        }
        50% {
          opacity: 0.38;
          filter: drop-shadow(0 0 12px var(--muzen-glow, rgba(254, 128, 25, 0.8)));
        }
      }
      @keyframes muzen-blink {
        0%, 49% { opacity: 0.9; }
        50%, 100% { opacity: 0.05; }
      }
    `;

    this.applyBaseStyles();
    this.bindStore();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public getStyleSheet(): HTMLStyleElement {
    return this.styleSheet;
  }

  private applyBaseStyles(): void {
    this.element.style.position = 'fixed';
    this.element.style.pointerEvents = 'none';
    this.element.style.zIndex = '2147483647';
    this.element.style.top = '0px';
    this.element.style.left = '0px';
    this.element.style.boxSizing = 'border-box';
    this.element.style.borderRadius = '2px';
    this.element.style.willChange = 'transform, width, height, opacity, box-shadow';
    this.element.style.transition = 'transform 0.08s cubic-bezier(0.2, 0, 0, 1), width 0.08s ease, height 0.08s ease';
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

    // 1. 取得配色票券
    const themeKey = state.theme || 'gruvbox-dark';
    const palette = THEME_PALETTES[themeKey] || THEME_PALETTES['gruvbox-dark'];
    const color = state.mode === 'VISUAL' ? palette.visual : palette.normal;

    // 設定 CSS 變數供呼吸動畫引用
    this.element.style.setProperty('--muzen-glow', `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`);

    // 2. 依據游標形態 (Shape) 調整幾何與渲染
    const shape = state.shape || 'block';
    let targetX = state.rect.x;
    let targetY = state.rect.y;
    let targetW = Math.max(state.rect.width, 2);
    let targetH = state.rect.height;

    switch (shape) {
      case 'hollow': // 空心外框：文字完全清晰可見，高對比外框錨定
        this.element.style.background = `rgba(${color.r}, ${color.g}, ${color.b}, 0.05)`;
        this.element.style.border = `2px solid ${color.hex}`;
        this.element.style.boxShadow = `0 0 6px rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`;
        break;

      case 'underline': // 閱讀底線：高度 3px 貼齊文字基線底部
        this.element.style.background = color.hex;
        this.element.style.border = 'none';
        this.element.style.boxShadow = `0 0 6px rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`;
        targetH = 3;
        targetY = state.rect.y + state.rect.height - 3;
        break;

      case 'block': // 經典實心方塊
      default:
        this.element.style.background = state.mode === 'VISUAL'
          ? `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`
          : `rgba(${color.r}, ${color.g}, ${color.b}, 0.75)`;
        this.element.style.border = `1px solid ${color.hex}`;
        this.element.style.boxShadow = `0 0 8px rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`;
        break;
    }

    // 3. 依據動態特效 (Effects: smooth, breathe, blink)
    const effects = state.effects || { smooth: true, breathe: true, blink: false };

    // 平滑位移控制
    if (effects.smooth) {
      this.element.style.transition = 'transform 0.08s cubic-bezier(0.2, 0, 0, 1), width 0.08s ease, height 0.08s ease';
    } else {
      this.element.style.transition = 'none';
    }

    // 複合動畫組合 (breathe, blink)
    const animList: string[] = [];
    if (effects.breathe) {
      animList.push('muzen-breathe 2.4s ease-in-out infinite');
    }
    if (effects.blink) {
      animList.push('muzen-blink 1s steps(2, start) infinite');
    }

    if (animList.length > 0) {
      this.element.style.animation = animList.join(', ');
    } else {
      this.element.style.animation = 'none';
      this.element.style.opacity = '0.9';
    }

    // 4. 利用 translate3d 走 GPU 合成層渲染
    this.element.style.width = `${targetW}px`;
    this.element.style.height = `${targetH}px`;
    this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.element.remove();
    this.styleSheet.remove();
  }
}
