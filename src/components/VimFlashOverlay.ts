import { cursorStore, CursorState, FlashHintItem } from '../core/cursorStore';
import { THEME_PALETTES } from './VimCursorOverlay';
import { calculateLuminance } from '../utils/themeDetector';

/**
 * Flash / Hint 全域視覺跳轉標籤覆蓋層 (Shadow DOM 內部渲染)
 */
export class VimFlashOverlay {
  private container: HTMLElement;
  private bannerEl: HTMLElement;
  private unsubscribe: (() => void) | null = null;
  private lastRenderSignature = '';

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'muzen-flash-overlay';
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100vw';
    this.container.style.height = '100vh';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '2147483646';
    this.container.style.display = 'none';

    this.bannerEl = document.createElement('div');
    this.bannerEl.style.position = 'fixed';
    this.bannerEl.style.top = '16px';
    this.bannerEl.style.right = '20px';
    this.bannerEl.style.padding = '6px 12px';
    this.bannerEl.style.borderRadius = '8px';
    this.bannerEl.style.fontFamily = 'monospace, ui-monospace, SFMono-Regular, Menlo, Consolas';
    this.bannerEl.style.fontSize = '12px';
    this.bannerEl.style.fontWeight = '700';
    this.bannerEl.style.letterSpacing = '0.4px';
    this.bannerEl.style.background = 'rgba(24, 24, 27, 0.92)';
    this.bannerEl.style.backdropFilter = 'blur(8px)';
    this.bannerEl.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
    this.bannerEl.style.display = 'flex';
    this.bannerEl.style.alignItems = 'center';
    this.bannerEl.style.gap = '8px';

    this.unsubscribe = cursorStore.subscribe((state) => this.render(state));
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private render(state: CursorState): void {
    if (!state.isFlashMode || !state.enabled || state.isExcluded) {
      if (this.container.style.display !== 'none') {
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        this.lastRenderSignature = '';
      }
      return;
    }

    const themeKey = state.theme || 'gruvbox-dark';
    const palette = state.autoTheme && state.dynamicPalette
      ? state.dynamicPalette
      : (THEME_PALETTES[themeKey] || THEME_PALETTES['gruvbox-dark']);
    const accentHex = palette.normal.hex;
    const visualHex = palette.visual.hex;
    const isLight = state.autoTheme
      ? state.detectedPageTheme === 'light'
      : (themeKey === 'gruvbox-light' || themeKey === 'intellij-light');
    const isDarkBadge = calculateLuminance(palette.normal.r, palette.normal.g, palette.normal.b) < 140;
    const badgeTextColor = isDarkBadge ? '#ffffff' : '#18181b';

    const pendingPrefix = state.pendingKeys.startsWith('f:') ? state.pendingKeys.slice(2) : '';
    const sig = `${state.flashInputMode}|${state.flashQuery}|${pendingPrefix}|${state.flashHints.length}|${accentHex}|${isLight ? 'L' : 'D'}`;
    if (sig === this.lastRenderSignature) return;
    this.lastRenderSignature = sig;

    this.container.style.display = 'block';
    this.container.innerHTML = '';

    // 1. 狀態提示膠囊 (依深淺背景自適應對比色)
    this.bannerEl.style.background = isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(24, 24, 27, 0.92)';
    this.bannerEl.style.boxShadow = isLight
      ? '0 8px 24px rgba(0, 0, 0, 0.14)'
      : '0 8px 24px rgba(0, 0, 0, 0.4)';
    this.bannerEl.style.border = `1px solid ${accentHex}`;
    this.bannerEl.style.color = isLight ? '#18181b' : '#f4f4f5';
    const modeLabel = state.flashInputMode === 'search' ? '⚡ FLASH' : '⚡ HINT';
    const queryText = state.flashInputMode === 'search'
      ? (state.flashQuery ? `: "${state.flashQuery}"` : ': 輸入搜尋字元...')
      : '';
    const prefixText = pendingPrefix ? ` [${pendingPrefix}_]` : '';
    const helpText = state.flashInputMode === 'search'
      ? 'Enter 跳首項 · Esc 取消'
      : '/ 搜尋 · Esc 取消';
    this.bannerEl.innerHTML = `<span style="color:${accentHex}">${modeLabel}</span><span>${queryText}${prefixText}</span><span style="opacity:0.55;font-weight:400;font-size:11px;">${helpText}</span>`;
    this.container.appendChild(this.bannerEl);

    // 2. 渲染每個候選標籤
    const fragment = document.createDocumentFragment();
    state.flashHints.forEach((hint: FlashHintItem) => {
      if (pendingPrefix && !hint.label.startsWith(pendingPrefix)) {
        return;
      }

      // 搜尋字元底色高亮
      if (hint.matchLength && hint.matchLength > 0) {
        const highlight = document.createElement('div');
        highlight.style.position = 'fixed';
        highlight.style.left = `${hint.rect.x}px`;
        highlight.style.top = `${hint.rect.y}px`;
        highlight.style.width = `${hint.rect.width}px`;
        highlight.style.height = `${hint.rect.height}px`;
        highlight.style.background = `rgba(${palette.visual.r}, ${palette.visual.g}, ${palette.visual.b}, 0.28)`;
        highlight.style.borderBottom = `2px solid ${visualHex}`;
        highlight.style.borderRadius = '2px';
        fragment.appendChild(highlight);
      }

      // 標籤徽章 (置於目標左上緣，避免遮擋目標字元)
      const badge = document.createElement('div');
      badge.style.position = 'fixed';
      const badgeTop = Math.max(2, hint.rect.y - 2);
      const badgeLeft = Math.max(2, hint.rect.x - 4);
      badge.style.left = `${badgeLeft}px`;
      badge.style.top = `${badgeTop}px`;
      badge.style.transform = 'translateY(-85%)';
      badge.style.padding = '1px 5px';
      badge.style.borderRadius = '4px';
      badge.style.fontFamily = 'monospace, ui-monospace, SFMono-Regular, Menlo, Consolas';
      badge.style.fontSize = '11px';
      badge.style.fontWeight = '800';
      badge.style.lineHeight = '14px';
      badge.style.textTransform = 'uppercase';
      badge.style.background = accentHex;
      badge.style.color = badgeTextColor;
      badge.style.boxShadow = isDarkBadge
        ? '0 2px 6px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.18)'
        : '0 2px 8px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.25)';
      badge.style.whiteSpace = 'nowrap';

      if (pendingPrefix && hint.label.length > pendingPrefix.length) {
        const matchedPart = hint.label.slice(0, pendingPrefix.length);
        const restPart = hint.label.slice(pendingPrefix.length);
        badge.innerHTML = `<span style="opacity:0.4">${matchedPart}</span><span>${restPart}</span>`;
      } else {
        badge.textContent = hint.label;
      }

      fragment.appendChild(badge);
    });

    this.container.appendChild(fragment);
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.container.remove();
  }
}
