import { AdvancedConfig, DEFAULT_ADVANCED_CONFIG, CursorTheme, CursorShape, cursorStore } from '../src/core/cursorStore';
import { initCursorHost } from '../src/content/hostElement';
import { CursorController } from '../src/core/cursorController';
import { LOCALES, Locale, Translations, detectDefaultLocale } from '../src/i18n/locales';

/**
 * Muzen Cursor 進階設定頁面互動邏輯 (全面接入真實 VimCursorOverlay 與 CursorController)
 */

let currentConfig: AdvancedConfig = { ...DEFAULT_ADVANCED_CONFIG };
let currentLocale: Locale = 'zh-TW';
let toastTimer: number | null = null;
let sandboxTheme: CursorTheme = 'gruvbox-dark';
let sandboxShape: CursorShape = 'block';
let controller: CursorController | null = null;

function applyLocale(locale: Locale): void {
  currentLocale = locale;
  const dict = LOCALES[locale] || LOCALES['zh-TW'];

  const i18nElements = document.querySelectorAll<HTMLElement>('[data-i18n]');
  i18nElements.forEach((el) => {
    const key = el.getAttribute('data-i18n') as keyof Translations;
    if (key && dict[key]) {
      el.textContent = dict[key];
    }
  });

  const resetBtns = document.querySelectorAll<HTMLElement>('.btn-field-reset');
  resetBtns.forEach((btn) => {
    btn.title = dict.resetFieldTooltip;
  });

  const localeSel = document.getElementById('options-locale-select') as HTMLSelectElement | null;
  if (localeSel) {
    localeSel.value = locale;
  }
}

function showToast(message?: string): void {
  const toast = document.getElementById('save-toast');
  if (!toast) return;
  const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
  toast.textContent = message || dict.toastUpdated;
  toast.classList.remove('hidden');

  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.add('hidden');
    toastTimer = null;
  }, 2200);
}

function syncCursorStore(): void {
  cursorStore.setState({
    enabled: true,
    visible: true,
    theme: sandboxTheme,
    shape: sandboxShape,
    advanced: currentConfig
  });
}

let previewTimer: any = null;
let revertSnapshot: any = null;

function startPreview(key: keyof AdvancedConfig): void {
  stopPreview();

  revertSnapshot = {
    mode: cursorStore.getState().mode,
    effects: { ...cursorStore.getState().effects },
    shape: sandboxShape,
    advanced: { ...currentConfig }
  };

  switch (key) {
    case 'visualBgOpacity':
      controller?.toggleVisualMode();
      controller?.moveHorizontal(1);
      setTimeout(() => controller?.moveHorizontal(1), 150);
      break;

    case 'hollowBgOpacity':
      cursorStore.setState({ shape: 'hollow' });
      controller?.moveHorizontal(1);
      setTimeout(() => controller?.moveHorizontal(-1), 220);
      break;

    case 'blockBgOpacity':
      if (cursorStore.getState().mode === 'VISUAL') controller?.exitVisualMode();
      cursorStore.setState({ shape: 'block' });
      controller?.moveHorizontal(1);
      setTimeout(() => controller?.moveHorizontal(-1), 220);
      break;

    case 'tiltAngleY':
    case 'scaleStretchY':
    case 'scaleSquishX':
      controller?.moveVertical(1);
      previewTimer = setTimeout(() => {
        controller?.moveVertical(-1);
      }, 350);
      break;

    case 'tiltAngleX':
    case 'scaleStretchX':
    case 'scaleSquishY':
    case 'perspective':
      controller?.moveHorizontal(1);
      previewTimer = setTimeout(() => {
        controller?.moveHorizontal(-1);
      }, 300);
      break;

    case 'springOvershoot':
    case 'springDurationMs':
    case 'deformSettleMs':
      controller?.moveWordForward();
      previewTimer = setTimeout(() => {
        controller?.moveHorizontal(-1);
      }, 350);
      break;

    case 'smoothDurationMs':
      cursorStore.setState({
        effects: { smooth: true, bounce: false, smoothScroll: true, breathe: false, blink: false }
      });
      controller?.moveHorizontal(1);
      previewTimer = setTimeout(() => {
        controller?.moveHorizontal(-1);
      }, 300);
      break;

    case 'breatheDuration':
    case 'breathePeakOpacity':
      cursorStore.setState({
        effects: { smooth: true, bounce: true, smoothScroll: true, breathe: true, blink: false }
      });
      break;

    case 'blinkDuration':
      cursorStore.setState({
        effects: { smooth: false, bounce: false, smoothScroll: true, breathe: false, blink: true }
      });
      break;

    case 'moveSettleDelayMs':
      controller?.moveHorizontal(1);
      break;

    case 'scrollDurationMs': {
      // 確保沙盒游標先置頂，隨後向下快速跨行推進觸發 Ease-Out Cubic 平滑自動捲動
      controller?.jumpToDocumentStart();
      setTimeout(() => {
        controller?.moveVertical(6);
      }, 60);

      previewTimer = setTimeout(() => {
        controller?.jumpToDocumentStart();
      }, currentConfig.scrollDurationMs + 450);
      break;
    }

    case 'viewportPaddingBottom': {
      controller?.jumpToDocumentStart();
      setTimeout(() => {
        // 向下推進剛好抵達或跨過底部安全邊距
        controller?.moveVertical(5);
      }, 60);

      previewTimer = setTimeout(() => {
        controller?.jumpToDocumentStart();
      }, 900);
      break;
    }

    case 'viewportPaddingTop': {
      controller?.jumpToDocumentStart();
      setTimeout(() => {
        controller?.moveVertical(6);
      }, 40);

      setTimeout(() => {
        // 往上回移 4 行，逼近或跨過頂部安全邊距，展示頂部緩衝自動回捲
        controller?.moveVertical(-4);
      }, 350);

      previewTimer = setTimeout(() => {
        controller?.jumpToDocumentStart();
      }, 1000);
      break;
    }

    case 'trailMode':
    case 'trailCount':
    case 'trailDurationMs':
    case 'trailDecayExponent':
    case 'trailMaxOpacity':
    case 'trailPreserveTrapezoid':
      cursorStore.setState({
        effects: { ...cursorStore.getState().effects, trail: true }
      });
      controller?.moveVertical(2);
      previewTimer = setTimeout(() => {
        controller?.moveVertical(-2);
      }, 420);
      break;

    default:
      controller?.moveHorizontal(1);
      previewTimer = setTimeout(() => {
        controller?.moveHorizontal(-1);
      }, 250);
      break;
  }
}

