import { Locale } from '../i18n/locales';

/**
 * Muzen Cursor 全域輕量狀態管理庫 (Vanilla Store)
 */

export type CursorMode = 'NORMAL' | 'VISUAL';
export type CursorTheme =
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'tokyo-night'
  | 'nord'
  | 'catppuccin'
  | 'everforest'
  | 'intellij-darcula'
  | 'intellij-light'
  | 'dracula'
  | 'monokai'
  | 'one-dark'
  | 'solarized-dark'
  | 'rose-pine'
  | 'cyberpunk';
export type CursorShape = 'block' | 'hollow' | 'underline';

export type MotionDirection = 'left' | 'right' | 'up' | 'down' | 'jump' | 'none';

export interface CursorEffects {
  smooth: boolean;       // 平滑物理位移 (Smooth Transition)
  bounce: boolean;       // 彈性梯形形變 (Trapezoid Deformation Bounce)
  smoothScroll: boolean; // 平滑視窗捲動 (Smooth Page Scrolling)
  breathe: boolean;      // 禪意呼吸燈 (Breathing Pulse Glow)
  blink: boolean;        // 經典閃爍 (Terminal Blink)
  trail?: boolean;       // 梯形透視殘影 (Trapezoid Motion Trail)
}

export interface CursorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TrailMode = 'line' | 'direct';

export interface AdvancedConfig {
  // 1. 幾何外觀與筆觸
  thickness: number;          // 游標粗細/線寬 (px)
  borderRadius: number;       // 圓角半徑 (px)
  outlineOffset: number;      // 外框偏移 (px)
  glowRadius: number;         // 光暈擴散半徑 (px)
  blockBgOpacity: number;     // NORMAL 方塊背景不透明度 (0~1)
  visualBgOpacity: number;    // VISUAL 選取不透明度 (0~1)
  hollowBgOpacity: number;    // 空心內部不透明度 (0~1)

  // 2. 梯形彈跳與 3D 透視物理
  perspective: number;        // 3D 透視景深 (px)
  tiltAngleX: number;         // 水平傾斜角度 (deg)
  tiltAngleY: number;         // 垂直傾斜角度 (deg)
  scaleStretchX: number;      // 水平伸展倍率
  scaleSquishY: number;       // 水平擠壓倍率
  scaleStretchY: number;      // 垂直伸展倍率
  scaleSquishX: number;       // 垂直擠壓倍率
  deformSettleMs: number;     // 形變回彈復原時間 (ms)

  // 3. 平滑過渡與阻尼時間
  smoothDurationMs: number;   // 平滑位移時間 (ms)
  springDurationMs: number;   // 彈簧回彈時間 (ms)
  springOvershoot: number;    // 彈簧超調張力

  // 4. 動態週期與計時器
  breatheDuration: number;    // 呼吸燈週期 (s)
  breathePeakOpacity: number; // 呼吸燈最高峰不透明度 (0~1)
  blinkDuration: number;      // 閃爍循環週期 (s)
  moveSettleDelayMs: number;  // 移動避震恢復延遲 (ms)

  // 5. 平滑捲動與視窗視野
  scrollDurationMs: number;   // 視窗捲動時間 (ms)
  viewportPaddingTop: number; // 視窗頂部邊距 (px)
  viewportPaddingBottom: number; // 視窗底部邊距 (px)

  // 6. 流光殘影與動態拖尾物理
  trailMode: TrailMode;       // 殘影過渡軌跡模式 ('line': 逐行流光 / 'direct': 兩點躍遷)
  trailCount: number;         // 殘影數量階數 (2 ~ 8，預設 4)
  trailDurationMs: number;    // 殘影淡出時長 (ms，預設 240)
  trailDecayExponent: number; // 距離衰減曲率 (預設 1.35)
  trailMaxOpacity: number;    // 最近端殘影起始透明度 (0.1 ~ 1.0，預設 0.75)
  trailPreserveTrapezoid: boolean; // 是否全程維持梯形透視形變 (預設 true)
}

export const DEFAULT_ADVANCED_CONFIG: AdvancedConfig = {
  thickness: 1.5,
  borderRadius: 1.5,
  outlineOffset: -1,
  glowRadius: 0,
  blockBgOpacity: 0.22,
  visualBgOpacity: 0.35,
  hollowBgOpacity: 0.05,

  perspective: 320,
  tiltAngleX: 18,
  tiltAngleY: 18,
  scaleStretchX: 1.15,
  scaleSquishY: 0.94,
  scaleStretchY: 1.10,
  scaleSquishX: 0.90,
  deformSettleMs: 75,

  smoothDurationMs: 80,
  springDurationMs: 110,
  springOvershoot: 1.45,

  breatheDuration: 3.0,
  breathePeakOpacity: 0.96,
  blinkDuration: 1.1,
  moveSettleDelayMs: 400,

  scrollDurationMs: 380,
  viewportPaddingTop: 120,
  viewportPaddingBottom: 160,

  trailMode: 'line',
  trailCount: 4,
  trailDurationMs: 260,
  trailDecayExponent: 1.35,
  trailMaxOpacity: 0.75,
  trailPreserveTrapezoid: true
};

export interface CursorState {
  enabled: boolean;
  isExcluded: boolean;
  locale: Locale;
  mode: CursorMode;
  theme: CursorTheme;
  shape: CursorShape;
  thickness: number;     // 游標粗細/線寬 (1 - 8 px，預設 2)
  glow: number;          // 游標光暈強度 (0 - 12 px，0 為無光暈，預設 6)
  effects: CursorEffects;
  advanced: AdvancedConfig; // 進階數值調校配置
  showStatusBar: boolean;
  rect: CursorRect;
  trailWaypoints?: CursorRect[]; // 跨行移動時由正版 j / k 演算法探測之各行真實路徑點
  visible: boolean;
  isMoving: boolean;      // 是否正在連續鍵盤移動或定位 (移動時常亮不閃爍)
  motionDirection: MotionDirection; // 運動方向（用於計算梯形與透視形變）
  motionSequence: number;  // 運動計數序號（即使同方向連續移動亦可感知每次跳躍）
  readingProgress: number; // 0 - 100
  charOffset: number;
}

type Listener = (state: CursorState) => void;

class CursorStore {
  private state: CursorState = {
    enabled: true,
    isExcluded: false,
    locale: 'zh-TW',
    mode: 'NORMAL',
    theme: 'gruvbox-dark',
    shape: 'block',
    thickness: 1.5,
    glow: 0,
    effects: {
      smooth: true,
      bounce: true,
      smoothScroll: true,
      breathe: false,
      blink: true,
      trail: true
    },
    advanced: { ...DEFAULT_ADVANCED_CONFIG },
    showStatusBar: true,
    rect: { x: 0, y: 0, width: 10, height: 20 },
    visible: false,
    isMoving: false,
    motionDirection: 'none',
    motionSequence: 0,
    readingProgress: 0,
    charOffset: 0
  };

  private listeners: Set<Listener> = new Set();

  public getState(): CursorState {
    return { ...this.state };
  }

  public setState(partial: Partial<CursorState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[Muzen Cursor] Store listener error:', err);
      }
    });
  }
}

export const cursorStore = new CursorStore();
