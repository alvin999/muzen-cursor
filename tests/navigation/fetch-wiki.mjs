import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function fetchWikiTaiwan() {
  console.log('正在從中文維基百科下載真實「臺灣」完整條目...');
  const res = await fetch('https://zh.wikipedia.org/wiki/%E8%87%BA%E7%81%A3');
  let html = await res.text();

  if (!html.includes('1911年的日本地圖，其中包括臺灣')) {
    throw new Error('下載的內容中未找到「1911年的日本地圖，其中包括臺灣」！');
  }

  // 補齊可能存在的協議相對連結，確保本地離線/內網環境也能良好渲染
  html = html.replace(/href="\/\//g, 'href="https://');
  html = html.replace(/src="\/\//g, 'src="https://');

  const destPath = path.join(__dirname, 'wiki-taiwan.html');
  fs.writeFileSync(destPath, html, 'utf8');
  console.log(`✅ 成功下載並保存真實條目至 ${destPath} (檔案大小: ${(html.length / 1024).toFixed(1)} KB)`);
}

fetchWikiTaiwan().catch(err => {
  console.error('❌ 下載失敗:', err);
  process.exit(1);
});