function stopPreview(): void {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
  if (revertSnapshot) {
    if (revertSnapshot.mode === 'NORMAL' && cursorStore.getState().mode === 'VISUAL') {
      controller?.exitVisualMode();
    }
    cursorStore.setState({
      shape: revertSnapshot.shape,
      effects: revertSnapshot.effects,
      advanced: revertSnapshot.advanced
    });
    revertSnapshot = null;
  }

  // 移開滑鼠時若沙盒有向下捲動，平順返回頂端
  const scrollBox = document.getElementById('sandbox-article-container');
  if (scrollBox && scrollBox.scrollTop > 0) {
    scrollBox.scrollTo({ top: 0, behavior: 'smooth' });
    controller?.jumpToDocumentStart();
  }
}

function populateForm(config: AdvancedConfig): void {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[data-key]');
  inputs.forEach((input) => {
    const key = input.getAttribute('data-key') as keyof AdvancedConfig;
    if (!key) return;
    if (input.type === 'checkbox') {
      input.checked = !!config[key];
    } else if (typeof config[key] === 'number') {
      input.value = String(config[key]);
    }
  });

  const selects = document.querySelectorAll<HTMLSelectElement>('select[data-key]');
  selects.forEach((select) => {
    const key = select.getAttribute('data-key') as keyof AdvancedConfig;
    if (!key) return;
    if (config[key] !== undefined) {
      select.value = String(config[key]);
    }
  });

  updateDiagnostics();
  syncCursorStore();
}

function saveConfig(silent = false): void {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set({ muzen_advanced: currentConfig }, () => {
      if (!silent) showToast();
    });
  } else {
    localStorage.setItem('muzen_advanced', JSON.stringify(currentConfig));
    if (!silent) showToast();
  }
  updateDiagnostics();
  syncCursorStore();
}

