// scripts/extract-changelog.mjs
// 從 CHANGELOG.md 提取當前版本的更新說明並生成 GitHub Release 內文

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const outputPath = path.join(rootDir, 'RELEASE_BODY.md');

// 取得目標版本號 (預設自命令列參數或環境變數取得，去除前導 'v')
const rawVersion = process.argv[2] || process.env.VERSION || 'v0.1.8';
const versionNumber = rawVersion.replace(/^v/, '').trim();
const zipName = `muzen-cursor-v${versionNumber}.zip`;

console.log(`[Extract Changelog] 目標版本: ${rawVersion} (純版本號: ${versionNumber})`);

if (!fs.existsSync(changelogPath)) {
  console.warn('[Extract Changelog] 未找到 CHANGELOG.md，使用基礎說明。');
  writeFallbackReleaseBody();
  process.exit(0);
}

const changelogContent = fs.readFileSync(changelogPath, 'utf8');

// 正規表達式搜尋對應版本的章節段落: ## [v?0.1.8] ... 直到下一個 ## [ 或檔案結尾
const versionRegex = new RegExp(
  `##\\s*\\[v?${versionNumber.replace(/\\./g, '\\.')}\\][\\s\\S]*?(?=\\n##\\s*\\[|$)`,
  'i'
);

const match = changelogContent.match(versionRegex);
let versionChangelog = '';

if (match && match[0].trim()) {
  versionChangelog = match[0].trim();
  console.log(`[Extract Changelog] 成功擷取版本 [${rawVersion}] 之變更紀錄 (${versionChangelog.length} 字元)`);
} else {
  console.warn(`[Extract Changelog] 未在 CHANGELOG.md 中找到 [${rawVersion}] 的標題，嘗試擷取最新版本章節...`);
  const latestMatch = changelogContent.match(/##\s*\[v?[0-9.]+\][\s\S]*?(?=\n##\s*\[|$)/i);
  if (latestMatch) {
    versionChangelog = latestMatch[0].trim();
  }
}

// 組合完整的 GitHub Release Body (Changelog + 安裝指南)
const releaseBody = `
${versionChangelog}

---

## 📦 安裝指南 / Installation Guide

### 繁體中文
1. 下載下方 Assets 中的 **\`${zipName}\`** 壓縮檔並解壓縮至本機資料夾。
2. 開啟 Chromium 核心瀏覽器（Google Chrome、Microsoft Edge、Brave 等）：
   - Chrome：於網址列輸入 \`chrome://extensions/\`
   - Edge：於網址列輸入 \`edge://extensions/\`
3. 開啟右上角 **「開發人員模式 (Developer mode)」**。
4. 點選左上角 **「載入未封裝項目 (Load unpacked)」**，選取剛剛解壓縮後的資料夾。
5. 安裝完成！前往任意網頁點擊文字即可開始沉浸式閱讀體驗（快捷鍵 <kbd>Alt</kbd> + <kbd>v</kbd> 可快速切換啟動／凍結）。

---

### English
1. Download **\`${zipName}\`** from the Assets section below and extract it to a local folder.
2. Open your Chromium-based browser (Chrome, Edge, Brave, etc.):
   - Chrome: Navigate to \`chrome://extensions/\`
   - Edge: Navigate to \`edge://extensions/\`
3. Enable **"Developer mode"** in the top-right corner.
4. Click **"Load unpacked"** in the top-left corner and select the extracted folder.
5. Ready! Visit any webpage and click on any text to start reading (press <kbd>Alt</kbd> + <kbd>v</kbd> to toggle the cursor).
`.trim();

fs.writeFileSync(outputPath, releaseBody, 'utf8');
console.log(`[Extract Changelog] 已生成完整發布內文至: ${outputPath}`);

function writeFallbackReleaseBody() {
  const fallback = `
## Release ${rawVersion}

請參閱專案更新紀錄或 commits 列表以獲取詳細改動。
Please refer to commit history or CHANGELOG.md for details.
  `.trim();
  fs.writeFileSync(outputPath, fallback, 'utf8');
}
