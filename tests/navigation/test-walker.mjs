import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findBrowser() {
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

async function testWalker() {
  const browserPath = findBrowser();
  const tempProfile = path.join(os.tmpdir(), `muzen-walker-${Date.now()}`);

  let resolveReport;
  const reportPromise = new Promise(r => resolveReport = r);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
      let content = fs.readFileSync(path.join(__dirname, 'wiki-history-slice.html'), 'utf8');
      const injection = `
        <script>
          function isElementOutOfFlow(el) {
            if (!el || el === document.body || el === document.documentElement) return false;
            const tag = el.tagName;
            if (tag === 'ASIDE') return true;
            const role = el.getAttribute('role');
            if (role === 'navigation' || role === 'complementary') return true;
            try {
              const style = window.getComputedStyle(el);
              if (style.float === 'right' || style.float === 'left') return true;
              if (style.position === 'fixed' || style.position === 'sticky') return true;
            } catch(e) {}
            return false;
          }

          function createFlowTreeWalker(root, allowOutOfFlow) {
            return document.createTreeWalker(
              root,
              NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
              {
                acceptNode(node) {
                  if (node.nodeType === 1) {
                    const tag = node.tagName;
                    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
                    if (!allowOutOfFlow && isElementOutOfFlow(node)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_SKIP;
                  }
                  if (node.nodeType === 3) {
                    if (node.textContent && node.textContent.trim().length > 0) return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_SKIP;
                  }
                  return NodeFilter.FILTER_SKIP;
                }
              }
            );
          }

          window.addEventListener('DOMContentLoaded', () => {
            const h2 = document.getElementById('歷史');
            let h2Text = null;
            for (const child of h2.childNodes) {
              if (child.nodeType === 3 && child.textContent.includes('歷史')) {
                h2Text = child;
                break;
              }
            }

            const walker = createFlowTreeWalker(document.body, false);
            walker.currentNode = h2Text;

            // 往下走一步
            const next1 = walker.nextNode();
            const next1Text = next1 ? next1.textContent.trim() : null;

            // 再往下走一步
            const next2 = walker.nextNode();
            const next2Text = next2 ? next2.textContent.trim() : null;

            // 從 next1 往回走一步
            walker.currentNode = next1;
            const prev1 = walker.previousNode();
            const prev1Text = prev1 ? prev1.textContent.trim() : null;

            fetch('/api/report', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                h2: h2Text ? h2Text.textContent.trim() : null,
                next1Text,
                next2Text,
                prev1Text
              })
            });
          });
        </script>
      `;
      content = content.replace('</body>', `${injection}</body>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    } else if (req.method === 'POST') {
      let b = '';
      req.on('data', c => b += c);
      req.on('end', () => {
        res.writeHead(200);
        res.end('ok');
        resolveReport(JSON.parse(b));
      });
    }
  });

  await new Promise(r => server.listen(4077, '127.0.0.1', r));

  const chromeProc = spawn(browserPath, [
    '--headless=new',
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'http://127.0.0.1:4077/'
  ]);

  const report = await Promise.race([
    reportPromise,
    new Promise(r => setTimeout(() => r({ timeout: true }), 5000))
  ]);

  chromeProc.kill();
  server.close();

  console.log('TREEWALKER REJECT RESULT:', JSON.stringify(report, null, 2));
}

testWalker();
