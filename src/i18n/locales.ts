/**
 * Muzen Cursor 多國語言字典 (繁體中文、英文、日文)
 */

export type Locale = 'zh-TW' | 'en' | 'ja';

export interface Translations {
  appName: string;
  appSubtitle: string;
  languageLabel: string;
  themeLabel: string;
  themeGruvboxDark: string;
  themeGruvboxLight: string;
  themeTokyoNight: string;
  themeNord: string;
  themeCatppuccin: string;
  themeEverforest: string;
  themeIntellijDarcula: string;
  themeIntellijLight: string;
  themeDracula: string;
  themeMonokai: string;
  themeOneDark: string;
  themeSolarizedDark: string;
  themeRosePine: string;
  themeCyberpunk: string;
  shapeLabel: string;
  shapeBlock: string;
  shapeHollow: string;
  shapeUnderline: string;
  thicknessLabel: string;
  thicknessPresetThin: string;
  thicknessPresetClassic: string;
  thicknessPresetMedium: string;
  thicknessPresetThick: string;
  glowLabel: string;
  glowOff: string;
  glowOffDetail: string;
  effectsLabel: string;
  motionEffectsLabel: string;
  pulseEffectLabel: string;
  pulseNone: string;
  effectSmooth: string;
  effectBounce: string;
  effectSmoothScroll: string;
  effectBreathe: string;
  effectBlink: string;
  statusBarSectionLabel: string;
  statusBarSectionDesc: string;
  blacklistSectionLabel: string;
  blacklistSectionDesc: string;
  blacklistDetecting: string;
  blacklistLocalTab: string;
  blacklistManage: string;
  blacklistPlaceholder: string;
  blacklistSaveBtn: string;
  blacklistSavedBtn: string;
  pdfSectionLabel: string;
  pdfSectionDesc: string;
  pdfOpenBtn: string;
  shortcutsTitle: string;
  shortcutHjkl: string;
  shortcutHalfPage: string;
  shortcutWbe: string;
  shortcutLineBoundary: string;
  shortcutDocBoundary: string;
  shortcutVisual: string;
  shortcutToggle: string;
  shortcutEscape: string;
  footerTip: string;
  statusStartPrompt: string;
  advancedSettingsBtn: string;
  resetDefaultsBtn: string;
  resetDefaultsSuccess: string;
  // Options 頁面翻譯
  optionsTitle: string;
  optionsSubtitle: string;
  exportJsonBtn: string;
  importJsonBtn: string;
  resetAllBtn: string;
  groupGeometryTitle: string;
  groupGeometryDesc: string;
  groupPhysicsTitle: string;
  groupPhysicsDesc: string;
  groupTransitionTitle: string;
  groupTransitionDesc: string;
  groupAnimationTitle: string;
  groupAnimationDesc: string;
  groupScrollTitle: string;
  groupScrollDesc: string;
  sandboxTitle: string;
  sandboxDesc: string;
  sandboxPara1: string;
  sandboxPara2: string;
  sandboxPara3: string;
  sandboxPara4: string;
  sandboxPara5: string;
  sandboxPara6: string;
  // Options 欄位標籤與提示
  fieldThickness: string;
  hintThickness: string;
  fieldBorderRadius: string;
  hintBorderRadius: string;
  fieldOutlineOffset: string;
  hintOutlineOffset: string;
  fieldGlowRadius: string;
  hintGlowRadius: string;
  fieldBlockBgOpacity: string;
  hintBlockBgOpacity: string;
  fieldVisualBgOpacity: string;
  hintVisualBgOpacity: string;
  fieldHollowBgOpacity: string;
  hintHollowBgOpacity: string;

  fieldPerspective: string;
  hintPerspective: string;
  fieldTiltAngleX: string;
  hintTiltAngleX: string;
  fieldTiltAngleY: string;
  hintTiltAngleY: string;
  fieldScaleStretchX: string;
  hintScaleStretchX: string;
  fieldScaleSquishY: string;
  hintScaleSquishY: string;
  fieldScaleStretchY: string;
  hintScaleStretchY: string;
  fieldScaleSquishX: string;
  hintScaleSquishX: string;
  fieldDeformSettleMs: string;
  hintDeformSettleMs: string;

  fieldSmoothDurationMs: string;
  hintSmoothDurationMs: string;
  fieldSpringDurationMs: string;
  hintSpringDurationMs: string;
  fieldSpringOvershoot: string;
  hintSpringOvershoot: string;

  fieldBreatheDuration: string;
  hintBreatheDuration: string;
  fieldBreathePeakOpacity: string;
  hintBreathePeakOpacity: string;
  fieldBlinkDuration: string;
  hintBlinkDuration: string;
  fieldMoveSettleDelayMs: string;
  hintMoveSettleDelayMs: string;

  fieldScrollDurationMs: string;
  hintScrollDurationMs: string;
  fieldViewportPaddingTop: string;
  hintViewportPaddingTop: string;
  fieldViewportPaddingBottom: string;
  hintViewportPaddingBottom: string;

  sandboxThemeLabel: string;
  sandboxShapeLabel: string;
  padUpBtn: string;
  padLeftBtn: string;
  padRightBtn: string;
  padDownBtn: string;
  padJumpBtn: string;
  padVisualBtn: string;
  padYankBtn: string;
  padEscBtn: string;
  diagPerspective: string;
  diagTilt: string;
  diagSettleTime: string;

