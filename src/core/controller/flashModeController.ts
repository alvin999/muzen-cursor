import { cursorStore } from '../cursorStore';
import { LOCALES } from '../../i18n/locales';
import { collectFlashHints } from '../navigation/flashNavigator';
import { CursorHostContext } from './types';

/**
 * Flash 全域視覺跳轉模式子控制器 (hint: 區塊標籤直達 / search: flash.nvim 搜尋過濾)
 */
export class FlashModeController {
  constructor(private readonly host: CursorHostContext) {}

  /**
   * 開啟 Flash 全域視覺跳轉模式
   */
  public open(mode: 'hint' | 'search' = 'hint'): void {
    this.host.closeJumpMenu();
    if (mode === 'search') {
      cursorStore.setState({
        isFlashMode: true,
        flashInputMode: 'search',
        flashQuery: '',
        flashHints: [],
        pendingKeys: ''
      });
      return;
    }

    const hints = collectFlashHints(this.host.getRootElement(), '');
    if (hints.length === 0) {
      const dict = LOCALES[cursorStore.getState().locale || 'zh-TW'] || LOCALES['zh-TW'];
      cursorStore.showStatusNotice(dict.noticeFlashEmpty, 1500);
      return;
    }
    cursorStore.setState({
      isFlashMode: true,
      flashInputMode: 'hint',
      flashQuery: '',
      flashHints: hints,
      pendingKeys: ''
    });
  }

  /**
   * 關閉 Flash 全域視覺跳轉模式
   */
  public close(): void {
    const state = cursorStore.getState();
    if (state.isFlashMode || state.flashQuery || state.flashHints.length > 0) {
      cursorStore.setState({
        isFlashMode: false,
        flashInputMode: 'hint',
        flashQuery: '',
        flashHints: [],
        pendingKeys: state.pendingKeys.startsWith('f:') ? '' : state.pendingKeys
      });
    }
  }

  public handleKey(e: KeyboardEvent, intercept: () => void): void {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.isComposing) {
      return;
    }

    intercept();
    const state = cursorStore.getState();
    const currentPrefix = state.pendingKeys.startsWith('f:') ? state.pendingKeys.slice(2) : '';

    if (e.key === 'Backspace') {
      if (currentPrefix.length > 0) {
        cursorStore.setState({ pendingKeys: '' });
        return;
      }
      if (state.flashInputMode === 'search' && state.flashQuery.length > 0) {
        const nextQuery = state.flashQuery.slice(0, -1);
        const hints = nextQuery ? collectFlashHints(this.host.getRootElement(), nextQuery) : [];
        cursorStore.setState({ flashQuery: nextQuery, flashHints: hints, pendingKeys: '' });
        return;
      }
      this.close();
      return;
    }

    // 在 Hint 模式下按 '/' 切換為 Flash 搜尋過濾模式
    if (state.flashInputMode === 'hint' && e.key === '/' && !currentPrefix) {
      cursorStore.setState({
        flashInputMode: 'search',
        flashQuery: '',
        flashHints: [],
        pendingKeys: ''
      });
      return;
    }

    // 在 Flash 搜尋模式下按 Enter 直接跳至第一個符合結果
    if (state.flashInputMode === 'search' && e.key === 'Enter' && state.flashHints.length > 0) {
      this.jumpToHint(state.flashHints[0]);
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const ch = e.key.toLowerCase();
      const nextPrefix = currentPrefix + ch;

      // 1. 若目前已有顯示標籤，優先比對跳轉標籤 (在 search 模式下，標籤已自動避開下一個可能輸入的搜尋字元)
      if (state.flashHints.length > 0) {
        const matchingHints = state.flashHints.filter((h) => h.label.startsWith(nextPrefix));
        const exactHint = matchingHints.find((h) => h.label === nextPrefix);
        if (exactHint && matchingHints.length === 1) {
          this.jumpToHint(exactHint);
          return;
        }
        if (matchingHints.length > 0) {
          cursorStore.setState({ pendingKeys: `f:${nextPrefix}` });
          return;
        }
      }

      // 2. 在 Flash 搜尋模式下，累加輸入字元進行即時過濾
      if (state.flashInputMode === 'search' && !currentPrefix) {
        const nextQuery = state.flashQuery + e.key;
        const nextHints = collectFlashHints(this.host.getRootElement(), nextQuery);
        if (nextHints.length === 0) {
          const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];
          cursorStore.showStatusNotice(dict.noticeFlashNoMatch, 1200);
          return;
        }
        cursorStore.setState({
          flashQuery: nextQuery,
          flashHints: nextHints,
          pendingKeys: ''
        });
      }
    }
  }

  private jumpToHint(hint: { node: Text | null; element?: HTMLElement; offset: number }): void {
    this.close();

    // 若跳轉目標為大型圖片/媒體元素
    if (hint.element && hint.element.isConnected) {
      this.host.pushJumpPoint();
      this.host.clearPreferredX();
      this.host.enterMediaTarget(hint.element, undefined, false);
      return;
    }

    if (!hint.node || !hint.node.isConnected) return;

    // 記錄跳轉前位置，支援 '' / `` 隨時返回
    this.host.pushJumpPoint();
    this.host.clearPreferredX();
    this.host.clearMediaTarget();

    this.host.setCurrentTarget({
      node: hint.node,
      offset: Math.min(hint.offset, Math.max(0, (hint.node.textContent?.length || 1) - 1))
    });
    this.host.updateActiveScope(hint.node);
    this.host.updateCursorPosition(true, undefined, false, true);
  }
}
