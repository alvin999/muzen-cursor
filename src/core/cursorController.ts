import { cursorStore, MotionDirection, CursorRect } from './cursorStore';
import { LOCALES } from '../i18n/locales';
import { detectReadingScope } from '../utils/domUtils';
import { TextTarget } from './wordNavigator';
import { isSmoothScrolling } from '../utils/smoothScroller';
import { computeWaypointsBetween } from './navigation/spatialNavigator';
import { VisualSelectionManager } from './navigation/selectionManager';
import { logger } from '../utils/logger';
import { CursorControllerOptions, CursorHostContext, NavDirection } from './controller/types';
import { RearviewManager } from './controller/rearviewManager';
import {
  ReadingStatsCache,
  computeReadingProgress,
  computeMotionDirection,
  measureTargetRect
} from './controller/cursorGeometry';
import { PointerInteractionManager } from './controller/pointerInteraction';
import { FlashModeController } from './controller/flashModeController';
import { ScrollFollower } from './controller/scrollFollower';
import { JumpHistoryManager } from './controller/jumpHistoryManager';
import { MediaController } from './controller/mediaController';
import { MotionEngine } from './controller/motionEngine';
import { KeybindingRouter } from './controller/keybindingRouter';

export type { CursorControllerOptions, JumpPoint } from './controller/types';

/**
 * Vim 核心游標控制器 (Facade / Orchestrator)
 * 負責組裝各子控制器、管理 DOM 事件監聽生命週期與游標座標狀態同步
 */
export class CursorController {
  private options?: CursorControllerOptions;
  private currentTarget: TextTarget | null = null;
  private previousTarget: TextTarget | null = null;
  private preferredX: number | null = null;
  private activeScopeElement: HTMLElement | null = null;
  private moveTimer: ReturnType<typeof setTimeout> | null = null;
  private isRecoveringTarget = false;

  private readonly readingStats = new ReadingStatsCache();
  private readonly selectionManager = new VisualSelectionManager();
  private readonly rearviewManager = new RearviewManager();
  private readonly pointerInteraction: PointerInteractionManager;
  private readonly flashModeController: FlashModeController;
  private readonly scrollFollower: ScrollFollower;
  private readonly jumpHistoryManager: JumpHistoryManager;
  private readonly mediaController: MediaController;
  private readonly motionEngine: MotionEngine;
  private readonly keybindingRouter: KeybindingRouter;

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private scrollHandler: (() => void) | null = null;

  constructor(options?: CursorControllerOptions) {
    this.options = options;
    const hostContext: CursorHostContext = {
      getOptions: () => this.options,
      getRootElement: () => this.rootElement,
      getEffectiveRoot: () => this.getEffectiveRoot(),
      getCurrentTarget: () => this.currentTarget,
      setCurrentTarget: (target) => {
        this.currentTarget = target;
      },
      ensureValidTarget: () => this.ensureValidTarget(),
      updateActiveScope: (node) => this.updateActiveScope(node),
      getPreferredX: () => this.preferredX,
      setPreferredX: (x) => {
        this.preferredX = x;
      },
      clearPreferredX: () => {
        this.preferredX = null;
      },
      getMediaElement: () => this.mediaController.element,
      clearMediaTarget: () => this.mediaController.clear(),
      enterMediaTarget: (mediaEl, navDirection, isRepeat, pendingTarget) =>
        this.mediaController.enter(mediaEl, navDirection, isRepeat, pendingTarget),
      triggerRearviewNotice: (direction) => this.triggerRearviewNotice(direction),
      scheduleMoveSettle: () => this.scheduleMoveSettle(),
      pushJumpPoint: (point) => this.jumpHistoryManager.push(point),
      closeJumpMenu: () => this.closeJumpMenu(),
      closeFlashMode: () => this.closeFlashMode(),
      clearSelectionAnchor: () => this.selectionManager.clearAnchor(),
      findInitialTarget: (direction) => this.findInitialTarget(direction),
      updateCursorPosition: (scrollIntoView, waypoints, isScrollUpdate, forceVisible, navDirection, isRepeat) =>
        this.updateCursorPosition(scrollIntoView, waypoints, isScrollUpdate, forceVisible, navDirection, isRepeat)
    };

    this.pointerInteraction = new PointerInteractionManager(hostContext);
    this.flashModeController = new FlashModeController(hostContext);
    this.scrollFollower = new ScrollFollower(hostContext);
    this.jumpHistoryManager = new JumpHistoryManager(hostContext);
    this.mediaController = new MediaController(hostContext);
    this.motionEngine = new MotionEngine(hostContext, this.mediaController);
    this.keybindingRouter = new KeybindingRouter(
      hostContext,
      this.motionEngine,
      this.flashModeController,
      this.jumpHistoryManager,
      this.mediaController,
      this.pointerInteraction,
      this.scrollFollower,
      {
        toggle: () => this.toggle(),
        toggleVisualMode: () => this.toggleVisualMode(),
        toggleVisualLineMode: () => this.toggleVisualLineMode(),
        exitVisualMode: () => this.exitVisualMode(),
        yankSelection: () => this.yankSelection()
      }
    );
  }

