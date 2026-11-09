import { VimCursorOverlay } from '../components/VimCursorOverlay';
import { VimStatusBar } from '../components/VimStatusBar';
import { VimJumpMenu } from '../components/VimJumpMenu';
import { VimRearviewMirror } from '../components/VimRearviewMirror';

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
  private rearviewMirror: VimRearviewMirror;

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

    // 1. 啟用現代原生 Popover API (manual 模式跳脫所有父層 Stacking Context，躍升至瀏覽器真實 Top Layer)
    if (typeof this.hostElement.showPopover === 'function') {
      try {
        this.hostElement.setAttribute('popover', 'manual');
        // 清除瀏覽器對 popover 預設的 margin、padding、邊框與背景色
        this.hostElement.style.margin = '0';
        this.hostElement.style.padding = '0';
        this.hostElement.style.border = 'none';
        this.hostElement.style.background = 'transparent';
        this.hostElement.style.overflow = 'visible';
        this.hostElement.style.outline = 'none';
      } catch { }
    }
    // 2. 舊版瀏覽器相容 Fallback: 保留最大 32-bit zIndex 防遮擋
    this.hostElement.style.zIndex = '2147483647';

    // 建立 Shadow DOM 隔離外部網頁 CSS
    this.shadow = this.hostElement.attachShadow({ mode: 'open' });

    // 初始化內部游標、狀態列、跳轉選單與翻頁後照鏡 UI
    this.overlay = new VimCursorOverlay();
    this.statusBar = new VimStatusBar();
    this.jumpMenu = new VimJumpMenu();
    this.rearviewMirror = new VimRearviewMirror();

    this.shadow.appendChild(this.overlay.getStyleSheet());
    this.shadow.appendChild(this.overlay.getElement());
    this.shadow.appendChild(this.statusBar.getElement());
    this.shadow.appendChild(this.jumpMenu.getElement());
    this.shadow.appendChild(this.rearviewMirror.getElement());
  }

  public getHostElement(): HTMLElement {
    return this.hostElement;
  }

  public destroy(): void {
    if (typeof this.hostElement.hidePopover === 'function') {
      try {
        this.hostElement.hidePopover();
      } catch { }
    }
    this.overlay.destroy();
    this.statusBar.destroy();
    this.jumpMenu.destroy();
    this.rearviewMirror.destroy();
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

  // 掛載至 documentElement 或 body 並喚醒 Top Layer
  const mountAndShow = (target: HTMLElement) => {
    target.appendChild(hostEl);
    // 依據 HTML 規範，popover 必須在掛載至 DOM 樹後才能呼叫 showPopover()
    if (typeof hostEl.showPopover === 'function') {
      try {
        hostEl.showPopover();
      } catch { }
    }
  };

  const mountTarget = document.body || document.documentElement;
  if (mountTarget) {
    mountAndShow(mountTarget);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      mountAndShow(document.body || document.documentElement);
    });
  }

  return hostInstance;
}
