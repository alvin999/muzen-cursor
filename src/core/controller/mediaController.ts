import { cursorStore, MediaTargetInfo } from '../cursorStore';
import { TextTarget } from '../wordNavigator';
import { getCharRectOfTarget, findNextMediaAfter } from '../navigation/spatialNavigator';
import { isOutOfNormalFlowWidget } from '../../utils/domUtils';
import { isSmoothScrolling, getViewportMetrics } from '../../utils/smoothScroller';
import { LightboxCommand } from '../../components/VimImageLightbox';
import { CursorHostContext, NavDirection } from './types';
import { computeReadingProgress } from './cursorGeometry';
import { scrollByDelta } from './scrollFollower';

/**
 * 媒體元素（圖片/大圖）停駐、分段捲動與燈箱檢視子控制器
 */
export class MediaController {
  private currentMediaElement: Element | null = null;
  private mediaEntryDirection: NavDirection | null = null;
  private pendingTargetAfterMedia: TextTarget | null = null;

  constructor(private readonly host: CursorHostContext) {}

  public get element(): Element | null {
    return this.currentMediaElement;
  }

  public get entryDirection(): NavDirection | null {
    return this.mediaEntryDirection;
  }

  public get pendingTarget(): TextTarget | null {
    return this.pendingTargetAfterMedia;
  }

  public isActive(): boolean {
    return Boolean(this.currentMediaElement);
  }

  public clear(): void {
    this.currentMediaElement = null;
    this.mediaEntryDirection = null;
    this.pendingTargetAfterMedia = null;
  }

  public enter(
    mediaEl: Element,
    navDirection?: NavDirection,
    isRepeat: boolean = false,
    pendingTarget?: TextTarget | null
  ): void {
    this.currentMediaElement = mediaEl;
    this.mediaEntryDirection = navDirection || null;
    this.pendingTargetAfterMedia = pendingTarget || null;
    this.scrollMediaIntoView(mediaEl, navDirection, isRepeat);
    this.host.updateCursorPosition(false, undefined, false, true, navDirection, isRepeat);
  }

  /**
   * 同步當前停駐媒體元素的外框座標至游標 Store；若元素已脫離 DOM 則自動清除並回傳 false
   */
  public syncCursorPosition(isScrollUpdate: boolean, forceVisible: boolean): boolean {
    if (!this.currentMediaElement) return false;
    if (!this.currentMediaElement.isConnected) {
      this.clear();
      return false;
    }

    const mediaEl = this.currentMediaElement;
    const mediaRect = mediaEl.getBoundingClientRect();
    const { viewportH, progress } = computeReadingProgress();
    const isVisibleInViewport = forceVisible || (mediaRect.bottom >= -80 && mediaRect.top <= viewportH + 80);

    const tag = mediaEl.tagName.toUpperCase();
    const mediaInfo: MediaTargetInfo = {
      tagName: tag,
      width: Math.round(mediaRect.width),
      height: Math.round(mediaRect.height)
    };
    if (tag === 'IMG') {
      const img = mediaEl as HTMLImageElement;
      mediaInfo.naturalWidth = img.naturalWidth;
      mediaInfo.naturalHeight = img.naturalHeight;
      mediaInfo.alt = img.alt || '';
      mediaInfo.src = img.currentSrc || img.src || '';
    }

    const prevState = cursorStore.getState();
    if (!isScrollUpdate) {
      this.host.scheduleMoveSettle();
    }

    cursorStore.setState({
      visible: isVisibleInViewport,
      isMoving: isScrollUpdate ? isSmoothScrolling() : true,
      motionDirection: isScrollUpdate ? 'none' : 'jump',
      motionSequence: isScrollUpdate ? prevState.motionSequence : (prevState.motionSequence || 0) + 1,
      isScrollUpdate,
      isMediaTarget: true,
      mediaInfo,
      hoveredLinkUrl: null,
      localDynamicPalette: null,
      rect: {
        x: mediaRect.left,
        y: mediaRect.top,
        width: Math.max(8, mediaRect.width),
        height: Math.max(8, mediaRect.height)
      },
      trailWaypoints: undefined,
      readingProgress: progress
    });
    return true;
  }

