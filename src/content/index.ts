import { initCursorHost } from './hostElement';
import { CursorController } from '../core/cursorController';
import { cursorStore, DEFAULT_ADVANCED_CONFIG, DEFAULT_KEYBINDINGS } from '../core/cursorStore';
import { detectPageSmartInfo, observeThemeChange, SmartThemeInfo } from '../utils/themeDetector';

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
        const nextEnabled = controller.toggle(typeof message.enabled === 'boolean' ? message.enabled : undefined);
        sendResponse({ success: true, enabled: nextEnabled });
      } else if (message.type === 'SET_THEME') {
        cursorStore.setState({ theme: message.theme });
        sendResponse({ success: true });
      } else if (message.type === 'SET_AUTO_THEME') {
        const autoTheme = !!message.autoTheme;
        const smartInfo = detectPageSmartInfo();
        cursorStore.setState({
          autoTheme,
          detectedPageTheme: smartInfo.theme,
          dynamicPalette: smartInfo.palette,
          detectedBgRgb: smartInfo.bgRgb
        });
        sendResponse({
          success: true,
          autoTheme,
          detectedPageTheme: smartInfo.theme,
          dynamicPalette: smartInfo.palette,
          detectedBgRgb: smartInfo.bgRgb
        });
      } else if (message.type === 'SET_DARK_THEME') {
        const state = cursorStore.getState();
        const nextTheme = state.autoTheme && state.detectedPageTheme === 'dark' ? message.theme : state.theme;
        cursorStore.setState({ darkTheme: message.theme, theme: nextTheme });
        sendResponse({ success: true, theme: nextTheme });
      } else if (message.type === 'SET_LIGHT_THEME') {
        const state = cursorStore.getState();
        const nextTheme = state.autoTheme && state.detectedPageTheme === 'light' ? message.theme : state.theme;
        cursorStore.setState({ lightTheme: message.theme, theme: nextTheme });
        sendResponse({ success: true, theme: nextTheme });
      } else if (message.type === 'SET_SHAPE') {
        cursorStore.setState({ shape: message.shape });
        sendResponse({ success: true });
      } else if (message.type === 'SET_THICKNESS') {
        cursorStore.setState({ thickness: Number(message.thickness) || 1.5 });
        sendResponse({ success: true });
      } else if (message.type === 'SET_GLOW') {
        cursorStore.setState({ glow: typeof message.glow === 'number' ? message.glow : 0 });
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
      } else if (message.type === 'SET_ADVANCED_STATUS_BAR') {
        cursorStore.setState({ showAdvancedStatusBar: !!message.showAdvancedStatusBar });
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
      } else if (message.type === 'SET_ADVANCED') {
        const currentAdv = cursorStore.getState().advanced || DEFAULT_ADVANCED_CONFIG;
        cursorStore.setState({
          advanced: {
            ...currentAdv,
            ...message.advanced
          }
        });
        sendResponse({ success: true });
      } else if (message.type === 'SET_KEYBINDINGS') {
        const currentKeys = cursorStore.getState().keybindings || DEFAULT_KEYBINDINGS;
        cursorStore.setState({
          keybindings: {
            ...currentKeys,
            ...message.keybindings,
            bindings: {
              ...currentKeys.bindings,
              ...(message.keybindings?.bindings || {})
            }
          }
        });
        sendResponse({ success: true });
      } else if (message.type === 'GET_STATUS') {
        sendResponse({ success: true, state: cursorStore.getState() });
      }
      return true;
    });
  }

  // 4. 讀取持久化設定
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['muzen_enabled', 'muzen_locale', 'muzen_theme', 'muzen_auto_theme', 'muzen_dark_theme', 'muzen_light_theme', 'muzen_shape', 'muzen_thickness', 'muzen_glow', 'muzen_effects', 'muzen_show_status_bar', 'muzen_excluded_sites', 'muzen_animation', 'muzen_advanced', 'muzen_keybindings'], (result) => {
      if (typeof result.muzen_enabled === 'boolean') {
        cursorStore.setState({ enabled: result.muzen_enabled });
      }
      if (result.muzen_locale) {
        cursorStore.setState({ locale: result.muzen_locale });
      }
      if (typeof result.muzen_show_status_bar === 'boolean') {
        cursorStore.setState({ showStatusBar: result.muzen_show_status_bar });
      }
      if (typeof result.muzen_show_advanced_status_bar === 'boolean') {
        cursorStore.setState({ showAdvancedStatusBar: result.muzen_show_advanced_status_bar });
      }
      if (result.muzen_theme) {
        cursorStore.setState({ theme: result.muzen_theme });
      }
      if (typeof result.muzen_auto_theme === 'boolean') {
        cursorStore.setState({ autoTheme: result.muzen_auto_theme });
      }
      if (result.muzen_dark_theme) {
        cursorStore.setState({ darkTheme: result.muzen_dark_theme });
      }
      if (result.muzen_light_theme) {
        cursorStore.setState({ lightTheme: result.muzen_light_theme });
      }

      // 感應當前網頁主題並在 autoTheme 啟用時套用智慧最適配色
      const smartInfo = detectPageSmartInfo();
      cursorStore.setState({
        detectedPageTheme: smartInfo.theme,
        dynamicPalette: smartInfo.palette,
        detectedBgRgb: smartInfo.bgRgb
      });
      if (result.muzen_auto_theme) {
        cursorStore.setState({ autoTheme: true });
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
      if (result.muzen_advanced && typeof result.muzen_advanced === 'object') {
        cursorStore.setState({
          advanced: {
            ...DEFAULT_ADVANCED_CONFIG,
            ...result.muzen_advanced
          }
        });
      }
      if (result.muzen_keybindings && typeof result.muzen_keybindings === 'object') {
        cursorStore.setState({
          keybindings: {
            ...DEFAULT_KEYBINDINGS,
            ...result.muzen_keybindings,
            bindings: {
              ...DEFAULT_KEYBINDINGS.bindings,
              ...(result.muzen_keybindings.bindings || {})
            }
          }
        });
      }
      if (result.muzen_effects) {
        cursorStore.setState({
          effects: {
            smooth: result.muzen_effects.smooth ?? true,
            bounce: result.muzen_effects.bounce ?? true,
            smoothScroll: result.muzen_effects.smoothScroll ?? true,
            breathe: result.muzen_effects.breathe ?? false,
            blink: result.muzen_effects.blink ?? true,
            trail: result.muzen_effects.trail ?? true
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

    // 監聽外部選項頁面儲存之變動，即時熱更新
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;
      if (changes.muzen_advanced) {
        const updated = changes.muzen_advanced.newValue || {};
        cursorStore.setState({
          advanced: {
            ...DEFAULT_ADVANCED_CONFIG,
            ...updated
          }
        });
      }
      if (changes.muzen_thickness && typeof changes.muzen_thickness.newValue === 'number') {
        cursorStore.setState({ thickness: changes.muzen_thickness.newValue });
      }
      if (changes.muzen_glow && typeof changes.muzen_glow.newValue === 'number') {
        cursorStore.setState({ glow: changes.muzen_glow.newValue });
      }
      if (changes.muzen_keybindings) {
        const updatedKeys = changes.muzen_keybindings.newValue || {};
        cursorStore.setState({
          keybindings: {
            ...DEFAULT_KEYBINDINGS,
            ...updatedKeys,
            bindings: {
              ...DEFAULT_KEYBINDINGS.bindings,
              ...(updatedKeys.bindings || {})
            }
          }
        });
      }
      if (changes.muzen_enabled) {
        cursorStore.setState({ enabled: changes.muzen_enabled.newValue });
      }
      if (changes.muzen_theme) {
        cursorStore.setState({ theme: changes.muzen_theme.newValue });
      }
      if (changes.muzen_auto_theme) {
        const isAuto = Boolean(changes.muzen_auto_theme.newValue);
        const smartInfo = detectPageSmartInfo();
        cursorStore.setState({
          autoTheme: isAuto,
          detectedPageTheme: smartInfo.theme,
          dynamicPalette: smartInfo.palette
        });
      }
      if (changes.muzen_dark_theme) {
        cursorStore.setState({ darkTheme: changes.muzen_dark_theme.newValue });
      }
      if (changes.muzen_light_theme) {
        cursorStore.setState({ lightTheme: changes.muzen_light_theme.newValue });
      }
      if (changes.muzen_shape) {
        cursorStore.setState({ shape: changes.muzen_shape.newValue });
      }
      if (changes.muzen_effects) {
        cursorStore.setState({ effects: changes.muzen_effects.newValue });
      }
    });
  }

  // 5. 監聽網頁深淺色主題動態變化 (SPA 免重整即時換膚支援)
  observeThemeChange((info: SmartThemeInfo) => {
    cursorStore.setState({
      detectedPageTheme: info.theme,
      dynamicPalette: info.palette,
      detectedBgRgb: info.bgRgb
    });
  });

  console.log('[Muzen Cursor] 霧前禪夢，見字如初。Vim 閱讀游標已成功就緒。');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
