import { initCursorHost } from './hostElement';
import { CursorController } from '../core/cursorController';
import { cursorStore } from '../core/cursorStore';

/**
 * 判斷當前網域名稱是否命中排除名單 (支援子網域比對)
 */
function isHostnameExcluded(hostname: string, excludedList: string[]): boolean {
  if (!hostname || !excludedList || !Array.isArray(excludedList)) return false;
  const current = hostname.toLowerCase();
  return excludedList.some((item) => {
    const pattern = item.trim().toLowerCase();
    if (!pattern) return false;
    return current === pattern || current.endsWith('.' + pattern);
  });
}

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
      } else if (message.type === 'SET_THICKNESS') {
        cursorStore.setState({ thickness: Number(message.thickness) || 2 });
        sendResponse({ success: true });
      } else if (message.type === 'SET_GLOW') {
        cursorStore.setState({ glow: typeof message.glow === 'number' ? message.glow : 6 });
        sendResponse({ success: true });
      } else if (message.type === 'SET_EFFECTS') {
        const currentEffects = cursorStore.getState().effects;
        cursorStore.setState({
          effects: {
            ...currentEffects,
            ...message.effects
          }
        });
        sendResponse({ success: true });
      } else if (message.type === 'SET_STATUS_BAR') {
        cursorStore.setState({ showStatusBar: !!message.showStatusBar });
        sendResponse({ success: true });
      } else if (message.type === 'SET_LOCALE') {
        cursorStore.setState({ locale: message.locale });
        sendResponse({ success: true });
      } else if (message.type === 'UPDATE_EXCLUDED_SITES') {
        const isExcluded = isHostnameExcluded(window.location.hostname, message.excludedSites || []);
        cursorStore.setState({ isExcluded, visible: !isExcluded && cursorStore.getState().visible });
        sendResponse({ success: true, isExcluded });
      } else if (message.type === 'GET_SITE_STATUS') {
        sendResponse({
          success: true,
          hostname: window.location.hostname,
          isExcluded: cursorStore.getState().isExcluded,
          state: cursorStore.getState()
        });
      } else if (message.type === 'SET_ANIMATION') {
        // 向下相容舊版單選訊息
        if (message.animation === 'smooth') {
          cursorStore.setState({ effects: { smooth: true, bounce: true, smoothScroll: true, breathe: false, blink: false } });
        } else if (message.animation === 'breathe') {
          cursorStore.setState({ effects: { smooth: true, bounce: true, smoothScroll: true, breathe: true, blink: false } });
        } else if (message.animation === 'blink') {
          cursorStore.setState({ effects: { smooth: false, bounce: false, smoothScroll: true, breathe: false, blink: true } });
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
    chrome.storage.sync.get(['muzen_enabled', 'muzen_locale', 'muzen_theme', 'muzen_shape', 'muzen_thickness', 'muzen_glow', 'muzen_effects', 'muzen_show_status_bar', 'muzen_excluded_sites', 'muzen_animation'], (result) => {
      if (typeof result.muzen_enabled === 'boolean') {
        cursorStore.setState({ enabled: result.muzen_enabled });
      }
      if (result.muzen_locale) {
        cursorStore.setState({ locale: result.muzen_locale });
      }
      if (typeof result.muzen_show_status_bar === 'boolean') {
        cursorStore.setState({ showStatusBar: result.muzen_show_status_bar });
      }
      if (result.muzen_theme) {
        cursorStore.setState({ theme: result.muzen_theme });
      }
      if (result.muzen_shape) {
        cursorStore.setState({ shape: result.muzen_shape });
      }
      if (typeof result.muzen_thickness === 'number') {
        cursorStore.setState({ thickness: result.muzen_thickness });
      }
      if (typeof result.muzen_glow === 'number') {
        cursorStore.setState({ glow: result.muzen_glow });
      }
      if (result.muzen_effects) {
        cursorStore.setState({
          effects: {
            smooth: result.muzen_effects.smooth ?? true,
            bounce: result.muzen_effects.bounce ?? true,
            smoothScroll: result.muzen_effects.smoothScroll ?? true,
            breathe: result.muzen_effects.breathe ?? false,
            blink: result.muzen_effects.blink ?? true
          }
        });
      }
      if (result.muzen_excluded_sites && Array.isArray(result.muzen_excluded_sites)) {
        const isExcluded = isHostnameExcluded(window.location.hostname, result.muzen_excluded_sites);
        cursorStore.setState({ isExcluded });
      } else if (result.muzen_animation) {
        if (result.muzen_animation === 'smooth') {
          cursorStore.setState({ effects: { smooth: true, bounce: true, smoothScroll: true, breathe: false, blink: false } });
        } else if (result.muzen_animation === 'breathe') {
          cursorStore.setState({ effects: { smooth: true, bounce: true, smoothScroll: true, breathe: true, blink: false } });
        } else if (result.muzen_animation === 'blink') {
          cursorStore.setState({ effects: { smooth: false, bounce: false, smoothScroll: true, breathe: false, blink: true } });
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
