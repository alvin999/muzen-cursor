/**
 * Muzen Cursor Background Service Worker (Manifest V3)
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('[Muzen Cursor]');
const bgLogger = createLogger('[Muzen Background]');


chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    logger.info('擴充功能安裝成功。');
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
  const rawUrl = changeInfo.url || tab.url;
  if (!rawUrl) return;

  const extensionBaseUrl = chrome.runtime.getURL('');
  // 避免重複導向自身擴充功能內部頁面
  if (rawUrl.startsWith(extensionBaseUrl)) return;

  // 1. 偵測並解包被其他擴充功能（如 Adobe Acrobat 等）包覆的原始網址
  let targetUrl = rawUrl;
  let isConflictFromOtherExtension = false;

  const wrappedMatch = rawUrl.match(/^chrome-extension:\/\/[a-z]{32}\/(https?:\/\/.+)$/i);
  if (wrappedMatch) {
    targetUrl = wrappedMatch[1];
    isConflictFromOtherExtension = true;
    logger.info('偵測到 Adobe 或其他 PDF 擴充功能網址包覆，已自動解包原始網址:', targetUrl);
  }

  // 2. 判斷是否為 PDF 網址（且必須為 http 或 https 協議，排除無效的內部擴充功能網址）
  const isPdfUrl = /\.pdf($|\?)/i.test(targetUrl);
  if (!isPdfUrl) return;
  if (!/^https?:\/\//i.test(targetUrl)) return;

  // 3. 檢查使用者是否開啟了「PDF 閱讀接管」
  chrome.storage.sync.get(['muzen_intercept_pdf'], (data) => {
    // 預設為 true，若使用者明確設定為 false 則不接管
    const shouldIntercept = typeof data.muzen_intercept_pdf === 'boolean' ? data.muzen_intercept_pdf : true;
    if (shouldIntercept) {
      const viewerUrl = `${extensionBaseUrl}src/pdf-viewer/viewer.html?file=${encodeURIComponent(targetUrl)}${isConflictFromOtherExtension ? '&conflict=adobe' : ''}`;
      chrome.tabs.update(tabId, { url: viewerUrl });
      logger.info(`已將 PDF 導向至專屬閱讀器: ${targetUrl}`);
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

// 監聽前端 Viewer 的 PDF 下載請求，利用 Service Worker 繞過 Brave Shields / 前端限制
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OPEN_TAB') {
    if (message.url) {
      chrome.tabs.create({
        url: message.url,
        active: message.active ?? false
      });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'URL is required' });
    }
    return true;
  }

  if (message.type === 'FETCH_PDF_DATA') {
    (async () => {
      try {
        bgLogger.info('開始代理抓取 PDF:', message.url);
        const resp = await fetch(message.url);
        if (!resp.ok) {
          throw new Error(`HTTP 請求失敗，狀態碼：${resp.status}`);
        }
        const buffer = await resp.arrayBuffer();
        bgLogger.info('PDF 抓取成功，大小 (bytes):', buffer.byteLength);
        // 將二進位轉成 Base64 字串傳遞給前端
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const len = bytes.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
          binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
        }
        sendResponse({ success: true, base64: btoa(binary) });
      } catch (err) {
        bgLogger.error('代理抓取 PDF 失敗:', err, '目標網址:', message.url);
        sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true; // 保持非同步通訊通道開放
  }
});