  /**
   * 處理從媒體元素垂直移動 (j / k) 的分段捲動與離開過渡
   * @returns true 表示已由媒體控制器完成處理，呼叫端應直接返回
   */
  public handleVerticalMove(direction: NavDirection, isRepeat: boolean): boolean {
    if (!this.currentMediaElement) return false;

    if (this.handleVerticalStep(direction, false, isRepeat)) {
      return true;
    }

    const prevMedia = this.currentMediaElement;
    const prevEntryDir = this.mediaEntryDirection;
    const pendingTarget = this.pendingTargetAfterMedia;
    const prevRect = prevMedia.getBoundingClientRect();
    this.clear();

    const isDownward = direction === 'down';
    const effRoot = this.host.getEffectiveRoot();
    const allowOut = isOutOfNormalFlowWidget(prevMedia, effRoot);
    const nextMedia = findNextMediaAfter(
      isDownward ? prevRect.bottom : prevRect.top,
      direction,
      effRoot,
      allowOut,
      prevMedia
    );

    if (prevEntryDir === direction && pendingTarget && pendingTarget.node.isConnected) {
      const pendingRect = getCharRectOfTarget(pendingTarget);
      const mediaBetween = nextMedia ? nextMedia.getBoundingClientRect() : null;
      const isMediaBeforePending = mediaBetween && pendingRect
        ? (isDownward ? mediaBetween.top < pendingRect.y - 6 : mediaBetween.bottom > pendingRect.y + 6)
        : false;

      if (isMediaBeforePending && nextMedia) {
        this.enter(nextMedia, direction, isRepeat, pendingTarget);
        return true;
      }
      this.host.setCurrentTarget(pendingTarget);
      this.host.updateActiveScope(pendingTarget.node);
      this.host.updateCursorPosition(true, undefined, false, true, direction, isRepeat);
      return true;
    }

    // 反向按鍵（例如向下進入圖片後立刻按 k 回頭）：回到原本圖片前的文字行
    const currentTarget = this.host.getCurrentTarget();
    if (prevEntryDir && prevEntryDir !== direction && currentTarget && currentTarget.node.isConnected) {
      this.host.updateCursorPosition(true, undefined, false, true, direction, isRepeat);
      return true;
    }

    // 從 f 跳轉進入圖片後首次按 j/k：以圖片鄰近位置作為起點尋找文字或下一張圖片
    if (
      nextMedia &&
      Math.abs(isDownward ? nextMedia.getBoundingClientRect().top - prevRect.bottom : prevRect.top - nextMedia.getBoundingClientRect().bottom) < 40
    ) {
      this.enter(nextMedia, direction, isRepeat);
      return true;
    }

    return false;
  }

  /**
   * 處理半頁跳轉 (d / u) 時在媒體上的推進與離開
   * @returns true 表示仍在媒體內部推進，呼叫端應直接返回
   */
  public handleHalfPageMove(direction: NavDirection, isRepeat: boolean): boolean {
    if (!this.currentMediaElement) return false;

    if (this.handleVerticalStep(direction, true, isRepeat)) {
      return true;
    }

    const prevEntryDir = this.mediaEntryDirection;
    const pendingTarget = this.pendingTargetAfterMedia;
    this.clear();
    if (prevEntryDir === direction && pendingTarget && pendingTarget.node.isConnected) {
      this.host.setCurrentTarget(pendingTarget);
      this.host.updateActiveScope(pendingTarget.node);
    }
    return false;
  }

  private scrollMediaIntoView(mediaEl: Element, navDirection?: NavDirection, isRepeat: boolean = false): void {
    const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(
      mediaEl,
      this.host.getOptions()?.containerRoot
    );
    if (!scrollTarget) return;

    const rect = mediaEl.getBoundingClientRect();
    const adv = cursorStore.getState().advanced;
    const maxPad = Math.floor(viewHeight * 0.28);
    const padTop = Math.min(maxPad, adv?.viewportPaddingTop ?? 120);
    const padBottom = Math.min(maxPad, adv?.viewportPaddingBottom ?? 160);
    const scrollDuration = isRepeat ? 80 : (adv?.scrollDurationMs ?? 360);

    let delta = 0;
    // 1. 若圖片未超過視窗高度，將圖片垂直置中
    if (rect.height <= viewHeight * 0.86) {
      const rectCenterY = (rect.top - parentTop) + rect.height / 2;
      const viewCenterY = viewHeight / 2;
      delta = rectCenterY - viewCenterY;
    } else if (navDirection === 'up') {
      // 2. 若圖片超過視窗高度，對齊起點邊緣以便分段往下/往上瀏覽
      delta = (rect.bottom - parentTop) - (viewHeight - padBottom);
    } else {
      delta = (rect.top - parentTop) - padTop;
    }

    if (Math.abs(delta) > 6) {
      scrollByDelta(scrollTarget, currentScroll, delta, { isRepeat, durationMs: scrollDuration });
    }
  }