function loadConfig(): void {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['muzen_advanced', 'muzen_theme', 'muzen_shape', 'muzen_locale'], (res) => {
      const savedLocale = (res.muzen_locale as Locale) || detectDefaultLocale();
      applyLocale(savedLocale);

      if (res.muzen_advanced && typeof res.muzen_advanced === 'object') {
        currentConfig = { ...DEFAULT_ADVANCED_CONFIG, ...res.muzen_advanced };
      } else {
        currentConfig = { ...DEFAULT_ADVANCED_CONFIG };
      }
      if (res.muzen_theme) sandboxTheme = res.muzen_theme;
      if (res.muzen_shape) sandboxShape = res.muzen_shape;

      const themeSel = document.getElementById('sandbox-theme') as HTMLSelectElement | null;
      if (themeSel && res.muzen_theme) themeSel.value = res.muzen_theme;

      const shapeSel = document.getElementById('sandbox-shape') as HTMLSelectElement | null;
      if (shapeSel && res.muzen_shape) shapeSel.value = res.muzen_shape;

      populateForm(currentConfig);
    });
  } else {
    applyLocale(detectDefaultLocale());
    const local = localStorage.getItem('muzen_advanced');
    if (local) {
      try {
        currentConfig = { ...DEFAULT_ADVANCED_CONFIG, ...JSON.parse(local) };
      } catch {
        currentConfig = { ...DEFAULT_ADVANCED_CONFIG };
      }
    }
    populateForm(currentConfig);
  }
}

function updateDiagnostics(): void {
  const diagPersp = document.getElementById('diag-persp');
  const diagTilt = document.getElementById('diag-tilt');
  const diagSettle = document.getElementById('diag-settle');

  if (diagPersp) diagPersp.textContent = `${currentConfig.perspective}px`;
  if (diagTilt) diagTilt.textContent = `${currentConfig.tiltAngleX}° / ${currentConfig.tiltAngleY}°`;
  if (diagSettle) diagSettle.textContent = `${currentConfig.deformSettleMs}ms`;
}

