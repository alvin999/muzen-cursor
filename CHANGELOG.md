# Changelog / 更新日誌

All notable changes to this project will be documented in this file.  
本專案所有顯著變更皆會記錄於本檔案中。

---

## [v0.1.11] - 2026-10-27

### 繁體中文 (Traditional Chinese)
#### 🐛 核心修復與導航對齊 (Bug Fixes & Navigation Alignment)
- **半頁跳轉 (`u` / `d`) 作用域與邊界防護對齊**：
  - **閱讀作用域隔離 (Scope Containment)**：將 `u` (向上半頁) 與 `d` (向下半頁) 的推進搜尋範圍對齊至當前有效作用域（`getEffectiveRoot()`），並納入與單行移動 (`j` / `k`) 相同的離流元件防護機制（`isOutOfNormalFlowWidget`），徹底解決游標在側邊欄、卡片或獨立容器跳轉時隨意外溢或超出框架的問題。
  - **根絕瞬移至左上角 (Eliminate Corner Snap)**：移除原先在頂部或邊界找不到足夠行數時強制觸發全頁級 `jumpToDocumentStart()` / `jumpToDocumentEnd()` 的機制，改為平穩原地停留並觸發邊界感知提示，杜絕游標與滾動突然被強制吸回頁面最左上角的問題。
  - **作用域鎖定維護 (Active Scope Synchronization)**：跳轉後主動同步更新作用域（`updateActiveScope`），確保後續導航操作持續精準錨定在同一閱讀容器內。

---

### English
#### 🐛 Bug Fixes & Navigation Alignment
- **Half-Page Navigation (`u` / `d`) Scope & Boundary Alignment**:
  - **Scope Containment**: Aligned half-page jump searches (`u` / `d`) with the active effective scope (`getEffectiveRoot()`) and integrated out-of-flow widget guards (`isOutOfNormalFlowWidget`), preventing the cursor from unexpectedly escaping containers or overflowing sidebars and card panels.
  - **Eliminate Corner Snapping**: Replaced the previous fallback behavior that abruptly invoked full-page `jumpToDocumentStart()` / `jumpToDocumentEnd()` at boundaries. The cursor now smoothly remains in place with boundary notifications, completely eliminating erratic jumps back to the top-left corner.
  - **Active Scope Synchronization**: Added `updateActiveScope` synchronization upon target acquisition to keep subsequent navigation precisely anchored within the target reading container.

---

## [v0.1.10] - 2026-10-20

### 繁體中文 (Traditional Chinese)
#### ✨ 新增功能與體驗優化 (Features & Improvements)
- **邊界與浮動元件觸底狀態列提示 (Boundary & Float Widget Toast Notices)**：
  - **頁面全文觸底反饋**：向下移動抵達頁面全文末端無法再前進時，狀態列優雅彈出「已閱卷終 · 抵達底界」提示，清晰感知閱讀進度。
  - **浮動元件／側欄掛件邊界感知**：當游標處於脫離常態文流之獨立掛件（如維基百科年表、側欄卡片、浮動 Info box）且已抵達底部邊界時，跳出「浮動元件已至邊界」提示，避免使用者因邊界封印機制而產生迷失感。
  - **高頻防抖節流機制 (Notice Throttling)**：內建 1.5 秒節流門檻，使用者長按 `j` 連發或極速連擊時不產生視覺干擾與閃爍。
  - **完整多國語系支援**：同步支援繁體中文 (`zh-TW`)、英文 (`en`) 與日文 (`ja`)。

---

### English
#### ✨ Features & Improvements
- **Boundary & Float Widget Toast Notifications**:
  - **End of Passage Feedback**: Displays an elegant status bar notice ("Reached the end of passage") when reaching the bottom of the readable page, providing clear awareness of reading progress.
  - **Floating Widget Boundary Awareness**: Displays "Reached boundary of widget" when reaching the bottom of out-of-flow widgets (e.g., sidebars, floating info boxes, infobox tables) where navigation is strictly contained.
  - **High-Frequency Throttle Protection**: Includes a 1.5-second debounce/throttle cooldown to eliminate notification jitter during key repeat.
  - **Full Trilingual Localization**: Fully translated and synced across Traditional Chinese (`zh-TW`), English (`en`), and Japanese (`ja`).

---

## [v0.1.9] - 2026-10-19

