import { cursorStore, CursorState, CursorTheme } from '../core/cursorStore';
import { LOCALES } from '../i18n/locales';
import { THEME_PALETTES } from './VimCursorOverlay';

/**
 * 底部沉浸式 Vim 狀態列 (Shadow DOM 內部渲染)
 * 支援全主題色彩聯動、微型進度條與智慧防遮擋幽靈模式
 */
export class VimStatusBar {
  private element: HTMLElement;
  private modeEl: HTMLElement;
  private pendingEl: HTMLElement;
  private infoEl: HTMLElement;
  private progressBarEl: HTMLElement;
  private unsubscribe: (() => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private isMouseNearby: boolean = false;
  private isCursorNearby: boolean = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'muzen-status-bar';

    this.modeEl = document.createElement('span');
    this.modeEl.className = 'muzen-mode-badge';

    this.pendingEl = document.createElement('span');
    this.pendingEl.className = 'muzen-pending-badge';

    this.infoEl = document.createElement('span');
    this.infoEl.className = 'muzen-info-badge';

    this.progressBarEl = document.createElement('div');
    this.progressBarEl.className = 'muzen-status-progress';

    this.element.appendChild(this.modeEl);
    this.element.appendChild(this.pendingEl);
    this.element.appendChild(this.infoEl);
    this.element.appendChild(this.progressBarEl);

    this.applyStyles();
    this.setupAntiObstruction();
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
    this.element.style.padding = '5px 12px 6px 12px';
    this.element.style.borderRadius = '5px';
    this.element.style.overflow = 'hidden'; // 切齊微型進度條底緣
    this.element.style.backdropFilter = 'blur(8px)';
    (this.element.style as any).webkitBackdropFilter = 'blur(8px)';
    this.element.style.pointerEvents = 'none';
    this.element.style.userSelect = 'none';
    this.element.style.opacity = '0';
    this.element.style.transition = 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease';
    this.element.style.transform = 'translateY(4px)';

    this.modeEl.style.fontWeight = 'bold';
    this.modeEl.style.letterSpacing = '1px';
    this.modeEl.style.transition = 'color 0.2s ease';

    this.pendingEl.style.display = 'none';
    this.pendingEl.style.padding = '1px 5px';
    this.pendingEl.style.borderRadius = '3px';
    this.pendingEl.style.fontSize = '11px';
    this.pendingEl.style.fontWeight = 'bold';
    this.pendingEl.style.lineHeight = '1';
    this.pendingEl.style.letterSpacing = '0.5px';
    this.pendingEl.style.transition = 'color 0.2s ease, background-color 0.2s ease';

    this.infoEl.style.opacity = '0.75';
    this.infoEl.style.transition = 'color 0.2s ease, opacity 0.2s ease';

    this.progressBarEl.style.position = 'absolute';
    this.progressBarEl.style.bottom = '0';
    this.progressBarEl.style.left = '0';
    this.progressBarEl.style.height = '2px';
    this.progressBarEl.style.width = '0%';
    this.progressBarEl.style.transition = 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease';
  }

  /**
   * 智慧防遮擋機制 (Anti-Obstruction Ghost Mode)
   * 當滑鼠靠近右下角角落時，狀態列自動降低不透明度為 0.15 幽靈模式，避免遮擋底層內文或功能按鈕
   */
  private setupAntiObstruction(): void {
    this.mouseMoveHandler = (e: MouseEvent) => {
      const thresholdX = window.innerWidth - 220;
      const thresholdY = window.innerHeight - 80;
      const near = e.clientX >= thresholdX && e.clientY >= thresholdY;

      if (near !== this.isMouseNearby) {
        this.isMouseNearby = near;
        this.updateVisibility(cursorStore.getState());
      }
    };
    window.addEventListener('mousemove', this.mouseMoveHandler, { passive: true });
  }

