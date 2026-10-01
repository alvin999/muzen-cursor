import { initCursorHost } from './hostElement';
import { CursorController } from '../core/cursorController';
import { cursorStore } from '../core/cursorStore';

/**
 * Muzen Cursor Content Script 入口點
 */
function main(): void {
  // 避免重複注入
  if ((window as unknown as { __MUZEN_CURSOR_INITIALIZED__?: boolean }).__MUZEN_CURSOR_INITIALIZED__) {
    return;
  }
  (window as unknown as { __MUZEN_CURSOR_INITIALIZED__?: boolean }).__MUZEN_CURSOR_INITIALIZED__ = true;

  // 1. 掛載 Shadow DOM 宿主元件
  initCursorHost();

  // 2. 初始化核心 Vim 游標控制器
  const controller = new CursorController();
  controller.init();

  // 3. 監聽 Background / Popup 訊息通訊
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'TOGGLE_CURSOR') {
        const current = cursorStore.getState().enabled;
        cursorStore.setState({ enabled: !current });
        sendResponse({ success: true, enabled: !current });
      } else if (message.type === 'GET_STATUS') {
        sendResponse({ success: true, state: cursorStore.getState() });
      }
      return true;
    });
  }

  // 4. 讀取持久化設定
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['muzen_enabled', 'muzen_theme'], (result) => {
      if (typeof result.muzen_enabled === 'boolean') {
        cursorStore.setState({ enabled: result.muzen_enabled });
      }
      if (result.muzen_theme) {
        cursorStore.setState({ theme: result.muzen_theme });
      }
    });
  }

  console.log('[Muzen Cursor] 霧前禪夢，見字如初。Vim 閱讀游標已成功就緒。');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
