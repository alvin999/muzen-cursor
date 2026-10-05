import { cursorStore, CursorState, CursorTheme, CursorRect, DEFAULT_ADVANCED_CONFIG } from '../core/cursorStore';

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
  private container: HTMLElement;
  private element: HTMLElement;
  private styleSheet: HTMLStyleElement;
  private unsubscribe: (() => void) | null = null;
  private settleTimer: number | null = null;
  private lastRenderedSeq = 0;
  private lastRect: { x: number; y: number; width: number; height: number } | null = null;

  // 殘影節點環狀池 (Ring Buffer: 避免連續鍵盤敲擊時覆蓋未播完的殘影)
  private readonly MAX_GHOSTS = 16;
  private ghostPool: HTMLElement[] = [];
  private ghostTimers: (number | null)[] = [];
  private ghostIndex = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'muzen-cursor-container';
    this.container.style.position = 'fixed';
    this.container.style.top = '0px';
    this.container.style.left = '0px';
    this.container.style.width = '0px';
    this.container.style.height = '0px';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '2147483647';

    this.element = document.createElement('div');
    this.element.className = 'muzen-cursor-overlay';

    // 初始化殘影節點池並加入 container（位於主游標下層）
    for (let i = 0; i < this.MAX_GHOSTS; i++) {
      const ghost = document.createElement('div');
      ghost.className = `muzen-cursor-ghost muzen-cursor-ghost-${i}`;
      ghost.style.position = 'fixed';
      ghost.style.top = '0px';
      ghost.style.left = '0px';
      ghost.style.pointerEvents = 'none';
      ghost.style.boxSizing = 'border-box';
      ghost.style.willChange = 'transform, opacity';
      ghost.style.display = 'none';
      ghost.style.opacity = '0';
      this.ghostPool.push(ghost);
      this.ghostTimers.push(null);
      this.container.appendChild(ghost);
    }
    this.container.appendChild(this.element);

    this.styleSheet = document.createElement('style');
    this.styleSheet.textContent = `
      @keyframes muzen-breathe {
        0%, 100% {
          opacity: 0;
          filter: none;
        }
        40% {
          opacity: var(--muzen-breathe-peak-opacity, 0.96);
          filter: var(--muzen-breathe-filter-max, none);
        }
        50% {
          opacity: calc(var(--muzen-breathe-peak-opacity, 0.96) * 0.97);
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
      @keyframes muzen-ghost-fade {
        0% {
          opacity: var(--muzen-ghost-opacity, 0.75);
          scale: 1;
        }
        100% {
          opacity: 0;
          scale: 0.94;
        }
      }
      @keyframes muzen-stream-fade {
        0%, 22% {
          opacity: var(--muzen-ghost-opacity, 0.75);
          scale: 1;
          filter: blur(0px);
        }
        60% {
          opacity: calc(var(--muzen-ghost-opacity, 0.75) * 0.55);
          scale: 0.94;
          filter: blur(0.3px);
        }
        100% {
          opacity: 0;
          scale: 0.88;
          filter: blur(0.8px);
        }
      }
      ::selection {
        background: var(--muzen-selection-bg, rgba(254, 128, 25, 0.35)) !important;
      }
    `;

    this.applyBaseStyles();
    this.bindStore();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public getStyleSheet(): HTMLStyleElement {
    return this.styleSheet;
  }

  private clearAllGhosts(): void {
    for (let i = 0; i < this.ghostPool.length; i++) {
      const ghost = this.ghostPool[i];
      ghost.style.display = 'none';
      ghost.style.opacity = '0';
      ghost.style.animation = 'none';
      if (this.ghostTimers[i] !== null) {
        clearTimeout(this.ghostTimers[i]!);
        this.ghostTimers[i] = null;
      }
    }
    this.ghostIndex = 0;
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
      this.clearAllGhosts();
      this.lastRect = null;
      return;
    }

    this.element.style.display = 'block';

    const adv = state.advanced || DEFAULT_ADVANCED_CONFIG;

    // 1. 取得配色票券
    const themeKey = state.theme || 'gruvbox-dark';
    const palette = THEME_PALETTES[themeKey] || THEME_PALETTES['gruvbox-dark'];
    const color = state.mode === 'VISUAL' ? palette.visual : palette.normal;

    // 同步主題選取透明效果 (自訂 visualBgOpacity，預設 0.35)
    const visualColor = palette.visual;
    const visualBgOpacity = typeof adv.visualBgOpacity === 'number' ? adv.visualBgOpacity : 0.35;
    document.documentElement.style.setProperty(
      '--muzen-selection-bg',
      `rgba(${visualColor.r}, ${visualColor.g}, ${visualColor.b}, ${visualBgOpacity})`
    );

    // 設定 CSS 變數供呼吸動畫引用
    this.element.style.setProperty('--muzen-glow', `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`);
    this.element.style.setProperty('--muzen-glow-core', `rgba(${color.r}, ${color.g}, ${color.b}, 0.85)`);
    this.element.style.setProperty('--muzen-glow-halo', `rgba(${color.r}, ${color.g}, ${color.b}, 0.45)`);
    this.element.style.setProperty('--muzen-breathe-peak-opacity', `${typeof adv.breathePeakOpacity === 'number' ? adv.breathePeakOpacity : 0.96}`);

    // 處理光暈 (Glow Radius: 優先讀取進階設定 glowRadius，0 為無光暈)
    const glow = typeof adv.glowRadius === 'number' ? Math.max(0, adv.glowRadius) : (typeof state.glow === 'number' ? Math.max(0, state.glow) : 0);
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

    // 2. 依據游標形態 (Shape)、粗細 (Thickness) 與進階幾何數值調整
    const shape = state.shape || 'block';
    const thickness = typeof adv.thickness === 'number' ? Math.max(0.5, adv.thickness) : (typeof state.thickness === 'number' ? Math.max(0.5, state.thickness) : 1.5);
    const borderRadius = typeof adv.borderRadius === 'number' ? Math.max(0, adv.borderRadius) : 1.5;
    const outlineOffset = typeof adv.outlineOffset === 'number' ? adv.outlineOffset : -1;
    const blockBgOpacity = typeof adv.blockBgOpacity === 'number' ? adv.blockBgOpacity : 0.22;
    const hollowBgOpacity = typeof adv.hollowBgOpacity === 'number' ? adv.hollowBgOpacity : 0.05;

    let targetX = state.rect.x;
    let targetY = state.rect.y;
    let targetW = Math.max(state.rect.width, 2);
    let targetH = state.rect.height;

    switch (shape) {
      case 'hollow': // 空心外框：文字完全清晰可見，高對比外框錨定
        this.element.style.background = `rgba(${color.r}, ${color.g}, ${color.b}, ${hollowBgOpacity})`;
        this.element.style.outline = 'none';
        this.element.style.border = `${thickness}px solid ${color.hex}`;
        this.element.style.borderRadius = `${borderRadius}px`;
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
          ? `rgba(${color.r}, ${color.g}, ${color.b}, ${visualBgOpacity})`
          : `rgba(${color.r}, ${color.g}, ${color.b}, ${blockBgOpacity})`;
        this.element.style.border = 'none';
        this.element.style.outline = `${thickness}px solid ${color.hex}`;
        this.element.style.outlineOffset = `${outlineOffset}px`;
        this.element.style.borderRadius = `${borderRadius}px`;
        this.element.style.boxShadow = glow > 0
          ? `0 0 ${Math.round(glow * 1.2)}px rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`
          : 'none';
        break;
    }

    // 3. 依據動態特效 (Effects: smooth, bounce, breathe, blink) 與進階過渡參數
    const effects = state.effects || { smooth: true, bounce: true, breathe: false, blink: true };
    const smoothDurationSec = ((adv.smoothDurationMs ?? 80) / 1000).toFixed(3);
    const springDurationSec = ((adv.springDurationMs ?? 110) / 1000).toFixed(3);
    const springOvershoot = typeof adv.springOvershoot === 'number' ? adv.springOvershoot : 1.45;

    // 平滑位移與彈跳阻尼控制
    if (effects.smooth) {
      if (effects.bounce) {
        // 彈性梯形物理回彈曲線 (Overshoot Spring)
        this.element.style.transition = `transform ${springDurationSec}s cubic-bezier(0.34, ${springOvershoot}, 0.64, 1), width 0.08s ease, height 0.08s ease`;
      } else {
        this.element.style.transition = `transform ${smoothDurationSec}s cubic-bezier(0.2, 0, 0, 1), width 0.08s ease, height 0.08s ease`;
      }
    } else {
      this.element.style.transition = 'none';
    }

    // 複合動畫組合 (breathe, blink)：移動中保持常亮，不閃爍
    const animList: string[] = [];
    const isMoving = !!state.isMoving;
    const breatheDuration = typeof adv.breatheDuration === 'number' ? adv.breatheDuration : 3.0;
    const blinkDuration = typeof adv.blinkDuration === 'number' ? adv.blinkDuration : 1.1;

    if (!isMoving) {
      if (effects.breathe) {
        animList.push(`muzen-breathe ${breatheDuration}s cubic-bezier(0.4, 0, 0.2, 1) infinite`);
      }
      if (effects.blink) {
        animList.push(`muzen-blink ${blinkDuration}s ease-in-out infinite`);
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

    const persp = typeof adv.perspective === 'number' ? adv.perspective : 320;
    const tiltX = typeof adv.tiltAngleX === 'number' ? adv.tiltAngleX : 18;
    const tiltY = typeof adv.tiltAngleY === 'number' ? adv.tiltAngleY : 18;
    const stretchX = typeof adv.scaleStretchX === 'number' ? adv.scaleStretchX : 1.15;
    const squishY = typeof adv.scaleSquishY === 'number' ? adv.scaleSquishY : 0.94;
    const stretchY = typeof adv.scaleStretchY === 'number' ? adv.scaleStretchY : 1.10;
    const squishX = typeof adv.scaleSquishX === 'number' ? adv.scaleSquishX : 0.90;
    const deformSettleMs = typeof adv.deformSettleMs === 'number' ? adv.deformSettleMs : 75;

    // 計算梯形透視形變 (Trapezoid Perspective Deformation)
    let deform = '';
    if (state.motionDirection !== 'none') {
      switch (state.motionDirection) {
        case 'right':
          deform = `perspective(${persp}px) rotateY(-${tiltX}deg) scale(${stretchX}, ${squishY})`;
          break;
        case 'left':
          deform = `perspective(${persp}px) rotateY(${tiltX}deg) scale(${stretchX}, ${squishY})`;
          break;
        case 'down':
          deform = `perspective(${persp}px) rotateX(${tiltY}deg) scale(${stretchY}, ${squishX})`;
          break;
        case 'up':
          deform = `perspective(${persp}px) rotateX(-${tiltY}deg) scale(${stretchY}, ${squishX})`;
          break;
        case 'jump':
          deform = `perspective(${persp}px) rotateX(${Math.round(tiltY * 0.44)}deg) scale(${((stretchX + stretchY) / 2).toFixed(2)}, ${((squishX + squishY) / 2).toFixed(2)})`;
          break;
      }
    }

    if (effects.bounce && effects.smooth && isNewMotion && state.motionDirection !== 'none' && deform) {
      this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) ${deform}`;

      if (this.settleTimer !== null) {
        clearTimeout(this.settleTimer);
      }
      this.settleTimer = window.setTimeout(() => {
        this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) perspective(${persp}px) rotateX(0deg) rotateY(0deg) scale(1, 1)`;
        this.settleTimer = null;
      }, deformSettleMs);
    } else {
      if (this.settleTimer !== null) {
        clearTimeout(this.settleTimer);
        this.settleTimer = null;
      }
      this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    }

    // 5. 梯形透視殘影動畫 (Trapezoid Motion Trail)
    const isTrailEnabled = effects.trail !== false;
    if (isTrailEnabled && isNewMotion && this.lastRect !== null && state.motionDirection !== 'none') {
      const dx = targetX - this.lastRect.x;
      const dy = targetY - this.lastRect.y;
      const dist = Math.hypot(dx, dy);

      // 位移超過 4px 時觸發流光殘影，避免微幅像素震顫造成視覺雜訊
      if (dist >= 4) {
        this.spawnTrailGhosts({
          originX: this.lastRect.x,
          originY: this.lastRect.y,
          originW: this.lastRect.width,
          originH: this.lastRect.height,
          targetX,
          targetY,
          targetW,
          targetH,
          dx,
          dy,
          dist,
          deform,
          adv,
          shape,
          color,
          thickness,
          borderRadius,
          outlineOffset,
          glow,
          waypoints: state.trailWaypoints
        });
      }
    }

    // 紀錄本次位移歷史座標供下一影格計算殘影軌跡
    this.lastRect = { x: targetX, y: targetY, width: targetW, height: targetH };
  }

  /**
   * 啟用單枚殘影節點並啟動 GPU 淡出動畫 (Ring Buffer 分派，支援串流階梯微延遲)
   */
  private activateGhost(
    gx: number,
    gy: number,
    gw: number,
    gh: number,
    deform: string,
    opacity: number,
    durationMs: number,
    shape: string,
    color: { r: number; g: number; b: number; hex: string },
    thickness: number,
    borderRadius: number,
    outlineOffset: number,
    glow: number,
    delayMs: number = 0,
    animType: 'stream' | 'static' = 'stream'
  ): void {
    const idx = this.ghostIndex;
    this.ghostIndex = (this.ghostIndex + 1) % this.MAX_GHOSTS;

    const ghost = this.ghostPool[idx];
    if (!ghost) return;

    if (this.ghostTimers[idx] !== null) {
      clearTimeout(this.ghostTimers[idx]!);
      this.ghostTimers[idx] = null;
    }

    const showGhost = () => {
      ghost.style.display = 'block';
      ghost.style.width = `${Math.max(2, Math.round(gw))}px`;
      ghost.style.height = `${Math.max(2, Math.round(gh))}px`;
      ghost.style.borderRadius = `${borderRadius}px`;
      ghost.style.transform = `translate3d(${Math.round(gx)}px, ${Math.round(gy)}px, 0) ${deform}`.trim();

      // 醒目高質感的筆觸與外觀 (逐行流光模式具備清晰飽滿的底色與光暈，呈現連踏跑過的每一步腳印)
      const isStream = animType === 'stream';
      switch (shape) {
        case 'hollow':
          ghost.style.background = `rgba(${color.r}, ${color.g}, ${color.b}, ${isStream ? 0.12 : 0.15})`;
          ghost.style.border = `${thickness}px solid ${color.hex}`;
          ghost.style.outline = 'none';
          ghost.style.boxShadow = glow > 0
            ? `0 0 ${glow}px rgba(${color.r}, ${color.g}, ${color.b}, 0.75)`
            : `0 0 6px rgba(${color.r}, ${color.g}, ${color.b}, 0.40)`;
          break;

        case 'underline':
          ghost.style.background = color.hex;
          ghost.style.border = 'none';
          ghost.style.outline = 'none';
          ghost.style.boxShadow = glow > 0
            ? `0 0 ${glow}px rgba(${color.r}, ${color.g}, ${color.b}, 0.85)`
            : `0 0 6px rgba(${color.r}, ${color.g}, ${color.b}, 0.50)`;
          break;

        case 'block':
        default:
          // 流光模式使用清晰立體的底色 (0.35)，與實心主游標 (0.42) 及輪廓相呼應，清晰呈現每步跑過的腳印
          ghost.style.background = `rgba(${color.r}, ${color.g}, ${color.b}, ${isStream ? 0.35 : 0.40})`;
          ghost.style.border = 'none';
          ghost.style.outline = `${thickness}px solid ${color.hex}`;
          ghost.style.outlineOffset = `${outlineOffset}px`;
          ghost.style.boxShadow = glow > 0
            ? `0 0 ${Math.max(glow, 6)}px rgba(${color.r}, ${color.g}, ${color.b}, 0.75)`
            : `0 0 6px rgba(${color.r}, ${color.g}, ${color.b}, 0.45)`;
          break;
      }

      // 透過 CSS 變數傳遞初始透明度
      ghost.style.setProperty('--muzen-ghost-opacity', `${opacity.toFixed(3)}`);
      ghost.style.animation = 'none';
      void ghost.offsetWidth; // 強制重置動畫影格

      // 流光模式：自然平順的衰退曲線 (0.2, 0, 0.25, 1)，兼具實體停留與溫潤羽化
      const animName = isStream ? 'muzen-stream-fade' : 'muzen-ghost-fade';
      const animTiming = 'cubic-bezier(0.2, 0, 0.25, 1)';
      ghost.style.animation = `${animName} ${durationMs}ms ${animTiming} forwards`;

      this.ghostTimers[idx] = window.setTimeout(() => {
        ghost.style.display = 'none';
        ghost.style.animation = 'none';
        ghost.style.scale = '1';
        ghost.style.filter = 'none';
        this.ghostTimers[idx] = null;
      }, durationMs);
    };

    if (delayMs > 0) {
      this.ghostTimers[idx] = window.setTimeout(showGhost, delayMs);
    } else {
      showGhost();
    }
  }

  /**
   * 殘影生成演算法：支援「逐行流光」與「兩點躍遷」兩種模式
   */
  private spawnTrailGhosts(params: {
    originX: number;
    originY: number;
    originW: number;
    originH: number;
    targetX: number;
    targetY: number;
    targetW: number;
    targetH: number;
    dx: number;
    dy: number;
    dist: number;
    deform: string;
    adv: any;
    shape: string;
    color: { r: number; g: number; b: number; hex: string };
    thickness: number;
    borderRadius: number;
    outlineOffset: number;
    glow: number;
    waypoints?: CursorRect[];
  }): void {
    const {
      originX,
      originY,
      originW,
      originH,
      targetX,
      targetY,
      targetW,
      targetH,
      dx,
      dy,
      dist,
      deform,
      adv,
      shape,
      color,
      thickness,
      borderRadius,
      outlineOffset,
      glow,
      waypoints
    } = params;

    const trailMode = (adv.trailMode || 'line') as 'line' | 'direct';
    const trailCount = Math.max(2, Math.min(this.MAX_GHOSTS, Math.round(adv.trailCount ?? 4)));
    const trailDurationMs = typeof adv.trailDurationMs === 'number' ? Math.max(100, adv.trailDurationMs) : 260;
    const trailDecayExponent = typeof adv.trailDecayExponent === 'number' ? Math.max(0.2, adv.trailDecayExponent) : 1.35;
    const trailMaxOpacity = typeof adv.trailMaxOpacity === 'number' ? Math.min(1, Math.max(0.1, adv.trailMaxOpacity)) : 0.75;
    const preserveTrapezoid = adv.trailPreserveTrapezoid !== false;

    // 鎖定 3D 透視矩陣
    const ghostDeform = (preserveTrapezoid && deform) ? deform : '';

    const absDy = Math.abs(dy);
    const lineHeight = Math.max(16, originH || targetH);
    const isMultiLine = absDy >= lineHeight * 0.75;

    // 模式 A：逐行流光 (trailMode === 'line' 且存在跨行位移)
    // 貼著經過的每一行依序產生階梯流光殘影，宛如高速連續敲擊 j / k 跑過去的穿行效果
    if (trailMode === 'line' && isMultiLine) {
      // 收集本次移動的所有視覺行足跡（包含出發點與經過的每一行）
      const footprints: CursorRect[] = [];

      // 1. 出發行足跡
      footprints.push({
        x: originX,
        y: originY,
        width: originW,
        height: originH
      });

      // 2. 經過行足跡
      if (waypoints && waypoints.length > 0) {
        // 使用正版 j / k 演算法探測之各行真實邊界
        for (const wp of waypoints) {
          footprints.push(wp);
        }
      } else {
        // 若無預先探測（例如超長跨節點跳躍），使用等分階梯直線內插
        const estimatedLines = Math.max(1, Math.round(absDy / lineHeight));
        if (estimatedLines > 1) {
          const stepCount = Math.min(estimatedLines - 1, this.MAX_GHOSTS - 3);
          for (let m = 1; m <= stepCount; m++) {
            const ratio = m / estimatedLines;
            footprints.push({
              x: originX + (targetX - originX) * ratio,
              y: originY + dy * ratio,
              width: originW + (targetW - originW) * ratio,
              height: originH + (targetH - originH) * ratio
            });
          }
        }
      }

      const totalSteps = footprints.length;
      // 擬真連續敲擊 j / k 的步頻節奏（每步約 36ms ~ 40ms）
      const stepCadenceMs = 38;

      for (let m = 0; m < totalSteps; m++) {
        const fp = footprints[m];
        // progress: 0 (出發行) -> 1 (最靠近目標行)
        const progress = totalSteps > 1 ? m / (totalSteps - 1) : 1;

        // 步態延遲：逐行依序踏下亮起，呈現清晰的穿行動態
        const staggerDelay = Math.min(240, m * stepCadenceMs);

        // 壽命波浪：維持在 210ms ~ 260ms，既看得一清二楚，又具備自然流光尾韻
        const stepDuration = Math.round(trailDurationMs * (0.80 + 0.20 * progress));

        // 透明度梯度：單步給滿 trailMaxOpacity；多步時出發點 0.45，最新點 0.75，確保每一格都清晰飽滿
        const minAlpha = 0.45;
        const alphaFactor = totalSteps === 1 ? 1 : (minAlpha + (1 - minAlpha) * Math.pow(progress, 0.75));
        const opacity = Math.max(0.30, trailMaxOpacity * alphaFactor);

        this.activateGhost(
          fp.x,
          fp.y,
          fp.width,
          fp.height,
          ghostDeform,
          opacity,
          stepDuration,
          shape,
          color,
          thickness,
          borderRadius,
          outlineOffset,
          glow,
          staggerDelay,
          'stream'
        );
      }
      return;
    }

    // 模式 B 或 同行水平移動：
    // 短距離單字元位移 (h / j / k / l，位移 < 45px)：在出發點原位留下 1 個清晰的 3D 殘影
    if (dist < 45) {
      this.activateGhost(
        originX,
        originY,
        originW,
        originH,
        ghostDeform,
        trailMaxOpacity,
        trailDurationMs,
        shape,
        color,
        thickness,
        borderRadius,
        outlineOffset,
        glow,
        0,
        'static'
      );
      return;
    }

    // 長距離跳躍 (w / b / 兩點過渡直線瞬移)：
    // 沿著跳躍路徑生成階梯殘影，由出發點至目標點依序遞增亮度（越遠越淡）
    const maxTrailSpan = 400;
    const spanRatio = dist > maxTrailSpan ? (maxTrailSpan / dist) : 1;
    const effectiveDx = dx * spanRatio;
    const effectiveDy = dy * spanRatio;

    const stepCount = Math.min(trailCount, Math.max(2, Math.floor(dist / 32)));

    for (let i = 0; i < stepCount; i++) {
      const ratio = (i + 1) / (stepCount + 1);

      const gx = targetX - effectiveDx * (1 - ratio);
      const gy = targetY - effectiveDy * (1 - ratio);
      const gw = originW + (targetW - originW) * ratio;
      const gh = originH + (targetH - originH) * ratio;

      const stepDuration = Math.round(trailDurationMs * (0.5 + 0.5 * ratio));
      const alphaFactor = Math.pow(Math.max(0.1, ratio), trailDecayExponent);
      const opacity = Math.max(0.12, trailMaxOpacity * alphaFactor);

      this.activateGhost(
        gx,
        gy,
        gw,
        gh,
        ghostDeform,
        opacity,
        stepDuration,
        shape,
        color,
        thickness,
        borderRadius,
        outlineOffset,
        glow,
        0,
        'stream'
      );
    }
  }

  public destroy(): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    this.clearAllGhosts();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    document.documentElement.style.removeProperty('--muzen-selection-bg');
    this.container.remove();
    this.styleSheet.remove();
  }
}
