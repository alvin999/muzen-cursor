import * as pdfjsLib from 'pdfjs-dist';
import { initCursorHost } from '../content/hostElement';
import { CursorController } from '../core/cursorController';

// 設定 PDF.js Worker
const workerUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
  ? chrome.runtime.getURL('pdf-viewer/pdf.worker.min.mjs')
  : './pdf.worker.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface ViewerState {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  totalPages: number;
  scale: number;
  fileName: string;
}

const state: ViewerState = {
  pdfDoc: null,
  currentPage: 1,
  totalPages: 0,
  scale: 1.25,
  fileName: ''
};

let cursorControllerInitialized = false;

// DOM 元素快取
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const dropCard = dropZone.querySelector('.drop-card') as HTMLDivElement;
const viewerContainer = document.getElementById('viewer-container') as HTMLDivElement;
const docTitle = document.getElementById('doc-title') as HTMLSpanElement;
const pageNumInput = document.getElementById('page-num-input') as HTMLInputElement;
const pageCountSpan = document.getElementById('page-count') as HTMLSpanElement;
const zoomLevelSpan = document.getElementById('zoom-level') as HTMLSpanElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

const btnPrev = document.getElementById('btn-prev-page') as HTMLButtonElement;
const btnNext = document.getElementById('btn-next-page') as HTMLButtonElement;
const btnZoomIn = document.getElementById('btn-zoom-in') as HTMLButtonElement;
const btnZoomOut = document.getElementById('btn-zoom-out') as HTMLButtonElement;
const btnZoomFit = document.getElementById('btn-zoom-fit') as HTMLButtonElement;

/**
 * 初始化檢視器事件與參數
 */
function init(): void {
  setupEventListeners();

  // 檢查 URL Query 是否帶有 file 參數
  const params = new URLSearchParams(window.location.search);
  const fileParam = params.get('file');
  if (fileParam) {
    loadPdfFromUrl(fileParam);
  }
}

/**
 * 綁定互動事件
 */
function setupEventListeners(): void {
  // 檔案選擇
  fileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) loadPdfFromFile(file);
  });

  // 拖放檔案
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropCard.classList.add('drag-over');
  });

  window.addEventListener('dragleave', (e) => {
    if (e.target === dropZone || !dropZone.contains(e.target as Node)) {
      dropCard.classList.remove('drag-over');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropCard.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type === 'application/pdf') {
      loadPdfFromFile(file);
    }
  });

  // 頁碼導航
  btnPrev.addEventListener('click', () => jumpToPage(state.currentPage - 1));
  btnNext.addEventListener('click', () => jumpToPage(state.currentPage + 1));
  pageNumInput.addEventListener('change', () => {
    const target = parseInt(pageNumInput.value, 10);
    if (!isNaN(target)) jumpToPage(target);
  });

  // 縮放控制
  btnZoomIn.addEventListener('click', () => changeScale(state.scale + 0.15));
  btnZoomOut.addEventListener('click', () => changeScale(Math.max(0.5, state.scale - 0.15)));
  btnZoomFit.addEventListener('click', fitToWidth);

  // 監聽主滾動容器以自動更新當前頁碼
  const mainContent = document.getElementById('main-content');
  mainContent?.addEventListener('scroll', handleScrollDebounced);
}

/**
 * 從本機 File 載入 PDF
 */
function loadPdfFromFile(file: File): void {
  state.fileName = file.name;
  docTitle.textContent = file.name;

  const reader = new FileReader();
  reader.onload = async () => {
    const arrayBuffer = reader.result as ArrayBuffer;
    await renderPdfDocument({ data: arrayBuffer });
  };
  reader.readAsArrayBuffer(file);
}

/**
 * 從線上 URL 載入 PDF
 */
async function loadPdfFromUrl(url: string): Promise<void> {
  try {
    const name = url.split('/').pop() || 'document.pdf';
    state.fileName = decodeURIComponent(name.split('?')[0]);
    docTitle.textContent = state.fileName;
    await renderPdfDocument({ url });
  } catch (err) {
    console.error('[Muzen PDF] 載入線上 PDF 失敗:', err);
    alert('無法載入指定的 PDF 檔案，可能受到跨來源 (CORS) 限制。');
  }
}

/**
 * 核心渲染管線：解析 PDF 並逐頁連續渲染
 */
