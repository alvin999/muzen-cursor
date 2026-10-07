import { cursorStore } from '../core/cursorStore';

let activeScrollRafId: number | null = null;

/**
 * 取消進行中之平滑滾動動畫
 */
export function cancelActiveScroll(): void {
  if (activeScrollRafId !== null) {
    cancelAnimationFrame(activeScrollRafId);
    activeScrollRafId = null;
  }
}

/**
 * 具有物理阻尼感之 Ease-Out Cubic 平滑捲動引擎
 */
export function animateScrollTo(
  target: HTMLElement | Window,
  targetTop: number,
  duration?: number
): void {
  const actualDuration =
    typeof duration === 'number'
      ? duration
      : (cursorStore.getState().advanced?.scrollDurationMs ?? 380);

  cancelActiveScroll();

  const isWin = target === window || !(target instanceof HTMLElement);
  const startTop = isWin
    ? window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
    : (target as HTMLElement).scrollTop;

  const viewportH = window.visualViewport?.height ?? window.innerHeight;
  const maxScroll = isWin
    ? Math.max(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - viewportH)
    : Math.max(0, (target as HTMLElement).scrollHeight - (target as HTMLElement).clientHeight);

  const clampedTarget = Math.max(0, Math.min(maxScroll, targetTop));
  const distance = clampedTarget - startTop;

  const isSmooth = cursorStore.getState().effects?.smoothScroll ?? true;
  if (!isSmooth || Math.abs(distance) < 1) {
    if (isWin) {
      window.scrollTo(0, clampedTarget);
    } else {
      (target as HTMLElement).scrollTop = clampedTarget;
    }
    return;
  }

  const startTime = performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / actualDuration);
    // Ease-Out Cubic: 物理阻尼曲線
    const ease = 1 - Math.pow(1 - progress, 3);
    const currentPos = startTop + distance * ease;

    if (isWin) {
      window.scrollTo(0, currentPos);
    } else {
      (target as HTMLElement).scrollTop = currentPos;
    }

    if (progress < 1) {
      activeScrollRafId = requestAnimationFrame(step);
    } else {
      if (isWin) {
        window.scrollTo(0, clampedTarget);
      } else {
        (target as HTMLElement).scrollTop = clampedTarget;
      }
      activeScrollRafId = null;
    }
  }

  activeScrollRafId = requestAnimationFrame(step);
}

/**
 * 尋找最近的可捲動容器元素
 */
export function getScrollParent(node: Node | null, containerRoot?: HTMLElement): HTMLElement | null {
  let el = node instanceof HTMLElement ? node : node?.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    try {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 10) {
        return el;
      }
    } catch {
      // 忽略跨域樣式讀取異常
    }
    el = el.parentElement;
  }

  // 若指定了 containerRoot，向上查找滾動容器
  if (containerRoot) {
    let p: HTMLElement | null = containerRoot;
    while (p && p !== document.body && p !== document.documentElement) {
      try {
        const style = window.getComputedStyle(p);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          return p;
        }
      } catch {}
      p = p.parentElement;
    }
  }

  return null;
}

export interface ViewportMetrics {
  scrollParent: HTMLElement | null;
  scrollTarget: HTMLElement | Window | null;
  viewHeight: number;
  parentTop: number;
  currentScroll: number;
}

/**
 * 取得當前節點所在之視口環境度量（自適應瀏覽器縮放與 visualViewport）
 */
export function getViewportMetrics(node: Node | null, containerRoot?: HTMLElement): ViewportMetrics {
  const scrollParent = getScrollParent(node, containerRoot);
  const viewHeight = scrollParent
    ? scrollParent.clientHeight
    : (window.visualViewport?.height ?? window.innerHeight);
  const parentTop = scrollParent
    ? scrollParent.getBoundingClientRect().top
    : (window.visualViewport?.offsetTop ?? 0);
  const currentScroll = scrollParent
    ? scrollParent.scrollTop
    : (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);
  const scrollTarget = scrollParent || (containerRoot ? null : window);

  return {
    scrollParent,
    scrollTarget,
    viewHeight,
    parentTop,
    currentScroll
  };
}