### 繁體中文 (Traditional Chinese)
#### 🚀 核心導航與滾動機制優化 (Navigation & Scrolling Improvements)
- **智慧容器與常態文流穿透 (Conditional In-flow Scope Escape)**：
  - 重構閱讀區域與滾動容器判定邏輯，以 W3C CSSOM 標準規範（`scrollHeight > clientHeight`）取代過往魔術數字門檻，大幅提升動態容器判斷準確性。
  - 支援常態文流（In-flow）元素（如嵌入式小工具、留言串）跨容器平順導航穿透，無縫延續閱讀流。
  - 對離流元件（Out-of-flow，如側邊欄、`fixed`/`sticky` 元素）維持嚴格的作用域隔離保護，徹底根除游標陷入死循環或被側邊資訊盒截胡問題。
- **瞬時幀同步與極速長按防震 (Instant Frame Sync for Key Repeat)**：
  - 針對長按（如長按 `j` 鍵重複連發）實作即時幀同步機制，顯著降低滾動延遲感。
  - 向下導航期間實施單向滾動跟隨保護，杜絕視窗逆向回彈跳躍。
  - 徹底解耦滾動事件與水平欄位記憶（`preferredX`），消除垂直跨行時的微幅水平抖動。
  - 移除導航跳躍限制（`maxDownwardJump` / `maxJump`），確保巨幅元素與跨段落跳躍流暢不中斷。
- **無障礙隱藏節點過濾標準化**：
  - 引入 `A11Y_HIDDEN_SELECTORS` 與 `isOffScreenOrZeroSize`，全面過濾螢幕報讀專用的不可見 DOM 節點，避免游標停滯於空白或隱藏內容。

#### 🧪 測試套件強化 (Test Suite Refinements)
- **Facebook 巨幅動態牆實戰基準**：
  - 擴充 `facebook-feed` 測試夾具，納入 720px 高度巨幅媒體橫幅、即時留言虛擬串流與長按幀同步壓力測試。
  - 確保高頻導航達到零反向拉回、零吸頂跳躍與完美穿透。
- 清理冗餘的單次除錯腳本與暫存測試檔案，精簡測試套件架構。

#### 🤖 CI / CD 自動化釋出 (Release Automation)
- **歷史 Release 更新日誌批次同步**：
  - 新增 `sync-all-releases.mjs` 工具腳本與 `sync-releases.yml` GitHub Actions 工作流程，支援將 `CHANGELOG.md` 雙語更新日誌自動同步至 GitHub Releases。

---

### English
#### 🚀 Navigation & Scrolling Improvements
- **Smart Container Detection & Conditional In-flow Scope Escape**:
  - Replaced arbitrary magic number heuristics with standard W3C CSSOM compliance (`scrollHeight > clientHeight`) for reading scope and scroll container detection.
  - Implemented conditional flow escape allowing in-flow elements (embedded widgets, comment sections) to transition across boundaries naturally.
  - Maintained strict isolation for out-of-flow elements (fixed/sticky sidebars, floating widgets) to prevent cursor trapping or infinite loops.
- **Instant Frame Sync & Anti-Bounce for Key Repeat**:
  - Introduced instant frame synchronization during key repeat (e.g. holding down `j`), eliminating motion lag.
  - Enforced unidirectional scroll tracking during downward navigation to eliminate reverse bounce.
  - Decoupled scroll events from horizontal column memory (`preferredX`), eliminating horizontal micro-jitter.
  - Removed restrictive jump caps (`maxDownwardJump` / `maxJump`) for seamless transitions across massive media blocks.
- **Standardized Accessibility Element Filtering**:
  - Integrated `A11Y_HIDDEN_SELECTORS` and `isOffScreenOrZeroSize` to cleanly bypass screen-reader-only and zero-sized hidden DOM nodes.

#### 🧪 Test Suite Refinements
- **Real-World Facebook Feed Benchmarks**:
  - Upgraded `facebook-feed` fixture with 720px media banners, virtualized comments, and high-frequency key repeat stress tests.
  - Verified 100% pass rate with zero reverse pullbacks, zero ceiling jumps, and robust media penetration.
- Pruned obsolete one-off debug scripts and temporary test fixtures.