  private get rootElement(): HTMLElement {
    return this.options?.containerRoot || document.body;
  }

  /**
   * 取得當前導航的作用域根節點
   * 若已鎖定閱讀區塊且該區塊仍在 DOM 中，優先作為邊界；否則回退至全域 rootElement
   */
  private getEffectiveRoot(): HTMLElement {
    if (this.activeScopeElement && this.activeScopeElement.isConnected) {
      return this.activeScopeElement;
    }
    return this.rootElement;
  }

  private updateActiveScope(targetNode?: Node | null): void {
    if (this.options?.containerRoot) {
      this.activeScopeElement = this.options.containerRoot;
      return;
    }
    const node = targetNode || this.currentTarget?.node;
    const parentEl = node ? (node instanceof Element ? (node as HTMLElement) : node.parentElement) : null;
    if (parentEl) {
      this.activeScopeElement = detectReadingScope(parentEl, this.rootElement);
    }
  }

  private ensureValidTarget(): boolean {
    if (this.currentTarget && this.currentTarget.node.isConnected) {
      return true;
    }
    if (this.isRecoveringTarget) return false;
    this.isRecoveringTarget = true;
    try {
      this.findInitialTarget();
    } finally {
      this.isRecoveringTarget = false;
    }
    return Boolean(this.currentTarget && this.currentTarget.node.isConnected);
  }

  private scheduleMoveSettle(): void {
    // 移動避震機制：位移時保持常亮不閃爍，靜止一段時間後平滑恢復閃爍/呼吸
    const settleDelay = cursorStore.getState().advanced?.moveSettleDelayMs ?? 400;
    if (this.moveTimer) clearTimeout(this.moveTimer);
    this.moveTimer = setTimeout(() => {
      cursorStore.setState({ isMoving: false, motionDirection: 'none' });
    }, settleDelay);
  }

  private triggerRearviewNotice(direction: NavDirection): void {
    this.rearviewManager.triggerNotice(this.currentTarget, direction, this.readingStats.headingTitle);
  }

  public init(): void {
    this.keydownHandler = (e: KeyboardEvent) => this.keybindingRouter.handleKeyDown(e);
    this.keyupHandler = (_e: KeyboardEvent) => {
      // 釋放按鍵時，由 VimCursorOverlay 之 RAF 散熱冷卻引擎平滑衰減
    };
    this.clickHandler = (e: MouseEvent) => this.pointerInteraction.handleClick(e);

    // 視窗縮放與滾動時保持游標位置緊密貼合
    let ticking = false;
    const requestScrollUpdate = () => {
      if (cursorStore.getState().isFlashMode) {
        this.closeFlashMode();
      }
      // 純滾動時保持 preferredX 鎖定，絕不清除水平記憶欄，避免換行與抖動
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (this.currentTarget && cursorStore.getState().enabled && !cursorStore.getState().isExcluded) {
            this.updateCursorPosition(false, undefined, true);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    const requestResizeUpdate = () => {
      // 僅在視窗寬高尺寸真正改變時，才重設水平記憶欄
      this.preferredX = null;
      requestScrollUpdate();
    };

    this.resizeHandler = requestResizeUpdate;
    this.scrollHandler = requestScrollUpdate;

    window.addEventListener('keydown', this.keydownHandler, true);
    window.addEventListener('keyup', this.keyupHandler, true);
    window.addEventListener('click', this.clickHandler, true);
    window.addEventListener('resize', this.resizeHandler, { passive: true });
    window.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.resizeHandler, { passive: true });
      window.visualViewport.addEventListener('scroll', this.scrollHandler, { passive: true });
    }
  }

