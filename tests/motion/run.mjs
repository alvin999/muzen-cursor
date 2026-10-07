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

async function runTest() {
  console.log('===============================================================');
  console.log('🚀 啟動 Muzen Cursor 游標位移與殘影對稱性自動測試 (Headless 模式)');
  console.log('===============================================================');

  const browserPath = findBrowser();
  console.log(`[環境] 檢測到瀏覽器: ${browserPath}`);

  const port = 3999;
  const tempProfile = path.join(os.tmpdir(), `muzen-test-profile-${Date.now()}`);

  let testResultResolve;
  const testResultPromise = new Promise((resolve) => {
    testResultResolve = resolve;
  });

  // 1. 啟動本機微型測試伺服器
  const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
      if (req.url === '/' || req.url === '/index.html') {
        const file = path.join(__dirname, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(file));
      } else if (req.url === '/dist/content/index.js') {
        const file = path.join(rootDir, 'dist/content/index.js');
        if (!fs.existsSync(file)) {
          res.writeHead(500);
          res.end('請先執行 npm run build 打包 dist/content/index.js');
          return;
        }
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
        res.end(JSON.stringify({ received: true }));
        try {
          const parsed = JSON.parse(body);
          testResultResolve(parsed);
        } catch (e) {
          testResultResolve({ error: 'JSON 解析失敗: ' + e.message });
        }
      });
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`[伺服器] 本機測試伺服器已啟動: http://127.0.0.1:${port}`);

  // 2. 啟動 Headless 瀏覽器
  const chromeProc = spawn(browserPath, [
    '--headless=new',
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-background-networking',
    `http://127.0.0.1:${port}/index.html`
  ], { stdio: 'ignore' });

  console.log('[流程] 瀏覽器已啟動，自動進行文字聚焦、按鍵向右 (l) 與向左 (h) 高頻採樣...');

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('測試執行逾時 (超過 12 秒未收到瀏覽器回報)')), 12000);
  });

  try {
    const result = await Promise.race([testResultPromise, timeoutPromise]);

    if (result.error) {
      throw new Error(result.error);
    }

    console.log('[流程] 瀏覽器自動測試完成！收到完整採樣數據。');

    analyzeAndReport(result);

  } finally {
    try {
      chromeProc.kill();
    } catch {}
    try {
      server.close();
    } catch {}
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

function analyzeAndReport(data) {
  const { rightSamples, leftSamples, interceptedLogs } = data;

  console.log('\n===============================================================');
  console.log('📊 測試結果自動驗證報告 (Symmetry & Motion Trail Analysis)');
  console.log('===============================================================');

  if (interceptedLogs && interceptedLogs.length > 0) {
    console.log('\n【瀏覽器內部 Muzen Trail 即時日誌】:');
    for (const log of interceptedLogs) {
      console.log(`  🔹 ${log}`);
    }
  }

  const targetCheckpoints = [0, 16, 32, 50, 80, 120, 180, 260];

  function pickCheckpointFrames(samples) {
    return targetCheckpoints.map((t) => {
      let closest = samples[0];
      let minDiff = 9999;
      for (const s of samples) {
        const diff = Math.abs(s.elapsedMs - t);
        if (diff < minDiff) {
          minDiff = diff;
          closest = s;
        }
      }
      return closest;
    });
  }

  const rightCheckpoints = pickCheckpointFrames(rightSamples);
  const leftCheckpoints = pickCheckpointFrames(leftSamples);

  console.log('\n【➡️ 向右移動 (按 l) 關鍵影格】:');
  console.table(rightCheckpoints.map((f) => {
    const g = f.ghosts[0];
    const relDiffX = g ? Math.round(g.rect.x - f.cursor.x) : '-';
    return {
      '時間(ms)': `${f.elapsedMs}ms`,
      '主游標 X': `${f.cursor.x}px`,
      '主游標 Y': `${f.cursor.y}px`,
      '殘影 X': g ? `${g.rect.x}px` : '-',
      '殘影 Y': g ? `${g.rect.y}px` : '-',
      '殘影相對方位': g ? (relDiffX < 0 ? `正左方 (${Math.abs(relDiffX)}px)` : `正右方 (${relDiffX}px) ⚠️`) : '無殘影',
      '殘影透明度': g ? `${g.opacity}` : '-'
    };
  }));

  console.log('\n【⬅️ 向左移動 (按 h) 關鍵影格】:');
  console.table(leftCheckpoints.map((f) => {
    const g = f.ghosts[0];
    const relDiffX = g ? Math.round(g.rect.x - f.cursor.x) : '-';
    return {
      '時間(ms)': `${f.elapsedMs}ms`,
      '主游標 X': `${f.cursor.x}px`,
      '主游標 Y': `${f.cursor.y}px`,
      '殘影 X': g ? `${g.rect.x}px` : '-',
      '殘影 Y': g ? `${g.rect.y}px` : '-',
      '殘影相對方位': g ? (relDiffX > 0 ? `正右方 (${relDiffX}px)` : `正左方 (${Math.abs(relDiffX)}px) ⚠️`) : '無殘影',
      '殘影透明度': g ? `${g.opacity}` : '-'
    };
  }));

  // 指標計算
  const rStart = rightSamples[0].cursor;
  const rEnd = rightSamples[rightSamples.length - 1].cursor;
  const lStart = leftSamples[0].cursor;
  const lEnd = leftSamples[leftSamples.length - 1].cursor;

  const rightDeltaX = rEnd.x - rStart.x;
  const rightDeltaY = rEnd.y - rStart.y;
  const leftDeltaX = lEnd.x - lStart.x;
  const leftDeltaY = lEnd.y - lStart.y;

  console.log('\n===============================================================');
  console.log('🔍 左右對稱度指標深度診斷:');
  console.log('---------------------------------------------------------------');
  console.log(`1. 水平總位移量: 向右 = +${rightDeltaX.toFixed(1)}px | 向左 = ${leftDeltaX.toFixed(1)}px`);
  const isDistanceSymmetric = Math.abs(Math.abs(rightDeltaX) - Math.abs(leftDeltaX)) < 1.0;
  console.log(`   👉 水平位移對稱性: ${isDistanceSymmetric ? '✅ 完美對稱 (符合字元等寬規律)' : '⚠️ 不對稱'}`);

  console.log(`2. 垂直基準線穩定度: 向右 ΔY = ${rightDeltaY.toFixed(1)}px | 向左 ΔY = ${leftDeltaY.toFixed(1)}px`);
  const isVerticalFlat = Math.abs(rightDeltaY) <= 0.5 && Math.abs(leftDeltaY) <= 0.5;
  console.log(`   👉 垂直水平度: ${isVerticalFlat ? '✅ 100% 筆直同行 (無 Y 軸上下浮動偏差)' : '⚠️ 存在 Y 軸垂直偏移'}`);

  // 殘影方位分析
  let rightGhostDirectionOk = true;
  let leftGhostDirectionOk = true;

  for (const s of rightSamples) {
    if (s.ghosts[0] && s.elapsedMs >= 20) {
      if (s.ghosts[0].rect.x > s.cursor.x) rightGhostDirectionOk = false;
    }
  }
  for (const s of leftSamples) {
    if (s.ghosts[0] && s.elapsedMs >= 20) {
      if (s.ghosts[0].rect.x < s.cursor.x) leftGhostDirectionOk = false;
    }
  }

  console.log(`3. 殘影方位物理正確性:`);
  console.log(`   - 向右 (l) 時殘影留在正左方: ${rightGhostDirectionOk ? '✅ 正確 (在身後起點)' : '❌ 錯誤 (出現在前方或上方)'}`);
  console.log(`   - 向左 (h) 時殘影留在正右方: ${leftGhostDirectionOk ? '✅ 正確 (在身後起點)' : '❌ 錯誤 (出現在前方或上方)'}`);

  // 速度與過渡感受比較
  const rMid = rightSamples.find((s) => s.elapsedMs >= 40 && s.elapsedMs <= 60)?.cursor;
  const lMid = leftSamples.find((s) => s.elapsedMs >= 40 && s.elapsedMs <= 60)?.cursor;

  if (rMid && lMid && Math.abs(rightDeltaX) > 0 && Math.abs(leftDeltaX) > 0) {
    const rProgress = Math.round(((rMid.x - rStart.x) / rightDeltaX) * 100);
    const lProgress = Math.round(((lMid.x - lStart.x) / leftDeltaX) * 100);
    console.log(`4. 動態速度曲線 (50ms 處位移進度): 向右 = ${rProgress}% | 向左 = ${lProgress}%`);
    const isProgressSymmetric = Math.abs(rProgress - lProgress) <= 15;
    console.log(`   👉 運動速度對稱性: ${isProgressSymmetric ? '✅ 左右過渡動態勻稱' : '⚠️ 左右速度感存在明顯差異'}`);
  }

  // 輸出寫入 JSON
  const reportPath = path.resolve(__dirname, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    metrics: {
      rightDeltaX,
      rightDeltaY,
      leftDeltaX,
      leftDeltaY,
      isDistanceSymmetric,
      isVerticalFlat,
      rightGhostDirectionOk,
      leftGhostDirectionOk
    },
    rightSamples,
    leftSamples,
    interceptedLogs
  }, null, 2), 'utf-8');

  console.log(`\n📁 完整影格原始資料已保存至: ${reportPath}`);
  console.log('===============================================================\n');
}

runTest().catch((err) => {
  console.error('❌ 測試執行失敗:', err);
  process.exit(1);
});
