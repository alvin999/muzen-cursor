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
- **Features**: Smart adaptive color theme for popup and options pages.
- **Fixes**: ESC key passthrough handling for native modals and overlays.

---

## [v0.1.6] - 2026-10-14
- **Features**: Multi-line trajectory planning and 3D perspective warp trails.
