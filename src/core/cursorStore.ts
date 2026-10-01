/**
 * Muzen Cursor 全域輕量狀態管理庫 (Vanilla Store)
 */

export type CursorMode = 'NORMAL' | 'VISUAL';
export type CursorTheme = 'gruvbox-dark' | 'gruvbox-light' | 'tokyo-night' | 'nord' | 'catppuccin' | 'everforest';
export type CursorShape = 'block' | 'hollow' | 'underline';

export interface CursorEffects {
  smooth: boolean;  // 平滑物理位移 (Smooth Transition)
  breathe: boolean; // 禪意呼吸燈 (Breathing Pulse Glow)
  blink: boolean;   // 經典閃爍 (Terminal Blink)
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
  mode: CursorMode;
  theme: CursorTheme;
  shape: CursorShape;
  effects: CursorEffects;
  showStatusBar: boolean;
  rect: CursorRect;
  visible: boolean;
  readingProgress: number; // 0 - 100
  charOffset: number;
}

type Listener = (state: CursorState) => void;

class CursorStore {
  private state: CursorState = {
    enabled: true,
    isExcluded: false,
    mode: 'NORMAL',
    theme: 'gruvbox-dark',
    shape: 'block',
    effects: {
      smooth: true,
      breathe: true,
      blink: false
    },
    showStatusBar: true,
    rect: { x: 0, y: 0, width: 10, height: 20 },
    visible: false,
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
