import { cursorStore, CursorState, JumpMenuItem } from '../core/cursorStore';

/**
 * Neovim 風格懸浮跳轉歷史選單 (Shadow DOM 內部渲染)
 */
export class VimJumpMenu {
  private element: HTMLElement;
  private listEl: HTMLElement;
  private headerEl: HTMLElement;
  private hintEl: HTMLElement;
  private unsubscribe: (() => void) | null = null;
  private onSelectCallback: ((item: JumpMenuItem) => void) | null = null;

  constructor(onSelect?: (item: JumpMenuItem) => void) {
    this.onSelectCallback = onSelect || null;
    this.element = document.createElement('div');
    this.element.className = 'muzen-jump-menu';

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'muzen-jump-header';

    this.listEl = document.createElement('div');
    this.listEl.className = 'muzen-jump-list';

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'muzen-jump-hint';

    this.element.appendChild(this.headerEl);
    this.element.appendChild(this.listEl);
    this.element.appendChild(this.hintEl);

    this.applyStyles();
    this.bindStore();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setOnSelect(cb: (item: JumpMenuItem) => void): void {
    this.onSelectCallback = cb;
  }

  private applyStyles(): void {
    this.element.style.position = 'fixed';
    this.element.style.bottom = '46px';
    this.element.style.right = '20px';
    this.element.style.width = '340px';
    this.element.style.maxHeight = '320px';
    this.element.style.zIndex = '2147483647';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.fontFamily = 'monospace, ui-monospace, SFMono-Regular, Menlo, Consolas';
    this.element.style.fontSize = '12px';
    this.element.style.borderRadius = '8px';
    this.element.style.background = 'rgba(28, 28, 28, 0.92)';
    this.element.style.backdropFilter = 'blur(10px)';
    this.element.style.border = '1px solid rgba(235, 219, 178, 0.2)';
    this.element.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)';
    this.element.style.color = '#ebdbb2';
    this.element.style.userSelect = 'none';
    this.element.style.pointerEvents = 'auto';
    this.element.style.overflow = 'hidden';
    this.element.style.opacity = '0';
    this.element.style.transform = 'translateY(10px) scale(0.97)';
    this.element.style.transition = 'opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)';

    this.headerEl.style.display = 'flex';
    this.headerEl.style.justifyContent = 'space-between';
    this.headerEl.style.alignItems = 'center';
    this.headerEl.style.padding = '8px 12px';
    this.headerEl.style.borderBottom = '1px solid rgba(235, 219, 178, 0.1)';
    this.headerEl.style.fontSize = '11px';
    this.headerEl.style.fontWeight = 'bold';
    this.headerEl.style.letterSpacing = '0.5px';
    this.headerEl.style.color = '#d79921';

    this.listEl.style.display = 'flex';
    this.listEl.style.flexDirection = 'column';
    this.listEl.style.overflowY = 'auto';
    this.listEl.style.maxHeight = '230px';
    this.listEl.style.padding = '4px 0';

    this.hintEl.style.padding = '6px 12px';
    this.hintEl.style.fontSize = '10px';
    this.hintEl.style.color = 'rgba(235, 219, 178, 0.5)';
    this.hintEl.style.borderTop = '1px solid rgba(235, 219, 178, 0.08)';
    this.hintEl.style.textAlign = 'right';
  }

  private bindStore(): void {
    this.unsubscribe = cursorStore.subscribe((state) => {
      this.updateView(state);
    });
  }

  private updateView(state: CursorState): void {
    if (!state.isJumpMenuOpen || !state.jumpMenuItems || state.jumpMenuItems.length === 0) {
      this.element.style.opacity = '0';
      this.element.style.transform = 'translateY(10px) scale(0.97)';
      this.element.style.pointerEvents = 'none';
      return;
    }

    this.element.style.opacity = '1';
    this.element.style.transform = 'translateY(0) scale(1)';
    this.element.style.pointerEvents = 'auto';

    const locale = state.locale || 'zh-TW';
    const titleText = locale === 'en' ? '⛩️ Jump List' : locale === 'ja' ? '⛩️ ジャンプ履歴' : '⛩️ 跳轉歷史清單';
    this.headerEl.innerHTML = `<span>${titleText}</span><span style="opacity: 0.6; font-size: 10px;">[Esc 關閉]</span>`;

    const hintText = locale === 'en' ? 'Press [1-9] to jump' : locale === 'ja' ? '[1-9]キーでジャンプ' : '按數字鍵 [1-9] 直接跳轉';
    this.hintEl.textContent = hintText;

    this.listEl.innerHTML = '';
    state.jumpMenuItems.forEach((item) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '6px 12px';
      row.style.cursor = 'pointer';
      row.style.transition = 'background 0.12s ease';

      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(235, 219, 178, 0.12)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onSelectCallback) {
          this.onSelectCallback(item);
        }
      });

      const leftWrap = document.createElement('div');
      leftWrap.style.display = 'flex';
      leftWrap.style.alignItems = 'center';
      leftWrap.style.gap = '8px';
      leftWrap.style.overflow = 'hidden';
      leftWrap.style.textOverflow = 'ellipsis';
      leftWrap.style.whiteSpace = 'nowrap';
      leftWrap.style.maxWidth = '260px';

      const keyBadge = document.createElement('span');
      keyBadge.style.display = 'inline-block';
      keyBadge.style.minWidth = '18px';
      keyBadge.style.padding = '1px 4px';
      keyBadge.style.borderRadius = '3px';
      keyBadge.style.background = 'rgba(215, 153, 33, 0.25)';
      keyBadge.style.color = '#fabd2f';
      keyBadge.style.fontWeight = 'bold';
      keyBadge.style.textAlign = 'center';
      keyBadge.textContent = String(item.index);

      const previewText = document.createElement('span');
      previewText.style.color = '#ebdbb2';
      previewText.style.fontSize = '12px';
      previewText.textContent = item.textPreview || '(無文字預覽)';

      leftWrap.appendChild(keyBadge);
      leftWrap.appendChild(previewText);

      const percent = document.createElement('span');
      percent.style.color = 'rgba(235, 219, 178, 0.45)';
      percent.style.fontSize = '11px';
      percent.style.marginLeft = '8px';
      percent.textContent = `${item.scrollPercent}%`;

      row.appendChild(leftWrap);
      row.appendChild(percent);

      this.listEl.appendChild(row);
    });
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.element.remove();
  }
}
