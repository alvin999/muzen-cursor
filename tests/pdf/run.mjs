import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const distDir = path.join(rootDir, 'dist');
const pdfFixturePath = path.join(__dirname, 'fixtures', 'book-riscv-rev1.pdf');

function findBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('未在系統中找到 Chrome 或 Edge 瀏覽器！');
}

/**
 * 啟動本機測試伺服器與 Headless 瀏覽器執行 PdfTest
 */
export async function runPdfTest({ timeoutMs = 180000, maxPagesToTest = 10 } = {}) {
  console.log('===============================================================');
  console.log('📑 Muzen Cursor PDF 檢視器導航 (u / d) 深度診斷測試 (PdfTest)');
  console.log('===============================================================');

  if (!fs.existsSync(pdfFixturePath)) {
    throw new Error(`找不到測試 PDF 檔案: ${pdfFixturePath}`);
  }

  const pdfBuffer = fs.readFileSync(pdfFixturePath);
  console.log(`- 測試樣本: xv6 book-riscv-rev1.pdf (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  const browserPath = findBrowser();
  const tempProfile = path.join(os.tmpdir(), `muzen-pdf-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  const port = 4055;

  let resolveReport;
  const reportPromise = new Promise((resolve) => {
    resolveReport = resolve;
  });

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`);
    const pathname = parsedUrl.pathname;

    if (req.method === 'GET') {
      if (pathname === '/api/pdf-base64') {
        const b64 = pdfBuffer.toString('base64');
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(b64);
        return;
      }

      if (pathname === '/api/pdf-bytes') {
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Length': pdfBuffer.length,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(pdfBuffer);
        return;
      }

      // 伺服 dist 靜態檔案
      let filePath = path.join(distDir, pathname.replace(/^\//, ''));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.mjs': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json',
          '.png': 'image/png',
          '.svg': 'image/svg+xml'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        if (pathname === '/src/pdf-viewer/viewer.html') {
          let html = fs.readFileSync(filePath, 'utf8');
          // 注入測試診斷鉤子與 mock chrome runtime (必須在 head 最前端，以確保 pdfViewer 模組執行前具備 chrome.runtime)
          const testHook = `
            <script>
              window.__PDF_TEST_ACTIVE__ = true;
              window.__PDF_BYTES_URL__ = '/api/pdf-bytes';

              // Mock chrome runtime for viewer
              window.chrome = window.chrome || {};
              window.chrome.runtime = {
                getURL: (p) => '/' + p,
                sendMessage: async (msg) => {
                  if (msg.type === 'FETCH_PDF_DATA') {
                    const r = await fetch('/api/pdf-base64');
                    const b64 = await r.text();
                    return { success: true, base64: b64 };
                  }
                  return { success: false, error: 'Unknown message' };
                }
              };
            </script>
            <script type="module" src="/pdf-test-runner.js"></script>
          `;
          html = html.replace('<head>', `<head>${testHook}`);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fs.readFileSync(filePath));
        return;
      }

      if (pathname === '/pdf-test-runner.js') {
        const runnerScript = fs.readFileSync(path.join(__dirname, 'pdf-test-runner.js'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(runnerScript);
        return;
      }

      res.writeHead(404);
      res.end('Not Found: ' + pathname);
    } else if (req.method === 'POST' && pathname === '/api/log') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        try {
          const item = JSON.parse(body);
          console.log(`[Browser ${item.type.toUpperCase()}] ${item.text}`);
        } catch {}
      });
    } else if (req.method === 'POST' && pathname === '/api/report') {
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

  const targetUrl = `http://127.0.0.1:${port}/src/pdf-viewer/viewer.html?file=/api/pdf-bytes`;
  console.log(`- 啟動 Headless 瀏覽器測試中: ${targetUrl}`);

  const chromeProc = spawn(browserPath, [
    '--headless=new',
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1280,960',
    targetUrl
  ], { stdio: 'inherit' });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`測試執行逾時 (超過 ${timeoutMs / 1000} 秒未收到回報)`)), timeoutMs);
  });

  try {
    const report = await Promise.race([reportPromise, timeoutPromise]);
    printTestReport(report);
    return report;
  } finally {
    chromeProc.kill();
    server.close();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

function printTestReport(report) {
  console.log('\n===============================================================');
  console.log('📊 PdfTest 診斷報告');
  console.log('===============================================================');

  if (report.error) {
    console.error('❌ 測試發生異常:', report.error);
    return;
  }

  console.log(`- 初始游標啟動時間: ${report.initDurationMs} ms`);
  console.log(`- 初始游標位置: 頁碼 P.${report.initialLocation?.pageNumber}, 文字: "${report.initialLocation?.text}"`);
  console.log(`- 總計測試向下 (d) 次數: ${report.downSteps?.length}`);
  console.log(`- 總計測試向上 (u) 次數: ${report.upSteps?.length}`);

  if (report.stuckEvents && report.stuckEvents.length > 0) {
    console.log(`\n⚠️ 偵測到卡住 (Stuck) 事件共 ${report.stuckEvents.length} 次！`);
    console.table(report.stuckEvents);
  } else {
    console.log('\n✅ 測試過程中未發現連續卡滯現象。');
  }

  console.log('\n📜 動作歷程抽樣:');
  const allSteps = [...(report.downSteps || []), ...(report.upSteps || [])];
  console.table(allSteps.filter((_, idx) => idx % 2 === 0 || idx === allSteps.length - 1));

  if (report.rootCauseAnalysis) {
    console.log('\n🔍 核心根因分析:');
    for (const [key, val] of Object.entries(report.rootCauseAnalysis)) {
      console.log(`  • [${key}]: ${val}`);
    }
  }

  console.log('===============================================================\n');
}

// 支援直接命令列執行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPdfTest().catch(err => {
    console.error('PdfTest 執行失敗:', err);
    process.exit(1);
  });
}
