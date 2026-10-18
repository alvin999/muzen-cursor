import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

function findBrowser() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else {
    // Linux
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/brave',
      '/usr/bin/brave-browser',
      '/opt/brave-bin/brave',
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  throw new Error('未在系統中找到 Chromium 系列瀏覽器 (Chrome / Brave / Edge / Chromium)！');
}

/**
 * 執行單一導航場景測試
 */
async function executeScenario({ name, htmlFile, port, testScript, timeoutMs = 15000 }) {
  console.log(`\n---------------------------------------------------------------`);
  console.log(`▶️ 正在執行場景: ${name}`);
  console.log(`---------------------------------------------------------------`);

  const browserPath = findBrowser();
  const tempProfile = path.join(os.tmpdir(), `muzen-nav-${Date.now()}-${Math.random().toString(36).substring(7)}`);

  let resolveReport;
  const reportPromise = new Promise((resolve) => {
    resolveReport = resolve;
  });

  const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
      if (req.url === '/' || req.url === `/${htmlFile}`) {
        let content = fs.readFileSync(path.join(__dirname, htmlFile), 'utf8');
        const injection = `
          <script src="/dist/content/index.js"></script>
          <script>
            ${testScript}
          </script>
        `;
        content = content.replace('</body>', `${injection}</body>`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      } else if (req.url === '/dist/content/index.js') {
        const file = path.join(rootDir, 'dist/content/index.js');
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(fs.readFileSync(file));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    } else if (req.method === 'POST' && req.url === '/api/report') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        try {
          resolveReport(JSON.parse(body));
        } catch (e) {
          resolveReport({ error: e.message });
        }
      });
    }
  });

  await new Promise(r => server.listen(port, '127.0.0.1', r));

  const chromeProc = spawn(browserPath, [
    '--headless=new',
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1280,960',
    `http://127.0.0.1:${port}/${htmlFile}`
  ], { stdio: 'ignore' });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`測試執行逾時 (超過 ${timeoutMs / 1000} 秒未收到回報)`)), timeoutMs);
  });

  try {
    const report = await Promise.race([reportPromise, timeoutPromise]);
    return report;
  } finally {
    chromeProc.kill();
    server.close();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

async function runAllNavigationTests() {
  console.log('===============================================================');
  console.log('🌐 Muzen Cursor 瀏覽動作與複雜版面導航精簡自動測試');
  console.log('===============================================================');

  // 確認打包檔案存在
  const distFile = path.join(rootDir, 'dist/content/index.js');
  if (!fs.existsSync(distFile)) {
    console.error('❌ 未找到 dist/content/index.js，請先執行 npm run build！');
    process.exit(1);
  }

  // ==============================================================
  // 場景 1: Facebook 虛擬動態牆高頻 DOM 更新壓力測試
  // ==============================================================
  const fbScript = `
    (async function() {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      await sleep(500);

      window.startFbDomChurn();

      const firstPost = document.querySelector('article.fb-post .post-content');
      const walker = document.createTreeWalker(firstPost, NodeFilter.SHOW_TEXT);
      const textNode = walker.nextNode();

      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 1);
      const rect = range.getBoundingClientRect();

      firstPost.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + 2,
        clientY: rect.top + 2,
        bubbles: true,
        cancelable: true
      }));

      await sleep(300);

      const steps = [];
      let leakedToSidebar = 0;
      let leakedToHeader = 0;
      let jumpBackCount = 0;
      let ceilingJumps = 0;
      let lastScrollY = 0;

      // 階段 1: 單步 j 導航 (15 步) - 檢驗跨越 720px 大圖與同行欄位鎖定
      for (let i = 1; i <= 15; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', bubbles: true, cancelable: true }));
        await sleep(100);

        const overlay = document.querySelector('#muzen-cursor-host-root');
        const shadow = overlay ? overlay.shadowRoot : null;
        const cursorEl = shadow ? shadow.querySelector('.muzen-cursor-overlay') : null;
        const cRect = cursorEl ? cursorEl.getBoundingClientRect() : null;

        const curX = cRect ? cRect.left : 0;
        const curY = cRect ? cRect.top : 0;
        const curScroll = Math.round(window.scrollY);

        if (curScroll < lastScrollY) jumpBackCount++;
        lastScrollY = curScroll;

        let activeText = '';
        let isInsideFeed = false;
        try {
          const caret = document.caretPositionFromPoint ? document.caretPositionFromPoint(curX + 4, curY + 6) : null;
          if (caret && caret.offsetNode) {
            const el = caret.offsetNode.nodeType === 1 ? caret.offsetNode : caret.offsetNode.parentElement;
            activeText = (caret.offsetNode.textContent || '').trim().substring(0, 28);
            if (el) {
              if (el.closest('nav.fb-left-sidebar')) leakedToSidebar++;
              if (el.closest('header.fb-header')) leakedToHeader++;
              if (el.closest('[role="feed"]')) isInsideFeed = true;
            }
          }
        } catch(e) {}

        steps.push({
          step: i,
          mode: 'single',
          scrollY: curScroll,
          cursorY: cRect ? Math.round(cRect.top) : 0,
          cursorX: cRect ? Math.round(cRect.left) : 0,
          text: activeText,
          inFeed: isInsideFeed
        });
      }

      // 階段 2: 極速長按 j (Repeat) 連續推進 (35 步，間隔 45ms) - 檢驗即時幀同步與防瞬移飛頂
      let reachedBottomZone = false;
      for (let i = 16; i <= 50; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', repeat: true, bubbles: true, cancelable: true }));
        await sleep(45);

        const overlay = document.querySelector('#muzen-cursor-host-root');
        const shadow = overlay ? overlay.shadowRoot : null;
        const cursorEl = shadow ? shadow.querySelector('.muzen-cursor-overlay') : null;
        const cRect = cursorEl ? cursorEl.getBoundingClientRect() : null;
        const curScroll = Math.round(window.scrollY);

        if (curScroll < lastScrollY) jumpBackCount++;
        lastScrollY = curScroll;

        if (cRect) {
          if (cRect.top > window.innerHeight - 240) reachedBottomZone = true;
          // 若已經到達底部舒適區，游標突然跳回視窗頂部 25% 以上，視為瞬移飛頂異常
          if (reachedBottomZone && cRect.top < window.innerHeight * 0.35) {
            ceilingJumps++;
          }
        }

        if (i % 5 === 0 || i === 50) {
          steps.push({
            step: i,
            mode: 'repeat',
            scrollY: curScroll,
            cursorY: cRect ? Math.round(cRect.top) : 0,
            cursorX: cRect ? Math.round(cRect.left) : 0,
            text: '長按幀同步推進中...',
            inFeed: true
          });
        }
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'j', code: 'KeyJ', bubbles: true, cancelable: true }));

      fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          leakedToSidebar,
          leakedToHeader,
          jumpBackCount,
          ceilingJumps,
          totalSteps: 50,
          finalScrollY: Math.round(window.scrollY),
          sampleSteps: [steps[0], steps[7], steps[14], steps[17], steps[20]]
        })
      });
    })();
  `;

  const fbReport = await executeScenario({
    name: 'Facebook 虛擬動態牆大圖穿透與長按極速幀同步壓力測試',
    htmlFile: 'facebook-feed.html',
    port: 4021,
    testScript: fbScript
  });

  console.log('📊 Facebook 動態牆高頻實戰測試結果:');
  console.table(fbReport.sampleSteps);
  console.log(`- 游標外溢到左側選單次數: ${fbReport.leakedToSidebar} 次 (標準: 0)`);
  console.log(`- 游標外溢到頂部 Header 次數: ${fbReport.leakedToHeader} 次 (標準: 0)`);
  console.log(`- 滾動逆向倒退跳躍次數: ${fbReport.jumpBackCount} 次 (標準: 0)`);
  console.log(`- 長按游標瞬移飛頂次數: ${fbReport.ceilingJumps} 次 (標準: 0)`);
  console.log(`- 最終滾動進度 (scrollY): ${fbReport.finalScrollY}px (標準: > 1000px，成功穿透 720px 大圖)`);

  const isFbPassed = fbReport.leakedToSidebar === 0 &&
                     fbReport.leakedToHeader === 0 &&
                     fbReport.jumpBackCount === 0 &&
                     fbReport.ceilingJumps === 0 &&
                     fbReport.finalScrollY > 1000;
  console.log(`👉 測試判定: ${isFbPassed ? '✅ PASS (大圖穿透流暢，長按幀同步完美推進)' : '❌ FAIL'}`);

  // ==============================================================
  // 場景 2: 維基百科側邊導覽盒防截胡測試 (截圖同款精煉版)
  // ==============================================================
  const wikiDivertScript = `
    (async function() {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      await sleep(500);

      // 起點：正文段落第一行中的「史」字 (文字內容：光緒二十年...甲午戰爭的失...)
      const pStart = document.getElementById('para-start');
      const textNode = pStart.firstChild;

      // 尋找「史」字所在 offset (清廷在甲午戰爭的失敗的「失」或「史」)
      const text = textNode.textContent;
      const targetCharIdx = text.indexOf('史') !== -1 ? text.indexOf('史') : 25;

      const range = document.createRange();
      range.setStart(textNode, targetCharIdx);
      range.setEnd(textNode, targetCharIdx + 1);
      const rect = range.getBoundingClientRect();

      pStart.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + 2,
        clientY: rect.top + 2,
        bubbles: true,
        cancelable: true
      }));

      await sleep(300);

      const steps = [];
      let leakedToSidebar = 0;
      let upwardJumps = 0;
      let reachedHeading = false;
      let prevCursorY = rect.top;

      // 連續按 j 鍵 14 次
      for (let i = 1; i <= 14; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', bubbles: true, cancelable: true }));
        await sleep(100);

        const overlay = document.querySelector('#muzen-cursor-host-root');
        const shadow = overlay ? overlay.shadowRoot : null;
        const cursorEl = shadow ? shadow.querySelector('.muzen-cursor-overlay') : null;
        const cRect = cursorEl ? cursorEl.getBoundingClientRect() : null;

        const curX = cRect ? cRect.left : 0;
        const curY = cRect ? cRect.top : 0;

        let activeText = '';
        try {
          const caret = document.caretPositionFromPoint ? document.caretPositionFromPoint(curX + 4, curY + 6) : null;
          if (caret && caret.offsetNode) {
            const el = caret.offsetNode.nodeType === 1 ? caret.offsetNode : caret.offsetNode.parentElement;
            activeText = (caret.offsetNode.textContent || '').trim().substring(0, 30);
            if (el && el.closest('.sidebar.vertical-navbox')) {
              leakedToSidebar++;
            }
          }
        } catch(e) {}

        if (activeText.includes('日治時期')) {
          reachedHeading = true;
        }

        // 檢測是否發生反向倒退跳躍 (按 j 游標 Y 座標向上縮小 > 15px)
        if (cRect && (prevCursorY - cRect.top) > 15) {
          upwardJumps++;
        }

        steps.push({
          step: i,
          cursorY: cRect ? Math.round(cRect.top) : 0,
          cursorX: cRect ? Math.round(cRect.left) : 0,
          text: activeText,
          inSidebar: activeText.includes('臺灣系列') || activeText.includes('閱 · 論 · 編')
        });

        if (cRect) prevCursorY = cRect.top;
      }

      fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          leakedToSidebar,
          upwardJumps,
          reachedHeading,
          steps
        })
      });
    })();
  `;

  const wikiDivertReport = await executeScenario({
    name: '維基百科側邊導覽盒防截胡測試 (截圖同款精煉版)',
    htmlFile: 'wiki-sidebar-divert.html',
    port: 4022,
    testScript: wikiDivertScript
  });

  console.log('📊 維基百科側邊導覽盒防截胡測試結果:');
  console.table(wikiDivertReport.steps.slice(0, 8));
  console.log(`- 游標被右側「閱·論·編/臺灣系列」截胡吸附次數: ${wikiDivertReport.leakedToSidebar} 次 (標準: 0)`);
  console.log(`- 按 j 向下卻反向向上倒退跳躍次數: ${wikiDivertReport.upwardJumps} 次 (標準: 0)`);
  console.log(`- 是否順暢穿透抵達「日治時期」大標題: ${wikiDivertReport.reachedHeading ? '✅ 是' : '❌ 否'}`);
  const isWikiDivertPassed = wikiDivertReport.leakedToSidebar === 0 && wikiDivertReport.upwardJumps === 0 && wikiDivertReport.reachedHeading;
  console.log(`👉 測試判定: ${isWikiDivertPassed ? '✅ PASS (主閱讀流完美隔離，零截胡，零倒退)' : '❌ FAIL'}`);

  console.log('\n===============================================================');
  console.log('🎉 導航測試套件執行完成！');
  console.log('===============================================================');

  if (!isFbPassed || !isWikiDivertPassed) {
    process.exit(1);
  }
}

runAllNavigationTests().catch(err => {
  console.error('❌ 測試套件執行失敗:', err);
  process.exit(1);
});
