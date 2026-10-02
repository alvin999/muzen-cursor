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
  },
  'intellij-darcula': {
    normal: { r: 56, g: 159, b: 214, hex: '#389fd6' },  // IntelliJ Blue
    visual: { r: 255, g: 198, b: 109, hex: '#ffc66d' }  // Darcula Amber Yellow
  },
  'intellij-light': {
    normal: { r: 53, g: 116, b: 240, hex: '#3574f0' },  // IntelliJ Accent Blue
    visual: { r: 229, g: 168, b: 75, hex: '#e5a84b' }   // Warm Amber Gold
  },
  'dracula': {
    normal: { r: 189, g: 147, b: 249, hex: '#bd93f9' }, // Dracula Purple
    visual: { r: 80, g: 250, b: 123, hex: '#50fa7b' }   // Dracula Green
  },
  'monokai': {
    normal: { r: 249, g: 38, b: 114, hex: '#f92672' },  // Monokai Pink
    visual: { r: 230, g: 219, b: 116, hex: '#e6db74' }  // Monokai Yellow
  },
  'one-dark': {
    normal: { r: 97, g: 175, b: 239, hex: '#61afef' },  // One Dark Blue
    visual: { r: 229, g: 192, b: 123, hex: '#e5c07b' }  // One Dark Gold
  },
  'solarized-dark': {
    normal: { r: 42, g: 161, b: 152, hex: '#2aa198' },  // Solarized Cyan
    visual: { r: 181, g: 137, b: 0, hex: '#b58900' }    // Solarized Yellow
  },
  'rose-pine': {
    normal: { r: 235, g: 111, b: 146, hex: '#eb6f92' }, // Rosé Rose Pink
    visual: { r: 246, g: 193, b: 119, hex: '#f6c177' }  // Rosé Gold
  },
  'cyberpunk': {
    normal: { r: 0, g: 240, b: 255, hex: '#00f0ff' },   // Cyberpunk Neon Cyan
    visual: { r: 255, g: 230, b: 0, hex: '#ffe600' }    // Cyberpunk Neon Yellow
  }
};

/**
 * 沉浸式 Vim 游標覆蓋層 (Shadow DOM 內部渲染，支援呼吸燈與空心形態)
 */
export class VimCursorOverlay {
  private element: HTMLElement;
  private styleSheet: HTMLStyleElement;
  private unsubscribe: (() => void) | null = null;
  private settleTimer: number | null = null;
  private lastRenderedSeq = 0;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'muzen-cursor-overlay';

