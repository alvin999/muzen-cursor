import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, '../public/images');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// -------------------------------------------------------------
// 共用字型與視窗外框 (嚴格遵守 XML 規範，字型全部使用單引號避免屬性解析錯誤)
// -------------------------------------------------------------
const COMMON_FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', sans-serif`;
const MONO_FONT = `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace`;

function renderWindowFrame({ width, height, title, url }) {
  return `
    <!-- 視窗底色與外框陰影 -->
    <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="14" fill="#1d2021" stroke="#3c3836" stroke-width="1.5" filter="url(#window-shadow)" />

    <!-- 視窗標題列 -->
    <rect x="10" y="10" width="${width - 20}" height="44" rx="14" fill="#282828" />
    <rect x="10" y="40" width="${width - 20}" height="14" fill="#282828" />
    <line x1="10" y1="54" x2="${width - 10}" y2="54" stroke="#3c3836" stroke-width="1" />

    <!-- macOS 紅黃綠三圓點 -->
    <circle cx="36" cy="32" r="6" fill="#fb4934" />
    <circle cx="56" cy="32" r="6" fill="#fabd2f" />
    <circle cx="76" cy="32" r="6" fill="#b8bb26" />

    <!-- 模擬網址列 -->
    <rect x="110" y="20" width="${width - 240}" height="24" rx="6" fill="#1d2021" stroke="#504945" stroke-width="1" />
    <text x="125" y="36" fill="#a89984" font-family="${MONO_FONT}" font-size="11">🔒 ${url}</text>

    <!-- 視窗右側外觀標籤 -->
    <rect x="${width - 115}" y="22" width="95" height="20" rx="4" fill="#3c3836" />
    <text x="${width - 68}" y="36" fill="#d5c4a1" font-family="${COMMON_FONT}" font-size="11" text-anchor="middle" font-weight="600">MUZEN VIM</text>
  `;
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// 圖 1: 極速選詞 × 劃詞翻譯 (先按 v 觸發選取 ➔ 按 w 跳詞 ➔ 出現翻譯畫面)
// -------------------------------------------------------------
function generateTranslationSvg() {
  const width = 880;
  const height = 480;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="window-shadow" x="0" y="0" width="${width}" height="${height}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    <filter id="cursor-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#fe8019" flood-opacity="0.8"/>
    </filter>
    <filter id="cursor-glow-gold" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#fabd2f" flood-opacity="0.8"/>
    </filter>
    <linearGradient id="card-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#282828"/>
      <stop offset="100%" stop-color="#1d2021"/>
    </linearGradient>

    <style>
      /* ====================================================
         三階段動態影格 (8.5 秒完整心流循環):
         0% ~ 12% : NORMAL 靜態閱讀 (停在單字開頭 s)
         13% ~ 21%: 第一步：按 v 觸發選取 (VISUAL 啟動，首字選取)
         23% ~ 32%: 第二步：按 w 智慧跳詞 (選取範圍平滑展開至詞尾)
         35% ~ 82%: 第三步：觸發原生選取 ➔ 彈出翻譯字典畫面！
         85% ~ 100%: 閱畢淡出並重置歸位
         ==================================================== */

      /* 第 1 步: v 按鍵閃亮 */
      @keyframes keyPressV {
        0%, 11%  { fill: #3c3836; stroke: #504945; transform: scale(1); }
        13%, 18% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.93); filter: drop-shadow(0 0 6px #fabd2f); }
        20%, 100%{ fill: #3c3836; stroke: #504945; transform: scale(1); filter: none; }
      }
      @keyframes keyTextV {
        0%, 11%  { fill: #fabd2f; }
        13%, 18% { fill: #1d2021; font-weight: 800; }
        20%, 100%{ fill: #fabd2f; }
      }

      /* 第 2 步: w 按鍵閃亮 */
      @keyframes keyPressW {
        0%, 22%  { fill: #3c3836; stroke: #504945; transform: scale(1); }
        24%, 30% { fill: #fe8019; stroke: #fe8019; transform: scale(0.93); filter: drop-shadow(0 0 6px #fe8019); }
        32%, 100%{ fill: #3c3836; stroke: #504945; transform: scale(1); filter: none; }
      }
      @keyframes keyTextW {
        0%, 22%  { fill: #fe8019; }
        24%, 30% { fill: #1d2021; font-weight: 800; }
        32%, 100%{ fill: #fe8019; }
      }

      /* 選取高亮框平滑展開 (從無 ➔ 首字 s ➔ 整個單詞 serendipitous) */
      @keyframes selectionExpansion {
        0%, 12%  { width: 0px; opacity: 0; }
        14%, 23% { width: 14px; opacity: 1; }
        26%, 83% { width: 114px; opacity: 1; }
        87%, 100%{ width: 114px; opacity: 0; }
      }

      /* 游標位移 (NORMAL 在首字 ➔ VISUAL 按 w 跳至詞尾) */
      @keyframes cursorStepMotion {
        0%, 23%  { transform: translateX(0px); }
        26%, 83% { transform: translateX(101px); }
        87%, 100%{ transform: translateX(0px); }
      }
      @keyframes cursorColorChange {
        0%, 12%  { fill: #fe8019; }
        14%, 84% { fill: #fabd2f; }
        86%, 100%{ fill: #fe8019; }
      }

      /* 第 3 步: 翻譯卡片在選取完成後彈出 */
      @keyframes popupCardAppear {
        0%, 33%  { opacity: 0; transform: translateY(14px) scale(0.96); pointer-events: none; }
        37%      { opacity: 1; transform: translateY(-2px) scale(1.02); }
        40%, 82% { opacity: 1; transform: translateY(0px) scale(1); }
        86%, 100%{ opacity: 0; transform: translateY(-8px) scale(0.98); }
      }

      /* 狀態列模式切換 (NORMAL ⟷ VISUAL) */
      @keyframes statusNormalSwitch {
        0%, 12%  { opacity: 1; }
        14%, 84% { opacity: 0; }
        86%, 100%{ opacity: 1; }
      }
      @keyframes statusVisualSwitch {
        0%, 12%  { opacity: 0; }
        14%, 84% { opacity: 1; }
        86%, 100%{ opacity: 0; }
      }

      /* 底部 Banner 翻譯按鈕高亮提示 */
      @keyframes bannerTransGlow {
        0%, 33%  { fill: #b8bb26; fill-opacity: 0.12; stroke: #b8bb26; stroke-width: 0.8; filter: none; }
        36%, 82% { fill: #b8bb26; fill-opacity: 0.35; stroke: #b8bb26; stroke-width: 1.5; filter: drop-shadow(0 0 6px rgba(184, 187, 38, 0.6)); }
        85%, 100%{ fill: #b8bb26; fill-opacity: 0.12; stroke: #b8bb26; stroke-width: 0.8; filter: none; }
      }

      .anim-key-rect-v { animation: keyPressV 8.5s ease-in-out infinite; transform-origin: center; }
      .anim-key-text-v { animation: keyTextV 8.5s ease-in-out infinite; }
      .anim-key-rect-w { animation: keyPressW 8.5s ease-in-out infinite; transform-origin: center; }
      .anim-key-text-w { animation: keyTextW 8.5s ease-in-out infinite; }
      .anim-selection  { animation: selectionExpansion 8.5s cubic-bezier(0.25, 1, 0.5, 1) infinite; }
      .anim-cursor-pos { animation: cursorStepMotion 8.5s cubic-bezier(0.25, 1, 0.5, 1) infinite; }
      .anim-cursor-col { animation: cursorColorChange 8.5s ease-in-out infinite; }
      .anim-popup      { animation: popupCardAppear 8.5s cubic-bezier(0.25, 1, 0.5, 1) infinite; transform-origin: top center; }
      .anim-status-norm{ animation: statusNormalSwitch 8.5s steps(1) infinite; }
      .anim-status-vis { animation: statusVisualSwitch 8.5s steps(1) infinite; }
      .anim-banner-pop { animation: bannerTransGlow 8.5s ease-in-out infinite; }
    </style>
  </defs>

  ${renderWindowFrame({
    width,
    height,
    title: 'Serendipity - Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Serendipity'
  })}

  <!-- 內容區 -->
  <g transform="translate(48, 86)">
    <!-- 標題 -->
    <text x="0" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="24" font-weight="700">Serendipity &amp; Scientific Discovery</text>
    <text x="0" y="48" fill="#928374" font-family="${COMMON_FONT}" font-size="13">From Wikipedia, the free encyclopedia</text>
    <line x1="0" y1="62" x2="784" y2="62" stroke="#3c3836" stroke-width="1" />

    <!-- 內文段落 -->
    <text x="0" y="100" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="16" letter-spacing="0.3">
      Serendipity is an unplanned, fortunate discovery. In the history of science and literature,
    </text>

    <!-- 目標句子 -->
    <text x="0" y="138" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="16" letter-spacing="0.3">many revolutionary ideas emerged from </text>

    <!-- 動態展開之選取高亮框 (Gruvbox Visual Gold) -->
    <rect class="anim-selection" x="290" y="118" height="26" rx="3" fill="#fabd2f" fill-opacity="0.32" stroke="#fabd2f" stroke-width="1.2" />

    <!-- 被選取的單詞文字 (保持清晰可見) -->
    <text x="294" y="138" fill="#fbf1c7" font-family="${COMMON_FONT}" font-size="16" font-weight="600" letter-spacing="0.3">serendipitous</text>

    <!-- 覆蓋於字元上的動態游標方塊 (伴隨按 w 平滑位移至詞尾) -->
    <g class="anim-cursor-pos">
      <rect class="anim-cursor-col" x="290" y="118" width="13" height="26" rx="2" fill-opacity="0.8" filter="url(#cursor-glow)" />
      <text x="294" y="138" fill="#282828" font-family="${COMMON_FONT}" font-size="16" font-weight="700">s</text>
    </g>

    <text x="408" y="138" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="16" letter-spacing="0.3"> observations, enabling thinkers to connect</text>
    <text x="0" y="176" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="16" letter-spacing="0.3">previously unrelated clues into profound breakthroughs.</text>

    <!-- ==================================================== -->
    <!-- 劃詞翻譯懸浮彈窗 (第三階段：選詞完畢後平滑彈出) -->
    <!-- ==================================================== -->
    <g transform="translate(230, 156)" filter="url(#card-shadow)">
      <g class="anim-popup">
        <rect x="0" y="0" width="370" height="152" rx="10" fill="url(#card-grad)" stroke="#665c54" stroke-width="1.2" />

        <!-- 頂部單字發音與詞性列 -->
        <circle cx="24" cy="26" r="10" fill="#3c3836" />
        <path d="M21 23 L24 23 L27 20 L27 32 L24 29 L21 29 Z" fill="#fabd2f" />

        <text x="42" y="30" fill="#fe8019" font-family="${COMMON_FONT}" font-size="16" font-weight="700">serendipitous</text>
        <text x="165" y="30" fill="#a89984" font-family="${MONO_FONT}" font-size="13">/ˌserənˈdɪpətəs/</text>

        <rect x="306" y="16" width="46" height="20" rx="4" fill="#b8bb26" fill-opacity="0.2" stroke="#b8bb26" stroke-width="0.8" />
        <text x="329" y="30" fill="#b8bb26" font-family="${COMMON_FONT}" font-size="11" text-anchor="middle" font-weight="600">adj.</text>

        <line x1="16" y1="46" x2="354" y2="46" stroke="#3c3836" stroke-width="1" />

        <!-- 翻譯主體釋義 -->
        <text x="18" y="70" fill="#fbf1c7" font-family="${COMMON_FONT}" font-size="14" font-weight="600">1. 機緣湊巧的；偶然發現的；意外獲得的</text>
        <text x="18" y="94" fill="#d5c4a1" font-family="${COMMON_FONT}" font-size="13">2. 善於意外發掘新奇事物的能力</text>

        <!-- 底部相容性提示 -->
        <rect x="0" y="118" width="370" height="34" rx="0" fill="#1d2021" />
        <line x1="0" y1="118" x2="370" y2="118" stroke="#3c3836" stroke-width="1" />
        <text x="18" y="139" fill="#83a598" font-family="${COMMON_FONT}" font-size="11">✨ 原生選取連動 ➔ 相容 Saladict、沉浸式翻譯、Google 翻譯</text>
      </g>
    </g>

    <!-- 右下角狀態列 (支援 NORMAL ⟷ VISUAL 動態熱切換) -->
    <g transform="translate(605, 240)">
      <rect x="0" y="0" width="178" height="28" rx="6" fill="#282828" stroke="#504945" stroke-width="1" />
      
      <!-- NORMAL 狀態 -->
      <g class="anim-status-norm">
        <circle cx="14" cy="14" r="4" fill="#b8bb26" />
        <text x="24" y="18" fill="#b8bb26" font-family="${MONO_FONT}" font-size="11" font-weight="700">NORMAL</text>
        <text x="82" y="18" fill="#a89984" font-family="${MONO_FONT}" font-size="11">[2:42]</text>
        <text x="134" y="18" fill="#83a598" font-family="${MONO_FONT}" font-size="11">Top 18%</text>
      </g>

      <!-- VISUAL 狀態 (按 v 後點亮) -->
      <g class="anim-status-vis">
        <circle cx="14" cy="14" r="4" fill="#fabd2f" />
        <text x="24" y="18" fill="#fabd2f" font-family="${MONO_FONT}" font-size="11" font-weight="700">VISUAL</text>
        <text x="76" y="18" fill="#fabd2f" font-family="${MONO_FONT}" font-size="11">[Word Sel]</text>
        <text x="142" y="18" fill="#83a598" font-family="${MONO_FONT}" font-size="11">18%</text>
      </g>
    </g>
  </g>

  <!-- ==================================================== -->
  <!-- 底部操作提示導引 (嚴格對齊操作順序: v ➔ w ➔ 彈出翻譯) -->
  <!-- ==================================================== -->
  <g transform="translate(48, 420)">
    <rect x="0" y="0" width="784" height="40" rx="8" fill="#282828" stroke="#3c3836" stroke-width="1" />

    <!-- 步驟 1: 按 v 觸發選取 -->
    <rect class="anim-key-rect-v" x="16" y="8" width="28" height="24" rx="4" fill="#3c3836" stroke="#504945" stroke-width="1" />
    <text class="anim-key-text-v" x="30" y="24" fill="#fabd2f" font-family="${MONO_FONT}" font-size="13" font-weight="700" text-anchor="middle">v</text>
    <text x="52" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="13" font-weight="600">1. 觸發選取</text>

    <!-- 箭頭 -->
    <text x="130" y="24" fill="#665c54" font-family="${COMMON_FONT}" font-size="14">➔</text>

    <!-- 步驟 2: 按 w 智慧跳詞 -->
    <rect class="anim-key-rect-w" x="152" y="8" width="28" height="24" rx="4" fill="#3c3836" stroke="#504945" stroke-width="1" />
    <text class="anim-key-text-w" x="166" y="24" fill="#fe8019" font-family="${MONO_FONT}" font-size="13" font-weight="700" text-anchor="middle">w</text>
    <text x="188" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="13" font-weight="600">2. 智慧跳詞</text>

    <!-- 箭頭 -->
    <text x="268" y="24" fill="#665c54" font-family="${COMMON_FONT}" font-size="14">➔</text>

    <!-- 步驟 3: 出現翻譯卡片 -->
    <rect class="anim-banner-pop" x="290" y="8" width="80" height="24" rx="4" fill="#b8bb26" fill-opacity="0.2" stroke="#b8bb26" stroke-width="1" />
    <text x="330" y="24" fill="#b8bb26" font-family="${COMMON_FONT}" font-size="12" font-weight="700" text-anchor="middle">3. 自動翻譯</text>
    <text x="382" y="24" fill="#fbf1c7" font-family="${COMMON_FONT}" font-size="13">即刻彈出釋義字典，雙手全神貫注鍵盤</text>
  </g>
</svg>`;
}

// -------------------------------------------------------------
// 圖 2: 鍵盤流瞬間選取與複製 Yank (demo-visual-yank.svg)
// -------------------------------------------------------------
function generateVisualYankSvg() {
  const width = 880;
  const height = 480;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="window-shadow-2" x="0" y="0" width="${width}" height="${height}" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <filter id="toast-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    <filter id="cursor-glow-gold" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#fabd2f" flood-opacity="0.8"/>
    </filter>

    <style>
      /* ====================================================
         YANK 複製三階段動態影格 (8.5 秒心流循環):
         0% ~ 12% : NORMAL 模式 (游標在第 14 行行首)
         13% ~ 21%: 第一步：按 v 進入視覺模式 (第 14 行單行選取)
         23% ~ 32%: 第二步：按 j 擴展選取範圍 (選取框平滑下展覆蓋 14~16 行)
         35% ~ 82%: 第三步：按 y 瞬間複製 ➔ 彈出 Toast 成功提示卡片！
         85% ~ 100%: 閱畢淡出並重置歸位
         ==================================================== */

      /* 第 1 步: v 鍵發光 */
      @keyframes keyPressYankV {
        0%, 11%  { fill: #3c3836; stroke: #504945; transform: scale(1); }
        13%, 18% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.93); filter: drop-shadow(0 0 6px #fabd2f); }
        20%, 100%{ fill: #3c3836; stroke: #504945; transform: scale(1); filter: none; }
      }
      @keyframes keyTextYankV {
        0%, 11%  { fill: #fabd2f; }
        13%, 18% { fill: #1d2021; font-weight: 800; }
        20%, 100%{ fill: #fabd2f; }
      }

      /* 第 2 步: j 鍵發光 */
      @keyframes keyPressYankJ {
        0%, 22%  { fill: #3c3836; stroke: #504945; transform: scale(1); }
        24%, 30% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.93); filter: drop-shadow(0 0 6px #fabd2f); }
        32%, 100%{ fill: #3c3836; stroke: #504945; transform: scale(1); filter: none; }
      }
      @keyframes keyTextYankJ {
        0%, 22%  { fill: #fabd2f; }
        24%, 30% { fill: #1d2021; font-weight: 800; }
        32%, 100%{ fill: #fabd2f; }
      }

      /* 第 3 步: y 鍵發光 (瞬間 Yank) */
      @keyframes keyPressYankY {
        0%, 33%  { fill: #3c3836; stroke: #504945; transform: scale(1); }
        35%, 41% { fill: #b8bb26; stroke: #b8bb26; transform: scale(0.93); filter: drop-shadow(0 0 8px #b8bb26); }
        43%, 100%{ fill: #3c3836; stroke: #504945; transform: scale(1); filter: none; }
      }
      @keyframes keyTextYankY {
        0%, 33%  { fill: #b8bb26; }
        35%, 41% { fill: #1d2021; font-weight: 800; }
        43%, 100%{ fill: #b8bb26; }
      }

      /* 選取高亮框高度展開 (從無 ➔ 第 14 行 ➔ 覆蓋第 14~16 行) */
      @keyframes selectionYankExpand {
        0%, 12%  { height: 0px; opacity: 0; }
        14%, 23% { height: 26px; opacity: 1; }
        26%, 83% { height: 78px; opacity: 1; }
        87%, 100%{ height: 78px; opacity: 0; }
      }

      /* 游標位移 (NORMAL 在 14 行 ➔ 按 j 下移至 16 行) */
      @keyframes cursorYankMotion {
        0%, 23%  { transform: translateY(0px); }
        26%, 83% { transform: translateY(52px); }
        87%, 100%{ transform: translateY(0px); }
      }
      @keyframes cursorYankColor {
        0%, 12%  { fill: #fe8019; }
        14%, 84% { fill: #fabd2f; }
        86%, 100%{ fill: #fe8019; }
      }

      /* 第 3 步: 成功 Toast 卡片在按下 y 後彈出 */
      @keyframes toastAppear {
        0%, 34%  { opacity: 0; transform: translateY(14px) scale(0.95); pointer-events: none; }
        38%      { opacity: 1; transform: translateY(-2px) scale(1.02); }
        41%, 82% { opacity: 1; transform: translateY(0px) scale(1); }
        86%, 100%{ opacity: 0; transform: translateY(-8px) scale(0.98); }
      }

      /* 狀態列模式切換 (NORMAL ⟷ VISUAL LINE) */
      @keyframes statusNormalYank {
        0%, 12%  { opacity: 1; }
        14%, 84% { opacity: 0; }
        86%, 100%{ opacity: 1; }
      }
      @keyframes statusVisualYank {
        0%, 12%  { opacity: 0; }
        14%, 84% { opacity: 1; }
        86%, 100%{ opacity: 0; }
      }

      /* 底部 Banner 提示效果 */
      @keyframes bannerYankGlow {
        0%, 33%  { fill: #b8bb26; fill-opacity: 0.12; stroke: #b8bb26; stroke-width: 0.8; filter: none; }
        36%, 82% { fill: #b8bb26; fill-opacity: 0.35; stroke: #b8bb26; stroke-width: 1.5; filter: drop-shadow(0 0 6px rgba(184, 187, 38, 0.6)); }
        85%, 100%{ fill: #b8bb26; fill-opacity: 0.12; stroke: #b8bb26; stroke-width: 0.8; filter: none; }
      }

      .anim-yank-key-v   { animation: keyPressYankV 8.5s ease-in-out infinite; transform-origin: center; }
      .anim-yank-text-v  { animation: keyTextYankV 8.5s ease-in-out infinite; }
      .anim-yank-key-j   { animation: keyPressYankJ 8.5s ease-in-out infinite; transform-origin: center; }
      .anim-yank-text-j  { animation: keyTextYankJ 8.5s ease-in-out infinite; }
      .anim-yank-key-y   { animation: keyPressYankY 8.5s ease-in-out infinite; transform-origin: center; }
      .anim-yank-text-y  { animation: keyTextYankY 8.5s ease-in-out infinite; }
      .anim-yank-select  { animation: selectionYankExpand 8.5s cubic-bezier(0.25, 1, 0.5, 1) infinite; }
      .anim-yank-cursor  { animation: cursorYankMotion 8.5s cubic-bezier(0.25, 1, 0.5, 1) infinite; }
      .anim-yank-curcol  { animation: cursorYankColor 8.5s ease-in-out infinite; }
      .anim-yank-toast   { animation: toastAppear 8.5s cubic-bezier(0.25, 1, 0.5, 1) infinite; transform-origin: top center; }
      .anim-yank-stat-n  { animation: statusNormalYank 8.5s steps(1) infinite; }
      .anim-yank-stat-v  { animation: statusVisualYank 8.5s steps(1) infinite; }
      .anim-yank-banner-y{ animation: bannerYankGlow 8.5s ease-in-out infinite; }
    </style>
  </defs>

  ${renderWindowFrame({
    width,
    height,
    title: 'Developer Documentation - Muzen Core',
    url: 'https://docs.muzen.dev/guide/configuration'
  })}

  <!-- 內容區: 程式碼/技術文件閱讀場景 -->
  <g transform="translate(48, 86)">
    <text x="0" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="24" font-weight="700">Quick Configuration</text>
    <text x="0" y="48" fill="#a89984" font-family="${COMMON_FONT}" font-size="13">Copy the configuration block directly into your project setup</text>
    <line x1="0" y1="62" x2="784" y2="62" stroke="#3c3836" stroke-width="1" />

    <!-- 程式碼視窗容器 -->
    <rect x="0" y="80" width="784" height="230" rx="8" fill="#1d2021" stroke="#3c3836" stroke-width="1" />

    <!-- 行號區域 -->
    <g font-family="${MONO_FONT}" font-size="14" fill="#7c6f64" text-anchor="end">
      <text x="36" y="112">12</text>
      <text x="36" y="138">13</text>
      <text x="36" y="164">14</text>
      <text x="36" y="190">15</text>
      <text x="36" y="216">16</text>
      <text x="36" y="242">17</text>
      <text x="36" y="268">18</text>
    </g>
    <line x1="48" y1="80" x2="48" y2="310" stroke="#3c3836" stroke-width="1" />

    <!-- 程式碼內容 -->
    <g font-family="${MONO_FONT}" font-size="14">
      <text x="64" y="112" fill="#928374">// Muzen Cursor Advanced Setup</text>

      <text x="64" y="138">
        <tspan fill="#fb4934">import</tspan> <tspan fill="#ebdbb2">{</tspan> <tspan fill="#83a598">createMuzenEngine</tspan> <tspan fill="#ebdbb2">}</tspan> <tspan fill="#fb4934">from</tspan> <tspan fill="#b8bb26">'muzen-cursor'</tspan><tspan fill="#ebdbb2">;</tspan>
      </text>

      <!-- VISUAL 模式選取區域背景 (動態由第 14 行展開覆蓋至第 16 行) -->
      <rect class="anim-yank-select" x="56" y="148" width="560" rx="4" fill="#fabd2f" fill-opacity="0.18" stroke="#fabd2f" stroke-width="1" stroke-dasharray="4 4" />

      <text x="64" y="164">
        <tspan fill="#fb4934">export const</tspan> <tspan fill="#fabd2f" font-weight="700">userConfig</tspan> <tspan fill="#ebdbb2">= {</tspan>
      </text>

      <text x="64" y="190">
        <tspan fill="#ebdbb2">  theme: </tspan><tspan fill="#b8bb26">'gruvbox-dark'</tspan><tspan fill="#ebdbb2">, shape: </tspan><tspan fill="#b8bb26">'block'</tspan><tspan fill="#ebdbb2">, smooth: </tspan><tspan fill="#d3869b">true</tspan><tspan fill="#ebdbb2">,</tspan>
      </text>

      <text x="64" y="216">
        <tspan fill="#ebdbb2">  cjkSmartSegmenter: </tspan><tspan fill="#d3869b">true</tspan><tspan fill="#ebdbb2">, breathePulse: </tspan><tspan fill="#d3869b">true</tspan>
      </text>

      <!-- 動態游標 (按 j 時平滑下移至第 16 行詞尾) -->
      <g class="anim-yank-cursor">
        <rect class="anim-yank-curcol" x="456" y="150" width="10" height="20" rx="2" filter="url(#cursor-glow-gold)" />
      </g>

      <text x="64" y="242" fill="#ebdbb2">};</text>

      <text x="64" y="268">
        <tspan fill="#83a598">createMuzenEngine</tspan><tspan fill="#ebdbb2">(userConfig);</tspan>
      </text>
    </g>

    <!-- ==================================================== -->
    <!-- 浮動成功提示 (第三階段：按下 y 後彈出 Toast 卡片) -->
    <!-- ==================================================== -->
    <g transform="translate(490, 95)" filter="url(#toast-shadow)">
      <g class="anim-yank-toast">
        <rect x="0" y="0" width="270" height="48" rx="8" fill="#282828" stroke="#b8bb26" stroke-width="1.5" />
        <circle cx="26" cy="24" r="12" fill="#b8bb26" fill-opacity="0.2" />
        <path d="M20 24 L24 28 L32 19" stroke="#b8bb26" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <text x="48" y="22" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="13" font-weight="700">3 行代碼已複製 (Yanked)</text>
        <text x="48" y="38" fill="#a89984" font-family="${MONO_FONT}" font-size="11">Copied to system clipboard!</text>
      </g>
    </g>

    <!-- 右下角狀態列 (支援 NORMAL ⟷ VISUAL LINE 動態熱切換) -->
    <g transform="translate(595, 270)">
      <rect x="0" y="0" width="175" height="28" rx="6" fill="#282828" stroke="#504945" stroke-width="1" />
      
      <!-- NORMAL 狀態 -->
      <g class="anim-yank-stat-n">
        <circle cx="14" cy="14" r="4" fill="#b8bb26" />
        <text x="24" y="18" fill="#b8bb26" font-family="${MONO_FONT}" font-size="11" font-weight="700">NORMAL</text>
        <text x="82" y="18" fill="#a89984" font-family="${MONO_FONT}" font-size="11">[Line 14]</text>
      </g>

      <!-- VISUAL LINE 狀態 (按 v ➔ j 後啟動) -->
      <g class="anim-yank-stat-v">
        <circle cx="14" cy="14" r="4" fill="#fabd2f" />
        <text x="24" y="18" fill="#fabd2f" font-family="${MONO_FONT}" font-size="11" font-weight="700">VISUAL LINE</text>
        <text x="108" y="18" fill="#fabd2f" font-family="${MONO_FONT}" font-size="11">[14-16]</text>
      </g>
    </g>
  </g>

  <!-- ==================================================== -->
  <!-- 底部操作提示導引 (嚴格對齊操作順序: v ➔ j ➔ y 複製) -->
  <!-- ==================================================== -->
  <g transform="translate(48, 420)">
    <rect x="0" y="0" width="784" height="40" rx="8" fill="#282828" stroke="#3c3836" stroke-width="1" />

    <!-- 步驟 1: 按 v 進入選取 -->
    <rect class="anim-yank-key-v" x="16" y="8" width="28" height="24" rx="4" fill="#3c3836" stroke="#504945" stroke-width="1" />
    <text class="anim-yank-text-v" x="30" y="24" fill="#fabd2f" font-family="${MONO_FONT}" font-size="13" font-weight="700" text-anchor="middle">v</text>
    <text x="52" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="13" font-weight="600">1. 進入選取</text>

    <!-- 箭頭 -->
    <text x="130" y="24" fill="#665c54" font-family="${COMMON_FONT}" font-size="14">➔</text>

    <!-- 步驟 2: 按 j 擴展範圍 -->
    <rect class="anim-yank-key-j" x="152" y="8" width="46" height="24" rx="4" fill="#3c3836" stroke="#504945" stroke-width="1" />
    <text class="anim-yank-text-j" x="175" y="24" fill="#fabd2f" font-family="${MONO_FONT}" font-size="13" font-weight="700" text-anchor="middle">j / $</text>
    <text x="206" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="13" font-weight="600">2. 整行擴展</text>

    <!-- 箭頭 -->
    <text x="286" y="24" fill="#665c54" font-family="${COMMON_FONT}" font-size="14">➔</text>

    <!-- 步驟 3: 按 y 瞬間複製 (Yank) -->
    <rect class="anim-yank-key-y" x="308" y="8" width="28" height="24" rx="4" fill="#3c3836" stroke="#504945" stroke-width="1" />
    <text class="anim-yank-text-y" x="322" y="24" fill="#b8bb26" font-family="${MONO_FONT}" font-size="13" font-weight="700" text-anchor="middle">y</text>
    <text x="344" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="13" font-weight="600">3. 瞬間複製 (Yank)</text>
    
    <text x="510" y="24" fill="#928374" font-family="${COMMON_FONT}" font-size="12">自動寫入系統剪貼簿，告別滑鼠拖曳手抖</text>
  </g>
</svg>`;
}

// -------------------------------------------------------------
// 圖 3: h / l 字元級平滑移動與游標精準覆蓋 (demo-reading-anchor.svg)
// -------------------------------------------------------------
function generateReadingAnchorSvg() {
  const width = 880;
  const height = 480;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="window-shadow-3" x="0" y="0" width="${width}" height="${height}" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <filter id="anchor-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#fe8019" flood-opacity="0.8"/>
    </filter>

    <style>
      /* ====================================================
         h / l 游標水平字元位移關鍵影格 (8 秒循環: 向右 l ➔ 向左 h)
         每次移動正好橫跨 22px，精準套在每一個字元正上方！
         ==================================================== */
      @keyframes cursorHLMove {
        /* 向右逐字推進 (l) */
        0%, 4%   { transform: translateX(0px); }
        7%, 10%  { transform: translateX(22px); }
        13%, 16% { transform: translateX(44px); }
        19%, 22% { transform: translateX(66px); }
        25%, 28% { transform: translateX(88px); }
        31%, 34% { transform: translateX(110px); }
        37%, 40% { transform: translateX(132px); }
        43%, 50% { transform: translateX(154px); }

        /* 向左逐字回移 (h) */
        53%, 56% { transform: translateX(132px); }
        59%, 62% { transform: translateX(110px); }
        65%, 68% { transform: translateX(88px); }
        71%, 74% { transform: translateX(66px); }
        77%, 80% { transform: translateX(44px); }
        83%, 86% { transform: translateX(22px); }
        89%, 96% { transform: translateX(0px); }
        98%, 100%{ transform: translateX(0px); }
      }

      /* l 鍵按壓同步亮起 */
      @keyframes keyPressL {
        0%, 5%   { fill: #3c3836; stroke: #504945; transform: scale(1); }
        7%, 9%   { fill: #fe8019; stroke: #fe8019; transform: scale(0.94); }
        11%, 12% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        13%, 15% { fill: #fe8019; stroke: #fe8019; transform: scale(0.94); }
        17%, 18% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        19%, 21% { fill: #fe8019; stroke: #fe8019; transform: scale(0.94); }
        23%, 24% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        25%, 27% { fill: #fe8019; stroke: #fe8019; transform: scale(0.94); }
        29%, 30% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        31%, 33% { fill: #fe8019; stroke: #fe8019; transform: scale(0.94); }
        35%, 36% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        37%, 39% { fill: #fe8019; stroke: #fe8019; transform: scale(0.94); }
        41%, 42% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        43%, 45% { fill: #fe8019; stroke: #fe8019; transform: scale(0.94); }
        47%, 100%{ fill: #3c3836; stroke: #504945; transform: scale(1); }
      }
      @keyframes keyTextL {
        0%, 5%   { fill: #ebdbb2; }
        7%, 9%   { fill: #1d2021; }
        11%, 12% { fill: #ebdbb2; }
        13%, 15% { fill: #1d2021; }
        17%, 18% { fill: #ebdbb2; }
        19%, 21% { fill: #1d2021; }
        23%, 24% { fill: #ebdbb2; }
        25%, 27% { fill: #1d2021; }
        29%, 30% { fill: #ebdbb2; }
        31%, 33% { fill: #1d2021; }
        35%, 36% { fill: #ebdbb2; }
        37%, 39% { fill: #1d2021; }
        41%, 42% { fill: #ebdbb2; }
        43%, 45% { fill: #1d2021; }
        47%, 100%{ fill: #ebdbb2; }
      }

      /* h 鍵按壓同步亮起 */
      @keyframes keyPressH {
        0%, 51%  { fill: #3c3836; stroke: #504945; transform: scale(1); }
        53%, 55% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.94); }
        57%, 58% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        59%, 61% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.94); }
        63%, 64% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        65%, 67% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.94); }
        69%, 70% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        71%, 73% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.94); }
        75%, 76% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        77%, 79% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.94); }
        81%, 82% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        83%, 85% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.94); }
        87%, 88% { fill: #3c3836; stroke: #504945; transform: scale(1); }
        89%, 91% { fill: #fabd2f; stroke: #fabd2f; transform: scale(0.94); }
        93%, 100%{ fill: #3c3836; stroke: #504945; transform: scale(1); }
      }
      @keyframes keyTextH {
        0%, 51%  { fill: #ebdbb2; }
        53%, 55% { fill: #1d2021; }
        57%, 58% { fill: #ebdbb2; }
        59%, 61% { fill: #1d2021; }
        63%, 64% { fill: #ebdbb2; }
        65%, 67% { fill: #1d2021; }
        69%, 70% { fill: #ebdbb2; }
        71%, 73% { fill: #1d2021; }
        75%, 76% { fill: #ebdbb2; }
        77%, 79% { fill: #1d2021; }
        81%, 82% { fill: #ebdbb2; }
        83%, 85% { fill: #1d2021; }
        87%, 88% { fill: #ebdbb2; }
        89%, 91% { fill: #1d2021; }
        93%, 100%{ fill: #ebdbb2; }
      }

      /* 當前移動方向文字提示切換 */
      @keyframes toggleDirL {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
      @keyframes toggleDirH {
        0%, 49% { opacity: 0; }
        50%, 100% { opacity: 1; }
      }

      .animated-hl-cursor {
        animation: cursorHLMove 8s cubic-bezier(0.25, 1, 0.5, 1) infinite;
      }
      .anim-key-rect-l {
        animation: keyPressL 8s ease-in-out infinite;
        transform-origin: center;
      }
      .anim-key-text-l {
        animation: keyTextL 8s ease-in-out infinite;
      }
      .anim-key-rect-h {
        animation: keyPressH 8s ease-in-out infinite;
        transform-origin: center;
      }
      .anim-key-text-h {
        animation: keyTextH 8s ease-in-out infinite;
      }
      .anim-dir-l {
        animation: toggleDirL 8s steps(1) infinite;
      }
      .anim-dir-h {
        animation: toggleDirH 8s steps(1) infinite;
      }
    </style>
  </defs>

  ${renderWindowFrame({
    width,
    height,
    title: 'Muzen Dynamics: Character Navigation (h & l)',
    url: 'https://muzen.dev/guide/character-navigation'
  })}

  <!-- 內容區 -->
  <g transform="translate(48, 80)">
    <!-- 文章標題與作者 -->
    <text x="0" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="22" font-weight="700">Precision Character Navigation with Vim Dynamics</text>
    <text x="0" y="46" fill="#83a598" font-family="${COMMON_FONT}" font-size="13">Dual-Directional Motion: [l] Step Right • [h] Step Left • Zero Mouse Dependency</text>
    <line x1="0" y1="58" x2="784" y2="58" stroke="#3c3836" stroke-width="1" />

    <!-- ========================================== -->
    <!-- 左側：情境介紹與互動卡片 (寬度 520px) -->
    <!-- ========================================== -->
    <g transform="translate(0, 72)">
      <!-- 導引說明內文 -->
      <text x="0" y="16" fill="#d5c4a1" font-family="${COMMON_FONT}" font-size="15" letter-spacing="0.2">
        傳統滑鼠標記或原生游標極易在長文中迷失字元焦點。
      </text>
      <text x="0" y="38" fill="#d5c4a1" font-family="${COMMON_FONT}" font-size="15" letter-spacing="0.2">
        Muzen Cursor 將高對比幾何游標「直接覆蓋在目標字元正上方」：
      </text>

      <!-- 核心展示卡片 (寬 510, 高 114) -->
      <g transform="translate(0, 56)">
        <rect x="0" y="0" width="510" height="114" rx="8" fill="#1d2021" stroke="#504945" stroke-width="1.2" />

        <!-- 卡片頂部資訊標籤 -->
        <rect x="0" y="0" width="510" height="30" rx="8" fill="#282828" />
        <rect x="0" y="20" width="510" height="10" fill="#282828" />
        <line x1="0" y1="30" x2="510" y2="30" stroke="#3c3836" stroke-width="1" />

        <circle cx="16" cy="15" r="4" fill="#fe8019" />
        <text x="26" y="19" fill="#fe8019" font-family="${COMMON_FONT}" font-size="11" font-weight="700">當前閱讀聚焦行 (ACTIVE LINE)</text>
        
        <rect x="408" y="6" width="90" height="18" rx="4" fill="#3c3836" />
        <text x="453" y="19" fill="#fabd2f" font-family="${MONO_FONT}" font-size="10" font-weight="700" text-anchor="middle">VIM NORMAL</text>

        <!-- 文字與覆蓋式游標區域 (字元基準線 y = 72) -->
        <g transform="translate(26, 72)">
          <!-- 1. 底層文字：精確 22px 等距排版，高對比米白色 #fbf1c7 -->
          <g font-family="${MONO_FONT}" font-size="22" font-weight="600" fill="#fbf1c7">
            <text x="0" y="0">M</text>
            <text x="22" y="0">u</text>
            <text x="44" y="0">z</text>
            <text x="66" y="0">e</text>
            <text x="88" y="0">n</text>
            <text x="110" y="0"> </text>
            <text x="132" y="0">C</text>
            <text x="154" y="0">u</text>
            <text x="176" y="0">r</text>
            <text x="198" y="0">s</text>
            <text x="220" y="0">o</text>
            <text x="242" y="0">r</text>
          </g>

          <!-- 2. 上層游標：直接覆蓋在字元正上方！(半透明琥珀色底 + 2px 鮮明外框 + 擴散光暈) -->
          <g class="animated-hl-cursor">
            <rect x="-3" y="-21" width="22" height="27" rx="3" fill="#fe8019" fill-opacity="0.32" stroke="#fe8019" stroke-width="2" filter="url(#anchor-glow)" />
          </g>

          <!-- 後續修飾符號 (展示真實代碼/排版情境) -->
          <text x="274" y="0" fill="#928374" font-family="${MONO_FONT}" font-size="18">.zen_mode();</text>
        </g>

        <!-- 卡片底部狀態提示條 -->
        <line x1="0" y1="92" x2="510" y2="92" stroke="#282828" stroke-width="1" />
        <text x="16" y="106" fill="#83a598" font-family="${COMMON_FONT}" font-size="11">✨ 游標完全貼齊字元邊界，具備 GPU 物理阻尼（80ms）平滑跟隨位移</text>
      </g>

      <!-- 卡片下方補充說明 -->
      <text x="0" y="196" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="14">
        • 按 <tspan fill="#fe8019" font-weight="700">l</tspan> 向右前進一個字元；按 <tspan fill="#fabd2f" font-weight="700">h</tspan> 向左後退一個字元。
      </text>
      <text x="0" y="218" fill="#a89984" font-family="${COMMON_FONT}" font-size="13">
        • 搭配 <tspan fill="#b8bb26" font-weight="600">w / b</tspan> 詞彙跳躍，視線永遠精準鎖定文字基線，手指無需碰觸滑鼠。
      </text>
    </g>

    <!-- 中間立體垂直分隔線 -->
    <line x1="535" y1="72" x2="535" y2="295" stroke="#3c3836" stroke-width="1" />

    <!-- ========================================== -->
    <!-- 右側：HUD 即時按鍵動態與游標外觀形態 -->
    <!-- ========================================== -->
    <g transform="translate(555, 72)">
      <!-- 鍵盤即時動力 HUD 視窗 -->
      <rect x="0" y="0" width="225" height="106" rx="8" fill="#282828" stroke="#504945" stroke-width="1" />
      <text x="14" y="22" fill="#928374" font-family="${COMMON_FONT}" font-size="11" font-weight="600">LIVE KEYBOARD DYNAMICS</text>

      <!-- 兩個大型實體按鍵: [ h ] 與 [ l ] -->
      <!-- [ h ] 按鍵 (向左) -->
      <g transform="translate(18, 32)">
        <rect class="anim-key-rect-h" x="0" y="0" width="40" height="34" rx="5" fill="#3c3836" stroke="#504945" stroke-width="1.2" />
        <text class="anim-key-text-h" x="20" y="22" fill="#ebdbb2" font-family="${MONO_FONT}" font-size="16" font-weight="700" text-anchor="middle">h</text>
        <text x="20" y="44" fill="#a89984" font-family="${COMMON_FONT}" font-size="10" text-anchor="middle">向左 ⟵</text>
      </g>

      <!-- [ l ] 按鍵 (向右) -->
      <g transform="translate(74, 32)">
        <rect class="anim-key-rect-l" x="0" y="0" width="40" height="34" rx="5" fill="#3c3836" stroke="#504945" stroke-width="1.2" />
        <text class="anim-key-text-l" x="20" y="22" fill="#ebdbb2" font-family="${MONO_FONT}" font-size="16" font-weight="700" text-anchor="middle">l</text>
        <text x="20" y="44" fill="#a89984" font-family="${COMMON_FONT}" font-size="10" text-anchor="middle">向右 ⟶</text>
      </g>

      <!-- 動態指示狀態膠囊 -->
      <rect x="130" y="38" width="82" height="24" rx="4" fill="#1d2021" stroke="#3c3836" stroke-width="1" />
      <g class="anim-dir-l">
        <text x="171" y="54" fill="#fe8019" font-family="${COMMON_FONT}" font-size="10.5" font-weight="700" text-anchor="middle">▶ 右移 (l)</text>
      </g>
      <g class="anim-dir-h">
        <text x="171" y="54" fill="#fabd2f" font-family="${COMMON_FONT}" font-size="10.5" font-weight="700" text-anchor="middle">◀ 左移 (h)</text>
      </g>

      <text x="14" y="96" fill="#83a598" font-family="${MONO_FONT}" font-size="11">阻尼跟隨: 80ms 物理過渡</text>

      <!-- 下方: 游標三種幾何形態 -->
      <text x="0" y="132" fill="#fabd2f" font-family="${COMMON_FONT}" font-size="12" font-weight="700">3 幾何錨點形態 (自訂外觀)</text>

      <!-- 形態 1: Block 實心方塊 (覆蓋字元) -->
      <g transform="translate(0, 142)">
        <rect x="0" y="0" width="225" height="30" rx="5" fill="#1d2021" stroke="#fe8019" stroke-width="1" />
        <rect x="10" y="6" width="10" height="18" rx="2" fill="#fe8019" />
        <text x="28" y="20" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="12" font-weight="600">Block 實心方塊</text>
        <text x="175" y="20" fill="#fe8019" font-family="${MONO_FONT}" font-size="10" font-weight="700">覆蓋字元</text>
      </g>

      <!-- 形態 2: Hollow 空心外框 -->
      <g transform="translate(0, 178)">
        <rect x="0" y="0" width="225" height="30" rx="5" fill="#1d2021" stroke="#3c3836" stroke-width="1" />
        <rect x="10" y="6" width="10" height="18" rx="2" fill="none" stroke="#7aa2f7" stroke-width="1.8" />
        <text x="28" y="20" fill="#a89984" font-family="${COMMON_FONT}" font-size="12">Hollow 空心外框</text>
        <text x="160" y="20" fill="#665c54" font-family="${COMMON_FONT}" font-size="10">文字無遮擋</text>
      </g>

      <!-- 形態 3: Underline 閱讀底線 -->
      <g transform="translate(0, 214)">
        <rect x="0" y="0" width="225" height="30" rx="5" fill="#1d2021" stroke="#3c3836" stroke-width="1" />
        <rect x="8" y="20" width="14" height="4" rx="1" fill="#b8bb26" />
        <text x="28" y="20" fill="#a89984" font-family="${COMMON_FONT}" font-size="12">Underline 閱讀底線</text>
        <text x="160" y="20" fill="#665c54" font-family="${COMMON_FONT}" font-size="10">速讀導航規</text>
      </g>
    </g>
  </g>

  <!-- 底部操作提示導引 (Action Banner) -->
  <g transform="translate(48, 420)">
    <rect x="0" y="0" width="784" height="40" rx="8" fill="#282828" stroke="#3c3836" stroke-width="1" />

    <!-- 按鍵指引 -->
    <rect class="anim-key-rect-h" x="14" y="8" width="28" height="24" rx="4" fill="#3c3836" stroke="#504945" stroke-width="1" />
    <text class="anim-key-text-h" x="28" y="24" fill="#ebdbb2" font-family="${MONO_FONT}" font-size="13" font-weight="700" text-anchor="middle">h</text>
    <text x="48" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="13" font-weight="600">向左字元</text>

    <text x="112" y="24" fill="#665c54" font-family="${COMMON_FONT}" font-size="14">|</text>

    <rect class="anim-key-rect-l" x="128" y="8" width="28" height="24" rx="4" fill="#3c3836" stroke="#504945" stroke-width="1" />
    <text class="anim-key-text-l" x="142" y="24" fill="#fe8019" font-family="${MONO_FONT}" font-size="13" font-weight="700" text-anchor="middle">l</text>
    <text x="162" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="13" font-weight="600">向右字元</text>

    <text x="226" y="24" fill="#665c54" font-family="${COMMON_FONT}" font-size="14">|</text>

    <rect x="242" y="8" width="50" height="24" rx="4" fill="#3c3836" stroke="#504945" stroke-width="1" />
    <text x="267" y="24" fill="#fabd2f" font-family="${MONO_FONT}" font-size="13" font-weight="700" text-anchor="middle">w / b</text>
    <text x="298" y="24" fill="#ebdbb2" font-family="${COMMON_FONT}" font-size="13">智慧單字跳躍</text>

    <text x="390" y="24" fill="#665c54" font-family="${COMMON_FONT}" font-size="14">|</text>

    <text x="406" y="24" fill="#b8bb26" font-family="${COMMON_FONT}" font-size="13" font-weight="600">🎯 游標覆蓋字元</text>
    <text x="526" y="24" fill="#928374" font-family="${COMMON_FONT}" font-size="12">雙手不離鍵盤，目光不離行距</text>
  </g>
</svg>`;
}

// -------------------------------------------------------------
// 執行產出
// -------------------------------------------------------------
const files = [
  { name: 'demo-translation.svg', content: generateTranslationSvg() },
  { name: 'demo-visual-yank.svg', content: generateVisualYankSvg() },
  { name: 'demo-reading-anchor.svg', content: generateReadingAnchorSvg() },
];

files.forEach(({ name, content }) => {
  const filePath = path.join(outputDir, name);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ 成功產生高品質模擬展示圖: public/images/${name} (${content.length} bytes)`);
});
