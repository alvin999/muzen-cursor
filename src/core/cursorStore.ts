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

export interface CursorEffects {
  smooth: boolean;       // 平滑物理位移 (Smooth Transition)
  smoothScroll: boolean; // 平滑視窗捲動 (Smooth Page Scrolling)
  breathe: boolean;      // 禪意呼吸燈 (Breathing Pulse Glow)
  blink: boolean;        // 經典閃爍 (Terminal Blink)
}

export interface CursorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  showStatusBar: boolean;
  rect: CursorRect;
  visible: boolean;
  isMoving: boolean;      // 是否正在連續鍵盤移動或定位 (移動時常亮不閃爍)
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
      smoothScroll: true,
      breathe: false,
      blink: true
    },
    showStatusBar: true,
    rect: { x: 0, y: 0, width: 10, height: 20 },
    visible: false,
    isMoving: false,
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
