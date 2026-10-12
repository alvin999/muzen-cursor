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

/**
 * 智慧辨識當前節點所屬的閱讀作用域區塊（Reading Scope）
 * 優先尋找語義主內容/動態饋給區或獨立滾動容器，防禦多欄式版面（如 Facebook、Twitter）游標跨界
 */
export function detectReadingScope(el: HTMLElement | null, fallbackRoot: HTMLElement = document.body): HTMLElement {
  if (!el) return fallbackRoot;

  // 0. 若點擊目標身處於 float / out-of-flow 掛件內部，直接將該掛件作為局部作用域（float 內不跑去外面）
  const widgetContainer = getOutOfNormalFlowContainer(el, fallbackRoot);
  if (widgetContainer) {
    return widgetContainer;
  }

  // 1. 優先尋找巨集閱讀容器 (如 Facebook 動態牆 [role="feed"]、主內容區 [role="main"]、<main> 或對話框 [role="dialog"])
  const macroScope = el.closest<HTMLElement>(
    '[role="feed"], [role="main"], main, [role="dialog"]'
  );
  if (macroScope && macroScope !== document.body && macroScope !== document.documentElement) {
    return macroScope;
  }

  // 2. 尋找獨立垂直滾動容器 (例如具有 overflow-y 滾動特徵的欄位)
  let current: HTMLElement | null = el.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    try {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && current.clientHeight > 120) {
        return current;
      }
    } catch {}
    current = current.parentElement;
  }

  // 3. 次級尋找獨立文章容器
  const articleScope = el.closest<HTMLElement>('[role="article"], article');
  if (articleScope && articleScope !== document.body) {
    return articleScope;
  }

  return fallbackRoot;
}

/**
 * 取得節點所屬的脫離正文正常流（Out-of-Flow）的掛件容器
 * 例如 <table class="floatright">, <aside>, position: fixed/sticky 容器
 */
export function getOutOfNormalFlowContainer(node: Node, rootBound?: HTMLElement): HTMLElement | null {
  let el = (node instanceof Element ? node : node.parentElement) as HTMLElement | null;
  const bound = rootBound || document.body;

  while (el && el !== bound && el !== document.body && el !== document.documentElement) {
    // 1. 標準語義標籤
    const tag = el.tagName;
    if (tag === 'ASIDE') return el;
    const role = el.getAttribute('role');
    if (role === 'navigation' || role === 'complementary') return el;

    // 2. 瀏覽器計算樣式物理特徵 (完全不依賴 class 名稱)
    try {
      const style = window.getComputedStyle(el);
      // 浮動側欄或浮動年表/卡片
      if (style.float === 'right' || style.float === 'left') {
        return el;
      }
      // 固定或黏性側邊欄
      if (style.position === 'fixed' || style.position === 'sticky') {
        return el;
      }
    } catch {}

    el = el.parentElement;
  }

  return null;
}

/**
 * 智慧判定節點是否身處於側邊掛件或脫離正文正常流（Out-of-Flow）的容器中
 * 物理排版特徵優先（零 class 名稱依賴）：
 * 1. 浮動掛件 (float: right / float: left) —— 例如維基百科各類年表、圖片卡片
 * 2. 固定/黏性側欄 (position: fixed / sticky) —— 例如 Facebook、Twitter、各大文件目錄
 * 3. W3C 標準語義 (aside, role="navigation", role="complementary")
 */
export function isOutOfNormalFlowWidget(node: Node, rootBound?: HTMLElement): boolean {
  return getOutOfNormalFlowContainer(node, rootBound) !== null;
}



