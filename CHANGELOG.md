# Changelog / 更新日誌

All notable changes to this project will be documented in this file.  
本專案所有顯著變更皆會記錄於本檔案中。

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