  /**
   * 當游標停駐在大圖上並按 j/k/d/u 時，若大圖尚未看完則在圖片內部平滑捲動；
   * 若大圖已到達邊緣，回傳 false 讓控制器自然跨往下一個文字節點。
   */
  private handleVerticalStep(direction: NavDirection, isHalfPage: boolean, isRepeat: boolean): boolean {
    if (!this.currentMediaElement || !this.currentMediaElement.isConnected) {
      this.clear();
      return false;
    }

    const mediaEl = this.currentMediaElement;
    const rect = mediaEl.getBoundingClientRect();
    const { scrollTarget, viewHeight, parentTop, currentScroll } = getViewportMetrics(
      mediaEl,
      this.host.getOptions()?.containerRoot
    );
    if (!scrollTarget) return false;

    const adv = cursorStore.getState().advanced;
    const maxPad = Math.floor(viewHeight * 0.28);
    const padTop = Math.min(maxPad, adv?.viewportPaddingTop ?? 120);
    const padBottom = Math.min(maxPad, adv?.viewportPaddingBottom ?? 160);
    const scrollDuration = isRepeat ? 80 : (adv?.scrollDurationMs ?? 320);

    const stepSize = isHalfPage ? viewHeight * 0.5 : viewHeight * 0.28;

    if (direction === 'down') {
      const remaining = (rect.bottom - parentTop) - (viewHeight - padBottom);
      if (remaining > 10) {
        const delta = Math.min(stepSize, remaining);
        scrollByDelta(scrollTarget, currentScroll, delta, { isRepeat, durationMs: scrollDuration });
        this.host.updateCursorPosition(false, undefined, true, true, 'down', isRepeat);
        return true;
      }
    } else {
      const remaining = padTop - (rect.top - parentTop);
      if (remaining > 10) {
        const delta = Math.min(stepSize, remaining);
        scrollByDelta(scrollTarget, currentScroll, -delta, { isRepeat, durationMs: scrollDuration });
        this.host.updateCursorPosition(false, undefined, true, true, 'up', isRepeat);
        return true;
      }
    }

    return false;
  }

  public openLightbox(): boolean {
    if (!this.currentMediaElement || !this.currentMediaElement.isConnected) return false;
    if (this.currentMediaElement.tagName.toUpperCase() !== 'IMG') return false;

    const img = this.currentMediaElement as HTMLImageElement;
    const src = img.currentSrc || img.src;
    if (!src) return false;

    cursorStore.setState({
      lightboxImage: {
        src,
        alt: img.alt || '',
        naturalWidth: img.naturalWidth || Math.round(img.getBoundingClientRect().width),
        naturalHeight: img.naturalHeight || Math.round(img.getBoundingClientRect().height)
      }
    });
    return true;
  }

  public handleLightboxKey(e: KeyboardEvent): void {
    const key = e.key;
    if (key === 'Escape') {
      this.dispatchLightboxCommand('close');
      return;
    }
    const lower = key.toLowerCase();
    if (lower === 'h' || key === 'ArrowLeft') {
      this.dispatchLightboxCommand('panLeft');
    } else if (lower === 'l' || key === 'ArrowRight') {
      this.dispatchLightboxCommand('panRight');
    } else if (lower === 'k' || key === 'ArrowUp') {
      this.dispatchLightboxCommand('panUp');
    } else if (lower === 'j' || key === 'ArrowDown') {
      this.dispatchLightboxCommand('panDown');
    } else if (lower === 'd' || key === '+' || key === '=') {
      this.dispatchLightboxCommand('zoomIn');
    } else if (lower === 'u' || key === '-') {
      this.dispatchLightboxCommand('zoomOut');
    }
  }

  private dispatchLightboxCommand(command: LightboxCommand): void {
    window.dispatchEvent(new CustomEvent('muzen-lightbox-command', { detail: { command } }));
  }
}
