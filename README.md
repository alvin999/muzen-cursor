# ⛩️ Muzen Cursor (霧前禪夢)

> **「霧前禪夢，見字如初」**  
> *A distraction-free, zen-like reading companion for the modern web and PDF.*

<p align="center">
  <img src="public/icons/icon128.png" alt="Muzen Cursor Logo" width="96" height="96" />
</p>

<p align="center">
  <a href="#-命名哲學與回文由來">命名哲學</a> •
  <a href="#-核心亮點">核心亮點</a> •
  <a href="#-快捷鍵指引">快捷鍵指引</a> •
  <a href="#-外觀與個性化定制">個性化定制</a> •
  <a href="#-安裝與使用指南">安裝指南</a> •
  <a href="#-技術架構">技術架構</a>
</p>

---

## 🪷 命名哲學與回文由來

<div align="center">

| **Muzen** | | **Zenmu** |
| :---: | :---: | :---: |
| **【 霧 前 】** | ⟷ | **【 禪 夢 】** |
| `mu - zen` | | `zen - mu` |

</div>

**Muzen Cursor** 誕生於對純粹閱讀專注的追求。

名稱源自日語讀音的對稱回文概念 —— **「Muzen (霧前)」與「Zenmu (禪夢)」**：
- **破文字之迷霧 (Muzen)**：在繁雜冗長的網頁資訊與排版干擾中，撥開迷霧，看清字裡行間的真實脈絡。
- **入專注之禪夢 (Zenmu)**：透過沉浸式 Vim 鍵盤動力學與高對比視覺錨點，引導讀者進入心流湧動、物我兩忘的閱讀禪境。

雙向回文象徵著：**起於撥開文字迷霧，歸於寧靜專注禪夢；循環往復，見字如初。**

---

## ✨ 核心亮點

在長文與技術文檔閱讀中，滑鼠滾輪滾動容易使視線迷失行級焦點；而瀏覽器原生的游標瀏覽（F7）僅有細微的閃爍垂直直線，無法提供足夠的操作與視覺回饋。既有的 Vim 擴充功能（如 Vimium）則著重於「分頁導航與點擊跳轉」，而非「逐行/逐字深度閱讀」。

**Muzen Cursor** 專為解決上述痛點而生：

- 🎯 **行/字元級別視覺錨點**：以 GPU 硬體加速驅動的幾何游標（實心方塊、空心外框、閱讀底線），緊密貼合文字基線。
- ⌨️ **正統 Vim 鍵盤動力學**：雙手不離鍵盤，隨心所欲進行字元、行級、單字邊界與全文頂底跳轉。
- 🀄 **原生 CJK 智慧斷詞**：結合瀏覽器原生 `Intl.Segmenter` 演算法，中日韓繁簡文字與英數混排時皆能智慧感知詞彙邊界（`w / b / e`）。
- 📑 **內建 PDF 閱讀器整合**：無縫接管 `.pdf` 檔案閱讀，與 Mozilla PDF.js `TextLayer` 深度對齊，實現學術論文與電子書的行級導航。
- ✍️ **輸入情境自動避讓**：智慧偵測 `<input>`、`<textarea>`、`contenteditable` 與富文本編輯區塊，打字時自動放行，絕不攔截使用者的正常輸入。
- 🚫 **自訂網域排除名單 (Blacklist)**：支援子網域繼承與自訂黑名單，可在彈出設定面板一鍵停用當前網站，保持閱讀與工作切換自如。
- 🎨 **14 大沉浸式風格主題與複合特效**：涵蓋 Gruvbox、IntelliJ Darcula / Light、Dracula、Monokai Pro、One Dark、Tokyo Night、Nord、Catppuccin、Everforest、Solarized Dark、Rosé Pine、Cyberpunk，並可複合勾選平滑位移、心流呼吸光暈與經典跳動。
- 🌐 **多國語言介面 (i18n)**：完整支援 **繁體中文 (zh-TW)**、**English (en)** 與 **日本語 (ja)**，包含介面標籤與下拉選項即時熱切換。
- 🛡️ **Shadow DOM 絕對隔離**：完全以 Web Components (Shadow DOM) 渲染，與目標網頁的 CSS/JavaScript 執行期 0 衝突、0 汙染。

---

## ⌨️ 快捷鍵指引

| 快捷鍵 | 動作說明 | 備註 |
| :--- | :--- | :--- |
| <kbd>h</kbd> / <kbd>l</kbd> | 向左 / 向右移動一個字元 | 支援跨行首尾銜接 |
| <kbd>j</kbd> / <kbd>k</kbd> | 向下 / 向上移動一行 | 支援幾何 X 軸記憶與跨段落吸附 |
| <kbd>u</kbd> / <kbd>d</kbd> | 向上 / 向下跳轉半頁 | 依設定執行平滑或即時視窗滾動 |
| <kbd>w</kbd> | 向前跳躍至下一個詞彙開頭 | 支援中英日 CJK 智慧跳詞 |
| <kbd>b</kbd> | 向後跳躍至上一個詞彙開頭 | 支援中英日 CJK 智慧跳詞 |
| <kbd>e</kbd> | 跳躍至下一個詞彙結尾 | 支援詞尾精準錨定 |
| <kbd>0</kbd> / <kbd>^</kbd> | 跳躍至當前文字行行首 | 貼齊行首文字 |
| <kbd>$</kbd> | 跳躍至當前文字行行尾 | 貼齊行尾文字 |
| <kbd>g</kbd> <kbd>g</kbd> | 快速跳至全文開頭 | 置頂並同步滾動 |
| <kbd>G</kbd> | 快速跳至全文結尾 | 置底並同步滾動 |
| <kbd>v</kbd> | 切換 **VISUAL 視覺選取模式** | 高對比選取色彩，同步原生文字選取 |
| <kbd>y</kbd> | 複製選取文字 (Yank) | 自動寫入作業系統剪貼簿 |
| <kbd>Alt</kbd> + <kbd>v</kbd> | 全域快速切換啟動 / 凍結 | 隨時喚醒或休眠游標 |
| <kbd>Esc</kbd> | 取消選取 / 隱藏游標 | 恢復純粹閱讀視野 |