  unitSeconds: string;
  unitTension: string;
  resetFieldTooltip: string;
  toastUpdated: string;
  toastFieldReset: string;
  confirmResetAll: string;
  toastResetAll: string;
  toastExportSuccess: string;
  toastImportSuccess: string;
  alertImportError: string;
}

export const LOCALES: Record<Locale, Translations> = {
  'zh-TW': {
    appName: 'Muzen Cursor',
    appSubtitle: '霧前禪夢，見字如初',
    languageLabel: '介面語言',
    themeLabel: '色彩主題',
    themeGruvboxDark: 'Gruvbox Dark (經典琥珀)',
    themeGruvboxLight: 'Gruvbox Light (淡雅暖白)',
    themeTokyoNight: 'Tokyo Night (東京暗夜)',
    themeNord: 'Nord (北歐冰原)',
    themeCatppuccin: 'Catppuccin Mocha (典雅摩卡)',
    themeEverforest: 'Everforest (森野之境)',
    themeIntellijDarcula: 'IntelliJ Darcula (極客暗灰)',
    themeIntellijLight: 'IntelliJ Light (皓白純粹)',
    themeDracula: 'Dracula (幽冥吸血鬼)',
    themeMonokai: 'Monokai Pro (經典霓光)',
    themeOneDark: 'One Dark (晨星深藍)',
    themeSolarizedDark: 'Solarized Dark (晴翠深碧)',
    themeRosePine: 'Rosé Pine (復古微醺)',
    themeCyberpunk: 'Cyberpunk (霓虹幻夜)',
    shapeLabel: '游標形態',
    shapeBlock: '實心方塊 (Block)',
    shapeHollow: '空心外框 (Hollow)',
    shapeUnderline: '閱讀底線 (Underline)',
    thicknessLabel: '游標粗細',
    thicknessPresetThin: '1px 極細',
    thicknessPresetClassic: '1.5px 經典',
    thicknessPresetMedium: '2px 標準',
    thicknessPresetThick: '3px 加粗',
    glowLabel: '游標光暈 (0 為無光暈)',
    glowOff: '無',
    glowOffDetail: '0 (無光暈)',
    effectsLabel: '動態特效 (可複選)',
    motionEffectsLabel: '位移特效 (可複選)',
    pulseEffectLabel: '靜態脈動 (單選)',
    pulseNone: '常駐微光',
    effectSmooth: '平滑位移',
    effectBounce: '彈簧效果',
    effectSmoothScroll: '平滑捲動',
    effectBreathe: '禪意呼吸',
    effectBlink: '經典閃爍',
    statusBarSectionLabel: '顯示底部狀態列',
    statusBarSectionDesc: '畫面右下角呈現目前 Vim 模式與文章進度',
    blacklistSectionLabel: '在此網站停用',
    blacklistSectionDesc: '排除之網域將自動凍結游標，避免干擾編輯器或專用快捷鍵',
    blacklistManage: '⚙️ 管理排除名單',
    blacklistPlaceholder: '每行輸入一個網域，例如：\ndocs.google.com\nmail.google.com\nnotion.so',
    blacklistSaveBtn: '儲存排除名單',
    blacklistSavedBtn: '✓ 已儲存',
    blacklistDetecting: '偵測中...',
    blacklistLocalTab: '本機分頁',
    pdfSectionLabel: 'PDF 閱讀接管 (PDF.js)',
    pdfSectionDesc: '開啟後，點擊 .pdf 網址將自動進入禪意閱讀器',
    pdfOpenBtn: '📄 開啟 PDF 閱讀器',
    shortcutsTitle: '快捷鍵指引',
    shortcutHjkl: '字元 / 行 移動',
    shortcutHalfPage: '向下 / 向上半頁跳轉',
    shortcutWbe: '中英文智慧跳詞 / 詞尾',
    shortcutLineBoundary: '跳至行首 / 行尾',
    shortcutDocBoundary: '全文開頭 / 結尾',
    shortcutVisual: 'Visual 選取 / 複製 (Yank)',
    shortcutToggle: '快速啟動 / 凍結游標',
    shortcutEscape: '取消選取 / 隱藏游標',
    footerTip: '點擊網頁文字即可立即錨定閱讀焦點',
    statusStartPrompt: '點擊文字或按 j 開始',
    advancedSettingsBtn: '⚙️ 進階數值調校 (物理與動態)',
    resetDefaultsBtn: '回復 mugen-yomu 預設值',
    resetDefaultsSuccess: '已回復預設值',
    optionsTitle: 'Muzen Cursor 進階數值調校',
    optionsSubtitle: '自由輸入精確數值，客製化物理阻尼、梯形形變與視覺筆觸',
    exportJsonBtn: '📤 匯出 JSON',
    importJsonBtn: '📥 匯入 JSON',
    resetAllBtn: '↺ 全部回復預設值',
    groupGeometryTitle: '幾何外觀與筆觸 (Geometry & Appearance)',
    groupGeometryDesc: '控制游標輪廓線條、圓角弧度與色彩半透明度',
    groupPhysicsTitle: '梯形彈跳與 3D 透視物理 (Trapezoid & 3D Deformation)',
    groupPhysicsDesc: 'mugen-yomu 招牌梯形回彈與立體果凍形變數值',
    groupTransitionTitle: '平滑過渡與阻尼時間 (Transition & Spring Physics)',
    groupTransitionDesc: '位移過渡曲線與超調回彈彈力',
    groupAnimationTitle: '動態節奏與避震計時器 (Animation & Rhythm)',
    groupAnimationDesc: '控制呼吸燈律動、閃爍循環與移動停止後的避震恢復',
    groupScrollTitle: '平滑捲動與黃金視野 (Scrolling & Viewport)',
    groupScrollDesc: 'Ease-Out Cubic 視窗阻尼捲動與黃金閱讀邊界',
    sandboxTitle: '即時物理互動沙盒',
    sandboxDesc: '輸入左側任意數值即可即時反映。支援鍵盤 h / j / k / l 或點擊下方按鈕進行測試：',
    sandboxPara1: '霧前禪夢，見字如初。當字元在深沉的黑色底蘊中漸次浮現，梯形物理的彈性回彈賦予每一個跳躍溫潤的生命力。',
    sandboxPara2: '在喧囂繁複的網路時代，回歸純粹的 Vim 鍵位導航，以最少的手部位移沉浸於文字之美。輕觸 h、j、k、l 感受極致絲滑的阻尼。',
    sandboxPara3: '每一道微光呼吸皆在靜默中守候，於移動瞬間常駐光明，於佇足之時安詳吐納。自由調配專屬數值，找回屬於您的閱讀專注力。',
    sandboxPara4: '黃金視野邊距隨時守候，當游標向下接近底緣或向上逼近頂端，Ease-Out Cubic 物理平滑推動視窗，令目光恆常平靜安歇。',
    sandboxPara5: '輕按 v 鍵進入 Visual 選取模式，字句反白隨心所欲；按 y 複製智慧存檔，Esc 還原沉浸節奏，行雲流水不著痕跡。',
    sandboxPara6: '長文深處，一念清寂。上下翻飛間，阻尼與彈力在此交會，讓每一次指尖的輕敲，皆成為閱讀旅途中的極致享受。',
    fieldThickness: '游標粗細/線寬 (Thickness)',
    hintThickness: '外框線寬或底線高度',
    fieldBorderRadius: '圓角半徑 (Border Radius)',
    hintBorderRadius: '方塊與外框角落平滑度',
    fieldOutlineOffset: '外框外擴偏移 (Outline Offset)',
    hintOutlineOffset: '實心方塊輪廓向外或向內偏移',
    fieldGlowRadius: '光暈擴散半徑 (Glow Radius)',
    hintGlowRadius: '周邊陰影發光半徑 (0 為關閉)',
    fieldBlockBgOpacity: 'NORMAL 方塊背景透明度',
    hintBlockBgOpacity: '實心方塊底色填充不透明度 (0 ~ 1)',
    fieldVisualBgOpacity: 'VISUAL 選取背景透明度',
    hintVisualBgOpacity: '選取反白高亮不透明度 (0 ~ 1)',
    fieldHollowBgOpacity: '空心內部底色透明度',
    hintHollowBgOpacity: '空心外框形態內部淡彩 (0 ~ 1)',
    fieldPerspective: '3D 透視景深 (Perspective)',
    hintPerspective: '3D 視角距離，數值愈小立體傾角愈強烈',
    fieldTiltAngleX: '水平跳字傾斜角 (Tilt Angle X)',
    hintTiltAngleX: '左右移動 (h/l/w/b) rotateY 旋轉角度',
    fieldTiltAngleY: '垂直跳行傾斜角 (Tilt Angle Y)',
    hintTiltAngleY: '上下換行 (j/k) rotateX 旋轉角度',
    fieldScaleStretchX: '橫向衝刺伸展倍率 (Stretch X)',
    hintScaleStretchX: '左右跳字瞬間水平方向拉伸比例',
    fieldScaleSquishY: '橫向抗積擠壓比例 (Squish Y)',
    hintScaleSquishY: '左右跳字瞬間垂直方向擠壓比例',
    fieldScaleStretchY: '垂直換行伸展倍率 (Stretch Y)',
    hintScaleStretchY: '上下跳行瞬間垂直方向拉長比例',
    fieldScaleSquishX: '垂直換行擠壓比例 (Squish X)',
    hintScaleSquishX: '上下跳行瞬間水平方向微縮比例',
    fieldDeformSettleMs: '形變回彈復原時間 (Settle Time)',
    hintDeformSettleMs: '梯形瞬間恢復為常規矩形的延遲時長',
    fieldSmoothDurationMs: '純平滑位移時長 (Smooth Duration)',
    hintSmoothDurationMs: '未開啟彈簧回彈時之基礎平滑位移耗時',
    fieldSpringDurationMs: '彈簧回彈過渡時長 (Spring Duration)',
    hintSpringDurationMs: '開啟彈跳時之衝刺與回彈動畫時長',
    fieldSpringOvershoot: '彈簧超調張力係數 (Overshoot)',
    hintSpringOvershoot: 'Cubic-bezier(0.34, X, 0.64, 1) 彈力超調值',
    fieldBreatheDuration: '呼吸燈完整週期 (Breathe Duration)',
    hintBreatheDuration: '吸氣至頂峰再呼氣之完整循環時長',
    fieldBreathePeakOpacity: '呼吸燈頂峰不透明度 (Peak Opacity)',
    hintBreathePeakOpacity: '吸氣至最亮頂峰時的不透明度 (0 ~ 1)',
    fieldBlinkDuration: '經典閃爍循環週期 (Blink Duration)',
    hintBlinkDuration: '終端機閃爍完整亮滅週期時長',
    fieldMoveSettleDelayMs: '移動避震恢復延遲 (Move Settle Delay)',
    hintMoveSettleDelayMs: '停止打字移動後，恢復閃爍/呼吸之延遲',
    fieldScrollDurationMs: '視窗平滑捲動時長 (Scroll Duration)',
    hintScrollDurationMs: 'Ease-Out Cubic 物理平滑捲動之總耗時',
    fieldViewportPaddingTop: '視窗頂部安全邊距 (Padding Top)',
    hintViewportPaddingTop: '游標向上接近頂部多少像素時自動推動頁面',
    fieldViewportPaddingBottom: '視窗底部安全邊距 (Padding Bottom)',
    hintViewportPaddingBottom: '游標向下接近底部多少像素時自動推動頁面',
    sandboxThemeLabel: '色彩主題：',
    sandboxShapeLabel: '游標形態：',
    padUpBtn: '↑ k (上行)',
    padLeftBtn: '← h (左字)',
    padRightBtn: 'l (右字) →',
    padDownBtn: '↓ j (下行)',
    padJumpBtn: 'w (跳詞)',
    padVisualBtn: 'v (選取)',
    padYankBtn: 'y (複製)',
    padEscBtn: 'Esc (取消)',
    diagPerspective: '透視景深:',
    diagTilt: '傾斜角度:',
    diagSettleTime: '回彈時間:',
    unitSeconds: '秒 (s)',
    unitTension: '張力',
    resetFieldTooltip: '還原預設值',
    toastUpdated: '✓ 數值已更新並同步至全部分頁',
    toastFieldReset: '已將「{field}」還原為預設值',
    confirmResetAll: '確定要將所有進階數值回復為官方預設值嗎？',
    toastResetAll: '✓ 所有進階數值已回復為預設值',
    toastExportSuccess: '✓ 已匯出設定檔 (JSON)',
    toastImportSuccess: '✓ 成功匯入外部進階設定',
    alertImportError: '匯入失敗：JSON 格式無效'
  },
  'en': {
    appName: 'Muzen Cursor',
    appSubtitle: 'Zen-like Reading Companion',
    languageLabel: 'Language',
    themeLabel: 'Color Theme',
    themeGruvboxDark: 'Gruvbox Dark (Classic Amber)',
    themeGruvboxLight: 'Gruvbox Light (Warm Cream)',
    themeTokyoNight: 'Tokyo Night (Midnight Blue)',
    themeNord: 'Nord (Arctic Frost)',
    themeCatppuccin: 'Catppuccin Mocha (Pastel Mauve)',
    themeEverforest: 'Everforest (Deep Forest)',
    themeIntellijDarcula: 'IntelliJ Darcula (Geek Gray)',
    themeIntellijLight: 'IntelliJ Light (Clean White)',
    themeDracula: 'Dracula (Vampire Purple)',
    themeMonokai: 'Monokai Pro (Neon Classic)',
    themeOneDark: 'One Dark (Atom Navy)',
    themeSolarizedDark: 'Solarized Dark (Solar Cyan)',
    themeRosePine: 'Rosé Pine (Vintage Bloom)',
    themeCyberpunk: 'Cyberpunk (Neon Mirage)',
    shapeLabel: 'Cursor Shape',
    shapeBlock: 'Solid Block',
    shapeHollow: 'Hollow Outline',
    shapeUnderline: 'Reading Underline',
    thicknessLabel: 'Cursor Thickness',
    thicknessPresetThin: '1px Ultra',
    thicknessPresetClassic: '1.5px Classic',
    thicknessPresetMedium: '2px Medium',
    thicknessPresetThick: '3px Bold',
    glowLabel: 'Cursor Glow (0 is Off)',
    glowOff: 'Off',
    glowOffDetail: '0 (Off)',
    effectsLabel: 'Motion Effects (Multi-select)',
    motionEffectsLabel: 'Motion Effects (Multi-select)',
    pulseEffectLabel: 'Idle Pulse (Single-choice)',
    pulseNone: 'Steady Glow',
    effectSmooth: 'Smooth Motion',
    effectBounce: 'Spring Effect',
    effectSmoothScroll: 'Smooth Scroll',
    effectBreathe: 'Zen Pulse',
    effectBlink: 'Classic Blink',
    statusBarSectionLabel: 'Show Status Bar',
    statusBarSectionDesc: 'Display Vim mode & reading progress at bottom-right',
    blacklistSectionLabel: 'Disable on Current Site',
    blacklistSectionDesc: 'Muzen will be deactivated on excluded sites to prevent interference',
    blacklistManage: '⚙️ Manage Excluded Sites',
    blacklistPlaceholder: 'One domain per line, e.g.:\ndocs.google.com\nmail.google.com\nnotion.so',
    blacklistSaveBtn: 'Save Excluded Sites',
    blacklistSavedBtn: '✓ Saved',
    blacklistDetecting: 'Detecting...',
    blacklistLocalTab: 'Local Page',
    pdfSectionLabel: 'PDF Interception (PDF.js)',
    pdfSectionDesc: 'Automatically open .pdf files inside Zen Reader',
    pdfOpenBtn: '📄 Open PDF Viewer',
    shortcutsTitle: 'Keyboard Shortcuts',
    shortcutHjkl: 'Char / Line Navigation',
    shortcutHalfPage: 'Half-page Down / Up',
    shortcutWbe: 'Smart Word Navigation (w/b/e)',
    shortcutLineBoundary: 'Line Start / End',
    shortcutDocBoundary: 'Document Start / End',
    shortcutVisual: 'Visual Selection / Copy (Yank)',
    shortcutToggle: 'Toggle Cursor Active',
    shortcutEscape: 'Clear Selection / Dismiss',
    footerTip: 'Click any text on the page to anchor cursor',
    statusStartPrompt: 'Click text or press j to begin',
    advancedSettingsBtn: '⚙️ Advanced Physics Tuning',
    resetDefaultsBtn: 'Reset to Defaults',
    resetDefaultsSuccess: 'Restored Defaults',
    optionsTitle: 'Muzen Cursor Advanced Tuning',
    optionsSubtitle: 'Fine-tune physics damping, trapezoid bounce, and geometry parameters',
    exportJsonBtn: '📤 Export JSON',
    importJsonBtn: '📥 Import JSON',
    resetAllBtn: '↺ Restore All Defaults',
    groupGeometryTitle: 'Geometry & Appearance',
    groupGeometryDesc: 'Configure cursor outline thickness, border radius, and opacities',
    groupPhysicsTitle: 'Trapezoid & 3D Deformation Physics',
    groupPhysicsDesc: 'mugen-yomu signature 3D perspective bounce and jelly stretch ratios',
    groupTransitionTitle: 'Transition Dynamics & Spring Physics',
    groupTransitionDesc: 'Smooth transition durations and spring tension curve overshoot',
    groupAnimationTitle: 'Animation Rhythm & Motion Settle',
    groupAnimationDesc: 'Breathing pulse cycle, terminal blink rate, and motion settle delay',
    groupScrollTitle: 'Smooth Scrolling & Viewport Navigation',
    groupScrollDesc: 'Ease-Out Cubic scrolling duration and golden reading padding',
    sandboxTitle: 'Live Interactive Sandbox',
    sandboxDesc: 'Tweak values on the left to see instant updates. Test with h / j / k / l or the buttons below:',
    sandboxPara1: 'Zen-like reading with timeless clarity. As characters emerge from deep black canvas, trapezoid bounce physics grants each leap a gentle soul.',
    sandboxPara2: 'In an era of endless noise, return to pure Vim navigation with minimal hand travel. Tap h, j, k, l to feel the exquisite smooth damping.',
    sandboxPara3: 'Every soft breathing glow waits in stillness, staying brightly lit during movement, and resting gently at pause. Tune your numbers to reclaim pure focus.',
    sandboxPara4: 'Golden viewport margins guard your focus: as the cursor nears the bottom or top boundary, Ease-Out Cubic physics gently propels the viewport.',
    sandboxPara5: 'Press v to toggle Visual selection mode and highlight text with ease; press y to yank and Esc to dismiss, flowing seamlessly across the page.',
    sandboxPara6: 'Deep within long documents, stillness reigns. Damping and spring tension converge here, making every keystroke a delightful reading sensation.',
    fieldThickness: 'Cursor Thickness',
    hintThickness: 'Outline border width or underline height',
    fieldBorderRadius: 'Corner Radius',
    hintBorderRadius: 'Corner curvature for block and outline',
    fieldOutlineOffset: 'Outline Offset',
    hintOutlineOffset: 'Outward or inward offset for block outline',
    fieldGlowRadius: 'Glow Radius',
    hintGlowRadius: 'Ambient glow radius (0 to disable)',
    fieldBlockBgOpacity: 'Normal Block Opacity',
    hintBlockBgOpacity: 'Block fill opacity in NORMAL mode (0 - 1)',
    fieldVisualBgOpacity: 'Visual Selection Opacity',
    hintVisualBgOpacity: 'Highlight fill opacity in VISUAL mode (0 - 1)',
    fieldHollowBgOpacity: 'Hollow Background Opacity',
    hintHollowBgOpacity: 'Inner tint opacity for hollow shape (0 - 1)',
    fieldPerspective: '3D Perspective Depth',
    hintPerspective: 'Viewing distance: smaller values increase tilt intensity',
    fieldTiltAngleX: 'Horizontal Tilt Angle (X)',
    hintTiltAngleX: 'rotateY angle during horizontal movement (h/l/w/b)',
    fieldTiltAngleY: 'Vertical Tilt Angle (Y)',
    hintTiltAngleY: 'rotateX angle during vertical line jumps (j/k)',
    fieldScaleStretchX: 'Horizontal Stretch Ratio',
    hintScaleStretchX: 'Horizontal stretch factor upon moving left/right',
    fieldScaleSquishY: 'Horizontal Squish Ratio',
    hintScaleSquishY: 'Vertical compression factor upon moving left/right',
    fieldScaleStretchY: 'Vertical Stretch Ratio',
    hintScaleStretchY: 'Vertical stretch factor upon moving up/down',
    fieldScaleSquishX: 'Vertical Squish Ratio',
    hintScaleSquishX: 'Horizontal compression factor upon moving up/down',
    fieldDeformSettleMs: 'Deformation Settle Time',
    hintDeformSettleMs: 'Time before trapezoid springs back to flat rectangle',
    fieldSmoothDurationMs: 'Smooth Transition Duration',
    hintSmoothDurationMs: 'Basic transition time when spring bounce is disabled',
    fieldSpringDurationMs: 'Spring Transition Duration',
    hintSpringDurationMs: 'Overall animation duration for spring overshoot & settle',
    fieldSpringOvershoot: 'Spring Tension Overshoot',
    hintSpringOvershoot: 'Peak overshoot in cubic-bezier(0.34, X, 0.64, 1)',
    fieldBreatheDuration: 'Breathing Cycle Duration',
    hintBreatheDuration: 'Full inhale and exhale cycle time in seconds',
    fieldBreathePeakOpacity: 'Breathing Peak Opacity',
    hintBreathePeakOpacity: 'Max opacity at inhalation peak (0 - 1)',
    fieldBlinkDuration: 'Terminal Blink Period',
    hintBlinkDuration: 'Full on/off terminal blink duration in seconds',
    fieldMoveSettleDelayMs: 'Motion Settle Delay',
    hintMoveSettleDelayMs: 'Delay after stopping typing before resuming pulse/blink',
    fieldScrollDurationMs: 'Smooth Scroll Duration',
    hintScrollDurationMs: 'Total duration for Ease-Out Cubic smooth page scrolling',
    fieldViewportPaddingTop: 'Top Viewport Padding',
    hintViewportPaddingTop: 'Minimum distance from top edge before page scrolls',
    fieldViewportPaddingBottom: 'Bottom Viewport Padding',
    hintViewportPaddingBottom: 'Minimum distance from bottom edge before page scrolls',
    sandboxThemeLabel: 'Theme:',
    sandboxShapeLabel: 'Cursor Shape:',
    padUpBtn: '↑ k (Up)',
    padLeftBtn: '← h (Left)',
    padRightBtn: 'l (Right) →',
    padDownBtn: '↓ j (Down)',
    padJumpBtn: 'w (Word)',
    padVisualBtn: 'v (Visual)',
    padYankBtn: 'y (Yank)',
    padEscBtn: 'Esc (Cancel)',
    diagPerspective: 'Perspective:',
    diagTilt: 'Tilt Angle:',
    diagSettleTime: 'Settle Time:',
    unitSeconds: 's',
    unitTension: 'tension',
    resetFieldTooltip: 'Reset to default',
    toastUpdated: '✓ Settings updated and synced to all tabs',
    toastFieldReset: 'Reset "{field}" to default',
    confirmResetAll: 'Are you sure you want to reset all advanced settings to defaults?',
    toastResetAll: '✓ All advanced settings reset to defaults',
    toastExportSuccess: '✓ Configuration exported (JSON)',
    toastImportSuccess: '✓ Successfully imported advanced settings',
    alertImportError: 'Import failed: Invalid JSON format'
  },
  'ja': {
    appName: 'Muzen Cursor',
    appSubtitle: '霧前禅夢、文字の如く初む',
    languageLabel: '表示言語',
    themeLabel: 'カラースキーム',
    themeGruvboxDark: 'Gruvbox Dark（琥珀）',
    themeGruvboxLight: 'Gruvbox Light（生成り）',
    themeTokyoNight: 'Tokyo Night（夜桜藍）',
    themeNord: 'Nord（極北氷原）',
    themeCatppuccin: 'Catppuccin Mocha（薄紅藤）',
    themeEverforest: 'Everforest（常盤森）',
    themeIntellijDarcula: 'IntelliJ Darcula（漆黒）',
    themeIntellijLight: 'IntelliJ Light（純白）',
    themeDracula: 'Dracula（吸血鬼）',
    themeMonokai: 'Monokai Pro（電光）',
    themeOneDark: 'One Dark（星夜藍）',
    themeSolarizedDark: 'Solarized Dark（深碧）',
    themeRosePine: 'Rosé Pine（微睡み薔薇）',
    themeCyberpunk: 'Cyberpunk（電脳幻夜）',
    shapeLabel: 'カーソル形状',
    shapeBlock: 'ソリッドブロック (Block)',
    shapeHollow: 'ホローアウトライン (Hollow)',
    shapeUnderline: 'アンダーライン (Underline)',
    thicknessLabel: 'カーソルの太さ',
    thicknessPresetThin: '1px 極細',
    thicknessPresetClassic: '1.5px 定番',
    thicknessPresetMedium: '2px 標準',
    thicknessPresetThick: '3px 太字',
    glowLabel: 'カーソル光彩（0で無効）',
    glowOff: 'なし',
    glowOffDetail: '0 (無光彩)',
    effectsLabel: 'モーション効果 (複数選択可)',
    motionEffectsLabel: '移動エフェクト (複数選択可)',
    pulseEffectLabel: '静止時の脈動 (単一選択)',
    pulseNone: '常時微光',
    effectSmooth: 'スムーズ移動',
    effectBounce: 'バネ効果',
    effectSmoothScroll: 'スムーズスクロール',
    effectBreathe: '禅の呼吸',
    effectBlink: 'クラシック点滅',
    statusBarSectionLabel: 'ステータスバーを表示',
    statusBarSectionDesc: '画面右下に現在のVimモードと読書進捗を表示',
    blacklistSectionLabel: 'このサイトで無効化',
    blacklistSectionDesc: '除外リスト内のドメインではカーソルを自動休止します',
    blacklistManage: '⚙️ 除外リストの管理',
    blacklistPlaceholder: '1行に1ドメインを入力（例）：\ndocs.google.com\nmail.google.com\nnotion.so',
    blacklistSaveBtn: 'リストを保存',
    blacklistSavedBtn: '✓ 保存完了',
    blacklistDetecting: '検出中...',
    blacklistLocalTab: 'ローカルページ',
    pdfSectionLabel: 'PDFリーダー統合 (PDF.js)',
    pdfSectionDesc: '有効時、.pdfファイルを開くと禅リーダーで起動します',
    pdfOpenBtn: '📄 PDFリーダーを開く',
    shortcutsTitle: 'ショートカット案内',
    shortcutHjkl: '文字 / 行 移動',
    shortcutHalfPage: '半ページ下 / 上移動',
    shortcutWbe: '単語移動 / 語尾へ',
    shortcutLineBoundary: '行頭 / 行末へジャンプ',
    shortcutDocBoundary: '文書の先頭 / 末尾',
    shortcutVisual: 'ビジュアル選択 / コピー (Yank)',
    shortcutToggle: 'カーソル起動 / 停止',
    shortcutEscape: '選択解除 / 非表示',
    footerTip: 'テキストをクリックして読書アンカーを設定',
    statusStartPrompt: 'クリックまたは j で開始',
    advancedSettingsBtn: '⚙️ 高度な物理・動態調整',
    resetDefaultsBtn: '初期設定に戻す',
    resetDefaultsSuccess: '初期値に戻しました',
    optionsTitle: 'Muzen Cursor 高度な数値調整',
    optionsSubtitle: '物理減衰、台形バウンス、幾何学パラメータを自在に入力・調整',
    exportJsonBtn: '📤 JSONをエクスポート',
    importJsonBtn: '📥 JSONをインポート',
    resetAllBtn: '↺ すべて初期値に戻す',
    groupGeometryTitle: '幾何学的外観と筆跡 (Geometry & Appearance)',
    groupGeometryDesc: 'カーソルの輪郭の太さ、角丸、透明度を制御',
    groupPhysicsTitle: '台形バウンスと3D透視物理 (Trapezoid & 3D Deformation)',
    groupPhysicsDesc: 'mugen-yomu特有の3D立体傾斜とゼリー状伸縮比率',
    groupTransitionTitle: 'スムーズ遷移とスプリング物理 (Transition & Spring Physics)',
    groupTransitionDesc: '変位遷移時間とスプリング張力曲線の反発強度',
    groupAnimationTitle: 'アニメーションリズムと静止タイマー (Animation & Rhythm)',
    groupAnimationDesc: '呼吸光の周期、点滅頻度、移動後の安定化遅延',
    groupScrollTitle: 'スムーズスクロールと視界領域 (Scrolling & Viewport)',
    groupScrollDesc: 'Ease-Out Cubicスクロール時間と快適な読書マージン',
    sandboxTitle: 'リアルタイム物理サンドボックス',
    sandboxDesc: '左側の数値を変更すると即座に反映。h / j / k / l やボタンでテストできます：',
    sandboxPara1: '霧前禅夢、文字の如く初む。深遠なる黒の余白に文字が浮かび、台形物理の弾性バウンスが跳躍に生命を吹き込みます。',
    sandboxPara2: '騒々しい情報化時代において、手首の負担を抑えるVimキーナビゲーションへ回帰。h、j、k、lで極上の滑らかさを体験。',
    sandboxPara3: '静寂の中に宿る微光の呼吸は、移動時に明るく常駐し、停止時に優しく息づきます。数値を自由に調合し、集中力を取り戻しましょう。',
    sandboxPara4: '黄金視界マージンが読書を守護。カーソルが上下の端に近づくと、Ease-Out Cubic物理エンジンが視界を滑らかに押し広げます。',
    sandboxPara5: 'vキーでVisual選択モードに切り替え、範囲選択も思いのまま。yでコピー、Escで即座に解除し、途切れない読書体験へ。',
    sandboxPara6: '長文の深淵に広がる静寂。減衰とスプリング張力が調和し、指先ひとつで極上の快適さと美しさを届牢します。',
    fieldThickness: 'カーソルの太さ/線幅 (Thickness)',
    hintThickness: '枠線の太さまたは下線の高さ',
    fieldBorderRadius: '角丸半径 (Border Radius)',
    hintBorderRadius: 'ブロックと枠線の角の滑らかさ',
    fieldOutlineOffset: '枠線オフセット (Outline Offset)',
    hintOutlineOffset: 'ソリッドブロック枠線の内外オフセット',
    fieldGlowRadius: '光彩拡散半径 (Glow Radius)',
    hintGlowRadius: '周辺グロー光彩半径 (0で無効)',
    fieldBlockBgOpacity: 'NORMAL モード背景透明度',
    hintBlockBgOpacity: 'ブロック塗りつぶし不透明度 (0 ~ 1)',
    fieldVisualBgOpacity: 'VISUAL 選択背景透明度',
    hintVisualBgOpacity: '文字選択ハイライト不透明度 (0 ~ 1)',
    fieldHollowBgOpacity: 'ホロー内部背景透明度',
    hintHollowBgOpacity: '中空形状の内側淡色透明度 (0 ~ 1)',
    fieldPerspective: '3D 透視深度 (Perspective)',
    hintPerspective: '3D視点距離。値が小さいほど立体傾斜が強くなります',
    fieldTiltAngleX: '水平移動傾斜角 (Tilt Angle X)',
    hintTiltAngleX: '左右移動 (h/l/w/b) の rotateY 傾斜角度',
    fieldTiltAngleY: '垂直改行傾斜角 (Tilt Angle Y)',
    hintTiltAngleY: '上下行移動 (j/k) の rotateX 傾斜角度',
    fieldScaleStretchX: '水平伸張倍率 (Stretch X)',
    hintScaleStretchX: '左右移動瞬間の水平方向引き伸ばし比率',
    fieldScaleSquishY: '垂直圧縮比率 (Squish Y)',
    hintScaleSquishY: '左右移動瞬間の垂直方向押しつぶし比率',
    fieldScaleStretchY: '垂直伸張倍率 (Stretch Y)',
    hintScaleStretchY: '上下移動瞬間の垂直方向引き伸ばし比率',
    fieldScaleSquishX: '水平圧縮比率 (Squish X)',
    hintScaleSquishX: '上下移動瞬間の水平方向縮小比率',
    fieldDeformSettleMs: '変形復帰時間 (Settle Time)',
    hintDeformSettleMs: '台形から通常矩形に復元する遅延ミリ秒',
    fieldSmoothDurationMs: '通常スムーズ遷移時間 (Smooth Duration)',
    hintSmoothDurationMs: 'スプリング無効時の基本スムーズ遷移時間',
    fieldSpringDurationMs: 'スプリング反発遷移時間 (Spring Duration)',
    hintSpringDurationMs: 'バネ効果有効時の衝動・反発アニメーション時間',
    fieldSpringOvershoot: 'スプリング張力係数 (Overshoot)',
    hintSpringOvershoot: 'Cubic-bezier(0.34, X, 0.64, 1) 反発強度',
    fieldBreatheDuration: '呼吸光サイクル周期 (Breathe Duration)',
    hintBreatheDuration: '吸気から呼気までの完全な1サイクル秒数',
    fieldBreathePeakOpacity: '呼吸光ピーク不透明度 (Peak Opacity)',
    hintBreathePeakOpacity: '最も明るい瞬間の最大不透明度 (0 ~ 1)',
    fieldBlinkDuration: '点滅サイクル周期 (Blink Duration)',
    hintBlinkDuration: 'ターミナル点滅の完全な点滅周期秒数',
    fieldMoveSettleDelayMs: '移動安定化遅延 (Move Settle Delay)',
    hintMoveSettleDelayMs: '入力停止後、点滅や呼吸を再開するまでの遅延',
    fieldScrollDurationMs: 'スムーズスクロール時間 (Scroll Duration)',
    hintScrollDurationMs: 'Ease-Out Cubic 物理スムーズスクロール総時間',
    fieldViewportPaddingTop: '視界上部マージン (Padding Top)',
    hintViewportPaddingTop: 'カーソルが上端に近づいた際に自動追従する距離',
    fieldViewportPaddingBottom: '視界下部マージン (Padding Bottom)',
    hintViewportPaddingBottom: 'カーソルが下端に近づいた際に自動追従する距離',
    sandboxThemeLabel: 'カラースキーム：',
    sandboxShapeLabel: 'カーソル形状：',
    padUpBtn: '↑ k (上行)',
    padLeftBtn: '← h (左字)',
    padRightBtn: 'l (右字) →',
    padDownBtn: '↓ j (下行)',
    padJumpBtn: 'w (単語)',
    padVisualBtn: 'v (選択)',
    padYankBtn: 'y (コピー)',
    padEscBtn: 'Esc (解除)',
    diagPerspective: '透視深度:',
    diagTilt: '傾斜角度:',
    diagSettleTime: '復帰時間:',
    unitSeconds: '秒 (s)',
    unitTension: '張力',
    resetFieldTooltip: 'デフォルトに戻す',
    toastUpdated: '✓ 設定が更新され、全タブに同期されました',
    toastFieldReset: '「{field}」をデフォルトに戻しました',
    confirmResetAll: 'すべての高度な設定をデフォルトに戻してもよろしいですか？',
    toastResetAll: '✓ すべての高度な設定をデフォルトに戻しました',
    toastExportSuccess: '✓ 設定をエクスポートしました (JSON)',
    toastImportSuccess: '✓ 高度な設定をインポートしました',
    alertImportError: 'インポート失敗：無効な JSON 形式です'
  }
};

/**
 * 依據瀏覽器環境自動偵測預設語言
 */
export function detectDefaultLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('zh')) return 'zh-TW';
  }
  return 'zh-TW';
}
