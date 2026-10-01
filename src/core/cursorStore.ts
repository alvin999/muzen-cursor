/**
 * Muzen Cursor 全域輕量狀態管理庫 (Vanilla Store)
 */

export type CursorMode = 'NORMAL' | 'VISUAL';
export type CursorTheme = 'gruvbox-dark' | 'gruvbox-light' | 'tokyo-night' | 'nord';

export interface CursorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CursorState {
  enabled: boolean;
  mode: CursorMode;
  theme: CursorTheme;
  rect: CursorRect;
  visible: boolean;
  readingProgress: number; // 0 - 100
  charOffset: number;
}

type Listener = (state: CursorState) => void;

class CursorStore {
  private state: CursorState = {
    enabled: true,
    mode: 'NORMAL',
    theme: 'gruvbox-dark',
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