> 💡 **提示**：直接用滑鼠點擊網頁上任意文字，游標與狀態列將立即以該字元為起點吸附就緒。

---

## 🎨 外觀與個性化定制

點擊瀏覽器工具列上的 **Muzen Cursor** 圖示即可開啟設定視窗：

### 1. 色彩主題 (Themes)
- **Gruvbox Dark**（經典琥珀暖調）
- **Gruvbox Light**（淡雅暖白羊皮紙）
- **Tokyo Night**（東京暗夜冷冽藍紫）
- **Nord**（北歐極光冰霜藍）
- **Catppuccin Mocha**（摩卡柔粉高雅）
- **Everforest**（深邃森林雅綠）

### 2. 游標形態 (Shapes)
- **實心方塊 (Block)**：經典終端高對比實心方塊，字元視覺焦點最強。
- **空心外框 (Hollow)**：文字完全不被覆蓋，提供乾淨無瑕的高對比外框。
- **閱讀底線 (Underline)**：貼齊字元基線的水平導航規，專為速讀訓練設計。

### 3. 動態特效 (Effects - 支援多選複合)
- **平滑位移 (Smooth)**：GPU 加速之三次方貝茲物理過渡曲線（0.08s 阻尼跟隨）。
- **平滑捲動 (Smooth Scroll)**：游標跳轉或翻頁時的視窗平滑滾動，亦可取消勾選以體驗極致零延遲即時跳動。
- **禪意呼吸 (Breathe)**：2.4s 週期之靜態心流呼吸脈動微光暈。
- **經典閃爍 (Blink)**：1s 頻率之硬派終端機經典方塊跳動。

---

## 🚀 安裝與使用指南

### 方法一：直接載入預先發布版本 (推薦)
1. 前往本專案的 [Releases 頁面](https://github.com/alvin999/muzen-cursor/releases) 下載最新版的 `muzen-cursor-v*.zip`。
2. 解壓縮該 ZIP 檔案至本機資料夾。
3. 打開 Chromium 核心瀏覽器（Google Chrome、Microsoft Edge、Brave 等），於網址列輸入 `chrome://extensions/`。
4. 開啟右上角的 **「開發人員模式 (Developer mode)」**。
5. 點擊左上角 **「載入未封裝項目 (Load unpacked)」**，並選取解壓縮後的資料夾。
6. 安裝完成！打開任意網頁即可點擊文字體驗。

### 方法二：從原始碼自行建置
```bash
# 1. 複製儲存庫
git clone https://github.com/alvin999/muzen-cursor.git
cd muzen-cursor

# 2. 安裝相依依賴
npm install

# 3. 建置發布產物
npm run build
```
建置完成後，於瀏覽器中載入專案底下的 `dist/` 目錄即可。

---

## 🛠️ 技術架構

```text
muzen-cursor/
├── manifest.json              # Chrome MV3 規格宣告
├── vite.config.ts             # 雙建置管線：IIFE 自包含 Content Script + ESM 彈出面板
├── src/
│   ├── background/            # Service Worker (背景通訊、PDF 自動攔截)
│   ├── content/               # Content Script 入口點 (自包含閉包，絕不污染宿主網頁)
│   ├── core/                  # 核心引擎 (座標量測、CJK 斷詞演算法、全域狀態庫)
│   │   ├── cursorController.ts
│   │   ├── cursorStore.ts
│   │   └── wordNavigator.ts
│   ├── components/            # Web Components (Shadow DOM 封裝覆蓋層與狀態列)
│   ├── i18n/                  # 多國語言字典 (zh-TW, en, ja)
│   ├── popup/                 # 設定彈出面板 (Vanilla TypeScript + CSS Variables)
│   └── pdf-viewer/            # 內建 Mozilla PDF.js 檢視器整合
```

- **0-Runtime Overhead**：全專案採用純原生 **Vanilla TypeScript + Web Components**，零前端重量框架依賴，總套件體積僅數十 KB。
- **自包含 IIFE 打包**：針對 Chrome MV3 content script 隔離環境，獨立編譯為純淨自包含腳本，徹底杜絕 `import statement outside a module` 語法相容性問題。
- **精確幾何度量**：利用瀏覽器 `DOM Range`、`createTreeWalker` 進行即時子像素字元座標解析，搭配 CSS `translate3d` 達成 120fps 流暢渲染。

---

## 📜 開源授權

本專案採用 [MIT License](LICENSE) 授權發布，歡迎自由使用、修改與社群貢獻。

<p align="center">
  <sub>霧前禪夢，見字如初。破文字之迷霧，入專注之禪夢。</sub>
</p>
