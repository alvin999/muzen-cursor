/**
 * Popup 設定邏輯 (Vanilla TS)
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggleEnabled = document.getElementById('toggle-enabled') as HTMLInputElement | null;
  const togglePdf = document.getElementById('toggle-pdf') as HTMLInputElement | null;
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
  const btnOpenPdf = document.getElementById('btn-open-pdf-viewer') as HTMLButtonElement | null;

  // 1. 初始化讀取設定
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['muzen_enabled', 'muzen_theme', 'muzen_intercept_pdf'], (data) => {
      if (toggleEnabled && typeof data.muzen_enabled === 'boolean') {
        toggleEnabled.checked = data.muzen_enabled;
      }
      if (togglePdf && typeof data.muzen_intercept_pdf === 'boolean') {
        togglePdf.checked = data.muzen_intercept_pdf;
      }
      if (themeSelect && data.muzen_theme) {
        themeSelect.value = data.muzen_theme;
      }
    });
  }

  // 2. 開關變更事件 (主游標)
  toggleEnabled?.addEventListener('change', () => {
    const isEnabled = toggleEnabled.checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_enabled: isEnabled });
    }

    // 發送訊息給當前活躍分頁
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, {
          type: 'TOGGLE_CURSOR',
          enabled: isEnabled
        });
      }
    });
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
  });
});
