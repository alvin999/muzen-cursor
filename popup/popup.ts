import { LOCALES, Locale, Translations, detectDefaultLocale } from '../src/i18n/locales';

/**
 * Popup 設定邏輯 (Vanilla TS)
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggleEnabled = document.getElementById('toggle-enabled') as HTMLInputElement | null;
  const toggleStatusBar = document.getElementById('toggle-status-bar') as HTMLInputElement | null;
  const togglePdf = document.getElementById('toggle-pdf') as HTMLInputElement | null;
  const localeSelect = document.getElementById('locale-select') as HTMLSelectElement | null;
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
  const shapeSelect = document.getElementById('shape-select') as HTMLSelectElement | null;
  const effectSmooth = document.getElementById('effect-smooth') as HTMLInputElement | null;
  const effectBreathe = document.getElementById('effect-breathe') as HTMLInputElement | null;
  const effectBlink = document.getElementById('effect-blink') as HTMLInputElement | null;
  const btnOpenPdf = document.getElementById('btn-open-pdf-viewer') as HTMLButtonElement | null;
  const currentSiteHostEl = document.getElementById('current-site-host');
  const toggleCurrentSite = document.getElementById('toggle-current-site') as HTMLInputElement | null;
  const btnToggleBlacklistView = document.getElementById('btn-toggle-blacklist-view');
  const blacklistDrawer = document.getElementById('blacklist-drawer');
  const blacklistInput = document.getElementById('blacklist-input') as HTMLTextAreaElement | null;
  const blacklistCount = document.getElementById('blacklist-count');
  const btnSaveBlacklist = document.getElementById('btn-save-blacklist');
  const collapseArrow = document.getElementById('collapse-arrow');

  let currentHostname = '';
  let excludedSites: string[] = [];
  let currentLocale: Locale = 'zh-TW';

  // 套用主題至 Popup 視窗
  const applyTheme = (theme: string) => {
    document.body.setAttribute('data-theme', theme || 'gruvbox-dark');
  };

  // 套用語言字典至 Popup 視窗
  const applyLocale = (locale: Locale) => {
    currentLocale = locale;
    const dict = LOCALES[locale] || LOCALES['zh-TW'];

    // 1. 替換所有帶有 data-i18n 屬性的文字
    const i18nElements = document.querySelectorAll<HTMLElement>('[data-i18n]');
    i18nElements.forEach((el) => {
      const key = el.getAttribute('data-i18n') as keyof Translations;
      if (key && dict[key]) {
        el.textContent = dict[key];
      }
    });

    // 2. 替換特定輸入框的 placeholder
    if (blacklistInput) {
      blacklistInput.placeholder = dict.blacklistPlaceholder;
    }

    // 3. 更新當前網域標籤預設文字（若未完成偵測）
    if (currentSiteHostEl && (currentSiteHostEl.textContent === '偵測中...' || currentSiteHostEl.textContent === 'Detecting...' || currentSiteHostEl.textContent === '検出中...')) {
      currentSiteHostEl.textContent = dict.blacklistDetecting;
    }
  };

  // 比對網域是否被排除
  const isExcluded = (host: string, list: string[]): boolean => {
    if (!host || !list) return false;
    const current = host.toLowerCase();
    return list.some((item) => {
      const pattern = item.trim().toLowerCase();
      if (!pattern) return false;
      return current === pattern || current.endsWith('.' + pattern);
    });
  };

  // 1. 初始化讀取設定
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['muzen_enabled', 'muzen_locale', 'muzen_theme', 'muzen_intercept_pdf', 'muzen_shape', 'muzen_effects', 'muzen_show_status_bar', 'muzen_excluded_sites', 'muzen_animation'], (data) => {
      // 載入語言設定
      const savedLocale = (data.muzen_locale as Locale) || detectDefaultLocale();
      if (localeSelect) {
        localeSelect.value = savedLocale;
      }
      applyLocale(savedLocale);

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
        applyTheme(data.muzen_theme);
      } else {
        applyTheme('gruvbox-dark');
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

      // 載入排除網站名單
      if (Array.isArray(data.muzen_excluded_sites)) {
        excludedSites = data.muzen_excluded_sites;
      }
      if (blacklistInput) {
        blacklistInput.value = excludedSites.join('\n');
      }
      if (blacklistCount) {
        blacklistCount.textContent = String(excludedSites.length);
      }
      if (toggleCurrentSite && currentHostname) {
        toggleCurrentSite.checked = isExcluded(currentHostname, excludedSites);
      }
    });
  }

  // 取得當前作用中分頁的 hostname
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.url) {
        try {
          const urlObj = new URL(activeTab.url);
          if (urlObj.protocol.startsWith('http')) {
            currentHostname = urlObj.hostname;
            if (currentSiteHostEl) {
              currentSiteHostEl.textContent = currentHostname;
              currentSiteHostEl.title = currentHostname;
            }
            if (toggleCurrentSite) {
              toggleCurrentSite.disabled = false;
              toggleCurrentSite.checked = isExcluded(currentHostname, excludedSites);
            }
          } else {
            if (currentSiteHostEl) currentSiteHostEl.textContent = urlObj.protocol.replace(':', '');
            if (toggleCurrentSite) toggleCurrentSite.disabled = true;
          }
        } catch {
          if (currentSiteHostEl) currentSiteHostEl.textContent = '本機分頁';
          if (toggleCurrentSite) toggleCurrentSite.disabled = true;
        }
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

  // 4. 當前網站排除開關
  toggleCurrentSite?.addEventListener('change', () => {
    if (!currentHostname) return;
    const shouldExclude = toggleCurrentSite.checked;

    if (shouldExclude) {
      if (!isExcluded(currentHostname, excludedSites)) {
        excludedSites.push(currentHostname);
      }
    } else {
      excludedSites = excludedSites.filter((h) => h.toLowerCase() !== currentHostname.toLowerCase());
    }

    if (blacklistInput) {
      blacklistInput.value = excludedSites.join('\n');
    }
    if (blacklistCount) {
      blacklistCount.textContent = String(excludedSites.length);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_excluded_sites: excludedSites });
    }
    broadcastToActiveTab({ type: 'UPDATE_EXCLUDED_SITES', excludedSites });
  });

  // 5. 展開 / 收合排除名單抽屜
  btnToggleBlacklistView?.addEventListener('click', () => {
    if (!blacklistDrawer) return;
    const isHidden = blacklistDrawer.classList.contains('hidden');
    if (isHidden) {
      blacklistDrawer.classList.remove('hidden');
      if (collapseArrow) collapseArrow.textContent = '▲';
    } else {
      blacklistDrawer.classList.add('hidden');
      if (collapseArrow) collapseArrow.textContent = '▼';
    }
  });

  // 6. 儲存自訂排除名單
  btnSaveBlacklist?.addEventListener('click', () => {
    if (!blacklistInput) return;
    const lines = blacklistInput.value
      .split('\n')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);

    excludedSites = Array.from(new Set(lines));
    blacklistInput.value = excludedSites.join('\n');

    if (blacklistCount) {
      blacklistCount.textContent = String(excludedSites.length);
    }
    if (toggleCurrentSite && currentHostname) {
      toggleCurrentSite.checked = isExcluded(currentHostname, excludedSites);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_excluded_sites: excludedSites });
    }
    broadcastToActiveTab({ type: 'UPDATE_EXCLUDED_SITES', excludedSites });

    const originalText = btnSaveBlacklist.textContent;
    btnSaveBlacklist.textContent = (LOCALES[currentLocale] || LOCALES['zh-TW']).blacklistSavedBtn;
    setTimeout(() => {
      btnSaveBlacklist.textContent = originalText;
    }, 1200);
  });

  // 7. 語言切換事件
  localeSelect?.addEventListener('change', () => {
    const newLocale = (localeSelect.value as Locale) || 'zh-TW';
    applyLocale(newLocale);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_locale: newLocale });
    }
    broadcastToActiveTab({ type: 'SET_LOCALE', locale: newLocale });
  });

  // 8. PDF 接管設定變更
  togglePdf?.addEventListener('change', () => {
    const isPdfIntercept = togglePdf.checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_intercept_pdf: isPdfIntercept });
      console.log('[Muzen Cursor] PDF 接管設定已更新:', isPdfIntercept);
    }
  });

  // 8. 手動開啟 PDF 閱讀器按鈕
  btnOpenPdf?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime?.getURL) {
      const viewerUrl = chrome.runtime.getURL('src/pdf-viewer/viewer.html');
      chrome.tabs.create({ url: viewerUrl });
    }
  });

  // 9. 主題變更事件
  themeSelect?.addEventListener('change', () => {
    const theme = themeSelect.value;
    applyTheme(theme);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_theme: theme });
    }
    broadcastToActiveTab({ type: 'SET_THEME', theme });
  });

  // 10. 游標形態變更事件 (Block / Hollow / Underline)
  shapeSelect?.addEventListener('change', () => {
    const shape = shapeSelect.value;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_shape: shape });
    }
    broadcastToActiveTab({ type: 'SET_SHAPE', shape });
  });

  // 11. 動態特效變更事件 (多選：Smooth / Breathe / Blink)
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