async function renderPdfDocument(src: { data?: ArrayBuffer; url?: string }): Promise<void> {
  try {
    const loadingTask = pdfjsLib.getDocument(src);
    state.pdfDoc = await loadingTask.promise;
    state.totalPages = state.pdfDoc.numPages;
    state.currentPage = 1;

    // 更新介面狀態
    dropZone.style.display = 'none';
    viewerContainer.style.display = 'flex';
    pageCountSpan.textContent = state.totalPages.toString();
    pageNumInput.max = state.totalPages.toString();
    pageNumInput.value = '1';
    updateZoomDisplay();

    // 清空舊頁面並渲染新文件
    viewerContainer.innerHTML = '';

    for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
      await renderPage(pageNum);
    }

    // 啟動 Muzen Cursor 核心控制器
    if (!cursorControllerInitialized) {
      initCursorHost();
      const controller = new CursorController();
      controller.init();
      cursorControllerInitialized = true;
      console.log('[Muzen PDF] Muzen Cursor 閱讀游標已成功在 PDF 檢視器上啟動。');
    }
  } catch (err) {
    console.error('[Muzen PDF] 解析或渲染 PDF 失敗:', err);
    alert('無法解析該 PDF 檔案。');
  }
}

/**
 * 渲染單一頁面（包含 Canvas 底圖與 TextLayer 文字層）
 */
async function renderPage(pageNum: number): Promise<void> {
  if (!state.pdfDoc) return;

  const page = await state.pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: state.scale });

  // 1. 頁面外層包裹容器
  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'pdf-page-wrapper';
  pageWrapper.id = `pdf-page-${pageNum}`;
  pageWrapper.dataset.pageNumber = pageNum.toString();
  pageWrapper.style.width = `${viewport.width}px`;
  pageWrapper.style.height = `${viewport.height}px`;
  pageWrapper.style.flexShrink = '0';

  // 2. 底層 Canvas (像素渲染)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  pageWrapper.appendChild(canvas);

  // 3. 表層 TextLayer (透明文字層，支援 Range 度量與文字選取)
  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'textLayer';
  textLayerDiv.style.width = `${viewport.width}px`;
  textLayerDiv.style.height = `${viewport.height}px`;
  pageWrapper.appendChild(textLayerDiv);

  viewerContainer.appendChild(pageWrapper);

  // 執行 Canvas 繪製
  if (ctx) {
    await page.render({
      canvas: canvas,
      canvasContext: ctx,
      viewport: viewport
    } as Parameters<typeof page.render>[0]).promise;
  }

  // 執行 TextLayer 構建
  try {
    const textContent = await page.getTextContent();
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport: viewport
    });
    await textLayer.render();
  } catch (err) {
    console.warn(`[Muzen PDF] Page ${pageNum} textLayer render error:`, err);
  }
}

/**
 * 縮放比例變更
 */
async function changeScale(newScale: number): Promise<void> {
  if (!state.pdfDoc || Math.abs(state.scale - newScale) < 0.01) return;
  state.scale = Math.round(newScale * 100) / 100;
  updateZoomDisplay();

  // 重新渲染全部頁面
  viewerContainer.innerHTML = '';
  for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
    await renderPage(pageNum);
  }

  // 保持跳轉至當前頁面
  jumpToPage(state.currentPage, false);
}

/**
 * 寬度自適應
 */
async function fitToWidth(): Promise<void> {
  if (!state.pdfDoc) return;
  const firstPage = await state.pdfDoc.getPage(1);
  const unscaledViewport = firstPage.getViewport({ scale: 1 });
  const containerWidth = viewerContainer.clientWidth - 60; // 扣除 padding
  if (containerWidth > 200 && unscaledViewport.width > 0) {
    await changeScale(containerWidth / unscaledViewport.width);
  }
}

function updateZoomDisplay(): void {
  zoomLevelSpan.textContent = `${Math.round(state.scale * 100)}%`;
}

/**
 * 跳轉至指定頁碼
 */
function jumpToPage(pageNum: number, smooth: boolean = true): void {
  if (pageNum < 1 || pageNum > state.totalPages) return;
  state.currentPage = pageNum;
  pageNumInput.value = pageNum.toString();

  const targetEl = document.getElementById(`pdf-page-${pageNum}`);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }
}

let scrollTimer: number | null = null;
function handleScrollDebounced(): void {
  if (scrollTimer) cancelAnimationFrame(scrollTimer);
  scrollTimer = requestAnimationFrame(() => {
    updateCurrentPageFromScroll();
  });
}

/**
 * 依據滾動位置偵測目前主要可見頁面
 */
function updateCurrentPageFromScroll(): void {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const pages = viewerContainer.querySelectorAll<HTMLElement>('.pdf-page-wrapper');
  const containerTop = mainContent.scrollTop;
  const containerHeight = mainContent.clientHeight;
  const middleY = containerTop + containerHeight / 3;

  for (const page of Array.from(pages)) {
    const pageTop = page.offsetTop;
    const pageBottom = pageTop + page.offsetHeight;
    if (middleY >= pageTop && middleY <= pageBottom) {
      const pageNum = parseInt(page.dataset.pageNumber || '1', 10);
      if (pageNum !== state.currentPage) {
        state.currentPage = pageNum;
        pageNumInput.value = pageNum.toString();
      }
      break;
    }
  }
}

// 頁面載入完成即執行初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
