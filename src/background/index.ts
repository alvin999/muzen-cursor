/**
 * Muzen Cursor Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Muzen Cursor] 擴充功能安裝成功。');
    // 初始化預設值
    chrome.storage.sync.set({
      muzen_enabled: true,
      muzen_theme: 'gruvbox-dark',
      muzen_intercept_pdf: true // 預設開啟 PDF 閱讀接管
    });
  }
});

// 監聽 PDF 網址開啟事件，依據使用者偏好決定是否由 Muzen PDF 接管
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (!url) return;

  const extensionBaseUrl = chrome.runtime.getURL('');
  // 避免重複導向自身擴充功能內部頁面
  if (url.startsWith(extensionBaseUrl)) return;

  // 判斷是否為以 .pdf 結尾或帶有參數的 PDF 網址
  const isPdfUrl = /\.pdf($|\?)/i.test(url);
  if (!isPdfUrl) return;

  // 檢查使用者是否開啟了「PDF 閱讀接管」
  chrome.storage.sync.get(['muzen_intercept_pdf'], (data) => {
    // 預設為 true，若使用者明確設定為 false 則不接管
    const shouldIntercept = typeof data.muzen_intercept_pdf === 'boolean' ? data.muzen_intercept_pdf : true;
    if (shouldIntercept) {
      const viewerUrl = `${extensionBaseUrl}src/pdf-viewer/viewer.html?file=${encodeURIComponent(url)}`;
      chrome.tabs.update(tabId, { url: viewerUrl });
      console.log(`[Muzen Cursor] 已將 PDF 導向至專屬閱讀器: ${url}`);
    }
  });
});

// 監聽快捷鍵指令
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-cursor') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_CURSOR' });
      }
    });
  }
});