  public destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    if (this.keyupHandler) {
      window.removeEventListener('keyup', this.keyupHandler, true);
      this.keyupHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
    if (window.visualViewport) {
      if (this.resizeHandler) {
        window.visualViewport.removeEventListener('resize', this.resizeHandler);
      }
      if (this.scrollHandler) {
        window.visualViewport.removeEventListener('scroll', this.scrollHandler);
      }
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, { capture: true } as EventListenerOptions);
      this.scrollHandler = null;
    }
    if (this.moveTimer) {
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }
    this.keybindingRouter.destroy();
    this.jumpHistoryManager.destroy();
    this.scrollFollower.destroy();
    this.rearviewManager.destroy();
    this.closeFlashMode();
  }

  /**
   * 切換游標啟用 / 深層休眠狀態 (供 Alt + V 全域快捷鍵、內部熱鍵或 Popup 通訊調用)
   */
  public toggle(forceEnabled?: boolean): boolean {
    const state = cursorStore.getState();
    const nextEnabled = typeof forceEnabled === 'boolean' ? forceEnabled : !state.enabled;
    const dict = LOCALES[state.locale || 'zh-TW'] || LOCALES['zh-TW'];

    if (nextEnabled) {
      cursorStore.setState({ enabled: true, visible: true });
      cursorStore.showStatusNotice(dict.noticeWakeUp, 1500);
      if (!this.currentTarget || !document.contains(this.currentTarget.node)) {
        this.findInitialTarget();
      } else {
        this.updateCursorPosition(true);
      }
    } else {
      this.closeJumpMenu();
      cursorStore.setState({ enabled: false, visible: false });
      cursorStore.showStatusNotice(dict.noticeDeepSleep, 1800);
    }

    return nextEnabled;
  }

  public getHoveredAnchor(target: TextTarget | null): HTMLAnchorElement | null {
    return this.pointerInteraction.getHoveredAnchor(target);
  }

  public getHoveredInteractiveElement(target: TextTarget | null): HTMLElement | null {
    return this.pointerInteraction.getHoveredInteractiveElement(target);
  }

  public openCurrentLink(inNewTab: boolean = false): boolean {
    return this.pointerInteraction.openCurrentLink(this.currentTarget, inNewTab);
  }

  public moveHorizontal(delta: number): void {
    this.motionEngine.moveHorizontal(delta);
  }

  public moveVertical(deltaRows: number, isRepeat: boolean = false): void {
    this.motionEngine.moveVertical(deltaRows, isRepeat);
  }

  public moveWordForward(): void {
    this.motionEngine.moveWordForward();
  }

  public moveWordBackward(): void {
    this.motionEngine.moveWordBackward();
  }

  public moveWordEnd(): void {
    this.motionEngine.moveWordEnd();
  }

  public jumpToLineBoundary(isStart: boolean): void {
    this.motionEngine.jumpToLineBoundary(isStart);
  }

  public jumpBack(exact: boolean = false): void {
    this.jumpHistoryManager.jumpBack(exact);
  }

  public openJumpMenu(exact: boolean = false): void {
    this.jumpHistoryManager.openMenu(exact);
  }

  public closeJumpMenu(): void {
    this.jumpHistoryManager.closeMenu();
  }

  public jumpToMenuItem(index: number): void {
    this.jumpHistoryManager.jumpToMenuItem(index);
  }

  public openFlashMode(mode: 'hint' | 'search' = 'hint'): void {
    this.flashModeController.open(mode);
  }

  public closeFlashMode(): void {
    this.flashModeController.close();
  }

  public jumpToDocumentStart(): void {
    this.motionEngine.jumpToDocumentStart();
  }

  public jumpToDocumentEnd(): void {
    this.motionEngine.jumpToDocumentEnd();
  }

  public moveHalfPage(isDownward: boolean, isRepeat: boolean = false): void {
    this.motionEngine.moveHalfPage(isDownward, isRepeat);
  }

  public rebindToContainer(container?: HTMLElement | null): boolean {
    return this.motionEngine.rebindToContainer(container);
  }

  public findInitialTarget(direction?: NavDirection): void {
    this.motionEngine.findInitialTarget(direction);
  }

  public getCurrentTarget(): TextTarget | null {
    return this.currentTarget;
  }

  /**
   * 切換 Visual (字元) 模式
   */
  public toggleVisualMode(): void {
    const currentMode = cursorStore.getState().mode;
    if (currentMode === 'NORMAL') {
      if (!this.currentTarget) {
        this.findInitialTarget();
      }
      if (this.currentTarget) {
        this.selectionManager.setAnchor({ ...this.currentTarget });
        cursorStore.setState({ mode: 'VISUAL' });
        this.selectionManager.syncNativeSelection(this.currentTarget);
      }
    } else if (currentMode === 'VISUAL_LINE') {
      // 從整行選取切換為字元選取 (對齊 Vim 行為：保留 Anchor)
      cursorStore.setState({ mode: 'VISUAL' });
      this.selectionManager.syncNativeSelection(this.currentTarget);
    } else {
      this.exitVisualMode();
    }
  }

  /**
   * 切換 Visual Line (整行) 模式 (Shift + V)
   */
  public toggleVisualLineMode(): void {
    const currentMode = cursorStore.getState().mode;
    if (currentMode === 'NORMAL') {
      if (!this.currentTarget) {
        this.findInitialTarget();
      }
      if (this.currentTarget) {
        this.selectionManager.setAnchor({ ...this.currentTarget });
        cursorStore.setState({ mode: 'VISUAL_LINE' });
        this.selectionManager.syncVisualLineSelection(this.currentTarget, this.getEffectiveRoot());
      }
    } else if (currentMode === 'VISUAL') {
      // 從字元選取切換為整行選取 (對齊 Vim 行為：保留 Anchor 並展開整行)
      cursorStore.setState({ mode: 'VISUAL_LINE' });
      this.selectionManager.syncVisualLineSelection(this.currentTarget, this.getEffectiveRoot());
    } else {
      this.exitVisualMode();
    }
  }

  public exitVisualMode(): void {
    this.selectionManager.exitVisualMode();
  }

  /**
   * Yank (複製) 當前選取內容
   */
  public async yankSelection(): Promise<void> {
    await this.selectionManager.yankSelection();
  }

  /**
   * 計算螢幕座標並同步游標、選取與視窗跟隨
   */
  private updateCursorPosition(
    scrollIntoView: boolean = false,
    waypoints?: CursorRect[],
    isScrollUpdate: boolean = false,
    forceVisible: boolean = false,
    navDirection?: NavDirection,
    isRepeat: boolean = false
  ): void {
    if (this.mediaController.syncCursorPosition(isScrollUpdate, forceVisible)) {
      return;
    }

    if (!this.ensureValidTarget() || !this.currentTarget) return;

    const { node } = this.currentTarget;

    try {
      const { rect, safeOffset } = measureTargetRect(this.currentTarget, this.getEffectiveRoot());
      const { viewportH, progress } = computeReadingProgress();
      const stats = this.readingStats.refreshIfNeeded(
        node,
        this.previousTarget?.node,
        this.getEffectiveRoot(),
        progress,
        isRepeat
      );

      // 容許適度邊界緩衝，避免邊界滾動時游標閃現閃退；若座標暫未就緒，安全維持當前可見狀態
      const hasValidCoords = typeof rect.top === 'number' && typeof rect.bottom === 'number' && !isNaN(rect.top) && !isNaN(rect.bottom);
      const isVisibleInViewport = forceVisible || (hasValidCoords
        ? (rect.bottom >= -80 && rect.top <= viewportH + 80)
        : (cursorStore.getState().visible ?? true));

      const isMoving = cursorStore.getState().isMoving ?? false;

      // 視窗純捲動/縮放更新：僅靜默貼齊游標位置，嚴格抑制殘影與運動序列遞增
      if (isScrollUpdate) {
        // 若游標正處於平滑運動 (isMoving)、滾動中 (isSmoothScrolling) 或目標在視野內，滾動途中嚴格保持可見
        const isScrolling = isSmoothScrolling();
        const shouldKeepVisible = isMoving || isVisibleInViewport || isScrolling;
        const nextMoving = isScrolling ? true : (isVisibleInViewport ? false : isMoving);

        cursorStore.setState({
          visible: shouldKeepVisible,
          isMoving: nextMoving,
          motionDirection: nextMoving ? cursorStore.getState().motionDirection : 'none',
          isScrollUpdate: true,
          isMediaTarget: false,
          mediaInfo: null,
          rect: {
            x: rect.left,
            y: rect.top,
            width: rect.width > 0 ? rect.width : 8,
            height: rect.height > 0 ? rect.height : 16
          },
          readingProgress: progress,
          charOffset: safeOffset,
          currentSectionTitle: stats.headingTitle,
          estimatedMinutesLeft: stats.readingMinutes
        });
        this.previousTarget = { ...this.currentTarget };
        return;
      }

      const prevState = cursorStore.getState();
      const motionDir: MotionDirection = computeMotionDirection(rect, prevState.rect, prevState.visible);

      // 若未直接傳入 waypoints，但與前次目標跨越視覺行，自動補齊中間經過行
      let finalWaypoints = waypoints;
      if (!finalWaypoints && this.previousTarget && this.currentTarget) {
        finalWaypoints = computeWaypointsBetween(
          this.previousTarget,
          this.currentTarget,
          this.preferredX ?? rect.left,
          this.rootElement
        );
      }

      this.scheduleMoveSettle();

      // 當游標移動停頓時，預先在背景非同步更新當前視窗快照 (以備翻頁回溯 0ms 呈現)
      this.rearviewManager.requestBackgroundSnapshot();

      cursorStore.setState({
        visible: forceVisible || isVisibleInViewport,
        isMoving: true,
        motionDirection: motionDir,
        motionSequence: (prevState.motionSequence || 0) + 1,
        chargeLevel: this.keybindingRouter.chargeLevel,
        isScrollUpdate: false,
        isMediaTarget: false,
        mediaInfo: null,
        hoveredLinkUrl: this.getHoveredAnchor(this.currentTarget)?.href || null,
        rect: {
          x: rect.left,
          y: rect.top,
          width: rect.width > 0 ? rect.width : 8,
          height: rect.height > 0 ? rect.height : 16
        },
        trailWaypoints: finalWaypoints && finalWaypoints.length > 0 ? finalWaypoints : undefined,
        readingProgress: progress,
        charOffset: safeOffset,
        currentSectionTitle: stats.headingTitle,
        estimatedMinutesLeft: stats.readingMinutes
      });

      this.previousTarget = { ...this.currentTarget };

      // Visual 與 Visual Line 模式下即時更新原生選取
      const currentMode = cursorStore.getState().mode;
      if (currentMode === 'VISUAL') {
        this.selectionManager.syncNativeSelection(this.currentTarget);
      } else if (currentMode === 'VISUAL_LINE') {
        this.selectionManager.syncVisualLineSelection(this.currentTarget, this.getEffectiveRoot());
      }

      if (scrollIntoView) {
        this.scrollFollower.followCursorInViewport(node, rect, navDirection, isRepeat);
      }

      if (!isScrollUpdate) {
        this.scrollFollower.scheduleDebounceRealignment();
      }
    } catch (err) {
      logger.warn('updateCursorPosition error:', err);
    }
  }
}
