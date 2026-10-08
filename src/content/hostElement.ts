import { VimCursorOverlay } from '../components/VimCursorOverlay';
import { VimStatusBar } from '../components/VimStatusBar';
import { VimJumpMenu } from '../components/VimJumpMenu';

/**
 * 宿主網頁注入容器 (使用原生 div + Shadow DOM，不依賴 customElements)
 */
export class MuzenCursorHost {
  public static readonly HOST_ID = 'muzen-cursor-host-root';
  private hostElement: HTMLElement;
  private shadow: ShadowRoot;
  private overlay: VimCursorOverlay;
  private statusBar: VimStatusBar;
  private jumpMenu: VimJumpMenu;

  constructor() {
    this.hostElement = document.createElement('div');
    this.hostElement.id = MuzenCursorHost.HOST_ID;

    // 容器樣式：固定於視窗且不干擾使用者滑鼠事件
    this.hostElement.style.position = 'fixed';
    this.hostElement.style.top = '0';
    this.hostElement.style.left = '0';
    this.hostElement.style.width = '0';
    this.hostElement.style.height = '0';
    this.hostElement.style.pointerEvents = 'none';
    this.hostElement.style.zIndex = '2147483647';

    // 建立 Shadow DOM 隔離外部網頁 CSS
    this.shadow = this.hostElement.attachShadow({ mode: 'open' });

    // 初始化內部游標、狀態列與跳轉選單 UI
    this.overlay = new VimCursorOverlay();
    this.statusBar = new VimStatusBar();
    this.jumpMenu = new VimJumpMenu();

    this.shadow.appendChild(this.overlay.getStyleSheet());
    this.shadow.appendChild(this.overlay.getElement());
    this.shadow.appendChild(this.statusBar.getElement());
    this.shadow.appendChild(this.jumpMenu.getElement());
  }

  public getHostElement(): HTMLElement {
    return this.hostElement;
  }

  public destroy(): void {
    this.overlay.destroy();
    this.statusBar.destroy();
    this.jumpMenu.destroy();
    this.hostElement.remove();
  }
}

/**
 * 初始化並掛載 Muzen Cursor 至當前網頁 DOM 樹中
 */
export function initCursorHost(): MuzenCursorHost {
  const existingEl = document.getElementById(MuzenCursorHost.HOST_ID);
  if (existingEl && (existingEl as unknown as { __muzen_host_instance__?: MuzenCursorHost }).__muzen_host_instance__) {
    return (existingEl as unknown as { __muzen_host_instance__: MuzenCursorHost }).__muzen_host_instance__;
  }

  // 若存在舊的 host 節點先清理
  if (existingEl) {
    existingEl.remove();
  }

  const hostInstance = new MuzenCursorHost();
  const hostEl = hostInstance.getHostElement();
  (hostEl as unknown as { __muzen_host_instance__: MuzenCursorHost }).__muzen_host_instance__ = hostInstance;

  // 掛載至 documentElement 或 body
  const mountTarget = document.body || document.documentElement;
  if (mountTarget) {
    mountTarget.appendChild(hostEl);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      (document.body || document.documentElement).appendChild(hostEl);
    });
  }

  return hostInstance;
}
