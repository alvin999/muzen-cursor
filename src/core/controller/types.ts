import { TextTarget } from '../wordNavigator';
import { CursorRect } from '../cursorStore';

export type NavDirection = 'up' | 'down';

export interface CursorControllerOptions {
  containerRoot?: HTMLElement;
  enableScroll?: boolean;
}

export interface JumpPoint {
  node: Node;
  offset: number;
  scrollX: number;
  scrollY: number;
  mediaElement?: Element;
}

/**
 * 供各子控制器存取核心游標狀態與協調動作的受控介面，避免子模組間循環依賴
 */
export interface CursorHostContext {
  getOptions(): CursorControllerOptions | undefined;
  getRootElement(): HTMLElement;
  getEffectiveRoot(): HTMLElement;
  getCurrentTarget(): TextTarget | null;
  setCurrentTarget(target: TextTarget | null): void;
  ensureValidTarget(): boolean;
  updateActiveScope(targetNode?: Node | null): void;
  getPreferredX(): number | null;
  setPreferredX(x: number | null): void;
  clearPreferredX(): void;
  findInitialTarget(direction?: NavDirection): void;
  getMediaElement(): Element | null;
  clearMediaTarget(): void;
  enterMediaTarget(
    mediaEl: Element,
    navDirection?: NavDirection,
    isRepeat?: boolean,
    pendingTarget?: TextTarget | null
  ): void;
  triggerRearviewNotice(direction: NavDirection): void;
  scheduleMoveSettle(): void;
  pushJumpPoint(customPoint?: JumpPoint): void;
  closeJumpMenu(): void;
  closeFlashMode(): void;
  clearSelectionAnchor(): void;
  updateCursorPosition(
    scrollIntoView?: boolean,
    waypoints?: CursorRect[],
    isScrollUpdate?: boolean,
    forceVisible?: boolean,
    navDirection?: NavDirection,
    isRepeat?: boolean
  ): void;
}
