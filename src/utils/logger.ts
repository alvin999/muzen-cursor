/**
 * Muzen Cursor - 統一日誌管理器 (Logger)
 * 避免在使用者一般網頁瀏覽或生產環境中佔用/污染主控台 (Console)。
 *
 * 啟用除錯模式方式：
 * 1. 在網頁主控台輸入：localStorage.setItem('MUZEN_DEBUG', 'true') 並重整
 * 2. 或在主控台直接設置全域變數：window.__MUZEN_DEBUG__ = true
 */

export interface ILogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * 檢查目前環境是否開啟了除錯模式
 */
export function isDebugMode(): boolean {
  try {
    if (typeof window !== 'undefined') {
      if ((window as unknown as { __MUZEN_DEBUG__?: boolean }).__MUZEN_DEBUG__ === true) {
        return true;
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem('MUZEN_DEBUG') === 'true') {
        return true;
      }
    }
    if (typeof self !== 'undefined' && (self as unknown as { __MUZEN_DEBUG__?: boolean }).__MUZEN_DEBUG__ === true) {
      return true;
    }
  } catch {
    // 忽略安全沙盒或無權限存取 localStorage 的例外
  }
  return false;
}

/**
 * 建立具特定標籤前綴的 Logger 實例
 * @param prefix 日誌前綴標籤，例如 "[Muzen Cursor]" 或 "[Muzen Trail]"
 */
export function createLogger(prefix = '[Muzen Cursor]'): ILogger {
  const cleanPrefix = prefix.trim();
  const format = (args: unknown[]): unknown[] => {
    if (args.length > 0 && typeof args[0] === 'string' && args[0].startsWith(cleanPrefix)) {
      return args;
    }
    return [`${cleanPrefix} `, ...args];
  };

  return {
    debug(...args: unknown[]) {
      if (isDebugMode()) {
        console.debug(...format(args));
      }
    },
    info(...args: unknown[]) {
      if (isDebugMode()) {
        console.info(...format(args));
      }
    },
    warn(...args: unknown[]) {
      // 警示預設亦受除錯開關保護，避免在未授權或非預期頁面引發主控台噪音
      if (isDebugMode()) {
        console.warn(...format(args));
      }
    },
    error(...args: unknown[]) {
      // 嚴重例外狀況一律輸出以利排查問題
      console.error(...format(args));
    }
  };
}

export const logger = createLogger('[Muzen Cursor]');
