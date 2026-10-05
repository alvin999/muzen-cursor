/**
 * DOM 與焦點相關公用函式
 */

/**
 * 判斷當前按鍵事件是否發生在輸入情境（Input Context）
 * 防止 Vim 快捷鍵干擾使用者的正常打字行為
 */
export function isTypingContext(e: KeyboardEvent | MouseEvent): boolean {
  const rawTarget = (e.composedPath ? e.composedPath()[0] : e.target) as Node | null;
  if (!rawTarget) return false;

  // 若目標為 Text 節點，向上尋找其父層 Element
  const target = (rawTarget instanceof Element ? rawTarget : rawTarget.parentElement) as HTMLElement | null;
  if (!target) return false;

  // 1. 常規 HTML 輸入控制項
  const tagName = target.tagName ? target.tagName.toUpperCase() : '';
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  // 2. contenteditable 區塊（包含富文本編輯器）
  if (target.isContentEditable || target.getAttribute?.('contenteditable') === 'true') {
    return true;
  }

  // 3. 現代編輯器常見框架標記 (Monaco, Notion, CodeMirror, Quill, ProseMirror)
  if (typeof target.closest === 'function') {
    const isEditor = target.closest(
      '.monaco-editor, .notion-page-content, .cm-editor, .ql-editor, .ProseMirror, [role="textbox"], [role="searchbox"]'
    );
    if (isEditor) {
      return true;
    }
  }

  return false;
}

/**
 * 判斷元素是否在可見視窗內
 */
export function isElementInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.left <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * 判斷當前網域名稱是否命中名單 (支援萬用或子網域比對)
 */
export function isHostnameExcluded(hostname: string, list: string[]): boolean {
  if (!hostname || !list || !Array.isArray(list)) return false;
  const current = hostname.toLowerCase();
  return list.some((item) => {
    const pattern = item.trim().toLowerCase();
    if (!pattern) return false;
    return current === pattern || current.endsWith('.' + pattern);
  });
}

