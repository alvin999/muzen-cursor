import { LOCALES, Locale, Translations, detectDefaultLocale } from '../src/i18n/locales';
import { formatKeyCombo, DEFAULT_ADVANCED_CONFIG, DEFAULT_KEYBINDINGS, KeybindingsConfig, TrailStyle } from '../src/core/cursorStore';
import { checkExtensionUpdate, getCurrentVersion, ReleaseInfo } from '../src/utils/updater';
import { SmartThemePalette } from '../src/utils/themeDetector';
import { SmearPhysicsEngine } from '../src/utils/smearPhysics';
import { CanvasTrailEffects } from '../src/utils/canvasTrailEffects';

/**
 * Popup 設定邏輯 (Vanilla TS)
 */

document.addEventListener('DOMContentLoaded', () => {
  // ===== 分頁標籤切換邏輯 =====
  const popupTabBtns = document.querySelectorAll<HTMLButtonElement>('.popup-tab-btn');
  const popupTabPanes = document.querySelectorAll<HTMLElement>('.popup-tab-pane');

  popupTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      popupTabBtns.forEach((b) => b.classList.toggle('active', b === btn));
      popupTabPanes.forEach((pane) => {
        pane.classList.toggle('hidden', pane.id !== targetId);
      });
    });
  });
  const toggleEnabled = document.getElementById('toggle-enabled') as HTMLInputElement | null;
  const tabStatusDot = document.getElementById('tab-status-dot');
  const tabStatusText = document.getElementById('tab-status-text');
  const toggleStatusBar = document.getElementById('toggle-status-bar') as HTMLInputElement | null;
  const toggleAdvancedStatusBar = document.getElementById('toggle-advanced-status-bar') as HTMLInputElement | null;
  const subStatusBarAdvanced = document.getElementById('sub-status-bar-advanced');
  const togglePdf = document.getElementById('toggle-pdf') as HTMLInputElement | null;
  const pdfConflictHint = document.getElementById('pdf-conflict-hint');
  const localeSelect = document.getElementById('locale-select') as HTMLSelectElement | null;
  const toggleAutoTheme = document.getElementById('toggle-auto-theme') as HTMLInputElement | null;
  const singleThemeWrapper = document.getElementById('single-theme-wrapper');
  const autoThemePanel = document.getElementById('auto-theme-panel');
  const autoThemeDot = document.getElementById('auto-theme-dot');
  const autoThemeDetectedText = document.getElementById('auto-theme-detected-text');
  const autoDotNormal = document.getElementById('auto-dot-normal');
  const autoHexNormal = document.getElementById('auto-hex-normal');
  const autoDotVisual = document.getElementById('auto-dot-visual');
  const autoHexVisual = document.getElementById('auto-hex-visual');
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
  const trailStyleRadios = document.querySelectorAll<HTMLInputElement>('input[name="muzen-trail-style"]');
  const effectCharge = document.getElementById('effect-charge') as HTMLInputElement | null;
  const effectRearviewMirror = document.getElementById('effect-rearview-mirror') as HTMLInputElement | null;
  const pulseRadios = document.querySelectorAll<HTMLInputElement>('input[name="muzen-pulse"]');
  const btnResetDefaults = document.getElementById('btn-reset-defaults') as HTMLButtonElement | null;
  const resetConfirmGroup = document.getElementById('reset-confirm-group');
  const btnResetCancel = document.getElementById('btn-reset-cancel') as HTMLButtonElement | null;
  const btnResetConfirm = document.getElementById('btn-reset-confirm') as HTMLButtonElement | null;
  const btnOpenKeybindings = document.getElementById('btn-open-keybindings') as HTMLButtonElement | null;
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

  // 版本與更新控制項
  const currentVersionTag = document.getElementById('current-version-tag');
  const updateStatusDot = document.getElementById('update-status-dot');
  const btnCheckUpdate = document.getElementById('btn-check-update') as HTMLButtonElement | null;
  const updatePanel = document.getElementById('update-panel');
  const latestVersionTag = document.getElementById('latest-version-tag');
  const btnDownloadUpdate = document.getElementById('btn-download-update') as HTMLButtonElement | null;
  const btnReloadExtension = document.getElementById('btn-reload-extension') as HTMLButtonElement | null;
  let currentReleaseInfo: ReleaseInfo | null = null;

  let currentHostname = '';
  let excludedSites: string[] = [];
  let currentLocale: Locale = 'zh-TW';
  let currentGlow = 6;

  // 主題狀態管理
  let savedManualTheme = 'gruvbox-dark';
  let isAutoThemeActive = false;
  let lastDetectedPageTheme: 'dark' | 'light' = 'dark';
  let lastDynamicPalette: SmartThemePalette | null = null;

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

  // 動態更新快捷鍵指引
  const formatToKbds = (binding?: any) => {
    if (!binding || !binding.enabled) return '';
    const text = formatKeyCombo(binding);
    if (text.includes(' + ')) {
      return text.split(' + ').map((k) => `<kbd>${k}</kbd>`).join(' + ');
    }
    if (text.includes(' ')) {
      return text.split(' ').map((k) => `<kbd>${k}</kbd>`).join(' ');
    }
    return `<kbd>${text}</kbd>`;
  };

  const updateShortcutGuides = (keybindings?: KeybindingsConfig) => {
    const config = keybindings || DEFAULT_KEYBINDINGS;
    const bindings = config.bindings || DEFAULT_KEYBINDINGS.bindings;

    const escDoubleEl = document.getElementById('guide-esc-double');
    if (escDoubleEl && bindings.escapeDouble) {
      escDoubleEl.innerHTML = formatToKbds(bindings.escapeDouble);
    }
    const escEl = document.getElementById('guide-esc');
    if (escEl && bindings.escape) {
      escEl.innerHTML = formatToKbds(bindings.escape);
    }
    const toggleEl = document.getElementById('guide-toggle');
    if (toggleEl && bindings.toggleCursor) {
      toggleEl.innerHTML = formatToKbds(bindings.toggleCursor);
    }
    const visualEl = document.getElementById('guide-visual');
    if (visualEl && bindings.visualMode && bindings.yank) {
      const lineStr = bindings.visualLineMode && bindings.visualLineMode.enabled ? ` / ${formatToKbds(bindings.visualLineMode)}` : '';
      visualEl.innerHTML = `${formatToKbds(bindings.visualMode)}${lineStr} / ${formatToKbds(bindings.yank)}`;
    }
    const flashEl = document.getElementById('guide-flash');
    if (flashEl && (bindings.flashJump || bindings.flashSearch)) {
      const parts: string[] = [];
      if (bindings.flashJump?.enabled) parts.push(formatToKbds(bindings.flashJump));
      if (bindings.flashSearch?.enabled) parts.push(formatToKbds(bindings.flashSearch));
      if (parts.length > 0) flashEl.innerHTML = parts.join(' / ');
    }
    const jumpBackEl = document.getElementById('guide-jumpback');
    if (jumpBackEl && (bindings.jumpBackLine || bindings.jumpBackExact)) {
      const parts: string[] = [];
      if (bindings.jumpBackLine?.enabled) parts.push(formatToKbds(bindings.jumpBackLine));
      if (bindings.jumpBackExact?.enabled) parts.push(formatToKbds(bindings.jumpBackExact));
      if (parts.length > 0) jumpBackEl.innerHTML = parts.join(' / ');
    }
    const linkEl = document.getElementById('guide-link');
    if (linkEl && (bindings.openLink || bindings.openLinkNewTab)) {
      const parts: string[] = [];
      if (bindings.openLink?.enabled) parts.push(formatToKbds(bindings.openLink));
      if (bindings.openLinkNewTab?.enabled) parts.push(formatToKbds(bindings.openLinkNewTab));
      if (parts.length > 0) linkEl.innerHTML = parts.join(' / ');
    }
  };

  // 套用主題至 Popup 視窗
  const applyTheme = (theme: string) => {
    document.body.setAttribute('data-theme', theme || 'gruvbox-dark');
  };

  // 套用 dynamicPalette 至 Popup 核心強調色 (注入 --accent-orange 與 --accent-green)
  const applyDynamicPalette = (palette?: SmartThemePalette | null) => {
    const root = document.body;
    if (palette?.normal?.hex) {
      root.style.setProperty('--accent-orange', palette.normal.hex);
    }
    if (palette?.visual?.hex) {
      root.style.setProperty('--accent-green', palette.visual.hex);
    }
  };

  // 清除 dynamicPalette 的 inline 覆寫，還原靜態主題本色
  const clearDynamicPalette = () => {
    const root = document.body;
    root.style.removeProperty('--accent-orange');
    root.style.removeProperty('--accent-green');
  };

  // 更新自動主題 UI 面板狀態
  const updateAutoThemeUI = (isAuto: boolean) => {
    if (toggleAutoTheme) toggleAutoTheme.checked = isAuto;
    if (singleThemeWrapper) singleThemeWrapper.style.display = isAuto ? 'none' : 'block';
    if (autoThemePanel) autoThemePanel.style.display = isAuto ? 'flex' : 'none';
  };

  // 統一更新 Popup 智慧感應主題狀態 (專屬 smart-adaptive 動態主題)
  const updatePopupThemeState = (
    isAuto: boolean,
    detectedTheme: 'dark' | 'light' = lastDetectedPageTheme,
    palette: SmartThemePalette | null = lastDynamicPalette,
    bgRgb?: { r: number; g: number; b: number } | null
  ) => {
    isAutoThemeActive = isAuto;
    lastDetectedPageTheme = detectedTheme;
    lastDynamicPalette = palette;
    updateAutoThemeUI(isAuto);

    const root = document.body;

    if (isAuto) {
      // 1. 切換至專屬的「✨ 智慧感應主題 (smart-adaptive)」
      root.setAttribute('data-theme', 'smart-adaptive');
      root.classList.toggle('theme-light', detectedTheme === 'light');

      // 2. 若有感應到網頁真實底色，讓 Popup 背景與網頁底色融為一體
      if (bgRgb) {
        root.style.setProperty('--bg-color', `rgb(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b})`);
        if (detectedTheme === 'dark') {
          // 深色網頁：卡片使用通透浮起層次
          const cardR = Math.min(255, bgRgb.r + 14);
          const cardG = Math.min(255, bgRgb.g + 14);
          const cardB = Math.min(255, bgRgb.b + 18);
          root.style.setProperty('--bg-card', `rgb(${cardR}, ${cardG}, ${cardB})`);
        } else {
          // 淺色網頁：卡片使用清爽純白
          root.style.setProperty('--bg-card', '#ffffff');
        }
      } else {
        root.style.removeProperty('--bg-color');
        root.style.removeProperty('--bg-card');
      }

      // 3. 由 dynamicPalette 接管焦點與開關色彩
      if (palette) {
        applyDynamicPalette(palette);
      }
    } else {
      // 關閉智慧主題：清除動態變數與 light class，還原至手動選取的靜態主題
      root.classList.remove('theme-light');
      root.style.removeProperty('--bg-color');
      root.style.removeProperty('--bg-card');
      clearDynamicPalette();
      applyTheme(savedManualTheme);
    }
  };

  // 更新當前網頁探測明暗結果與智慧最適色彩預覽 UI
  const updateDetectedThemeUI = (detected: 'dark' | 'light', dynamicPalette?: any) => {
    const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
    if (autoThemeDetectedText) {
      autoThemeDetectedText.textContent = detected === 'dark' ? dict.detectedDarkLabel : dict.detectedLightLabel;
    }
    if (autoThemeDot) {
      if (detected === 'light') {
        autoThemeDot.classList.add('light-mode');
      } else {
        autoThemeDot.classList.remove('light-mode');
      }
    }
    if (dynamicPalette) {
      if (autoDotNormal && dynamicPalette.normal) {
        autoDotNormal.style.backgroundColor = dynamicPalette.normal.hex;
        autoDotNormal.style.boxShadow = `0 0 6px ${dynamicPalette.normal.hex}`;
      }
      if (autoHexNormal && dynamicPalette.normal) {
        autoHexNormal.textContent = dynamicPalette.normal.hex;
      }
      if (autoDotVisual && dynamicPalette.visual) {
        autoDotVisual.style.backgroundColor = dynamicPalette.visual.hex;
        autoDotVisual.style.boxShadow = `0 0 6px ${dynamicPalette.visual.hex}`;
      }
      if (autoHexVisual && dynamicPalette.visual) {
        autoHexVisual.textContent = dynamicPalette.visual.hex;
      }
    }
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

    if (btnOpenOptions) {
      btnOpenOptions.title = dict.advancedSettingsBtn;
    }

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

    // 5. 即時同步更新面板多國語言狀態
    renderUpdateUI(currentReleaseInfo);

    // 6. 即時同步更新當前分頁狀態文字
    updateTabStatusUI(lastKnownTabStatus);
  };

  // ===== 當前分頁即時狀態管理器 =====
  type TabStatusType = 'active' | 'standby' | 'sleep' | 'disabled' | 'excluded' | 'local';
  let lastKnownTabStatus: TabStatusType = 'active';

  const updateTabStatusUI = (statusType: TabStatusType) => {
    lastKnownTabStatus = statusType;
    if (!tabStatusDot || !tabStatusText) return;
    const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];

    tabStatusDot.className = `tab-status-dot ${statusType}`;
    switch (statusType) {
      case 'active':
        tabStatusText.textContent = dict.tabStatusActive;
        break;
      case 'standby':
        tabStatusText.textContent = dict.tabStatusStandby;
        break;
      case 'sleep':
        tabStatusText.textContent = dict.tabStatusDeepSleep;
        break;
      case 'disabled':
        tabStatusText.textContent = dict.tabStatusDisabled;
        break;
      case 'excluded':
        tabStatusText.textContent = dict.tabStatusExcluded;
        break;
      case 'local':
        tabStatusText.textContent = dict.tabStatusLocal;
        break;
    }
  };

  const refreshActiveTabStatus = () => {
    if (toggleEnabled && !toggleEnabled.checked) {
      updateTabStatusUI('disabled');
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab?.id || !activeTab?.url || !activeTab.url.startsWith('http')) {
          updateTabStatusUI('local');
          return;
        }

        if (isExcluded(currentHostname, excludedSites)) {
          updateTabStatusUI('excluded');
          return;
        }

        chrome.tabs.sendMessage(activeTab.id, { type: 'GET_STATUS' }, (response) => {
          if (chrome.runtime.lastError || !response?.state) {
            if (isAutoThemeActive) {
              const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              updatePopupThemeState(true, prefersDark ? 'dark' : 'light', null);
            }
            return;
          }

          const s = response.state;
          const detected = s.detectedPageTheme || 'dark';
          const palette = s.dynamicPalette || null;
          const bgRgb = s.detectedBgRgb || null;
          updateDetectedThemeUI(detected, palette);

          // 若開啟智慧感應主題，直接更新專屬 smart-adaptive 主題外觀與 dynamicPalette
          if (isAutoThemeActive) {
            updatePopupThemeState(true, detected, palette, bgRgb);
          }
          if (s.isExcluded) {
            updateTabStatusUI('excluded');
          } else if (!s.enabled) {
            updateTabStatusUI('sleep');
          } else if (!s.visible) {
            updateTabStatusUI('standby');
          } else {
            updateTabStatusUI('active');
          }
        });
      });
    }
  };

  // ===== 版本檢查與一鍵更新模組 =====
  const currVer = getCurrentVersion();
  if (currentVersionTag) {
    currentVersionTag.textContent = `v${currVer}`;
  }

  // 渲染更新狀態至介面
  function renderUpdateUI(info: ReleaseInfo | null, isManual = false) {
    const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
    currentReleaseInfo = info;

    if (!info) {
      if (updateStatusDot) {
        updateStatusDot.className = 'update-status-dot';
      }
      if (isManual && btnCheckUpdate) {
        btnCheckUpdate.textContent = dict.updateCheckFailed;
        setTimeout(() => {
          btnCheckUpdate.textContent = dict.checkUpdateBtn;
        }, 2500);
      }
      return;
    }

    if (info.hasUpdate) {
      // 偵測到新版本發布
      if (updateStatusDot) {
        updateStatusDot.className = 'update-status-dot has-update';
        updateStatusDot.title = `${dict.updateAvailable}: v${info.latestVersion}`;
      }
      if (latestVersionTag) {
        latestVersionTag.textContent = `v${info.latestVersion}`;
      }
      if (updatePanel) {
        updatePanel.style.display = 'flex';
      }
      if (btnCheckUpdate) {
        btnCheckUpdate.textContent = `v${info.latestVersion} !`;
      }
    } else {
      // 目前已為最新版
      if (updateStatusDot) {
        updateStatusDot.className = 'update-status-dot up-to-date';
        updateStatusDot.title = dict.upToDate;
      }
      if (updatePanel) {
        updatePanel.style.display = 'none';
      }
      if (btnCheckUpdate) {
        btnCheckUpdate.textContent = isManual ? dict.upToDate : dict.checkUpdateBtn;
        if (isManual) {
          setTimeout(() => {
            btnCheckUpdate.textContent = dict.checkUpdateBtn;
          }, 2000);
        }
      }
    }
  }

  // 執行檢查更新
  const handleCheckUpdate = async (force = false) => {
    const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
    if (btnCheckUpdate) {
      btnCheckUpdate.classList.add('loading');
      if (force) btnCheckUpdate.textContent = dict.checkingUpdate;
    }

    const info = await checkExtensionUpdate(force);

    if (btnCheckUpdate) {
      btnCheckUpdate.classList.remove('loading');
    }
    renderUpdateUI(info, force);
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
    chrome.storage.sync.get(['muzen_enabled', 'muzen_locale', 'muzen_theme', 'muzen_auto_theme', 'muzen_dark_theme', 'muzen_light_theme', 'muzen_intercept_pdf', 'muzen_shape', 'muzen_thickness', 'muzen_glow', 'muzen_effects', 'muzen_show_status_bar', 'muzen_excluded_sites', 'muzen_animation', 'muzen_keybindings'], (data) => {
      // 載入語言設定
      const savedLocale = (data.muzen_locale as Locale) || detectDefaultLocale();
      if (localeSelect) {
        localeSelect.value = savedLocale;
      }
      applyLocale(savedLocale);
      updateShortcutGuides(data.muzen_keybindings);

      if (toggleEnabled && typeof data.muzen_enabled === 'boolean') {
        toggleEnabled.checked = data.muzen_enabled;
      }
      if (toggleStatusBar && typeof data.muzen_show_status_bar === 'boolean') {
        toggleStatusBar.checked = data.muzen_show_status_bar;
      }
      if (toggleAdvancedStatusBar && typeof data.muzen_show_advanced_status_bar === 'boolean') {
        toggleAdvancedStatusBar.checked = data.muzen_show_advanced_status_bar;
      }
      updateStatusBarSubRowState();
      if (togglePdf && typeof data.muzen_intercept_pdf === 'boolean') {
        togglePdf.checked = data.muzen_intercept_pdf;
      }
      if (pdfConflictHint && togglePdf) {
        pdfConflictHint.style.display = togglePdf.checked ? 'flex' : 'none';
      }

      // 智慧感應主題載入
      savedManualTheme = (data.muzen_theme as string) || 'gruvbox-dark';
      isAutoThemeActive = Boolean(data.muzen_auto_theme);

      if (themeSelect && data.muzen_theme) {
        themeSelect.value = data.muzen_theme;
      }

      // 預設深淺判斷
      const initialPrefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      updatePopupThemeState(isAutoThemeActive, initialPrefersDark ? 'dark' : 'light', null);
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
        const hasTrail = data.muzen_effects.trail !== undefined ? !!data.muzen_effects.trail : false;
        const hasSmear = data.muzen_effects.smear !== undefined ? !!data.muzen_effects.smear : !hasTrail;
        const trailStyleVal = data.muzen_effects.trailStyle || (hasSmear ? 'smear' : hasTrail ? 'trail' : 'none');
        trailStyleRadios.forEach((r) => { r.checked = r.value === trailStyleVal; });
        if (effectCharge) effectCharge.checked = data.muzen_effects.charge !== undefined ? !!data.muzen_effects.charge : true;
        if (effectRearviewMirror) effectRearviewMirror.checked = data.muzen_effects.rearviewMirror !== undefined ? !!data.muzen_effects.rearviewMirror : true;
        const pulseVal = data.muzen_effects.blink ? 'blink' : data.muzen_effects.breathe ? 'breathe' : 'none';
        pulseRadios.forEach((r) => { r.checked = r.value === pulseVal; });
      } else if (data.muzen_animation) {
        // 向下相容
        if (effectSmooth) effectSmooth.checked = data.muzen_animation === 'smooth' || data.muzen_animation === 'breathe';
        if (effectBounce) effectBounce.checked = true;
        if (effectSmoothScroll) effectSmoothScroll.checked = true;
        trailStyleRadios.forEach((r) => { r.checked = r.value === 'smear'; });
        if (effectCharge) effectCharge.checked = true;
        if (effectRearviewMirror) effectRearviewMirror.checked = true;
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
        refreshActiveTabStatus();
      } else {
        updateTabStatusUI('local');
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
    if (!isEnabled) {
      updateTabStatusUI('disabled');
    } else {
      setTimeout(() => refreshActiveTabStatus(), 100);
    }
  });

  // 輔助函式：切換狀態列子選項啟用/禁用狀態
  const updateStatusBarSubRowState = () => {
    const isParentEnabled = toggleStatusBar ? toggleStatusBar.checked : true;
    if (subStatusBarAdvanced) {
      subStatusBarAdvanced.classList.toggle('disabled', !isParentEnabled);
    }
    if (toggleAdvancedStatusBar) {
      toggleAdvancedStatusBar.disabled = !isParentEnabled;
    }
  };

  // 3. 狀態列顯示開關變更事件
  toggleStatusBar?.addEventListener('change', () => {
    const isShow = toggleStatusBar.checked;
    updateStatusBarSubRowState();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_show_status_bar: isShow });
    }
    broadcastToActiveTab({ type: 'SET_STATUS_BAR', showStatusBar: isShow });
  });

  // 3.1 進階長文閱讀輔助開關變更事件
  toggleAdvancedStatusBar?.addEventListener('change', () => {
    const isAdvanced = toggleAdvancedStatusBar.checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_show_advanced_status_bar: isAdvanced });
    }
    broadcastToActiveTab({ type: 'SET_ADVANCED_STATUS_BAR', showAdvancedStatusBar: isAdvanced });
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
    refreshActiveTabStatus();
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
    refreshActiveTabStatus();

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
    if (pdfConflictHint) {
      pdfConflictHint.style.display = isPdfIntercept ? 'flex' : 'none';
    }
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
    savedManualTheme = theme;
    if (!isAutoThemeActive) {
      applyTheme(theme);
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_theme: theme });
    }
    broadcastToActiveTab({ type: 'SET_THEME', theme });
  });

  // 9.1 智慧感應主題開關事件 (預設關閉)
  toggleAutoTheme?.addEventListener('change', () => {
    const isAuto = toggleAutoTheme.checked;
    updatePopupThemeState(isAuto);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ muzen_auto_theme: isAuto });
    }
    broadcastToActiveTab({ type: 'SET_AUTO_THEME', autoTheme: isAuto });
    setTimeout(() => refreshActiveTabStatus(), 100);
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

    let activeTrailStyle = 'smear';
    trailStyleRadios.forEach((r) => {
      if (r.checked) activeTrailStyle = r.value;
    });

    const effects = {
      smooth: effectSmooth ? effectSmooth.checked : true,
      bounce: effectBounce ? effectBounce.checked : true,
      smoothScroll: effectSmoothScroll ? effectSmoothScroll.checked : true,
      trailStyle: activeTrailStyle,
      smear: activeTrailStyle === 'smear',
      trail: activeTrailStyle === 'trail',
      charge: effectCharge ? effectCharge.checked : true,
      rearviewMirror: effectRearviewMirror ? effectRearviewMirror.checked : true,
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
  trailStyleRadios.forEach((r) => r.addEventListener('change', onEffectsChanged));
  effectCharge?.addEventListener('change', onEffectsChanged);
  effectRearviewMirror?.addEventListener('change', onEffectsChanged);
  pulseRadios.forEach((r) => r.addEventListener('change', onEffectsChanged));

  // 14.1 動態效果說明列 (方案 A) 與 迷你殘影即時示範軌道 (方案 C)
  const motionHintEl = document.getElementById('motion-effects-hint');
  const trailHintEl = document.getElementById('trail-style-hint');
  const pulseHintEl = document.getElementById('pulse-effects-hint');
  const trailStyleGroup = document.getElementById('trail-style-group');
  const pulseGroup = document.getElementById('pulse-effects-group');

  const MOTION_HINT_MAP: Record<string, keyof Translations> = {
    'effect-smooth': 'hintEffectSmooth',
    'effect-bounce': 'hintEffectBounce',
    'effect-smooth-scroll': 'hintEffectSmoothScroll',
    'effect-charge': 'hintEffectCharge',
    'effect-rearview-mirror': 'hintEffectRearviewMirror'
  };

  const TRAIL_HINT_MAP: Record<TrailStyle, keyof Translations> = {
    none: 'hintTrailNone',
    smear: 'hintTrailSmear',
    trail: 'hintTrailTrail',
    laser: 'hintTrailLaser',
    sparkle: 'hintTrailSparkle',
    ribbon: 'hintTrailRibbon'
  };

  const PULSE_HINT_MAP: Record<string, keyof Translations> = {
    none: 'hintPulseNone',
    blink: 'hintPulseBlink',
    breathe: 'hintPulseBreathe'
  };

  const getCheckedValue = (radios: NodeListOf<HTMLInputElement>, fallback: string): string => {
    for (const r of Array.from(radios)) {
      if (r.checked) return r.value;
    }
    return fallback;
  };

  const updateHintBars = (
    hoverTrail?: TrailStyle,
    hoverPulse?: string,
    hoverMotionKey?: keyof Translations
  ) => {
    const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
    if (motionHintEl) {
      motionHintEl.textContent = hoverMotionKey ? dict[hoverMotionKey] : dict.hintMotionDefault;
      motionHintEl.classList.toggle('is-hovering', !!hoverMotionKey);
    }
    if (trailHintEl) {
      const activeTrail = (hoverTrail || getCheckedValue(trailStyleRadios, 'smear')) as TrailStyle;
      const key = TRAIL_HINT_MAP[activeTrail] || 'hintTrailSmear';
      trailHintEl.textContent = dict[key];
      trailHintEl.classList.toggle('is-hovering', !!hoverTrail);
    }
    if (pulseHintEl) {
      const activePulse = hoverPulse || getCheckedValue(pulseRadios, 'blink');
      const key = PULSE_HINT_MAP[activePulse] || 'hintPulseBlink';
      pulseHintEl.textContent = dict[key];
      pulseHintEl.classList.toggle('is-hovering', !!hoverPulse);
    }
  };

  // 迷你殘影即時示範軌道引擎
  const previewCanvas = document.getElementById('trail-preview-canvas') as HTMLCanvasElement | null;
  const previewCtx = previewCanvas?.getContext('2d') || null;
  const previewSmear = new SmearPhysicsEngine();
  const previewCanvasEffects = new CanvasTrailEffects();
  const previewSmearConfig = {
    stiffness: DEFAULT_ADVANCED_CONFIG.smearStiffness,
    trailingStiffness: DEFAULT_ADVANCED_CONFIG.smearTrailingStiffness,
    trailingExponent: DEFAULT_ADVANCED_CONFIG.smearTrailingExponent,
    damping: DEFAULT_ADVANCED_CONFIG.smearDamping,
    distanceStopAnimating: DEFAULT_ADVANCED_CONFIG.smearDistanceStopAnimating,
    maxLength: DEFAULT_ADVANCED_CONFIG.smearMaxLength
  };
  const previewTrailDurationMs = DEFAULT_ADVANCED_CONFIG.trailDurationMs;
  const previewTrailCount = DEFAULT_ADVANCED_CONFIG.trailCount;
  let previewMode: TrailStyle = 'smear';
  let previewAtRight = false;
  let previewLastJumpTs = 0;
  let previewLastFrameTs = performance.now();
  let previewGhostTimer = 0;

  const parseHexRgb = (hexStr: string) => {
    const clean = hexStr.trim().replace('#', '');
    if (clean.length === 6) {
      const n = parseInt(clean, 16);
      if (!Number.isNaN(n)) {
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, hex: `#${clean}` };
      }
    }
    return { r: 254, g: 128, b: 25, hex: '#fe8019' };
  };

  const triggerPreviewJump = (mode: TrailStyle, forceReset = false) => {
    if (!previewCanvas) return;
    const w = previewCanvas.clientWidth || 280;
    const h = previewCanvas.clientHeight || 28;
    const boxW = 9;
    const boxH = 16;
    const y = Math.round((h - boxH) / 2);
    const leftX = 16;
    const rightX = Math.max(leftX + 40, w - 26);

    if (forceReset) {
      previewAtRight = false;
      previewSmear.snapTo({ x: leftX, y, width: boxW, height: boxH });
      previewCanvasEffects.clear();
    }

    const originX = previewAtRight ? rightX : leftX;
    const targetX = previewAtRight ? leftX : rightX;
    previewAtRight = !previewAtRight;
    previewLastJumpTs = performance.now();
    previewGhostTimer = previewTrailDurationMs;

    const originRect = { x: originX, y, width: boxW, height: boxH };
    const targetRect = { x: targetX, y, width: boxW, height: boxH };
    const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-orange') || '#fe8019';
    const color = parseHexRgb(accentHex);

    if (mode === 'smear') {
      previewSmear.setTarget(targetRect, previewSmearConfig);
    } else if (mode === 'laser' || mode === 'sparkle' || mode === 'ribbon') {
      previewCanvasEffects.spawn(mode, originRect, targetRect, color, 0.45);
    }
  };

  const renderPreviewLoop = (now: number) => {
    const dt = now - previewLastFrameTs;
    previewLastFrameTs = now;

    if (previewCanvas && previewCtx) {
      const w = previewCanvas.clientWidth || 280;
      const h = previewCanvas.clientHeight || 28;
      if (w > 0 && h > 0) {
        const dpr = window.devicePixelRatio || 1;
        const cw = Math.round(w * dpr);
        const ch = Math.round(h * dpr);
        if (previewCanvas.width !== cw || previewCanvas.height !== ch) {
          previewCanvas.width = cw;
          previewCanvas.height = ch;
        }

        if (now - previewLastJumpTs >= 950) {
          triggerPreviewJump(previewMode);
        }

        const boxW = 9;
        const boxH = 16;
        const y = Math.round((h - boxH) / 2);
        const leftX = 16;
        const rightX = Math.max(leftX + 40, w - 26);
        const curTargetX = previewAtRight ? rightX : leftX;
        const curOriginX = previewAtRight ? leftX : rightX;
        const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-orange') || '#fe8019';
        const color = parseHexRgb(accentHex);

        if (previewMode === 'smear') {
          const active = previewSmear.step(dt, previewSmearConfig);
          previewCtx.save();
          previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          previewCtx.clearRect(0, 0, w, h);

          if (active) {
            const poly = previewSmear.getPolygon();
            const { tail, head } = previewSmear.getGradientAxis();
            if (poly.length >= 3) {
              previewCtx.beginPath();
              previewCtx.moveTo(poly[0].x, poly[0].y);
              for (let i = 1; i < poly.length; i++) previewCtx.lineTo(poly[i].x, poly[i].y);
              previewCtx.closePath();
              const grad = previewCtx.createLinearGradient(tail.x, tail.y, head.x, head.y);
              grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`);
              grad.addColorStop(1, color.hex);
              previewCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`;
              previewCtx.fill();
              previewCtx.lineWidth = 1.5;
              previewCtx.strokeStyle = grad;
              previewCtx.stroke();
            }
          } else {
            previewCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`;
            previewCtx.strokeStyle = color.hex;
            previewCtx.lineWidth = 1.5;
            previewCtx.fillRect(curTargetX, y, boxW, boxH);
            previewCtx.strokeRect(curTargetX, y, boxW, boxH);
          }
          previewCtx.restore();
        } else if (previewMode === 'laser' || previewMode === 'sparkle' || previewMode === 'ribbon') {
          previewCanvasEffects.stepAndDraw(previewCtx, dt, w, h, dpr);
          previewCtx.save();
          previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          previewCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`;
          previewCtx.strokeStyle = color.hex;
          previewCtx.lineWidth = 1.5;
          previewCtx.fillRect(curTargetX, y, boxW, boxH);
          previewCtx.strokeRect(curTargetX, y, boxW, boxH);
          previewCtx.restore();
        } else {
          previewCtx.save();
          previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          previewCtx.clearRect(0, 0, w, h);

          if (previewMode === 'trail' && previewGhostTimer > 0) {
            previewGhostTimer = Math.max(0, previewGhostTimer - dt);
            const fade = previewGhostTimer / previewTrailDurationMs;
            for (let g = 1; g <= previewTrailCount; g++) {
              const t = g / (previewTrailCount + 1);
              const gx = curOriginX + (curTargetX - curOriginX) * t;
              const alpha = fade * (0.15 + 0.5 * t);
              previewCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${(alpha * 0.25).toFixed(3)})`;
              previewCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha.toFixed(3)})`;
              previewCtx.lineWidth = 1.2;
              previewCtx.fillRect(gx, y, boxW, boxH);
              previewCtx.strokeRect(gx, y, boxW, boxH);
            }
          }

          previewCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`;
          previewCtx.strokeStyle = color.hex;
          previewCtx.lineWidth = 1.5;
          previewCtx.fillRect(curTargetX, y, boxW, boxH);
          previewCtx.strokeRect(curTargetX, y, boxW, boxH);
          previewCtx.restore();
        }
      }
    }

    // 繪製 位移特效 預覽軌道 (#motion-preview-canvas)
    const motionCanvas = document.getElementById('motion-preview-canvas') as HTMLCanvasElement | null;
    const motionCtx = motionCanvas?.getContext('2d');
    if (motionCanvas && motionCtx) {
      const mw = motionCanvas.clientWidth || 280;
      const mh = motionCanvas.clientHeight || 28;
      if (mw > 0 && mh > 0) {
        const dpr = window.devicePixelRatio || 1;
        const cw = Math.round(mw * dpr);
        const ch = Math.round(mh * dpr);
        if (motionCanvas.width !== cw || motionCanvas.height !== ch) {
          motionCanvas.width = cw;
          motionCanvas.height = ch;
        }
        const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-orange') || '#fe8019';
        const color = parseHexRgb(accentHex);

        motionCtx.save();
        motionCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        motionCtx.clearRect(0, 0, mw, mh);

        const cycleMs = 1100;
        const phase = (now % (cycleMs * 2)) / cycleMs; // 0..2
        const forward = phase < 1;
        const tRaw = forward ? phase : phase - 1;
        const leftX = 16;
        const rightX = Math.max(leftX + 40, mw - 26);
        const boxW = 9;
        const boxH = 16;
        const baseY = Math.round((mh - boxH) / 2);

        const focus = motionPreviewFocus;
        const isSmooth = focus ? focus === 'effect-smooth' || focus === 'effect-bounce' : !!effectSmooth?.checked;
        const isBounce = focus ? focus === 'effect-bounce' : !!effectBounce?.checked;

        if (focus === 'effect-smooth-scroll') {
          // 示範柔和捲動線條
          const scrollOffset = Math.sin((now / 900) * Math.PI) * 8;
          motionCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.35)`;
          motionCtx.lineWidth = 2;
          for (let line = -1; line <= 2; line++) {
            const ly = Math.round(mh / 2 + line * 9 - scrollOffset);
            if (ly >= 2 && ly <= mh - 2) {
              motionCtx.beginPath();
              motionCtx.moveTo(16, ly);
              motionCtx.lineTo(mw - 16, ly);
              motionCtx.stroke();
            }
          }
          motionCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`;
          motionCtx.strokeStyle = color.hex;
          motionCtx.lineWidth = 1.5;
          motionCtx.fillRect(Math.round(mw / 2 - boxW / 2), baseY, boxW, boxH);
          motionCtx.strokeRect(Math.round(mw / 2 - boxW / 2), baseY, boxW, boxH);
        } else if (focus === 'effect-rearview-mirror') {
          // 示範大跳躍 + 右下角後照鏡 HUD 閃現
          const cx = forward ? rightX : leftX;
          motionCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`;
          motionCtx.strokeStyle = color.hex;
          motionCtx.lineWidth = 1.5;
          motionCtx.fillRect(cx, baseY, boxW, boxH);
          motionCtx.strokeRect(cx, baseY, boxW, boxH);

          const hudAlpha = Math.max(0.15, 1 - tRaw * 1.1);
          const hudW = 36;
          const hudH = 16;
          const hudX = Math.round(mw / 2 - hudW / 2);
          const hudY = Math.round((mh - hudH) / 2);
          motionCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${(hudAlpha * 0.2).toFixed(3)})`;
          motionCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${hudAlpha.toFixed(3)})`;
          motionCtx.lineWidth = 1;
          motionCtx.fillRect(hudX, hudY, hudW, hudH);
          motionCtx.strokeRect(hudX, hudY, hudW, hudH);
          motionCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${hudAlpha.toFixed(3)})`;
          motionCtx.fillRect(hudX + 5, hudY + 6, hudW - 10, 4);
        } else {
          // smooth / bounce / charge 綜合移動示範
          const moveT = Math.min(1, tRaw * 3.4);
          let ease = 1;
          if (isSmooth) {
            if (isBounce) {
              // 輕微彈性過衝
              const c4 = (2 * Math.PI) / 3;
              ease = moveT >= 1 ? 1 : 1 + Math.pow(2, -8 * moveT) * Math.sin((moveT * 10 - 0.75) * c4) * 0.25;
            } else {
              ease = 1 - Math.pow(1 - moveT, 3);
            }
          } else {
            ease = moveT > 0.05 ? 1 : 0;
          }
          const startX = forward ? leftX : rightX;
          const endX = forward ? rightX : leftX;
          const cx = startX + (endX - startX) * ease;
          const skew = isBounce && moveT < 0.8 ? (forward ? -0.22 : 0.22) * (1 - moveT) : 0;

          const isCharge = focus === 'effect-charge' || (!focus && !!effectCharge?.checked);
          const chargeGlow = isCharge ? 6 + Math.sin(now / 140) * 4 : 0;
          if (chargeGlow > 0) {
            motionCtx.shadowColor = color.hex;
            motionCtx.shadowBlur = chargeGlow;
          }
          motionCtx.translate(cx + boxW / 2, baseY + boxH / 2);
          motionCtx.transform(1, 0, skew, 1, 0, 0);
          motionCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`;
          motionCtx.strokeStyle = color.hex;
          motionCtx.lineWidth = 1.5;
          motionCtx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
          motionCtx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
        }

        motionCtx.restore();
      }
    }

    // 繪製 靜態脈動 預覽軌道 (#pulse-preview-canvas)
    const pulseCanvas = document.getElementById('pulse-preview-canvas') as HTMLCanvasElement | null;
    const pulseCtx = pulseCanvas?.getContext('2d');
    if (pulseCanvas && pulseCtx) {
      const pw = pulseCanvas.clientWidth || 280;
      const ph = pulseCanvas.clientHeight || 28;
      if (pw > 0 && ph > 0) {
        const dpr = window.devicePixelRatio || 1;
        const cw = Math.round(pw * dpr);
        const ch = Math.round(ph * dpr);
        if (pulseCanvas.width !== cw || pulseCanvas.height !== ch) {
          pulseCanvas.width = cw;
          pulseCanvas.height = ch;
        }
        const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-orange') || '#fe8019';
        const color = parseHexRgb(accentHex);

        const activePulse = pulsePreviewFocus || getCheckedValue(pulseRadios, 'blink');
        let alpha = 1.0;
        let glow = 0;
        if (activePulse === 'blink') {
          const s = Math.sin((now / 550) * Math.PI);
          alpha = s >= 0 ? 1.0 : 0.12;
        } else if (activePulse === 'breathe') {
          const wave = (Math.sin((now / 1200) * Math.PI) + 1) * 0.5;
          alpha = 0.22 + wave * 0.78;
          glow = 3 + wave * 8;
        }

        const boxW = 9;
        const boxH = 16;
        const cx = Math.round(pw / 2 - boxW / 2);
        const cy = Math.round((ph - boxH) / 2);

        pulseCtx.save();
        pulseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pulseCtx.clearRect(0, 0, pw, ph);
        if (glow > 0) {
          pulseCtx.shadowColor = color.hex;
          pulseCtx.shadowBlur = glow;
        }
        pulseCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${(0.28 * alpha).toFixed(3)})`;
        pulseCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha.toFixed(3)})`;
        pulseCtx.lineWidth = 1.5;
        pulseCtx.fillRect(cx, cy, boxW, boxH);
        pulseCtx.strokeRect(cx, cy, boxW, boxH);
        pulseCtx.restore();
      }
    }

    requestAnimationFrame(renderPreviewLoop);
  };

  let motionPreviewFocus: string | null = null;
  let pulsePreviewFocus: string | null = null;

  // 綁定 Hover 動態提示與預覽切換
  Object.entries(MOTION_HINT_MAP).forEach(([id, key]) => {
    const input = document.getElementById(id);
    const chip = input?.closest('.effect-chip');
    chip?.addEventListener('mouseenter', () => {
      motionPreviewFocus = id;
      updateHintBars(undefined, undefined, key);
    });
  });
  motionHintEl?.parentElement?.querySelector('.effects-group')?.addEventListener('mouseleave', () => {
    motionPreviewFocus = null;
    updateHintBars();
  });

  trailStyleRadios.forEach((radio) => {
    const chip = radio.closest('.effect-chip');
    const mode = radio.value as TrailStyle;
    chip?.addEventListener('mouseenter', () => {
      updateHintBars(mode);
      if (previewMode !== mode) {
        previewMode = mode;
        triggerPreviewJump(previewMode, true);
      }
    });
    radio.addEventListener('change', () => {
      if (radio.checked) {
        previewMode = mode;
        updateHintBars();
        triggerPreviewJump(previewMode, true);
      }
    });
  });
  trailStyleGroup?.addEventListener('mouseleave', () => {
    const active = getCheckedValue(trailStyleRadios, 'smear') as TrailStyle;
    updateHintBars();
    if (previewMode !== active) {
      previewMode = active;
      triggerPreviewJump(previewMode, true);
    }
  });

  pulseRadios.forEach((radio) => {
    const chip = radio.closest('.effect-chip');
    chip?.addEventListener('mouseenter', () => {
      pulsePreviewFocus = radio.value;
      updateHintBars(undefined, radio.value);
    });
    radio.addEventListener('change', () => updateHintBars());
  });
  pulseGroup?.addEventListener('mouseleave', () => {
    pulsePreviewFocus = null;
    updateHintBars();
  });

  // 啟動示範軌道
  setTimeout(() => {
    previewMode = getCheckedValue(trailStyleRadios, 'smear') as TrailStyle;
    updateHintBars();
    triggerPreviewJump(previewMode, true);
    requestAnimationFrame(renderPreviewLoop);
  }, 80);

  // 14.4 開啟按鍵與防衝突設定頁面
  btnOpenKeybindings?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      const url = chrome.runtime.getURL('options/index.html#keybindings');
      chrome.tabs.create({ url });
    } else {
      window.open('../options/index.html#keybindings', '_blank');
    }
  });

  // 14.5 開啟進階設定頁面 (支援 Header 圖示、Tab 1 導引卡片與 Tab 3 按鈕)
  const openAdvancedOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      const url = chrome.runtime.getURL('options/index.html#appearance');
      chrome.tabs.create({ url });
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../options/index.html#appearance', '_blank');
    }
  };

  btnOpenOptions?.addEventListener('click', openAdvancedOptions);
  document.getElementById('btn-quick-options')?.addEventListener('click', openAdvancedOptions);
  document.getElementById('btn-tab3-options')?.addEventListener('click', openAdvancedOptions);

  // 15. 回復預設值事件 (展開【取消】與【確定】雙按鈕防呆)
  let isResetConfirming = false;
  let resetConfirmTimer: any = null;

  const showConfirmButtons = () => {
    isResetConfirming = true;
    if (btnResetDefaults) btnResetDefaults.style.display = 'none';
    if (resetConfirmGroup) resetConfirmGroup.classList.remove('hidden');

    if (resetConfirmTimer) clearTimeout(resetConfirmTimer);
    resetConfirmTimer = setTimeout(() => {
      hideConfirmButtons();
    }, 5000);
  };

  const hideConfirmButtons = () => {
    isResetConfirming = false;
    if (resetConfirmTimer) {
      clearTimeout(resetConfirmTimer);
      resetConfirmTimer = null;
    }
    if (resetConfirmGroup) resetConfirmGroup.classList.add('hidden');
    if (btnResetDefaults) btnResetDefaults.style.display = '';
  };

  btnResetDefaults?.addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirmButtons();
  });

  btnResetCancel?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideConfirmButtons();
  });

  btnResetConfirm?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideConfirmButtons();

    // 預設參數對齊經典體驗
    const defaultTheme = 'gruvbox-dark';
    const defaultDarkTheme = 'gruvbox-dark';
    const defaultLightTheme = 'gruvbox-light';
    const defaultShape = 'block';
    const defaultThickness = 1.5;
    const defaultGlow = 0;
    const defaultEffects = {
      smooth: true,
      bounce: true,
      smoothScroll: true,
      trailStyle: 'smear',
      smear: true,
      trail: false,
      charge: true,
      rearviewMirror: true,
      breathe: false,
      blink: true
    };
    const defaultShowStatusBar = true;
    const defaultShowAdvancedStatusBar = true;
    const defaultInterceptPdf = true;

    // 1. 更新 UI 控制項狀態
    if (themeSelect) {
      themeSelect.value = defaultTheme;
      applyTheme(defaultTheme);
    }
    updateAutoThemeUI(false);
    if (shapeSelect) shapeSelect.value = defaultShape;
    updateThicknessUI(defaultThickness);
    updateGlowUI(defaultGlow);
    if (effectSmooth) effectSmooth.checked = true;
    if (effectBounce) effectBounce.checked = true;
    if (effectSmoothScroll) effectSmoothScroll.checked = true;
    trailStyleRadios.forEach((r) => { r.checked = r.value === 'smear'; });
    if (effectCharge) effectCharge.checked = true;
    if (effectRearviewMirror) effectRearviewMirror.checked = true;
    pulseRadios.forEach((r) => { r.checked = r.value === 'blink'; });
    if (toggleStatusBar) toggleStatusBar.checked = defaultShowStatusBar;
    if (toggleAdvancedStatusBar) toggleAdvancedStatusBar.checked = defaultShowAdvancedStatusBar;
    updateStatusBarSubRowState();
    if (togglePdf) togglePdf.checked = defaultInterceptPdf;

    // 2. 寫入 chrome.storage.sync
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({
        muzen_theme: defaultTheme,
        muzen_auto_theme: false,
        muzen_dark_theme: defaultDarkTheme,
        muzen_light_theme: defaultLightTheme,
        muzen_shape: defaultShape,
        muzen_thickness: defaultThickness,
        muzen_glow: defaultGlow,
        muzen_effects: defaultEffects,
        muzen_show_status_bar: defaultShowStatusBar,
        muzen_show_advanced_status_bar: defaultShowAdvancedStatusBar,
        muzen_intercept_pdf: defaultInterceptPdf
      });
    }

    // 3. 廣播所有更新至作用中分頁
    broadcastToActiveTab({ type: 'SET_AUTO_THEME', autoTheme: false });
    broadcastToActiveTab({ type: 'SET_THEME', theme: defaultTheme });
    broadcastToActiveTab({ type: 'SET_DARK_THEME', theme: defaultDarkTheme });
    broadcastToActiveTab({ type: 'SET_LIGHT_THEME', theme: defaultLightTheme });
    broadcastToActiveTab({ type: 'SET_SHAPE', shape: defaultShape });
    broadcastToActiveTab({ type: 'SET_THICKNESS', thickness: defaultThickness });
    broadcastToActiveTab({ type: 'SET_GLOW', glow: defaultGlow });
    broadcastToActiveTab({ type: 'SET_EFFECTS', effects: defaultEffects });
    broadcastToActiveTab({ type: 'SET_STATUS_BAR', showStatusBar: defaultShowStatusBar });
    broadcastToActiveTab({ type: 'SET_ADVANCED_STATUS_BAR', showAdvancedStatusBar: defaultShowAdvancedStatusBar });

    // 4. 按鈕微動畫回饋
    const btnIcon = btnResetDefaults?.querySelector('.btn-icon');
    const btnText = btnResetDefaults?.querySelector('.btn-text');
    const strings = LOCALES[currentLocale] || LOCALES['zh-TW'];
    if (btnIcon) btnIcon.textContent = '✓';
    if (btnText) btnText.textContent = strings.resetDefaultsSuccess;
    btnResetDefaults?.classList.add('success');
    setTimeout(() => {
      if (btnIcon) btnIcon.textContent = '↺';
      if (btnText) btnText.textContent = strings.resetDefaultsBtn;
      btnResetDefaults?.classList.remove('success');
    }, 1500);
  });

  // 點擊 Popup 任意其他地方時若處於確認狀態，自動取消
  document.addEventListener('click', (e) => {
    if (isResetConfirming) {
      const target = e.target as Node;
      if (!resetConfirmGroup?.contains(target) && !btnResetDefaults?.contains(target)) {
        hideConfirmButtons();
      }
    }
  });

  // 綁定「檢查更新」按鈕點擊
  if (btnCheckUpdate) {
    btnCheckUpdate.addEventListener('click', () => {
      handleCheckUpdate(true);
    });
  }

  // 綁定「一鍵下載最新版」按鈕點擊
  if (btnDownloadUpdate) {
    btnDownloadUpdate.addEventListener('click', () => {
      if (currentReleaseInfo?.downloadUrl) {
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
          chrome.tabs.create({ url: currentReleaseInfo.downloadUrl });
        } else {
          window.open(currentReleaseInfo.downloadUrl, '_blank');
        }
      }
    });
  }

  // 綁定「重新載入套件」按鈕點擊
  if (btnReloadExtension) {
    btnReloadExtension.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.reload) {
        chrome.runtime.reload();
      } else {
        window.location.reload();
      }
    });
  }

  // 開啟 Popup 面板時自動執行輕量快取檢查
  handleCheckUpdate(false);
});
