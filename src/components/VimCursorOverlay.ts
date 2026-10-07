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
  private trajectoryTimers: number[] = [];

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
      ghost.style.transformOrigin = 'center center';
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
        }
        100% {
          opacity: 0;
        }
      }
      @keyframes muzen-stream-fade {
        0%, 20% {
          opacity: var(--muzen-ghost-opacity, 0.75);
          filter: blur(0px);
        }
        60% {
          opacity: calc(var(--muzen-ghost-opacity, 0.75) * 0.55);
          filter: blur(0.3px);
        }
        100% {
          opacity: 0;
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

  private clearTrajectoryTimers(): void {
    if (this.trajectoryTimers.length > 0) {
      for (const t of this.trajectoryTimers) {
        clearTimeout(t);
      }
      this.trajectoryTimers = [];
    }
  }

  private settleDeform(targetX: number, targetY: number, persp: number, deformSettleMs: number): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
    }
    this.settleTimer = window.setTimeout(() => {
      this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) perspective(${persp}px) rotateX(0deg) rotateY(0deg) scale(1, 1)`;
      this.settleTimer = null;
    }, deformSettleMs);
  }

  /**
   * 計算本次位移的統一換行軌跡清單 (主游標與殘影走完全相同的軌跡)
   */
  private buildTrajectory(
    origin: { x: number; y: number; width: number; height: number },
    target: { x: number; y: number; width: number; height: number },
    waypoints: CursorRect[] | undefined,
    trailMode: string
  ): CursorRect[] {
    const trajectory: CursorRect[] = [];
    const dy = target.y - origin.y;
    const absDy = Math.abs(dy);
    const lineHeight = Math.max(16, origin.height || target.height);
    const isMultiLine = absDy >= lineHeight * 0.75;

    if (trailMode === 'line' && isMultiLine) {
      if (waypoints && waypoints.length > 0) {
        // 使用正版 j / k 演算法探測之各行真實邊界
        for (const wp of waypoints) {
          trajectory.push(wp);
        }
      } else {
        // 若無預先探測之 waypoints，使用等分階梯直線內插補齊經過的行
        const estimatedLines = Math.max(1, Math.round(absDy / lineHeight));
        if (estimatedLines > 1) {
          const stepCount = Math.min(estimatedLines - 1, this.MAX_GHOSTS - 3);
          for (let m = 1; m <= stepCount; m++) {
            const ratio = m / estimatedLines;
            trajectory.push({
              x: origin.x + (target.x - origin.x) * ratio,
              y: origin.y + dy * ratio,
              width: origin.width + (target.width - origin.width) * ratio,
              height: origin.height + (target.height - origin.height) * ratio
            });
          }
        }
      }
    }

    // 最後一點必定為目標終點
    trajectory.push({
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height
    });

    // 向上移動時，軌跡點不能越過目標點上方；向下移動時，軌跡點不能越過目標點下方
    for (const pt of trajectory) {
      if (dy < 0 && pt.y < target.y) {
        pt.y = target.y;
      } else if (dy > 0 && pt.y > target.y) {
        pt.y = target.y;
      }
    }

    return trajectory;
  }

  private clearAllGhosts(): void {
    this.clearTrajectoryTimers();
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

    if (state.isScrollUpdate) {
      // 視窗純捲動/縮放更新：僅靜默貼齊游標位置，嚴格抑制殘影
      this.clearTrajectoryTimers();
      this.element.style.width = `${targetW}px`;
      this.element.style.height = `${targetH}px`;
      this.element.style.transition = 'none';
      this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      this.lastRect = { x: targetX, y: targetY, width: targetW, height: targetH };
      return;
    }

    // 4. 利用 translate3d 與 3D 透視矩陣走 GPU 合成層渲染
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

    const isTrailEnabled = effects.trail !== false;
    const trailMode = (adv.trailMode || 'line') as 'line' | 'direct';
    const trailDurationMs = typeof adv.trailDurationMs === 'number' ? Math.max(100, adv.trailDurationMs) : 260;
    const trailMaxOpacity = typeof adv.trailMaxOpacity === 'number' ? Math.min(1, Math.max(0.1, adv.trailMaxOpacity)) : 0.75;
    const ghostDeform = (adv.trailPreserveTrapezoid !== false && deform) ? deform : '';

    this.clearTrajectoryTimers();

    if (isNewMotion && this.lastRect !== null && state.motionDirection !== 'none') {
      const originRect = this.lastRect;
      const targetRect = { x: targetX, y: targetY, width: targetW, height: targetH };
      const dx = targetX - originRect.x;
      const dy = targetY - originRect.y;
      const dist = Math.hypot(dx, dy);

      // 取得統一的換行軌跡 (主游標與殘影走完全相同的軌跡)
      const trajectory = this.buildTrajectory(originRect, targetRect, state.trailWaypoints, trailMode);

      console.log('[Muzen Trail] 位移事件 ->', {
        direction: state.motionDirection,
        dx: Math.round(dx),
        dy: Math.round(dy),
        dist: Math.round(dist),
        trajectoryLength: trajectory.length,
        hasWaypoints: !!(state.trailWaypoints && state.trailWaypoints.length > 0),
        origin: { x: Math.round(originRect.x), y: Math.round(originRect.y) },
        target: { x: Math.round(targetRect.x), y: Math.round(targetRect.y) }
      });

      if (trajectory.length > 1 && effects.smooth) {
        console.log('[Muzen Trail] 命中分支 -> 多行飛躍模式 (Multi-line trajectory mode)', trajectory);
        // 多行換行飛躍模式：主游標沿著 waypoints 逐行飛躍，殘影緊隨身後即時釋放
        const stepMs = Math.max(22, Math.min(30, Math.round(110 / trajectory.length)));

        // 游標在出發點起飛瞬間，起點立即留下一抹殘影
        if (isTrailEnabled) {
          this.activateGhost(
            originRect.x,
            originRect.y,
            originRect.width,
            originRect.height,
            ghostDeform,
            trailMaxOpacity * 0.45,
            trailDurationMs,
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

        for (let k = 0; k < trajectory.length; k++) {
          const pt = trajectory[k];
          const isFinal = k === trajectory.length - 1;
          const stepDelay = k * stepMs;

          const runStep = () => {
            this.element.style.width = `${Math.round(pt.width)}px`;
            this.element.style.height = `${Math.round(pt.height)}px`;

            if (isFinal) {
              if (effects.bounce) {
                this.element.style.transition = `transform ${springDurationSec}s cubic-bezier(0.34, ${springOvershoot}, 0.64, 1), width 0.08s ease, height 0.08s ease`;
              } else {
                this.element.style.transition = `transform ${smoothDurationSec}s cubic-bezier(0.2, 0, 0, 1), width 0.08s ease, height 0.08s ease`;
              }
              this.element.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) ${deform}`;
              this.settleDeform(pt.x, pt.y, persp, deformSettleMs);
            } else {
              this.element.style.transition = `transform ${stepMs}ms linear, width ${stepMs}ms ease, height ${stepMs}ms ease`;
              this.element.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) ${ghostDeform}`;

              if (isTrailEnabled) {
                const progress = (k + 1) / trajectory.length;
                const opacity = Math.max(0.30, trailMaxOpacity * (0.45 + 0.55 * progress));
                this.activateGhost(
                  pt.x,
                  pt.y,
                  pt.width,
                  pt.height,
                  ghostDeform,
                  opacity,
                  trailDurationMs,
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
          };

          if (stepDelay === 0) {
            runStep();
          } else {
            this.trajectoryTimers.push(window.setTimeout(runStep, stepDelay));
          }
        }
      } else {
        console.log('[Muzen Trail] 命中分支 -> 單步/同行模式 (Single-step mode)', {
          dist: Math.round(dist),
          isTrailEnabled,
          canSpawnGhosts: isTrailEnabled && dist >= 4
        });
        // 單步或無中繼行位移 (同行水平或兩點過渡)：主游標直接過渡，殘影緊隨
        this.element.style.width = `${targetW}px`;
        this.element.style.height = `${targetH}px`;

        if (effects.bounce && effects.smooth && deform) {
          this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) ${deform}`;
          this.settleDeform(targetX, targetY, persp, deformSettleMs);
        } else {
          this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
        }

        if (isTrailEnabled && dist >= 4) {
          this.spawnSingleStepGhosts({
            originX: originRect.x,
            originY: originRect.y,
            originW: originRect.width,
            originH: originRect.height,
            targetX,
            targetY,
            targetW,
            targetH,
            dx,
            dy,
            dist,
            ghostDeform,
            adv,
            shape,
            color,
            thickness,
            borderRadius,
            outlineOffset,
            glow
          });
        }
      }
    } else {
      // 靜止渲染或首次加載
      this.element.style.width = `${targetW}px`;
      this.element.style.height = `${targetH}px`;
      this.element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    }

    // 紀錄本次位移歷史座標供下一影格計算殘影軌跡
    this.lastRect = { x: targetX, y: targetY, width: targetW, height: targetH };
  }

  /**
   * 啟用單枚殘影節點並啟動 GPU 淡出動畫 (Ring Buffer 分派，支援即時釋放與流光淡出)
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

      console.log(`[Muzen Trail Ghost #${idx}] 節點渲染 ->`, {
        x: Math.round(gx),
        y: Math.round(gy),
        w: Math.round(gw),
        h: Math.round(gh),
        deform: deform || '(無形變/平正)',
        animType
      });

      // 醒目高質感的筆觸與外觀
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

      const animName = isStream ? 'muzen-stream-fade' : 'muzen-ghost-fade';
      const animTiming = 'cubic-bezier(0.2, 0, 0.25, 1)';
      ghost.style.animation = `${animName} ${durationMs}ms ${animTiming} forwards`;

      requestAnimationFrame(() => {
        const gRect = ghost.getBoundingClientRect();
        const cRect = this.element.getBoundingClientRect();
        const diffX = Math.round(gRect.left - cRect.left);
        const diffY = Math.round(gRect.top - cRect.top);
        console.log(`[Muzen Trail DOM 實測 #${idx}]`, {
          '殘影實體坐標': { left: Math.round(gRect.left), top: Math.round(gRect.top), w: Math.round(gRect.width), h: Math.round(gRect.height) },
          '主游標實體坐標': { left: Math.round(cRect.left), top: Math.round(cRect.top), w: Math.round(cRect.width), h: Math.round(cRect.height) },
          '相對位置 (殘影 vs 主游標)': {
            水平方位: diffX < 0 ? `正左方 (${Math.abs(diffX)}px)` : (diffX > 0 ? `正右方 (${diffX}px)` : '水平完全重疊'),
            垂直方位: Math.abs(diffY) <= 1 ? '垂直完全平齊 (0px)' : (diffY < 0 ? `偏上方 (${Math.abs(diffY)}px ⚠️)` : `偏下方 (${diffY}px ⚠️)`),
            diffX,
            diffY
          },
          '殘影 Transform': window.getComputedStyle(ghost).transform,
          '主游標 Transform': window.getComputedStyle(this.element).transform
        });
      });

      this.ghostTimers[idx] = window.setTimeout(() => {
        ghost.style.display = 'none';
        ghost.style.animation = 'none';
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
   * 單步位移殘影（同行水平移動 h/l/w/b 或兩點過渡）：
   * 殘影在起點或軌跡上即刻生成 (delayMs = 0)，緊隨主游標身後消散
   */
  private spawnSingleStepGhosts(params: {
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
    ghostDeform: string;
    adv: any;
    shape: string;
    color: { r: number; g: number; b: number; hex: string };
    thickness: number;
    borderRadius: number;
    outlineOffset: number;
    glow: number;
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
      ghostDeform,
      adv,
      shape,
      color,
      thickness,
      borderRadius,
      outlineOffset,
      glow
    } = params;

    const trailCount = Math.max(2, Math.min(this.MAX_GHOSTS, Math.round(adv.trailCount ?? 4)));
    const trailDurationMs = typeof adv.trailDurationMs === 'number' ? Math.max(100, adv.trailDurationMs) : 260;
    const trailDecayExponent = typeof adv.trailDecayExponent === 'number' ? Math.max(0.2, adv.trailDecayExponent) : 1.35;
    const trailMaxOpacity = typeof adv.trailMaxOpacity === 'number' ? Math.min(1, Math.max(0.1, adv.trailMaxOpacity)) : 0.75;

    const absDy = Math.abs(dy);
    const lineHeight = Math.max(16, originH || targetH);
    const isHorizontal = absDy < lineHeight * 0.75;

    if (isHorizontal && dist < 45) {
      // 短距離單字元位移 (h / l)：嚴格錨定在運動軌跡正後方的出發點基準
      const gw = originW || targetW;
      let gx = originX;
      if (dx > 0) {
        // 向右前進 (l)：殘影必須嚴格留在主游標正左方 (身後起點)
        gx = Math.min(originX, targetX - gw);
      } else if (dx < 0) {
        // 向左前進 (h)：殘影必須嚴格留在主游標正右方 (身後起點)
        gx = Math.max(originX, targetX + targetW);
      }

      console.log('[Muzen Trail] spawn -> 水平單字元 (h/l)', {
        gx: Math.round(gx),
        gy: Math.round(targetY),
        gw: Math.round(gw),
        gh: Math.round(targetH),
        dx: Math.round(dx),
        originX: Math.round(originX),
        targetX: Math.round(targetX)
      });

      this.activateGhost(
        gx,
        targetY, // 垂直坐標嚴格鎖定目標行基準線，消除 Y 軸向上浮動偏差
        gw,
        targetH,
        '',      // 同行正後方殘影使用平正錨定，移除 3D 透視旋轉形變，杜絕視覺中心上浮至左上方
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

    if (dist < 45) {
      console.log('[Muzen Trail] spawn -> 垂直微步 (j/k)', {
        originX: Math.round(originX),
        originY: Math.round(originY),
        dy: Math.round(dy)
      });
      // 垂直微步回退方案 (j / k 單步位移)
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

    console.log('[Muzen Trail] spawn -> 長距離/跳躍模式', {
      dist: Math.round(dist),
      isHorizontal,
      stepCount: Math.min(trailCount, Math.max(2, Math.floor(dist / 32)))
    });

    // 長距離跳躍 (w / b / e)：沿著起點到終點生成階梯殘影，緊隨身後
    const maxTrailSpan = 400;
    const spanRatio = dist > maxTrailSpan ? (maxTrailSpan / dist) : 1;
    const effectiveDx = dx * spanRatio;
    const effectiveDy = isHorizontal ? 0 : dy * spanRatio;
    const stepCount = Math.min(trailCount, Math.max(2, Math.floor(dist / 32)));

    for (let i = 0; i < stepCount; i++) {
      const ratio = (i + 1) / (stepCount + 1);
      const gx = targetX - effectiveDx * (1 - ratio);
      const gy = isHorizontal ? targetY : targetY - effectiveDy * (1 - ratio);
      const gw = originW + (targetW - originW) * ratio;
      const gh = isHorizontal ? targetH : originH + (targetH - originH) * ratio;

      const stepDuration = Math.round(trailDurationMs * (0.6 + 0.4 * ratio));
      const alphaFactor = Math.pow(Math.max(0.1, ratio), trailDecayExponent);
      const opacity = Math.max(0.15, trailMaxOpacity * alphaFactor);

      this.activateGhost(
        gx,
        gy,
        gw,
        gh,
        isHorizontal ? '' : ghostDeform, // 同行長移動亦保持平正基準，杜絕上浮
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
