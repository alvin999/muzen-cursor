/**
 * 網頁深淺色主題感應器 (Web Theme Detector)
 * 智慧探測網頁是深色 (Dark) 或淺色 (Light)，並支援 SPA 動態切換監聽
 */

export type PageTheme = 'dark' | 'light';

export interface SmartThemeColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

export interface SmartThemePalette {
  normal: SmartThemeColor;
  visual: SmartThemeColor;
}

export interface SmartThemeInfo {
  theme: PageTheme;
  palette: SmartThemePalette;
  bgRgb: { r: number; g: number; b: number };
}

/**
 * 解析各類 CSS 顏色字串為 RGBA 數值
 */
export function parseCssColor(colorStr: string): { r: number; g: number; b: number; a: number } | null {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit') {
    return null;
  }

  // 1. rgb / rgba 格式
  const rgbaMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
    };
  }

  // 2. 16 進位 #RRGGBB 或 #RGB 格式
  const hexMatch = colorStr.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      };
    }
  }

  return null;
}

/**
 * 計算標準感知亮度 (Perceived Luminance，範圍 0 ~ 255)
 * 基於標準感知加權：Y = 0.299*R + 0.587*G + 0.114*B
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 探測當前網頁的主題配色（深色或淺色）
 * 採階層式探測法：
 * 1. 檢查 HTML / Body 宣告的 class 與 data 屬性 (Tailwind, GitHub, DaisyUI 等)
 * 2. 檢查 meta 標籤 (color-scheme / theme-color)
 * 3. 取樣 body 與 documentElement 的計算背景色感知亮度
 * 4. 系統偏好 prefers-color-scheme 與預設白底 fallback
 */
export function detectPageTheme(luminanceThreshold = 128): PageTheme {
  if (typeof document === 'undefined') return 'light';

  const html = document.documentElement;
  const body = document.body;

  // 1. 檢查標籤屬性 (優先級最高：明確的主題標記)
  const checkElementClassesAndDataset = (el: HTMLElement | null): PageTheme | null => {
    if (!el) return null;
    const classList = Array.from(el.classList).map((c) => c.toLowerCase());
    const darkClasses = ['dark', 'dark-mode', 'dark-theme', 'theme-dark', 'night', 'theme--dark', 'vscode-dark'];
    const lightClasses = ['light', 'light-mode', 'light-theme', 'theme-light', 'theme--light', 'vscode-light'];

    if (classList.some((c) => darkClasses.includes(c))) return 'dark';
    if (classList.some((c) => lightClasses.includes(c))) return 'light';

    // 檢查 data-theme, data-color-mode, data-mode, data-bs-theme 等
    for (const key of ['theme', 'colorMode', 'mode', 'colorScheme', 'bsTheme']) {
      const val = (el.dataset[key] || '').toLowerCase();
      if (val.includes('dark') || val.includes('night') || val.includes('black')) return 'dark';
      if (val.includes('light') || val.includes('day') || val.includes('white')) return 'light';
    }

    // 檢查自訂屬性 (包含 Bootstrap 5.3+ data-bs-theme)
    const themeAttr = (
      el.getAttribute('data-theme') ||
      el.getAttribute('data-bs-theme') ||
      el.getAttribute('theme') ||
      ''
    ).toLowerCase();
    if (themeAttr.includes('dark')) return 'dark';
    if (themeAttr.includes('light')) return 'light';

    return null;
  };

  const htmlDecl = checkElementClassesAndDataset(html);
  if (htmlDecl) return htmlDecl;

  const bodyDecl = checkElementClassesAndDataset(body);
  if (bodyDecl) return bodyDecl;

  // 2. 檢查 meta 標籤與 computed color-scheme
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')?.toLowerCase();
  if (metaColorScheme) {
    if (metaColorScheme.includes('dark') && !metaColorScheme.includes('light')) return 'dark';
    if (metaColorScheme.includes('light') && !metaColorScheme.includes('dark')) return 'light';
  }

  // 檢查 CSS computed style 之 color-scheme
  try {
    const htmlScheme = window.getComputedStyle(html).colorScheme?.toLowerCase();
    if (htmlScheme) {
      if (htmlScheme.includes('dark') && !htmlScheme.includes('light')) return 'dark';
      if (htmlScheme.includes('light') && !htmlScheme.includes('dark')) return 'light';
    }
  } catch {
    // 安全略過
  }

  const metaThemeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
  if (metaThemeColor) {
    const parsedMeta = parseCssColor(metaThemeColor);
    if (parsedMeta && parsedMeta.a > 0.3) {
      return calculateLuminance(parsedMeta.r, parsedMeta.g, parsedMeta.b) < luminanceThreshold ? 'dark' : 'light';
    }
  }

  // 3. 向上取樣 body 與 html 計算背景色 (若為透明則進一步探測常見 SPA 根容器)
  const effectiveBg = getEffectivePageBg();
  if (effectiveBg) {
    const lum = calculateLuminance(effectiveBg.r, effectiveBg.g, effectiveBg.b);
    return lum < luminanceThreshold ? 'dark' : 'light';
  }

  // 4. 系統偏好與瀏覽器預設 fallback
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) return 'dark';
  }

  // 瀏覽器預設白底
  return 'light';
}

/**
 * RGB 轉 16 進位 Hex 字串
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 向上取樣 body 與 html 計算背景色 (若為透明則進一步探測常見 SPA 根容器)
 */
