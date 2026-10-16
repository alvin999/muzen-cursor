// scripts/sync-all-releases.mjs
// 批次同步 CHANGELOG.md 中的所有歷史版本中英文說明至 GitHub Releases

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const token = process.env.GITHUB_TOKEN;
const repoOwner = 'alvin999';
const repoName = 'muzen-cursor';

if (!token) {
  console.error('❌ 缺少 GITHUB_TOKEN 環境變數！');
  process.exit(1);
}

if (!fs.existsSync(changelogPath)) {
  console.error('❌ 未找到 CHANGELOG.md 檔案！');
  process.exit(1);
}

const changelogContent = fs.readFileSync(changelogPath, 'utf8');

function getInstallInstructions(zipName) {
  return [
    '## 📦 安裝指南 / Installation Guide',
    '',
    '### 繁體中文',
    `1. 下載下方 Assets 中的 **\`${zipName}\`** 壓縮檔並解壓縮至本機資料夾。`,
    '2. 開啟 Chromium 核心瀏覽器（Google Chrome、Microsoft Edge、Brave 等）：',
    '   - Chrome：於網址列輸入 `chrome://extensions/`',
    '   - Edge：於網址列輸入 `edge://extensions/`',
    '3. 開啟右上角 **「開發人員模式 (Developer mode)」**。',
    '4. 點選左上角 **「載入未封裝項目 (Load unpacked)」**，選取剛剛解壓縮後的資料夾。',
    '5. 安裝完成！前往任意網頁點擊文字即可開始沉浸式閱讀體驗（快捷鍵 <kbd>Alt</kbd> + <kbd>v</kbd> 可快速切換啟動／凍結）。',
    '',
    '---',
    '',
    '### English',
    `1. Download **\`${zipName}\`** from the Assets section below and extract it to a local folder.`,
    '2. Open your Chromium-based browser (Chrome, Edge, Brave, etc.):',
    '   - Chrome: Navigate to `chrome://extensions/`',
    '   - Edge: Navigate to `edge://extensions/`',
    '3. Enable **"Developer mode"** in the top-right corner.',
    '4. Click **"Load unpacked"** in the top-left corner and select the extracted folder.',
    '5. Ready! Visit any webpage and click on any text to start reading (press <kbd>Alt</kbd> + <kbd>v</kbd> to toggle the cursor).'
  ].join('\n');
}

async function syncReleases() {
  console.log('🚀 開始從 GitHub 取得現有 Releases 列表...');
  const authHeader = token.startsWith('ghp_') || token.startsWith('github_pat_') ? `Bearer ${token}` : `token ${token}`;
  const listRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/releases?per_page=50`, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Muzen-Sync-Script'
    }
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    console.error(`❌ 無法取得 releases: HTTP ${listRes.status} - ${errText}`);
    process.exit(1);
  }

  const releases = await listRes.json();
  console.log(`📦 總計找到 ${releases.length} 個 Releases。開始逐一比對並更新 Changelog...\n`);

  for (const rel of releases) {
    const tagName = rel.tag_name;
    const versionNum = tagName.replace(/^v/, '').trim();
    const zipName = `muzen-cursor-${tagName}.zip`;

    // 搜尋 CHANGELOG.md 中對應版本的段落
    const regex = new RegExp(
      `##\\s*\\[v?${versionNum.replace(/\\./g, '\\.')}\\][\\s\\S]*?(?=\\n##\\s*\\[|$)`,
      'i'
    );
    const match = changelogContent.match(regex);

    if (!match) {
      console.warn(`⚠️ [${tagName}] 未在 CHANGELOG.md 找到對應更新說明，略過。`);
      continue;
    }

    const versionChangelog = match[0].trim();

    // 組合完整的 Release Body
    const newBody = `${versionChangelog}\n\n---\n\n${getInstallInstructions(zipName)}`;

    console.log(`⏳ 正在更新 [${tagName}] (Release ID: ${rel.id})...`);

    const patchRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/releases/${rel.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Muzen-Sync-Script',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: newBody
      })
    });

    if (patchRes.ok) {
      console.log(`✅ [${tagName}] 更新成功！`);
    } else {
      const err = await patchRes.text();
      console.error(`❌ [${tagName}] 更新失敗: HTTP ${patchRes.status} - ${err}`);
    }

    // 避免打到 GitHub API secondary rate limit
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n🎉 所有歷史版本 Release Changelog 同步作業完成！');
}

syncReleases().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
