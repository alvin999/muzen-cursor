import { cursorStore } from '../cursorStore';
import { LOCALES } from '../../i18n/locales';
import { TextTarget } from '../wordNavigator';
import { findFirstTextNodeIn } from '../navigation/spatialNavigator';
import { isTypingContext } from '../../utils/domUtils';
import { resolveTextTargetFromPoint, isClickWithinDistanceThreshold } from '../../utils/caretUtils';
import { CursorHostContext } from './types';

const INTERACTIVE_SELECTOR = [
  'button:not([disabled])',
  'summary',
  'input[type="checkbox"]',
  'input[type="button"]',
  'input[type="submit"]',
  '[role="button"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[aria-expanded]',
  '[aria-pressed]'
].join(',');

/**
 * 滑鼠點擊聚焦與超連結 / ARIA 互動元素探測管理器
 */
export class PointerInteractionManager {
  constructor(private readonly host: CursorHostContext) {}

  /**
   * 點擊網頁文字時，自動聚焦並初始化游標定位
   */
  public handleClick(e: MouseEvent): void {
    this.host.closeJumpMenu();
    this.host.closeFlashMode();
    this.host.clearPreferredX();
    const state = cursorStore.getState();

    // 1. 若處於打字情境、完全停用名單、或擴充功能未啟用，直接忽略
    if (isTypingContext(e) || state.isExcluded || state.enabled === false) {
      return;
    }

    const clickX = e.clientX;
    const clickY = e.clientY;

    const rawTarget = e.composedPath ? e.composedPath()[0] : e.target;
    const targetEl = (rawTarget instanceof Element ? rawTarget : (rawTarget as Node)?.parentElement) as HTMLElement | null;

    if (!targetEl || targetEl.closest('#muzen-cursor-host-root')) {
      return;
    }

    // 2. 智慧防誤觸：點擊按鈕、超連結、下拉選單、分頁標籤、導覽列等互動元件時，100% 保持網頁原生功能，不召喚游標
    if (targetEl.closest('button, a, summary, [role="button"], [role="tab"], [role="menuitem"], .btn, nav, header')) {
      return;
    }

    // 若限定作用容器，非容器內部的點擊一律忽略
    const containerRoot = this.host.getOptions()?.containerRoot;
    if (containerRoot && !containerRoot.contains(targetEl)) {
      return;
    }

    // 3. 標準 Caret 解析器 (解決 L199 Deprecated 問題，標準優先並兼顧相容性)
    const resolved = resolveTextTargetFromPoint(clickX, clickY, targetEl, (root) => findFirstTextNodeIn(root));
    if (!resolved) {
      return;
    }

    // 4. 關鍵距離防禦：確認找到的文字節點與點擊處的物理距離
    if (!isClickWithinDistanceThreshold(clickX, clickY, resolved.node)) {
      return;
    }

    // 若原本已有游標定位，且點擊處造成實質位移，推入跳轉堆疊 (方便誤觸時按 '' 回復)
    const currentTarget = this.host.getCurrentTarget();
    if (currentTarget && currentTarget.node && currentTarget.node.isConnected) {
      if (currentTarget.node !== resolved.node || Math.abs(currentTarget.offset - resolved.offset) > 3) {
        this.host.pushJumpPoint();
      }
    }

    this.host.setCurrentTarget({
      node: resolved.node,
      offset: resolved.offset
    });
    this.host.updateActiveScope(resolved.node);

    const curMode = cursorStore.getState().mode;
    if (curMode !== 'VISUAL' && curMode !== 'VISUAL_LINE') {
      this.host.clearSelectionAnchor();
    }

    // 直接喚醒游標並設定為可見，狀態列同步切換為 NORMAL 模式
    cursorStore.setState({ enabled: true, visible: true });
    this.host.updateCursorPosition(false);
  }

  /**
   * 取得當前文字目標所處的超連結元素 (a[href])
   */
  public getHoveredAnchor(target: TextTarget | null): HTMLAnchorElement | null {
    if (!target || !target.node) return null;
    const parent = target.node.parentElement || (target.node instanceof HTMLElement ? target.node : null);
    if (!parent) return null;
    return parent.closest('a[href]') as HTMLAnchorElement | null;
  }

  /**
   * 取得當前文字目標所處的標準互動/切換元素 (Button / Summary / ARIA 控制項)
   * 依循 W3C/ARIA 規範，並設有最大面積限制以防誤觸外層大容器
   */
  public getHoveredInteractiveElement(target: TextTarget | null): HTMLElement | null {
    if (!target || !target.node) return null;
    const parent = target.node.parentElement || (target.node instanceof HTMLElement ? target.node : null);
    if (!parent) return null;

    const el = parent.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
    if (!el) return null;

    // 防誤觸機制：過濾掉面積過大的外層容器 (例如寬高超過視窗 70% 的版面區塊)
    const rect = el.getBoundingClientRect();
    const maxW = window.innerWidth * 0.7;
    const maxH = window.innerHeight * 0.7;
    if (rect.width > maxW && rect.height > maxH) {
      return null;
    }

    return el;
  }

  /**
   * 點選或在背景新分頁開啟當前超連結
   */
  public openCurrentLink(target: TextTarget | null, inNewTab: boolean = false): boolean {
    const anchor = this.getHoveredAnchor(target);
    if (!anchor || !anchor.href) return false;

    const href = anchor.href;
    const dict = LOCALES[cursorStore.getState().locale || 'zh-TW'] || LOCALES['zh-TW'];

    if (inNewTab) {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'OPEN_TAB',
            url: href,
            active: false
          });
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      } catch {
        window.open(href, '_blank', 'noopener,noreferrer');
      }

      cursorStore.showStatusNotice(`↗ ${dict.actionOpenLinkNewTab || '新分頁已開啟'}`, 1200);
      return true;
    }

    // 當前分頁點選開啟
    anchor.click();
    return true;
  }
}
