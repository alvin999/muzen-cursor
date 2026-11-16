import { CursorRect, FlashHintItem } from '../cursorStore';
import { isValidReadableTextNode } from './spatialNavigator';

const DEFAULT_HINT_ALPHABET = 'asdfjklghqweruiopzxcvnm';

interface RawCandidate {
  node: Text;
  offset: number;
  rect: CursorRect;
  matchLength?: number;
  nextChar?: string;
}

/**
 * 檢查元素是否實際可見且未超出視口
 */
function isRectInViewport(rect: DOMRect, vw: number, vh: number): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (rect.bottom < 0 || rect.top > vh) return false;
  if (rect.right < 0 || rect.left > vw) return false;
  return true;
}

/**
 * 檢查節點是否屬於 Muzen 自身的宿主容器
 */
function isHostNode(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return !!el?.closest('#muzen-cursor-host-root');
}

/**
 * 尋找所屬的語義區塊容器，用來做無搜尋字元時的段落級去重
 */
function getBlockContainer(node: Node): Element | null {
  let el = node.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    const tag = el.tagName;
    if (
      tag === 'P' || tag === 'LI' || tag === 'H1' || tag === 'H2' || tag === 'H3' ||
      tag === 'H4' || tag === 'H5' || tag === 'H6' || tag === 'BLOCKQUOTE' ||
      tag === 'PRE' || tag === 'TD' || tag === 'TH' || tag === 'DT' || tag === 'DD' ||
      tag === 'A' || tag === 'BUTTON' || tag === 'FIGCAPTION' || tag === 'SUMMARY'
    ) {
      return el;
    }
    try {
      const display = window.getComputedStyle(el).display;
      if (display === 'block' || display === 'flex' || display === 'grid' || display === 'list-item') {
        return el;
      }
    } catch { }
    el = el.parentElement;
  }
  return document.body;
}

/**
 * 為候選清單分配單碼或無前綴衝突的雙碼標籤
 */
function assignLabels(candidates: RawCandidate[], forbiddenChars: Set<string>): FlashHintItem[] {
  if (candidates.length === 0) return [];

  const availableChars = DEFAULT_HINT_ALPHABET
    .split('')
    .filter((ch) => !forbiddenChars.has(ch));

  // 若全部都被排除，退回使用預設字元表確保仍有標籤可用
  const alphabet = availableChars.length >= 4 ? availableChars : DEFAULT_HINT_ALPHABET.split('');
  const labels: string[] = [];

  if (candidates.length <= alphabet.length) {
    for (let i = 0; i < candidates.length; i++) {
      labels.push(alphabet[i]);
    }
  } else {
    // 保留部分單碼給最前面的項目，其餘展開為雙碼 (Prefix-free)
    const maxSingle = Math.max(0, alphabet.length - Math.ceil((candidates.length - alphabet.length) / (alphabet.length - 1)));
    for (let i = 0; i < maxSingle && labels.length < candidates.length; i++) {
      labels.push(alphabet[i]);
    }
    for (let p = maxSingle; p < alphabet.length && labels.length < candidates.length; p++) {
      for (let s = 0; s < alphabet.length && labels.length < candidates.length; s++) {
        labels.push(alphabet[p] + alphabet[s]);
      }
    }
  }

  const result: FlashHintItem[] = [];
  const limit = Math.min(candidates.length, labels.length);
  for (let i = 0; i < limit; i++) {
    const c = candidates[i];
    result.push({
      label: labels[i],
      node: c.node,
      offset: c.offset,
      rect: c.rect,
      matchLength: c.matchLength
    });
  }
  return result;
}

/**
 * 收集視口內所有可跳轉目標並分配標籤
 * - query 為空：收集視口內各區塊／浮動視窗開頭（免切換輸入法即可直達）
 * - query 非空：依搜尋字串精準比對並動態避開下一字元衝突（flash.nvim 風格）
 */
export function collectFlashHints(
  rootElement: HTMLElement,
  query: string = ''
): FlashHintItem[] {
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const normalizedQuery = query.toLowerCase();
  const isSearchMode = normalizedQuery.length > 0;

  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (node.nodeType !== Node.TEXT_NODE) return NodeFilter.FILTER_REJECT;
      if (isHostNode(node)) return NodeFilter.FILTER_REJECT;
      if (!isValidReadableTextNode(node as Text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const candidates: RawCandidate[] = [];
  const seenBlocks = new WeakSet<Element>();
  const forbiddenNextChars = new Set<string>();
  const range = document.createRange();
  const MAX_CANDIDATES = 120;

  let current = walker.nextNode() as Text | null;
  while (current && candidates.length < MAX_CANDIDATES) {
    const text = current.textContent || '';

    if (!isSearchMode) {
      // 區塊模式：每個區塊元素只取第一個非空白字元，避免畫面過度擁擠
      const block = getBlockContainer(current);
      if (block && !seenBlocks.has(block)) {
        const firstNonSpace = text.search(/\S/);
        if (firstNonSpace !== -1) {
          try {
            range.setStart(current, firstNonSpace);
            range.setEnd(current, firstNonSpace + 1);
            const domRect = range.getBoundingClientRect();
            if (isRectInViewport(domRect, vw, vh)) {
              // 空間距離去重：避免過近的相鄰行內元素重疊標籤
              const tooClose = candidates.some(
                (c) => Math.abs(c.rect.y - domRect.top) < 16 && Math.abs(c.rect.x - domRect.left) < 42
              );
              if (!tooClose) {
                seenBlocks.add(block);
                candidates.push({
                  node: current,
                  offset: firstNonSpace,
                  rect: {
                    x: domRect.left,
                    y: domRect.top,
                    width: Math.max(8, domRect.width),
                    height: Math.max(14, domRect.height)
                  }
                });
              }
            }
          } catch { }
        }
      }
    } else {
      // 搜尋模式：比對所有符合 query 的子字串
      const lowerText = text.toLowerCase();
      let searchFrom = 0;
      while (searchFrom < lowerText.length && candidates.length < MAX_CANDIDATES) {
        const idx = lowerText.indexOf(normalizedQuery, searchFrom);
        if (idx === -1) break;

        try {
          const endIdx = Math.min(text.length, idx + normalizedQuery.length);
          range.setStart(current, idx);
          range.setEnd(current, endIdx);
          const domRect = range.getBoundingClientRect();
          if (isRectInViewport(domRect, vw, vh)) {
            const nextCh = endIdx < text.length ? text[endIdx].toLowerCase() : '';
            if (nextCh && /[a-z0-9]/.test(nextCh)) {
              forbiddenNextChars.add(nextCh);
            }
            candidates.push({
              node: current,
              offset: idx,
              matchLength: normalizedQuery.length,
              nextChar: nextCh,
              rect: {
                x: domRect.left,
                y: domRect.top,
                width: Math.max(8, domRect.width),
                height: Math.max(14, domRect.height)
              }
            });
          }
        } catch { }
        searchFrom = idx + Math.max(1, normalizedQuery.length);
      }
    }

    current = walker.nextNode() as Text | null;
  }

  return assignLabels(candidates, isSearchMode ? forbiddenNextChars : new Set<string>());
}