  private applyThemeStyles(theme: CursorTheme): void {
    const isLight = theme === 'gruvbox-light' || theme === 'intellij-light';

    if (isLight) {
      this.element.style.background = 'rgba(248, 246, 242, 0.92)';
      this.element.style.border = '1px solid rgba(0, 0, 0, 0.12)';
      this.element.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.08)';
      this.element.style.color = '#282828';
    } else {
      this.element.style.background = 'rgba(25, 26, 32, 0.88)';
      this.element.style.border = '1px solid rgba(255, 255, 255, 0.14)';
      this.element.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.38)';
      this.element.style.color = '#ebdbb2';
    }
  }

  private updateVisibility(state: CursorState): void {
    if (!state.enabled || state.showStatusBar === false || state.isExcluded) {
      this.element.style.opacity = '0';
      this.element.style.transform = 'translateY(4px)';
      return;
    }

    // 當鍵盤游標座標進入右下角區域時，同樣自動幽靈淡出
    this.isCursorNearby = Boolean(
      state.visible &&
      state.rect &&
      state.rect.x > window.innerWidth - 240 &&
      state.rect.y > window.innerHeight - 90
    );

    if (this.isMouseNearby || this.isCursorNearby) {
      this.element.style.opacity = '0.15';
      this.element.style.transform = 'translateY(0)';
      return;
    }

    this.element.style.opacity = '1';
    this.element.style.transform = 'translateY(0)';
  }

  private bindStore(): void {
    this.unsubscribe = cursorStore.subscribe((state: CursorState) => {
      this.render(state);
    });
  }

  private render(state: CursorState): void {
    this.updateVisibility(state);
    if (!state.enabled || state.showStatusBar === false || state.isExcluded) {
      return;
    }

    const themeKey = state.theme || 'gruvbox-dark';
    const palette = THEME_PALETTES[themeKey] || THEME_PALETTES['gruvbox-dark'];
    this.applyThemeStyles(themeKey);

    // 微型進度條渲染 (與主題高亮色同步)
    const progress = Math.max(0, Math.min(100, Math.round(state.readingProgress)));
    this.progressBarEl.style.width = state.visible ? `${progress}%` : '0%';
    this.progressBarEl.style.backgroundColor = palette.normal.hex;

    const isLight = themeKey === 'gruvbox-light' || themeKey === 'intellij-light';

    if (!state.visible) {
      this.pendingEl.style.display = 'none';
      this.modeEl.textContent = 'MUZEN';
      this.modeEl.style.color = palette.normal.hex;
      const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];
      this.infoEl.textContent = dict.statusStartPrompt;
      return;
    }

    // 即時按鍵緩衝區微章 (如次數前綴 5 或雙鍵等待 g, ')
    if (state.pendingKeys) {
      this.pendingEl.style.display = 'inline-block';
      this.pendingEl.textContent = state.pendingKeys;
      this.pendingEl.style.color = palette.visual.hex;
      this.pendingEl.style.backgroundColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.14)';
    } else {
      this.pendingEl.style.display = 'none';
    }

    if (state.mode === 'VISUAL_LINE') {
      this.modeEl.textContent = '-- VISUAL LINE --';
      this.modeEl.style.color = '#d3869b'; // Gruvbox Purple / Magenta
    } else if (state.mode === 'VISUAL') {
      this.modeEl.textContent = '-- VISUAL --';
      this.modeEl.style.color = palette.visual.hex;
    } else {
      this.modeEl.textContent = '-- NORMAL --';
      this.modeEl.style.color = palette.normal.hex;
    }

    // 優先顯示臨時操作通知 (如 yank 複製回饋 Toast)
    if (state.statusNotice) {
      this.infoEl.textContent = state.statusNotice;
      this.infoEl.style.opacity = '1';
      this.infoEl.style.color = palette.normal.hex;
      return;
    }

    this.infoEl.style.color = '';
    this.infoEl.style.opacity = '0.75';

    // 若處於選取模式且具備選取統計資訊，顯示選取字數或行數
    const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];
    if ((state.mode === 'VISUAL' || state.mode === 'VISUAL_LINE') && state.selectionStats) {
      if (state.mode === 'VISUAL_LINE') {
        const linesText = dict.statusLinesCount.replace('{count}', String(state.selectionStats.lines));
        this.infoEl.textContent = `[${linesText}]`;
      } else {
        const charsText = dict.statusCharsCount.replace('{count}', String(state.selectionStats.chars));
        this.infoEl.textContent = `[${charsText}]`;
      }
      return;
    }

    this.infoEl.textContent = `[${progress}%]`;
  }

  public destroy(): void {
    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.element.remove();
  }
}