function initEvents(): void {
  // 0. 語言切換選單監聽
  const localeSel = document.getElementById('options-locale-select') as HTMLSelectElement | null;
  if (localeSel) {
    localeSel.addEventListener('change', () => {
      const selected = localeSel.value as Locale;
      applyLocale(selected);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ muzen_locale: selected });
      } else {
        localStorage.setItem('muzen_locale', selected);
      }
    });
  }

  // 跨分頁與 popup 變更即時監聽同步
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;
      if (changes.muzen_locale && changes.muzen_locale.newValue) {
        applyLocale(changes.muzen_locale.newValue as Locale);
      }
      if (changes.muzen_theme && changes.muzen_theme.newValue) {
        sandboxTheme = changes.muzen_theme.newValue;
        const themeSel = document.getElementById('sandbox-theme') as HTMLSelectElement | null;
        if (themeSel) themeSel.value = sandboxTheme;
        syncCursorStore();
      }
      if (changes.muzen_shape && changes.muzen_shape.newValue) {
        sandboxShape = changes.muzen_shape.newValue;
        const shapeSel = document.getElementById('sandbox-shape') as HTMLSelectElement | null;
        if (shapeSel) shapeSel.value = sandboxShape;
        syncCursorStore();
      }
      if (changes.muzen_advanced && changes.muzen_advanced.newValue) {
        currentConfig = { ...DEFAULT_ADVANCED_CONFIG, ...changes.muzen_advanced.newValue };
        populateForm(currentConfig);
      }
    });
  }

  // 1. 數值與核取方塊輸入框即時同步
  const inputs = document.querySelectorAll<HTMLInputElement>('input[data-key]');
  inputs.forEach((input) => {
    const handleInput = () => {
      const key = input.getAttribute('data-key') as keyof AdvancedConfig;
      if (!key) return;

      if (input.type === 'checkbox') {
        (currentConfig as any)[key] = input.checked;
        saveConfig(false);
      } else {
        const numVal = parseFloat(input.value);
        if (!isNaN(numVal)) {
          (currentConfig as any)[key] = numVal;
          saveConfig(false);
        }
      }
    };

    input.addEventListener('input', handleInput);
    input.addEventListener('change', handleInput);
  });

  // 1.1 下拉選單即時同步 (如 trailMode)
  const selects = document.querySelectorAll<HTMLSelectElement>('select[data-key]');
  selects.forEach((select) => {
    select.addEventListener('change', () => {
      const key = select.getAttribute('data-key') as keyof AdvancedConfig;
      if (!key) return;
      (currentConfig as any)[key] = select.value;
      saveConfig(false);
    });
  });

  // 2. 單項重設按鈕
  document.querySelectorAll<HTMLButtonElement>('.btn-field-reset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key') as keyof AdvancedConfig;
      if (!key) return;

      const defaultVal = DEFAULT_ADVANCED_CONFIG[key];
      (currentConfig as any)[key] = defaultVal;

      const targetControl = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-key="${key}"]`);
      if (targetControl) {
        if (targetControl instanceof HTMLInputElement && targetControl.type === 'checkbox') {
          targetControl.checked = !!defaultVal;
        } else {
          targetControl.value = String(defaultVal);
        }
      }

      saveConfig(false);
      const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
      showToast(dict.toastFieldReset.replace('{field}', key) + ` (${defaultVal})`);
    });
  });

  // 3. 全部回復預設值
  const btnResetAll = document.getElementById('btn-reset-all');
  if (btnResetAll) {
    btnResetAll.addEventListener('click', () => {
      const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
      if (confirm(dict.confirmResetAll)) {
        currentConfig = { ...DEFAULT_ADVANCED_CONFIG };
        populateForm(currentConfig);
        saveConfig(false);
        showToast(dict.toastResetAll);
      }
    });
  }

  // 4. 匯出 JSON
  const btnExport = document.getElementById('btn-export-json');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', 'muzen-cursor-advanced-settings.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast(dict.toastExportSuccess);
    });
  }

  // 5. 匯入 JSON
  const btnImport = document.getElementById('btn-import-json');
  const fileImportInput = document.getElementById('file-import-input') as HTMLInputElement | null;
  if (btnImport && fileImportInput) {
    btnImport.addEventListener('click', () => {
      fileImportInput.click();
    });

    fileImportInput.addEventListener('change', (e) => {
      const dict = LOCALES[currentLocale] || LOCALES['zh-TW'];
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (imported && typeof imported === 'object') {
            currentConfig = { ...DEFAULT_ADVANCED_CONFIG, ...imported };
            populateForm(currentConfig);
            saveConfig(false);
            showToast(dict.toastImportSuccess);
          }
        } catch (err) {
          alert(dict.alertImportError);
        }
        target.value = '';
      };
      reader.readAsText(file);
    });
  }

  // 6. 沙盒控制條（主題與形態）
  const themeSel = document.getElementById('sandbox-theme') as HTMLSelectElement | null;
  if (themeSel) {
    themeSel.addEventListener('change', () => {
      sandboxTheme = themeSel.value as CursorTheme;
      syncCursorStore();
    });
  }

  const shapeSel = document.getElementById('sandbox-shape') as HTMLSelectElement | null;
  if (shapeSel) {
    shapeSel.addEventListener('change', () => {
      sandboxShape = shapeSel.value as CursorShape;
      syncCursorStore();
    });
  }

  // 7. 沙盒方向與模式按鈕 (直接呼叫正版 controller)
  document.getElementById('pad-left')?.addEventListener('click', () => controller?.moveHorizontal(-1));
  document.getElementById('pad-right')?.addEventListener('click', () => controller?.moveHorizontal(1));
  document.getElementById('pad-up')?.addEventListener('click', () => controller?.moveVertical(-1));
  document.getElementById('pad-down')?.addEventListener('click', () => controller?.moveVertical(1));
  document.getElementById('pad-word-fwd')?.addEventListener('click', () => controller?.moveWordForward());
  document.getElementById('pad-v')?.addEventListener('click', () => controller?.toggleVisualMode());
  document.getElementById('pad-yank')?.addEventListener('click', () => controller?.yankSelection());
  document.getElementById('pad-esc')?.addEventListener('click', () => controller?.exitVisualMode());

  // 8. 每個選項滑鼠懸浮 (hover) 即時動態效果模擬
  document.querySelectorAll<HTMLElement>('.field-card').forEach((card) => {
    const control = card.querySelector<HTMLInputElement | HTMLSelectElement>('input[data-key], select[data-key]');
    const key = control?.getAttribute('data-key') as keyof AdvancedConfig | null;
    if (!key) return;

    card.addEventListener('mouseenter', () => {
      card.classList.add('is-previewing');
      startPreview(key);
    });

    card.addEventListener('mouseleave', () => {
      card.classList.remove('is-previewing');
      stopPreview();
    });
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 1. 掛載正版 Shadow DOM 宿主元件 (VimCursorOverlay + VimStatusBar)
  initCursorHost();

  // 2. 初始化正版 CursorController，限定於沙盒段落內
  const sandboxArticle = document.getElementById('sandbox-article');
  if (sandboxArticle) {
    controller = new CursorController({
      containerRoot: sandboxArticle,
      enableScroll: true
    });
    controller.init();
  }

  loadConfig();
  initEvents();

  setTimeout(() => {
    controller?.findInitialTarget();
  }, 120);
});
