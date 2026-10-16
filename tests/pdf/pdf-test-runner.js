// tests/pdf/pdf-test-runner.js
// 在瀏覽器端運行的 PDF 導航 (u / d) 深度探測腳本

(async function () {
  // 劫持 console.log 轉發至 Node 測試伺服器
  const oldLog = console.log;
  const oldWarn = console.warn;
  const oldErr = console.error;
  function remoteLog(type, args) {
    const text = args.map(a => {
      if (a instanceof Error) return a.message + '\n' + a.stack;
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, text })
    }).catch(() => {});
  }
  console.log = function(...args) { oldLog.apply(console, args); remoteLog('info', args); };
  console.warn = function(...args) { oldWarn.apply(console, args); remoteLog('warn', args); };
  console.error = function(...args) { oldErr.apply(console, args); remoteLog('error', args); };

  console.log('[PdfTest] 測試探測腳本已注入，正在等待 PDF 檢視器與游標就緒...');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const startTime = Date.now();
  let cursorHost = null;
  let cursorOverlay = null;

  // 1. 等待游標 Overlay 出現且 PDF 首頁渲染完成 (最多等待 40 秒)
  const maxWait = 40000;
  while (Date.now() - startTime < maxWait) {
    cursorHost = document.getElementById('muzen-cursor-host-root');
    if (cursorHost && cursorHost.shadowRoot) {
      cursorOverlay = cursorHost.shadowRoot.querySelector('.muzen-cursor-overlay');
      if (cursorOverlay && cursorOverlay.style.display !== 'none') {
        const firstPageText = document.querySelector('#pdf-page-1 .textLayer');
        if (firstPageText && firstPageText.children.length > 0) {
          break;
        }
      }
    }
    await sleep(200);
  }

  const initDurationMs = Date.now() - startTime;
  if (!cursorOverlay) {
    await sendReport({
      error: `逾時 (${maxWait}ms) 未能偵測到 Muzen Cursor 游標就緒！請確認 PDF 是否渲染完成或崩潰。`,
      initDurationMs
    });
    return;
  }

  console.log(`[PdfTest] 游標已成功就緒！啟動耗時: ${initDurationMs}ms`);

  const mainContent = document.getElementById('main-content');
  const viewerContainer = document.getElementById('viewer-container');

  // 取得當前游標文字與所在頁面之輔助函式
  function getCurrentCursorState() {
    let storeState = null;
    let ctrlTarget = null;
    if (window.__MUZEN_CURSOR_CONTROLLER__) {
      ctrlTarget = window.__MUZEN_CURSOR_CONTROLLER__.currentTarget;
    }

    const cRect = cursorOverlay.getBoundingClientRect();
    const curX = cRect.left;
    const curY = cRect.top;

    let text = '';
    let pageNumber = null;
    let nodeTag = '';

    // 優先從 currentTarget 取得節點
    const activeNode = ctrlTarget ? ctrlTarget.node : null;
    if (activeNode) {
      text = (activeNode.textContent || '').trim().substring(0, 35);
      nodeTag = activeNode.nodeType === 3 ? 'TEXT' : (activeNode.tagName || '');
      const pageEl = activeNode.parentElement ? activeNode.parentElement.closest('.pdf-page-wrapper') : null;
      if (pageEl) {
        pageNumber = parseInt(pageEl.dataset.pageNumber || '0', 10);
      }
    } else {
      try {
        const caret = document.caretPositionFromPoint
          ? document.caretPositionFromPoint(curX + 3, curY + 4)
          : null;
        if (caret && caret.offsetNode) {
          const n = caret.offsetNode;
          text = (n.textContent || '').trim().substring(0, 35);
          nodeTag = n.nodeType === 3 ? 'TEXT' : (n.tagName || '');
          const pageEl = n.parentElement ? n.parentElement.closest('.pdf-page-wrapper') : null;
          if (pageEl) {
            pageNumber = parseInt(pageEl.dataset.pageNumber || '0', 10);
          }
        }
      } catch (e) {}
    }

    return {
      x: Math.round(curX),
      y: Math.round(curY),
      scrollTop: Math.round(mainContent ? mainContent.scrollTop : 0),
      text,
      pageNumber,
      nodeTag,
      targetOffset: ctrlTarget ? ctrlTarget.offset : null,
      overlayOpacity: cursorOverlay.style.opacity,
      overlayTransform: cursorOverlay.style.transform
    };
  }

  const initialLoc = getCurrentCursorState();
  console.log('[PdfTest] 初始狀態:', initialLoc);

  const downSteps = [];
  const upSteps = [];
  const stuckEvents = [];

  // 2. 測試第 1 次按下 'd' (向下半頁) 的詳細內部狀態
  console.log('[PdfTest] === 開始偵測第 1 次按 d 的內部執行狀況 ===');
  const overlay = cursorOverlay;
  console.log('[PdfTest] 按 d 前 Overlay 座標:', overlay.getBoundingClientRect());

  // 監聽 keydown 處理後的狀態
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'd',
      code: 'KeyD',
      bubbles: true,
      cancelable: true
    })
  );

  await sleep(100);
  console.log('[PdfTest] 按 d 後 100ms Overlay 座標:', overlay.getBoundingClientRect(), 'scrollTop:', mainContent?.scrollTop);

  await sleep(400);
  console.log('[PdfTest] 按 d 後 500ms Overlay 座標:', overlay.getBoundingClientRect(), 'scrollTop:', mainContent?.scrollTop);

  // 測試連續按下 'd' 8 次
  console.log('[PdfTest] 開始執行向下半頁 (d) 測試...');
  for (let i = 1; i <= 8; i++) {
    const beforeState = getCurrentCursorState();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'd',
        code: 'KeyD',
        bubbles: true,
        cancelable: true
      })
    );

    // 等待 450ms 完成平滑滾動與游標重錨定
    await sleep(450);

    const afterState = getCurrentCursorState();
    const isStuck =
      beforeState.scrollTop === afterState.scrollTop &&
      Math.abs(beforeState.y - afterState.y) < 2 &&
      beforeState.text === afterState.text;

    const stepInfo = {
      step: i,
      action: 'halfPageDown (d)',
      page: afterState.pageNumber,
      scrollTop: afterState.scrollTop,
      cursorY: afterState.y,
      cursorX: afterState.x,
      textSnippet: afterState.text,
      isStuck
    };

    downSteps.push(stepInfo);

    if (isStuck) {
      stuckEvents.push({
        step: i,
        action: 'd',
        reason: '連續按 d 後 scrollTop 與 cursorY 完全未變動',
        location: afterState
      });
      console.warn(`[PdfTest] ⚠️ 步驟 ${i} 發生卡住 (d)！`, stepInfo);
    }
  }

  // 3. 測試連續按下 'u' (向上半頁) 8 次
  console.log('[PdfTest] 開始執行向上半頁 (u) 測試...');
  for (let i = 1; i <= 8; i++) {
    const beforeState = getCurrentCursorState();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'u',
        code: 'KeyU',
        bubbles: true,
        cancelable: true
      })
    );

    await sleep(450);

    const afterState = getCurrentCursorState();
    const isStuck =
      beforeState.scrollTop === afterState.scrollTop &&
      Math.abs(beforeState.y - afterState.y) < 2 &&
      beforeState.text === afterState.text;

    const stepInfo = {
      step: i,
      action: 'halfPageUp (u)',
      page: afterState.pageNumber,
      scrollTop: afterState.scrollTop,
      cursorY: afterState.y,
      cursorX: afterState.x,
      textSnippet: afterState.text,
      isStuck
    };

    upSteps.push(stepInfo);

    if (isStuck) {
      stuckEvents.push({
        step: i,
        action: 'u',
        reason: '連續按 u 後 scrollTop 與 cursorY 完全未變動',
        location: afterState
      });
      console.warn(`[PdfTest] ⚠️ 步驟 ${i} 發生卡住 (u)！`, stepInfo);
    }
  }

  // 4. 進行深度根因診斷 (Root Cause Analysis)
  const rootCauseAnalysis = {};

  // 診斷項 A: 跨頁邊界 DOM 貫穿能力測試 (TreeWalker 從 Page 1 底部是否能步進到 Page 2)
  try {
    const page1Text = document.querySelector('#pdf-page-1 .textLayer');
    const page2Text = document.querySelector('#pdf-page-2 .textLayer');

    if (page1Text && page2Text) {
      const walker = document.createTreeWalker(
        viewerContainer,
        NodeFilter.SHOW_TEXT
      );

      // 移動到 page 1 最後一個 text node
      const p1Walker = document.createTreeWalker(page1Text, NodeFilter.SHOW_TEXT);
      let p1LastText = null;
      let cur = p1Walker.nextNode();
      while (cur) {
        p1LastText = cur;
        cur = p1Walker.nextNode();
      }

      if (p1LastText) {
        walker.currentNode = p1LastText;
        const nextCrossNode = walker.nextNode();
        const isInPage2 = nextCrossNode && page2Text.contains(nextCrossNode);

        rootCauseAnalysis['crossPageTreeWalker'] = isInPage2
          ? 'PASS (TreeWalker 可自 Page 1 正常跨入 Page 2)'
          : `FAIL (TreeWalker 跨頁受阻，下一個節點為: ${nextCrossNode ? nextCrossNode.parentElement?.className : 'null'})`;
      }
    } else {
      rootCauseAnalysis['crossPageTreeWalker'] = `WARN (Page 2 文字層尚未建立: page1=${!!page1Text}, page2=${!!page2Text})`;
    }
  } catch (err) {
    rootCauseAnalysis['crossPageTreeWalker'] = `ERROR: ${err.message}`;
  }

  // 診斷項 B: 滾動容器與視窗高度評估
  rootCauseAnalysis['scrollContainerMetrics'] = JSON.stringify({
    mainContentScrollHeight: mainContent?.scrollHeight,
    mainContentClientHeight: mainContent?.clientHeight,
    viewerContainerHeight: viewerContainer?.clientHeight,
    isScrollable: (mainContent?.scrollHeight || 0) > (mainContent?.clientHeight || 0) + 10
  });

  // 診斷項 C: TextLayer 是否包含阻礙 Range 計算的 CSS (如 position / transform)
  const sampleSpan = document.querySelector('.textLayer span');
  if (sampleSpan) {
    const cs = window.getComputedStyle(sampleSpan);
    rootCauseAnalysis['textLayerCssFeatures'] = JSON.stringify({
      position: cs.position,
      transform: cs.transform,
      display: cs.display,
      pointerEvents: cs.pointerEvents
    });
  }

  // 5. 彙整並回傳測試報告
  await sendReport({
    success: true,
    initDurationMs,
    initialLocation: initialLoc,
    downSteps,
    upSteps,
    stuckEvents,
    rootCauseAnalysis
  });

  async function sendReport(data) {
    try {
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      console.log('[PdfTest] 診斷報告已成功傳送至測試伺服器。');
    } catch (e) {
      console.error('[PdfTest] 傳送報告失敗:', e);
    }
  }
})();
