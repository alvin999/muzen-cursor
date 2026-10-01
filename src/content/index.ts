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
      } else if (message.type === 'SET_THEME') {
        cursorStore.setState({ theme: message.theme });
        sendResponse({ success: true });
      } else if (message.type === 'SET_SHAPE') {
        cursorStore.setState({ shape: message.shape });
        sendResponse({ success: true });
      } else if (message.type === 'SET_EFFECTS') {
        cursorStore.setState({ effects: message.effects });
        sendResponse({ success: true });
      } else if (message.type === 'SET_ANIMATION') {
        // 向下相容舊版單選訊息
        if (message.animation === 'smooth') {
          cursorStore.setState({ effects: { smooth: true, breathe: false, blink: false } });
        } else if (message.animation === 'breathe') {
          cursorStore.setState({ effects: { smooth: true, breathe: true, blink: false } });
        } else if (message.animation === 'blink') {
          cursorStore.setState({ effects: { smooth: false, breathe: false, blink: true } });
        }
        sendResponse({ success: true });
      } else if (message.type === 'GET_STATUS') {
        sendResponse({ success: true, state: cursorStore.getState() });
      }
      return true;
    });
  }

  // 4. 讀取持久化設定
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['muzen_enabled', 'muzen_theme', 'muzen_shape', 'muzen_effects', 'muzen_animation'], (result) => {
      if (typeof result.muzen_enabled === 'boolean') {
        cursorStore.setState({ enabled: result.muzen_enabled });
      }
      if (result.muzen_theme) {
        cursorStore.setState({ theme: result.muzen_theme });
      }
      if (result.muzen_shape) {
        cursorStore.setState({ shape: result.muzen_shape });
      }
      if (result.muzen_effects) {
        cursorStore.setState({ effects: result.muzen_effects });
      } else if (result.muzen_animation) {
        if (result.muzen_animation === 'smooth') {
          cursorStore.setState({ effects: { smooth: true, breathe: false, blink: false } });
        } else if (result.muzen_animation === 'breathe') {
          cursorStore.setState({ effects: { smooth: true, breathe: true, blink: false } });
        } else if (result.muzen_animation === 'blink') {
          cursorStore.setState({ effects: { smooth: false, breathe: false, blink: true } });
        }
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
