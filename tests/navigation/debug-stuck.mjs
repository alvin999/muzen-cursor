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
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('未找到 Chrome！');
}

async function debugStuck() {
  const browserPath = findBrowser();
  const port = 4099;
  const tempProfile = path.join(os.tmpdir(), `muzen-debug-${Date.now()}`);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
      if (req.url === '/' || req.url === '/wiki-float.html') {
        let content = fs.readFileSync(path.join(__dirname, 'wiki-float.html'), 'utf8');
        const injection = `
          <script src="/dist/content/index.js"></script>
          <script>
            (async function() {
              const sleep = ms => new Promise(r => setTimeout(r, ms));
              await sleep(600);

              const caption = document.getElementById('target-map-caption');
              const textNode = caption.firstChild;

              // 量測當前圖說文字的座標
              const range = document.createRange();
              range.setStart(textNode, 0);
              range.setEnd(textNode, 1);
              const captionRect = range.getBoundingClientRect();

              console.log('=== [DEBUG] 1911 地圖圖說座標 ===');
              console.log('Caption top:', captionRect.top, 'bottom:', captionRect.bottom);

              // 模擬 searchDownwardNextLine 往下遍歷節點
              const trace = [];
              let cur = textNode;
              let count = 0;
              while (cur && count < 25) {
                count++;
                const parent = cur.parentElement;
                const r = document.createRange();
                r.selectNodeContents(cur);
                const rect = r.getBoundingClientRect();
                const text = cur.textContent.trim().substring(0, 20);

                trace.push({
                  step: count,
                  tag: parent ? parent.tagName : '',
                  text,
                  top: Math.round(rect.top),
                  bottom: Math.round(rect.bottom),
                  diffFromCaption: Math.round(rect.top - captionRect.top)
                });

                // TreeWalker 找下一個 Text
                const walker = document.createTreeWalker(document.getElementById('content'), NodeFilter.SHOW_TEXT);
                walker.currentNode = cur;
                cur = walker.nextNode();
              }

              fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ captionTop: captionRect.top, trace })
              });
            })();
          </script>
        `;
        content = content.replace('</body>', `${injection}</body>`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      } else if (req.url === '/dist/content/index.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(fs.readFileSync(path.join(rootDir, 'dist/content/index.js')));
      }
    } else if (req.method === 'POST') {
      let b = '';
      req.on('data', c => b += c);
      req.on('end', () => {
        res.writeHead(200);
        res.end('ok');
        const data = JSON.parse(b);
        console.log('Caption Top:', data.captionTop);
        console.table(data.trace);
        process.exit(0);
      });
    }
  });

  await new Promise(r => server.listen(port, '127.0.0.1', r));

  spawn(browserPath, [
    '--headless=new',
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    `http://127.0.0.1:${port}/wiki-float.html`
  ]);
}

debugStuck();
