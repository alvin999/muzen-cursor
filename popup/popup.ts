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
  const thicknessSlider = document.getElementById('thickness-slider') as HTMLInputElement | null;
  const thicknessVal = document.getElementById('thickness-val');
  const presetBtns = document.querySelectorAll<HTMLButtonElement>('.preset-btn');
  const glowSlider = document.getElementById('glow-slider') as HTMLInputElement | null;
  const glowVal = document.getElementById('glow-val');
  const effectSmooth = document.getElementById('effect-smooth') as HTMLInputElement | null;
  const effectBounce = document.getElementById('effect-bounce') as HTMLInputElement | null;
  const effectSmoothScroll = document.getElementById('effect-smooth-scroll') as HTMLInputElement | null;
  const effectTrail = document.getElementById('effect-trail') as HTMLInputElement | null;
  const pulseRadios = document.querySelectorAll<HTMLInputElement>('input[name="muzen-pulse"]');
  const btnResetDefaults = document.getElementById('btn-reset-defaults') as HTMLButtonElement | null;
  const btnOpenOptions = document.getElementById('btn-open-options') as HTMLButtonElement | null;
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
  let currentGlow = 6;

  // 更新粗細 UI
  const updateThicknessUI = (val: number) => {
    if (thicknessSlider) thicknessSlider.value = String(val);
    if (thicknessVal) thicknessVal.textContent = `${val}px`;
    presetBtns.forEach((btn) => {
      const btnVal = Number(btn.getAttribute('data-thickness'));
      btn.classList.toggle('active', btnVal === val);
    });
  };

  // 更新光暈 UI
  const updateGlowUI = (val: number) => {
    currentGlow = val;
    if (glowSlider) glowSlider.value = String(val);
    if (glowVal) {
      const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
      glowVal.textContent = val <= 0 ? (dict.glowOffDetail || dict.glowOff) : `${val}px`;
    }
  };

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

    // 4. 更新光暈數值顯示
    updateGlowUI(currentGlow);
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
    chrome.storage.sync.get(['muzen_enabled', 'muzen_locale', 'muzen_theme', 'muzen_intercept_pdf', 'muzen_shape', 'muzen_thickness', 'muzen_glow', 'muzen_effects', 'muzen_show_status_bar', 'muzen_excluded_sites', 'muzen_animation'], (data) => {
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
      if (typeof data.muzen_thickness === 'number') {
        updateThicknessUI(data.muzen_thickness);
      } else {
        updateThicknessUI(1.5);
      }
      if (typeof data.muzen_glow === 'number') {
        updateGlowUI(data.muzen_glow);
      } else {
        updateGlowUI(0);
      }
      if (data.muzen_effects) {
        if (effectSmooth) effectSmooth.checked = data.muzen_effects.smooth !== undefined ? !!data.muzen_effects.smooth : true;
        if (effectBounce) effectBounce.checked = data.muzen_effects.bounce !== undefined ? !!data.muzen_effects.bounce : true;
        if (effectSmoothScroll) effectSmoothScroll.checked = data.muzen_effects.smoothScroll !== undefined ? !!data.muzen_effects.smoothScroll : true;
        if (effectTrail) effectTrail.checked = data.muzen_effects.trail !== undefined ? !!data.muzen_effects.trail : true;
        const pulseVal = data.muzen_effects.blink ? 'blink' : data.muzen_effects.breathe ? 'breathe' : 'none';
        pulseRadios.forEach((r) => { r.checked = r.value === pulseVal; });
      } else if (data.muzen_animation) {
        // 向下相容
        if (effectSmooth) effectSmooth.checked = data.muzen_animation === 'smooth' || data.muzen_animation === 'breathe';
        if (effectBounce) effectBounce.checked = true;
        if (effectSmoothScroll) effectSmoothScroll.checked = true;
        if (effectTrail) effectTrail.checked = true;
        const pulseVal = data.muzen_animation === 'breathe' ? 'breathe' : data.muzen_animation === 'blink' ? 'blink' : 'none';
        pulseRadios.forEach((r) => { r.checked = r.value === pulseVal; });
      } else {
        // 預設為經典閃爍
        pulseRadios.forEach((r) => { r.checked = r.value === 'blink'; });
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

  // 11. 粗細 Preset 快速切換
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-thickness')) || 2;
      updateThicknessUI(val);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ muzen_thickness: val });
      }
      broadcastToActiveTab({ type: 'SET_THICKNESS', thickness: val });
    });
  });

  // 12. 粗細 Slider 滑桿調整
  thicknessSlider?.addEventListener('input', () => {
    const val = Number(thicknessSlider.value) || 2;
    updateThicknessUI(val);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_thickness: val });
    }
    broadcastToActiveTab({ type: 'SET_THICKNESS', thickness: val });
  });

  // 13. 光暈強度 Slider 滑桿調整 (0 為無光暈)
  glowSlider?.addEventListener('input', () => {
    const val = Number(glowSlider.value);
    updateGlowUI(val);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_glow: val });
    }
    broadcastToActiveTab({ type: 'SET_GLOW', glow: val });
  });

  // 14. 動態特效變更事件 (位移特效複選 + 靜態脈動單選)
  const onEffectsChanged = () => {
    let activePulse = 'blink';
    pulseRadios.forEach((r) => {
      if (r.checked) activePulse = r.value;
    });

    const effects = {
      smooth: effectSmooth ? effectSmooth.checked : true,
      bounce: effectBounce ? effectBounce.checked : true,
      smoothScroll: effectSmoothScroll ? effectSmoothScroll.checked : true,
      trail: effectTrail ? effectTrail.checked : true,
      breathe: activePulse === 'breathe',
      blink: activePulse === 'blink'
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_effects: effects });
    }
    broadcastToActiveTab({ type: 'SET_EFFECTS', effects });
  };

  effectSmooth?.addEventListener('change', onEffectsChanged);
  effectBounce?.addEventListener('change', onEffectsChanged);
  effectSmoothScroll?.addEventListener('change', onEffectsChanged);
  effectTrail?.addEventListener('change', onEffectsChanged);
  pulseRadios.forEach((r) => r.addEventListener('change', onEffectsChanged));

  // 14.5 開啟進階設定頁面
  btnOpenOptions?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../options/index.html', '_blank');
    }
  });

  // 15. 回復預設值事件
  btnResetDefaults?.addEventListener('click', () => {
    // 預設參數對齊經典體驗
    const defaultTheme = 'gruvbox-dark';
    const defaultShape = 'block';
    const defaultThickness = 1.5;
    const defaultGlow = 0;
    const defaultEffects = {
      smooth: true,
      bounce: true,
      smoothScroll: true,
      trail: true,
      breathe: false,
      blink: true
    };
    const defaultShowStatusBar = true;
    const defaultInterceptPdf = true;

    // 1. 更新 UI 控制項狀態
    if (themeSelect) {
      themeSelect.value = defaultTheme;
      applyTheme(defaultTheme);
    }
    if (shapeSelect) shapeSelect.value = defaultShape;
    updateThicknessUI(defaultThickness);
    updateGlowUI(defaultGlow);
    if (effectSmooth) effectSmooth.checked = true;
    if (effectBounce) effectBounce.checked = true;
    if (effectSmoothScroll) effectSmoothScroll.checked = true;
    if (effectTrail) effectTrail.checked = true;
    pulseRadios.forEach((r) => { r.checked = r.value === 'blink'; });
    if (toggleStatusBar) toggleStatusBar.checked = defaultShowStatusBar;
    if (togglePdf) togglePdf.checked = defaultInterceptPdf;

    // 2. 寫入 chrome.storage.sync
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({
        muzen_theme: defaultTheme,
        muzen_shape: defaultShape,
        muzen_thickness: defaultThickness,
        muzen_glow: defaultGlow,
        muzen_effects: defaultEffects,
        muzen_show_status_bar: defaultShowStatusBar,
        muzen_intercept_pdf: defaultInterceptPdf
      });
    }

    // 3. 廣播所有更新至作用中分頁
    broadcastToActiveTab({ type: 'SET_THEME', theme: defaultTheme });
    broadcastToActiveTab({ type: 'SET_SHAPE', shape: defaultShape });
    broadcastToActiveTab({ type: 'SET_THICKNESS', thickness: defaultThickness });
    broadcastToActiveTab({ type: 'SET_GLOW', glow: defaultGlow });
    broadcastToActiveTab({ type: 'SET_EFFECTS', effects: defaultEffects });
    broadcastToActiveTab({ type: 'SET_STATUS_BAR', show: defaultShowStatusBar });

    // 4. 按鈕微動畫回饋
    const btnIcon = btnResetDefaults.querySelector('.btn-icon');
    const btnText = btnResetDefaults.querySelector('.btn-text');
    const strings = LOCALES[currentLocale] || LOCALES['zh-TW'];
    if (btnIcon) btnIcon.textContent = '✓';
    if (btnText) btnText.textContent = strings.resetDefaultsSuccess;
    btnResetDefaults.classList.add('success');
    setTimeout(() => {
      if (btnIcon) btnIcon.textContent = '↺';
      if (btnText) btnText.textContent = strings.resetDefaultsBtn;
      btnResetDefaults.classList.remove('success');
    }, 1500);
  });
});
