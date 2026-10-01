/**
 * Popup 設定邏輯 (Vanilla TS)
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggleEnabled = document.getElementById('toggle-enabled') as HTMLInputElement | null;
  const toggleStatusBar = document.getElementById('toggle-status-bar') as HTMLInputElement | null;
  const togglePdf = document.getElementById('toggle-pdf') as HTMLInputElement | null;
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
  const shapeSelect = document.getElementById('shape-select') as HTMLSelectElement | null;
  const effectSmooth = document.getElementById('effect-smooth') as HTMLInputElement | null;
  const effectBreathe = document.getElementById('effect-breathe') as HTMLInputElement | null;
  const effectBlink = document.getElementById('effect-blink') as HTMLInputElement | null;
  const btnOpenPdf = document.getElementById('btn-open-pdf-viewer') as HTMLButtonElement | null;

  // 1. 初始化讀取設定
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['muzen_enabled', 'muzen_theme', 'muzen_intercept_pdf', 'muzen_shape', 'muzen_effects', 'muzen_show_status_bar', 'muzen_animation'], (data) => {
      if (toggleEnabled && typeof data.muzen_enabled === 'boolean') {
        toggleEnabled.checked = data.muzen_enabled;
      }
      if (toggleStatusBar && typeof data.muzen_show_status_bar === 'boolean') {
        toggleStatusBar.checked = data.muzen_show_status_bar;
      }
      if (togglePdf && typeof data.muzen_intercept_pdf === 'boolean') {
        togglePdf.checked = data.muzen_intercept_pdf;
      }
      if (themeSelect && data.muzen_theme) {
        themeSelect.value = data.muzen_theme;
      }
      if (shapeSelect && data.muzen_shape) {
        shapeSelect.value = data.muzen_shape;
      }
      if (data.muzen_effects) {
        if (effectSmooth) effectSmooth.checked = !!data.muzen_effects.smooth;
        if (effectBreathe) effectBreathe.checked = !!data.muzen_effects.breathe;
        if (effectBlink) effectBlink.checked = !!data.muzen_effects.blink;
      } else if (data.muzen_animation) {
        // 向下相容
        if (effectSmooth) effectSmooth.checked = data.muzen_animation === 'smooth' || data.muzen_animation === 'breathe';
        if (effectBreathe) effectBreathe.checked = data.muzen_animation === 'breathe';
        if (effectBlink) effectBlink.checked = data.muzen_animation === 'blink';
      }
    });
  }

  // 輔助函式：發送訊息至當前分頁以即時熱更新
  const broadcastToActiveTab = (message: Record<string, unknown>) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, message);
      }
    });
  };

  // 2. 開關變更事件 (主游標)
  toggleEnabled?.addEventListener('change', () => {
    const isEnabled = toggleEnabled.checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_enabled: isEnabled });
    }
    broadcastToActiveTab({ type: 'TOGGLE_CURSOR', enabled: isEnabled });
  });

  // 3. 狀態列顯示開關變更事件
  toggleStatusBar?.addEventListener('change', () => {
    const isShow = toggleStatusBar.checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_show_status_bar: isShow });
    }
    broadcastToActiveTab({ type: 'SET_STATUS_BAR', showStatusBar: isShow });
  });

  // 3. PDF 接管設定變更
  togglePdf?.addEventListener('change', () => {
    const isPdfIntercept = togglePdf.checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_intercept_pdf: isPdfIntercept });
      console.log('[Muzen Cursor] PDF 接管設定已更新:', isPdfIntercept);
    }
  });

  // 4. 手動開啟 PDF 閱讀器按鈕
  btnOpenPdf?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime?.getURL) {
      const viewerUrl = chrome.runtime.getURL('src/pdf-viewer/viewer.html');
      chrome.tabs.create({ url: viewerUrl });
    }
  });

  // 5. 主題變更事件
  themeSelect?.addEventListener('change', () => {
    const theme = themeSelect.value;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_theme: theme });
    }
    broadcastToActiveTab({ type: 'SET_THEME', theme });
  });

  // 6. 游標形態變更事件 (Block / Hollow / Underline)
  shapeSelect?.addEventListener('change', () => {
    const shape = shapeSelect.value;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_shape: shape });
    }
    broadcastToActiveTab({ type: 'SET_SHAPE', shape });
  });

  // 7. 動態特效變更事件 (多選：Smooth / Breathe / Blink)
  const onEffectsChanged = () => {
    const effects = {
      smooth: effectSmooth ? effectSmooth.checked : true,
      breathe: effectBreathe ? effectBreathe.checked : false,
      blink: effectBlink ? effectBlink.checked : false
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_effects: effects });
    }
    broadcastToActiveTab({ type: 'SET_EFFECTS', effects });
  };

  effectSmooth?.addEventListener('change', onEffectsChanged);
  effectBreathe?.addEventListener('change', onEffectsChanged);
  effectBlink?.addEventListener('change', onEffectsChanged);
});