export function getEffectivePageBg(): { r: number; g: number; b: number } | null {
  if (typeof document === 'undefined') return null;
  const html = document.documentElement;
  const body = document.body;
  const targets: (HTMLElement | null)[] = [
    body,
    html,
    document.getElementById('root'),
    document.getElementById('__next'),
    document.getElementById('app'),
    document.querySelector('main')
  ];

  for (const el of targets) {
    if (!el) continue;
    try {
      const bg = window.getComputedStyle(el).backgroundColor;
      const parsed = parseCssColor(bg);
      if (parsed && parsed.a > 0.05) {
        return { r: parsed.r, g: parsed.g, b: parsed.b };
      }
    } catch {
      // 安全略過
    }
  }
  return null;
}

/**
 * 智慧演算當前網頁最適游標配色 (Smart Dynamic Cursor Palette)
 * 根據採樣到的背景色彩特徵、感知亮度與色彩心理學，自動產生最高辨識度與舒適感的色彩組合
 */
export function generateSmartCursorPalette(
  theme: PageTheme,
  bg: { r: number; g: number; b: number }
): SmartThemePalette {
  if (theme === 'dark') {
    // 深色網頁：人眼在暗處對黃橙色波長最敏感，且具備最佳夜間對比與無眩光特性
    const isColdTint = bg.b > bg.r + 15; // 偏深冷色調 (如 GitHub Dark, VSCode)
    const isGreenTint = bg.g > bg.r + 15 && bg.g > bg.b + 10; // 偏暗綠

    let normalR = 254;
    let normalG = 138;
    let normalB = 24;

    if (isColdTint) {
      // 冷色背景中，加強琥珀暖光的鮮明度
      normalR = 255;
      normalG = 145;
      normalB = 30;
    } else if (isGreenTint) {
      // 墨綠色背景中，稍微偏向珊瑚暖赤橙以提升補色反差
      normalR = 255;
      normalG = 115;
      normalB = 60;
    }

    return {
      normal: {
        r: normalR,
        g: normalG,
        b: normalB,
        hex: rgbToHex(normalR, normalG, normalB)
      },
      visual: {
        r: 250,
        g: 198,
        b: 50,
        hex: '#fac632' // 明亮金黃
      }
    };
  } else {
    // 淺色網頁 (白底、米黃、淺灰)：游標必須有充足的濃度避免融入背景，同時保留品牌標誌性
    const isWarmBg = bg.r > bg.b + 15; // 暖米色 / 護眼底色
    
    let normalR = 175;
    let normalG = 58;
    let normalB = 3;

    if (isWarmBg) {
      // 暖色米白底：加重暗赭赤紅對比
      normalR = 168;
      normalG = 42;
      normalB = 2;
    }

    return {
      normal: {
        r: normalR,
        g: normalG,
        b: normalB,
        hex: rgbToHex(normalR, normalG, normalB)
      },
      visual: {
        r: 181,
        g: 118,
        b: 20,
        hex: '#b57614' // 雅致深金琥珀
      }
    };
  }
}

/**
 * 完整偵測網頁主題明暗及智慧演算最適調色盤
 */
export function detectPageSmartInfo(luminanceThreshold = 128): SmartThemeInfo {
  const theme = detectPageTheme(luminanceThreshold);
  const effectiveBg = getEffectivePageBg() || (theme === 'dark' ? { r: 24, g: 24, b: 24 } : { r: 255, g: 255, b: 255 });
  const palette = generateSmartCursorPalette(theme, effectiveBg);
  return {
    theme,
    palette,
    bgRgb: effectiveBg
  };
}

/**
 * 監聽網頁主題色彩變動 (防抖 MutationObserver 與 matchMedia 監聽)
 * @param callback 當網頁主題變更時回調，支援傳遞最新 SmartThemeInfo
 * @param options 可自訂亮度門檻與防抖毫秒
 * @returns 取消監聽之清理函式 (unsubscribe)
 */
export function observeThemeChange(
  callback: (info: SmartThemeInfo) => void,
  options: { luminanceThreshold?: number; debounceMs?: number } = {}
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const threshold = options.luminanceThreshold ?? 128;
  const debounceMs = options.debounceMs ?? 200;

  let lastInfo = detectPageSmartInfo(threshold);
  let timer: number | null = null;

  const triggerCheck = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      timer = null;
      const current = detectPageSmartInfo(threshold);
      if (
        current.theme !== lastInfo.theme ||
        current.palette.normal.hex !== lastInfo.palette.normal.hex
      ) {
        lastInfo = current;
        callback(current);
      }
    }, debounceMs);
  };

  // 1. 監聽 DOM 樹根節點屬性變化
  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes') {
          triggerCheck();
          break;
        }
      }
    });

    const obsConfig: MutationObserverInit = {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode', 'data-mode', 'theme', 'data-bs-theme']
    };

    if (document.documentElement) {
      observer.observe(document.documentElement, obsConfig);
    }
    if (document.body) {
      observer.observe(document.body, obsConfig);
    }
  }

  // 2. 監聽系統/瀏覽器明暗模式切換
  let mediaQuery: MediaQueryList | null = null;
  const mediaListener = () => triggerCheck();
  if (window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', mediaListener);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(mediaListener);
    }
  }

  // 回傳完整清理函式
  return () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (mediaQuery) {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', mediaListener);
      } else if ((mediaQuery as any).removeListener) {
        (mediaQuery as any).removeListener(mediaListener);
      }
    }
  };
}