#### 🤖 CI / CD & Release Automation
- **Batch Historical Release Changelog Sync**:
  - Added `sync-all-releases.mjs` and `.github/workflows/sync-releases.yml` to automatically synchronize bilingual changelogs across all GitHub Releases.

---

## [v0.1.8] - 2026-10-16

### 繁體中文 (Traditional Chinese)
#### 🚀 新增功能與改進 (Features & Improvements)
- **PDF 檢視器動態縮放與游標自適應**：
  - 支援游標跟隨 PDF 頁面自適應縮放（Zoom In / Out / Fit Width），文字層（TextLayer）與底層 Canvas 保持精準對齊。
  - 優化 PDF 重新渲染時的頁面狀態記憶，縮放後自動維持在當前閱讀頁碼。
- **全新 PDF 自動化測試套件 (`PdfTest`)**：
  - 新增 `tests/pdf/` 測試套件與 `npm run test:pdf` 指令，以 MIT xv6 110 頁經典教材作為實體基準樣本。
  - 支援 Headless 瀏覽器環境下的自動翻頁測試、跨頁 DOM 貫穿驗證與診斷遙測。

#### 🐛 錯誤修復 (Bug Fixes)
- **修復 PDF 模式下 `u` / `d` 半頁導航卡住問題**：
  - 解決 `moveHalfPage` 平滑滾動期間因目標行暫時在可視視窗外而被誤判為 `visible: false`（淺層休眠待機）的缺陷。
  - 在滾動動畫生命週期內強化可見性保護，確保游標持續保持接管狀態。
  - 擴展休眠待命狀態下的喚醒按鍵：除原本的 `j` 外，按下 `d`、`u`、`k` 亦能順暢喚醒並立即執行導航，徹底消除按鍵丟棄與死鎖狀況。

---

### English
#### 🚀 Features & Improvements
- **Dynamic PDF Viewer Zoom & Cursor Scaling**:
  - Full cursor scaling adaptation during PDF zoom in, zoom out, and fit-width operations, maintaining pixel-perfect alignment between the TextLayer and Canvas.
  - Stabilized page re-rendering with automatic current-page retention.
- **Automated PDF Test Suite (`PdfTest`)**:
  - Introduced `tests/pdf/` test suite and `npm run test:pdf` script benchmarked against the 110-page MIT xv6 RISC-V textbook.
  - Automated headless navigation testing, cross-page DOM penetration validation, and diagnostic telemetry.

#### 🐛 Bug Fixes
- **Fixed Half-Page (`u` / `d`) Navigation Freeze in PDF Mode**:
  - Eliminated premature visibility culling where `moveHalfPage` falsely marked the cursor as inactive/sleep (`visible: false`) while the physical smooth scroll was still in flight.
  - Added strict in-flight visibility protection during smooth scroll animation lifecycles.
  - Expanded standby wake-up keystrokes: in addition to `j`, pressing `d`, `u`, or `k` now seamlessly wakes up the cursor and executes the motion without dropped events.

---

## [v0.1.7] - 2026-10-15

### 繁體中文 (Traditional Chinese)
- **智慧自動主題與動態調色盤**：Popup 彈窗介面支援與當前網頁背景自動融合之智慧調色盤（支援多色動態萃取與高對比切換）。

### English
- **Smart Adaptive Theme & Dynamic Palette**: Added adaptive color theming for the popup interface that automatically harmonizes with the active web page background.

---

## [v0.1.6] - 2026-10-15

### 繁體中文 (Traditional Chinese)
- **ESC 鍵穿透與原生效能保護**：優化 ESC 按鍵邏輯，放行事件穿透給網頁原生 Modal 彈窗與全螢幕響應，避免快捷鍵衝突。
- **線上 PDF 載入增強**：修復線上 PDF 代理下載邏輯，妥善處理第三方擴充功能（如 Adobe Acrobat）衝突解包情境。

### English
- **ESC Key Passthrough**: Enabled natural event propagation on ESC keystrokes to prevent conflicts with native web modals and full-screen overlays.
- **Online PDF Loading Robustness**: Resolved online PDF fetching issues via background proxying and added conflict detection for third-party PDF extensions.

---

## [v0.1.5] - 2026-10-15

### 繁體中文 (Traditional Chinese)
- **智慧網頁主題偵測**：擴展背景色自動辨識演算法，精準在深色與淺色模式間動態切換游標樣式。

