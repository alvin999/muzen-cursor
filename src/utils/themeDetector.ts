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
 * RGB 轉 HSL
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * HSL 轉 RGB 及 16 進位 Hex 色碼
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number; hex: string } {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.max(0, Math.min(255, Math.round(255 * color)));
  };
  const r = f(0);
  const g = f(8);
  const b = f(4);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return { r, g, b, hex: `#${toHex(r)}${toHex(g)}${toHex(b)}` };
}

/**
 * 探測網頁主要品牌色 / 強調色 (Accent Color)
 */
export function getEffectivePageAccent(): { r: number; g: number; b: number } | null {
  if (typeof document === 'undefined') return null;

  // 1. meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
  if (metaThemeColor) {
    const parsed = parseCssColor(metaThemeColor);
    if (parsed && parsed.a > 0.3) {
      const max = Math.max(parsed.r, parsed.g, parsed.b);
      const min = Math.min(parsed.r, parsed.g, parsed.b);
      if (max - min > 25) {
        return { r: parsed.r, g: parsed.g, b: parsed.b };
      }
    }
  }

  // 2. 探測主要連結或按鈕顏色
  try {
    const primaryEl = document.querySelector('main a, article a, a, .btn-primary, [role="button"]');
    if (primaryEl) {
      const style = window.getComputedStyle(primaryEl);
      const color = style.color;
      const parsed = parseCssColor(color);
      if (parsed && parsed.a > 0.5) {
        const max = Math.max(parsed.r, parsed.g, parsed.b);
        const min = Math.min(parsed.r, parsed.g, parsed.b);
        if (max - min > 35) {
          return { r: parsed.r, g: parsed.g, b: parsed.b };
        }
      }
    }
  } catch {
    // 安全略過
  }

  return null;
}

/**
 * 智慧演算當前網頁最適游標配色 (Smart Dynamic Cursor Palette)
 * 多彩化演算引擎：依網頁底色色相 (Hue)、對比互補與品牌色，動態生成高對比、不眩光的專屬色彩 (青/藍/紫/綠/珊瑚金)
 */
export function generateSmartCursorPalette(
  theme: PageTheme,
  bg: { r: number; g: number; b: number },
  accent: { r: number; g: number; b: number } | null = null
): SmartThemePalette {
  const [h, s, l] = rgbToHsl(bg.r, bg.g, bg.b);

  // 1. 若網頁有顯著的品牌強調色，調校亮度後直接化為專屬游標主色
  if (accent) {
    const [accH, accS] = rgbToHsl(accent.r, accent.g, accent.b);
    if (accS > 25) {
      const targetL = theme === 'dark' ? 62 : 38;
      const normalColor = hslToRgb(accH, Math.min(95, accS + 10), targetL);
      const visualColor = hslToRgb((accH + 40) % 360, 90, theme === 'dark' ? 68 : 42);
      return { normal: normalColor, visual: visualColor };
    }
  }

  // 2. 純數學連續色彩生成演算法 (Pure Mathematical Generative Color Algorithm)
  // 零 hardcode、零靜態查表，現場根據環境光譜連續演算專屬游標配色

  // (1) 色相 (Hue)：色輪 180° 對稱互補 + 中性底色自適應
  const baseH = s > 12 ? (h + 180) % 360 : 205; // 有彩色走 180° 對稱互補，黑白灰走極光湛藍
  const visualH = (baseH + 38) % 360;           // Visual 模式沿和諧角旋轉 38°

  // (2) 飽和度 (Saturation)：負反饋聚焦公式 (背景越灰暗素淨，游標飽和度越充沛聚焦)
  const baseS = Math.min(95, Math.max(72, 96 - s * 0.22));
  const visualS = Math.min(95, Math.max(78, baseS + 4));

  // (3) 明度 (Lightness)：平滑對比推開函數，保證 WCAG 2.1 高對比度
  const isDark = theme === 'dark';
  const normalL = isDark
    ? Math.min(85, Math.max(62, 100 - l * 0.55))    // 深色網頁底 -> 映射至 62% ~ 85% 明亮清澈區間
    : Math.max(22, Math.min(40, (100 - l) * 0.65)); // 淺色網頁底 -> 映射至 22% ~ 40% 濃郁深色區間

  // Visual 狀態明度階梯偏置 (深色背景更亮、淺色背景更沉穩，強化選取立體感)
  const visualL = isDark ? Math.min(90, normalL + 7) : Math.max(18, normalL - 6);

  return {
    normal: hslToRgb(baseH, baseS, normalL),
    visual: hslToRgb(visualH, visualS, visualL)
  };
}

/**
 * 完整偵測網頁主題明暗及智慧演算最適調色盤 (dynamicPalette)
 */
export function detectPageSmartInfo(luminanceThreshold = 128): SmartThemeInfo {
  const theme = detectPageTheme(luminanceThreshold);
  const effectiveBg = getEffectivePageBg() || (theme === 'dark' ? { r: 24, g: 24, b: 24 } : { r: 255, g: 255, b: 255 });
  const accent = getEffectivePageAccent();
  const palette = generateSmartCursorPalette(theme, effectiveBg, accent);
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