    this.styleSheet = document.createElement('style');
    this.styleSheet.textContent = `
      @keyframes muzen-breathe {
        0%, 100% {
          opacity: 0;
          filter: none;
        }
        40% {
          opacity: 0.96;
          filter: var(--muzen-breathe-filter-max, none);
        }
        50% {
          opacity: 0.93;
          filter: var(--muzen-breathe-filter-peak, none);
        }
        85% {
          opacity: 0.15;
          filter: none;
        }
      }
      @keyframes muzen-blink {
        0%, 54%  { opacity: 1; }
        57%, 88% { opacity: 0; }
        92%, 100%{ opacity: 1; }
      }
      ::selection {
        background: var(--muzen-selection-bg, rgba(254, 128, 25, 0.35)) !important;
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
    if (!state.enabled || !state.visible || state.isExcluded) {
      this.element.style.opacity = '0';
      this.element.style.display = 'none';
      return;
    }

    this.element.style.display = 'block';

    // 1. 取得配色票券
    const themeKey = state.theme || 'gruvbox-dark';
    const palette = THEME_PALETTES[themeKey] || THEME_PALETTES['gruvbox-dark'];
    const color = state.mode === 'VISUAL' ? palette.visual : palette.normal;

    // 同步 mugen-yomu 主題選取透明效果 (35% 半透明高對比底色)
    const visualColor = palette.visual;
    document.documentElement.style.setProperty(
      '--muzen-selection-bg',
      `rgba(${visualColor.r}, ${visualColor.g}, ${visualColor.b}, 0.35)`
    );

    // 設定 CSS 變數供呼吸動畫引用
    this.element.style.setProperty('--muzen-glow', `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`);
    this.element.style.setProperty('--muzen-glow-core', `rgba(${color.r}, ${color.g}, ${color.b}, 0.85)`);
    this.element.style.setProperty('--muzen-glow-halo', `rgba(${color.r}, ${color.g}, ${color.b}, 0.45)`);

    // 處理光暈 (Glow Intensity: 0 為無光暈)
    const glow = typeof state.glow === 'number' ? Math.max(0, state.glow) : 0;
    if (glow <= 0) {
      this.element.style.setProperty('--muzen-breathe-filter-min', 'none');
      this.element.style.setProperty('--muzen-breathe-filter-peak', 'none');
      this.element.style.setProperty('--muzen-breathe-filter-max', 'none');
    } else {
      const coreMin = Math.max(1, Math.round(glow * 0.25));
      const coreMax = Math.max(1, Math.round(glow * 0.5));
      const haloMax = Math.round(glow * 1.8);
      const haloPeak = Math.round(glow * 1.4);
      this.element.style.setProperty('--muzen-breathe-filter-min', `drop-shadow(0 0 ${coreMin}px var(--muzen-glow-core))`);
      this.element.style.setProperty('--muzen-breathe-filter-peak', `drop-shadow(0 0 ${coreMax}px var(--muzen-glow-core)) drop-shadow(0 0 ${haloPeak}px var(--muzen-glow-halo))`);
      this.element.style.setProperty('--muzen-breathe-filter-max', `drop-shadow(0 0 ${coreMax}px var(--muzen-glow-core)) drop-shadow(0 0 ${haloMax}px var(--muzen-glow-halo))`);
    }

    // 2. 依據游標形態 (Shape) 與粗細 (Thickness) 調整幾何與渲染
    const shape = state.shape || 'block';
    const thickness = typeof state.thickness === 'number' ? Math.max(0.5, state.thickness) : 1.5;

    let targetX = state.rect.x;
    let targetY = state.rect.y;
    let targetW = Math.max(state.rect.width, 2);
    let targetH = state.rect.height;

    switch (shape) {
      case 'hollow': // 空心外框：文字完全清晰可見，高對比外框錨定
        this.element.style.background = `rgba(${color.r}, ${color.g}, ${color.b}, 0.05)`;
        this.element.style.outline = 'none';
        this.element.style.border = `${thickness}px solid ${color.hex}`;
        this.element.style.borderRadius = '2px';
        this.element.style.boxShadow = glow > 0
          ? `0 0 ${glow}px rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`
          : 'none';
        break;

      case 'underline': // 閱讀底線：高度依據 thickness 貼齊文字基線底部
        this.element.style.background = color.hex;
        this.element.style.outline = 'none';
        this.element.style.border = 'none';
        this.element.style.borderRadius = '0px';
        this.element.style.boxShadow = glow > 0
          ? `0 0 ${glow}px rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`
          : 'none';
        targetH = thickness;
        targetY = state.rect.y + state.rect.height - thickness;
        break;

      case 'block': // 經典實心方塊 (完全對齊 mugen-yomu 原始碼規格)
      default:
        this.element.style.background = state.mode === 'VISUAL'
          ? `rgba(${color.r}, ${color.g}, ${color.b}, 0.35)`
          : `rgba(${color.r}, ${color.g}, ${color.b}, 0.22)`;
        this.element.style.border = 'none';
        this.element.style.outline = `${thickness}px solid ${color.hex}`;
        this.element.style.outlineOffset = '-1px';
        this.element.style.borderRadius = '1.5px';
        this.element.style.boxShadow = glow > 0
          ? `0 0 ${Math.round(glow * 1.2)}px rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`
          : 'none';
        break;
    }

    // 3. 依據動態特效 (Effects: smooth, bounce, breathe, blink)
    const effects = state.effects || { smooth: true, bounce: true, breathe: false, blink: true };

    // 平滑位移與彈跳阻尼控制
    if (effects.smooth) {
      if (effects.bounce) {
        // 彈性梯形物理回彈曲線 (Overshoot Spring)
        this.element.style.transition = 'transform 0.11s cubic-bezier(0.34, 1.45, 0.64, 1), width 0.08s ease, height 0.08s ease';
      } else {
        this.element.style.transition = 'transform 0.08s cubic-bezier(0.2, 0, 0, 1), width 0.08s ease, height 0.08s ease';
      }
    } else {
      this.element.style.transition = 'none';
    }

    // 複合動畫組合 (breathe, blink)：mugen-yomu 招牌機制——移動中保持常亮，不閃爍
    const animList: string[] = [];
    const isMoving = !!state.isMoving;

    if (!isMoving) {
      if (effects.breathe) {
        animList.push('muzen-breathe 3s cubic-bezier(0.4, 0, 0.2, 1) infinite');
      }
      if (effects.blink) {
        animList.push('muzen-blink 1.1s ease-in-out infinite');
      }
    }

    if (animList.length > 0) {
      this.element.style.animation = animList.join(', ');
    } else {
      this.element.style.animation = 'none';
      this.element.style.opacity = '1'; // 移動中或無動畫時維持 100% 滿格全亮常駐
    }

    // 4. 利用 translate3d 與 3D 透視矩陣走 GPU 合成層渲染
    this.element.style.width = `${targetW}px`;
    this.element.style.height = `${targetH}px`;

    const isNewMotion = state.motionSequence !== this.lastRenderedSeq;
    this.lastRenderedSeq = state.motionSequence;

    if (effects.bounce && effects.smooth && isNewMotion && state.motionDirection !== 'none') {
      let deform = '';
      switch (state.motionDirection) {
        case 'right':
          deform = 'perspective(320px) rotateY(-18deg) scale(1.15, 0.94)';
          break;
        case 'left':
          deform = 'perspective(320px) rotateY(18deg) scale(1.15, 0.94)';
          break;
        case 'down':
          deform = 'perspective(320px) rotateX(18deg) scale(1.10, 0.90)';
          break;
        case 'up':
          deform = 'perspective(320px) rotateX(-18deg) scale(1.10, 0.90)';
          break;
        case 'jump':
          deform = 'perspective(320px) rotateX(8deg) scale(1.08, 0.92)';
          break;
      }

      this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) ${deform}`;

      if (this.settleTimer !== null) {
        clearTimeout(this.settleTimer);
      }
      this.settleTimer = window.setTimeout(() => {
        this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) perspective(320px) rotateX(0deg) rotateY(0deg) scale(1, 1)`;
        this.settleTimer = null;
      }, 75);
    } else {
      if (this.settleTimer !== null) {
        clearTimeout(this.settleTimer);
        this.settleTimer = null;
      }
      this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    }
  }

  public destroy(): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    document.documentElement.style.removeProperty('--muzen-selection-bg');
    this.element.remove();
    this.styleSheet.remove();
  }
}