### English
- **Smart Adaptive Page Theming**: Enhanced automated background detection to intelligently switch between light and dark cursor palettes.

---

## [v0.1.4] - 2026-10-15

### 繁體中文 (Traditional Chinese)
- **翻頁回溯後照鏡 HUD (Rearview Mirror)**：在進行大跨度跳轉（如半頁翻頁或跳轉）時，於頂部微光彈出剛才閱讀的章節與文字片段。
- **動態超頻動能充能 (Kinetic Charge Overdrive)**：連續導航時觸發動態流動光效與微型拖尾加速。
- **極致狀態列 HUD 升級**：整合章節路徑（Breadcrumbs）、預估剩餘閱讀時間、計數前綴（Count Prefix）與暫存鍵緩衝提示徽章。
- **分頁專屬休眠與全域開關解耦**：單一分頁休眠不影響其他分頁之使用。

### English
- **Rearview Mirror Peek HUD**: Temporary HUD notification at the top displaying previous reading context and section headings upon long-distance jumps.
- **Kinetic Charge Overdrive Animation**: Responsive energy trail effect that charges dynamically during high-frequency keystroke navigation.
- **Status Bar HUD Enhancements**: Added section breadcrumbs, estimated remaining reading time, count prefix buffer, and pending key badges.
- **Per-Tab Sleep Decoupling**: Differentiated individual tab standby mode from the global extension toggle.

---

## [v0.1.3] - 2026-10-14

### 繁體中文 (Traditional Chinese)
- **Visual Line 整行選取模式 (`Shift + V`)**：支援整行選取、整行展開掃掠光效與行數統計。
- **純 CSS 物理排版閱讀作用域隔離**：採用純 CSSOM 物理特徵辨識主閱讀流，自動排除浮動側欄、年表卡片與導覽列。
- **一鍵版本檢查與更新工作流程**：在選項與彈窗頁面支援自動檢查新版本。

### English
- **Visual Line Selection Mode (`Shift + V`)**: Implemented full-line text selection with dynamic beam sweep effects and line counting telemetry.
- **Pure CSS Physical Scope Isolation**: Switched to strict CSSOM geometric layout inspection to prevent cursor leakage into sidebars and floating widgets.
- **One-Click Update Checker**: Added automated version checking and streamlined update workflow in settings.

---

## [v0.1.2] - 2026-10-14

### 繁體中文 (Traditional Chinese)
- **跳轉歷史堆疊與 Neovim 浮動選單**：支援 `''` 與 ` `` ` 跳回前次歷史位置，並具備 1-9 數字鍵快速跳轉清單 HUD。

### English
- **Jump History Stack & Neovim-Style Jump Menu**: Added jumplist navigation (`''` / ` `` `) and a dedicated floating HUD menu with 1-9 direct jump keys.

---

## [v0.1.1] - 2026-10-14

### 繁體中文 (Traditional Chinese)
- **黃金閱讀視口自適應平滑滾動**：大幅提升滾動跟隨精度與平滑阻尼體驗。
- **游標殘影對齊與自動化運動測試套件**：修正殘影發射方向，新增 `tests/motion` 自動化物理測試。

### English
- **Adaptive Viewport Smooth Scrolling**: Enhanced golden-ratio reading viewport tracking with calibrated Ease-Out Cubic damping.
- **Motion Trail Alignment & Automated Test Suite**: Corrected ghost trail departure physics and introduced the `tests/motion` headless test harness.

---

## [v0.1.0] - 2026-10-13

### 繁體中文 (Traditional Chinese)
- **初始正式發布**：
  - 核心 Vim 鍵盤閱讀導航 (`h/j/k/l`, `w/b/e`, `0/$`, `gg/G`)。
  - 沉浸式多行運動殘影（Motion Trails）與 Gruvbox 等多種禪意主題。
  - 視覺選取與 Yank 複製模式 (`v/y`)、自適應行高與多欄排版支援。

### English
- **Initial Public Release**:
  - Core Vim-style distraction-free reading cursor (`h/j/k/l`, `w/b/e`, `0/$`, `gg/G`).
  - Immersive multi-line motion trails and curated zen themes (Gruvbox, Nord, Tokyo Night, etc.).
  - Visual selection and Yank copy mode (`v/y`), dynamic line height adaptation, and multi-column web support.
