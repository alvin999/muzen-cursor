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

  console.log('[流程] 瀏覽器已啟動，自動進行文字聚焦、按鍵向右 (l)、向左 (h)、向下 (j) 與向上 (k) 高頻採樣...');

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('測試執行逾時 (超過 20 秒未收到瀏覽器回報)')), 20000);
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
  const { rightSamples, leftSamples, downSamples, upSamples, interceptedLogs } = data;

  console.log('\n===============================================================');
  console.log('📊 測試結果自動驗證報告 (Horizontal & Vertical Symmetry Analysis)');
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
  const downCheckpoints = downSamples ? pickCheckpointFrames(downSamples) : [];
  const upCheckpoints = upSamples ? pickCheckpointFrames(upSamples) : [];

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

  if (downCheckpoints.length > 0) {
    console.log('\n【⬇️ 向下移動 (按 j) 關鍵影格】:');
    console.table(downCheckpoints.map((f) => {
      const g = f.ghosts[0];
      const relDiffY = g ? Math.round(g.rect.y - f.cursor.y) : '-';
      return {
        '時間(ms)': `${f.elapsedMs}ms`,
        '主游標 X': `${f.cursor.x}px`,
        '主游標 Y': `${f.cursor.y}px`,
        '殘影 X': g ? `${g.rect.x}px` : '-',
        '殘影 Y': g ? `${g.rect.y}px` : '-',
        '殘影相對方位': g ? (relDiffY < 0 ? `正上方 (${Math.abs(relDiffY)}px)` : `正下方 (${relDiffY}px) ⚠️`) : '無殘影',
        '殘影透明度': g ? `${g.opacity}` : '-'
      };
    }));
  }

  if (upCheckpoints.length > 0) {
    console.log('\n【⬆️ 向上移動 (按 k) 關鍵影格】:');
    console.table(upCheckpoints.map((f) => {
      const g = f.ghosts[0];
      const relDiffY = g ? Math.round(g.rect.y - f.cursor.y) : '-';
      return {
        '時間(ms)': `${f.elapsedMs}ms`,
        '主游標 X': `${f.cursor.x}px`,
        '主游標 Y': `${f.cursor.y}px`,
        '殘影 X': g ? `${g.rect.x}px` : '-',
        '殘影 Y': g ? `${g.rect.y}px` : '-',
        '殘影相對方位': g ? (relDiffY > 0 ? `正下方 (${relDiffY}px)` : `正上方 (${Math.abs(relDiffY)}px) ⚠️`) : '無殘影',
        '殘影透明度': g ? `${g.opacity}` : '-'
      };
    }));
  }

  // 指標計算：水平
  const rStart = rightSamples[0].cursor;
  const rEnd = rightSamples[rightSamples.length - 1].cursor;
  const lStart = leftSamples[0].cursor;
  const lEnd = leftSamples[leftSamples.length - 1].cursor;

  const rightDeltaX = rEnd.x - rStart.x;
  const rightDeltaY = rEnd.y - rStart.y;
  const leftDeltaX = lEnd.x - lStart.x;
  const leftDeltaY = lEnd.y - lStart.y;

  console.log('\n===============================================================');
  console.log('🔍 左右水平對稱度指標深度診斷 (h / l):');
  console.log('---------------------------------------------------------------');
  console.log(`1. 水平總位移量: 向右 = +${rightDeltaX.toFixed(1)}px | 向左 = ${leftDeltaX.toFixed(1)}px`);
  const isHorizDistanceSymmetric = Math.abs(Math.abs(rightDeltaX) - Math.abs(leftDeltaX)) < 1.0;
  console.log(`   👉 水平位移對稱性: ${isHorizDistanceSymmetric ? '✅ 完美對稱 (符合字元等寬規律)' : '⚠️ 不對稱'}`);

  console.log(`2. 垂直基準線穩定度: 向右 ΔY = ${rightDeltaY.toFixed(1)}px | 向左 ΔY = ${leftDeltaY.toFixed(1)}px`);
  const isVerticalFlat = Math.abs(rightDeltaY) <= 0.5 && Math.abs(leftDeltaY) <= 0.5;
  console.log(`   👉 垂直水平度: ${isVerticalFlat ? '✅ 100% 筆直同行 (無 Y 軸上下浮動偏差)' : '⚠️ 存在 Y 軸垂直偏移'}`);

  // 殘影方位分析：水平
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

  // 指標計算：垂直
  let isVertDistanceSymmetric = true;
  let isHorizStable = true;
  let downGhostDirectionOk = true;
  let upGhostDirectionOk = true;

  if (downSamples && upSamples) {
    const dStart = downSamples[0].cursor;
    const dEnd = downSamples[downSamples.length - 1].cursor;
    const uStart = upSamples[0].cursor;
    const uEnd = upSamples[upSamples.length - 1].cursor;

    const downDeltaX = dEnd.x - dStart.x;
    const downDeltaY = dEnd.y - dStart.y;
    const upDeltaX = uEnd.x - uStart.x;
    const upDeltaY = uEnd.y - uStart.y;

    console.log('\n===============================================================');
    console.log('🔍 上下垂直對稱度與跳躍穩定度診斷 (j / k):');
    console.log('---------------------------------------------------------------');
    console.log(`1. 垂直總位移量: 向下 = +${downDeltaY.toFixed(1)}px | 向上 = ${upDeltaY.toFixed(1)}px`);
    isVertDistanceSymmetric = Math.abs(Math.abs(downDeltaY) - Math.abs(upDeltaY)) < 1.0;
    console.log(`   👉 垂直位移對稱性: ${isVertDistanceSymmetric ? '✅ 完美對稱 (嚴格對應行高)' : '⚠️ 不對稱'}`);

    console.log(`2. 水平記憶欄穩定度: 向下 ΔX = ${downDeltaX.toFixed(1)}px | 向上 ΔX = ${upDeltaX.toFixed(1)}px`);
    isHorizStable = Math.abs(downDeltaX) <= 1.0 && Math.abs(upDeltaX) <= 1.0;
    console.log(`   👉 水平欄位鎖定: ${isHorizStable ? '✅ 100% 垂直對齊 (無左右抖動漂移)' : '⚠️ 存在 X 軸側向漂移'}`);

    // 垂直殘影方位分析（在游標跨越行間到位後，驗證殘影留在庫存身後的起點）
    for (const s of downSamples) {
      if (s.ghosts[0] && s.elapsedMs >= 60 && s.elapsedMs <= 200) {
        if (s.ghosts[0].rect.y > s.cursor.y) downGhostDirectionOk = false;
      }
    }
    for (const s of upSamples) {
      if (s.ghosts[0] && s.elapsedMs >= 60 && s.elapsedMs <= 200) {
        if (s.ghosts[0].rect.y < s.cursor.y) upGhostDirectionOk = false;
      }
    }
    console.log(`3. 垂直殘影方位物理正確性:`);
    console.log(`   - 向下 (j) 時殘影留在正上方: ${downGhostDirectionOk ? '✅ 正確 (在身後起點)' : '❌ 錯誤 (出現在下方)'}`);
    console.log(`   - 向上 (k) 時殘影留在正下方: ${upGhostDirectionOk ? '✅ 正確 (在身後起點)' : '❌ 錯誤 (出現在上方)'}`);
  }

  // 4. 全維度座標健全性防禦檢查 (Zero-Coordinate & Negative Drift Check)
  console.log('\n===============================================================');
  console.log('🛡️ 座標健全度與零點瞬移防禦檢測:');
  console.log('---------------------------------------------------------------');
  const allSampleSets = [
    { name: '向右 (l)', samples: rightSamples },
    { name: '向左 (h)', samples: leftSamples },
    { name: '向下 (j)', samples: downSamples },
    { name: '向上 (k)', samples: upSamples }
  ].filter(s => s.samples);

  let hasZeroDrift = false;
  for (const set of allSampleSets) {
    const bogusFrames = set.samples.filter(f => f.cursor.x <= 0 && f.cursor.y <= 0);
    if (bogusFrames.length > 0) {
      hasZeroDrift = true;
      console.log(`   ❌ ${set.name} 偵測到游標墜入 (0, 0) 異常影格: ${bogusFrames.length} 幀`);
    }
  }
  if (!hasZeroDrift) {
    console.log('   👉 零點瞬移防禦: ✅ 100% 通過 (所有影格座標真實且連貫，無 (0,0) 墜毀)');
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
      isHorizDistanceSymmetric,
      isVerticalFlat,
      rightGhostDirectionOk,
      leftGhostDirectionOk,
      isVertDistanceSymmetric,
      isHorizStable,
      downGhostDirectionOk,
      upGhostDirectionOk,
      hasZeroDrift
    },
    rightSamples,
    leftSamples,
    downSamples,
    upSamples,
    interceptedLogs
  }, null, 2), 'utf-8');

  console.log(`\n📁 完整影格原始資料已保存至: ${reportPath}`);
  console.log('===============================================================\n');
}

runTest().catch((err) => {
  console.error('❌ 測試執行失敗:', err);
  process.exit(1);
});
