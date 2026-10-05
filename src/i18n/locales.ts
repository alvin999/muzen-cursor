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
  effectTrail: string;
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

  groupTrailTitle: string;
  groupTrailDesc: string;
  fieldTrailMode: string;
  hintTrailMode: string;
  trailModeLine: string;
  trailModeDirect: string;
  fieldTrailCount: string;
  hintTrailCount: string;
  fieldTrailDurationMs: string;
  hintTrailDurationMs: string;
  fieldTrailDecayExponent: string;
  hintTrailDecayExponent: string;
  fieldTrailMaxOpacity: string;
  hintTrailMaxOpacity: string;
  fieldTrailPreserveTrapezoid: string;
  hintTrailPreserveTrapezoid: string;

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

  // 標籤頁與按鍵設定
  tabPhysicsTitle: string;
  tabKeybindingsTitle: string;
  keybindingsSectionTitle: string;
  keybindingsSectionDesc: string;
  conflictStrategyTitle: string;
  conflictStrategyDesc: string;
  conflictModeActiveOnly: string;
  conflictModeActiveOnlyDesc: string;
  conflictModeAlways: string;
  conflictModeAlwaysDesc: string;
  conflictModeRequireModifier: string;
  conflictModeRequireModifierDesc: string;
  passthroughSitesTitle: string;
  passthroughSitesDesc: string;
  passthroughPlaceholder: string;
  savePassthroughBtn: string;
  passthroughSavedBtn: string;
  siteRulesTitle: string;
  siteRulesDesc: string;

  groupSystemKeysTitle: string;
  groupMoveKeysTitle: string;
  groupWordKeysTitle: string;
  groupPageKeysTitle: string;
  groupVisualKeysTitle: string;

  actionToggleCursor: string;
  descToggleCursor: string;
  actionEscape: string;
  descEscape: string;
  actionMoveLeft: string;
  descMoveLeft: string;
  actionMoveRight: string;
  descMoveRight: string;
  actionMoveUp: string;
  descMoveUp: string;
  actionMoveDown: string;
  descMoveDown: string;
  actionWordForward: string;
  descWordForward: string;
  actionWordBackward: string;
  descWordBackward: string;
  actionWordEnd: string;
  descWordEnd: string;
  actionLineStart: string;
  descLineStart: string;
  actionLineEnd: string;
  descLineEnd: string;
  actionHalfPageDown: string;
  descHalfPageDown: string;
  actionHalfPageUp: string;
  descHalfPageUp: string;
  actionDocStart: string;
  descDocStart: string;
  actionDocEnd: string;
  descDocEnd: string;
  actionVisualMode: string;
  descVisualMode: string;
  actionYank: string;
  descYank: string;

  recordKeyBtn: string;
  recordingKeyPrompt: string;
  clearKeyBtn: string;
  resetKeybindingsBtn: string;
  keyConflictWarning: string;
  keyDisabledText: string;
  toastKeybindingsReset: string;
  openKeybindingsSettingsBtn: string;
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
    effectTrail: '流光殘影',
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
    resetDefaultsBtn: '回復預設值',
    resetDefaultsSuccess: '已回復預設值',
    optionsTitle: 'Muzen Cursor 進階數值調校',
    optionsSubtitle: '自由輸入精確數值，客製化物理阻尼、梯形形變與視覺筆觸',
    exportJsonBtn: '📤 匯出 JSON',
    importJsonBtn: '📥 匯入 JSON',
    resetAllBtn: '↺ 全部回復預設值',
    groupGeometryTitle: '幾何外觀與筆觸 (Geometry & Appearance)',
    groupGeometryDesc: '控制游標輪廓線條、圓角弧度與色彩半透明度',
    groupPhysicsTitle: '梯形彈跳與 3D 透視物理 (Trapezoid & 3D Deformation)',
    groupPhysicsDesc: '招牌梯形回彈與立體果凍形變數值',
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
    groupTrailTitle: '流光殘影與動態拖尾 (Motion Trail & Afterimage)',
    groupTrailDesc: '移動時留下由濃漸淡、且保持 3D 透視梯形角度的水墨流光拖尾',
    fieldTrailMode: '殘影軌跡模式 (Trail Mode)',
    hintTrailMode: '選擇換行時殘影貼著每一行穿梭流動，或兩點起終點直線躍遷',
    trailModeLine: '逐行流光 (貼著每一行流動)',
    trailModeDirect: '兩點躍遷 (起終點直線過渡)',
    fieldTrailCount: '殘影階數/數量 (Trail Count)',
    hintTrailCount: '拖尾產生的分身殘影階數 (2 ~ 8 階)',
    fieldTrailDurationMs: '殘影消散時長 (Trail Duration)',
    hintTrailDurationMs: '殘影從顯現至平滑消散的毫秒數 (ms)',
    fieldTrailDecayExponent: '距離衰減曲率 (Decay Exponent)',
    hintTrailDecayExponent: '數值越大，離游標越遠的殘影越快變淡',
    fieldTrailMaxOpacity: '近端殘影不透明度 (Peak Opacity)',
    hintTrailMaxOpacity: '最靠近主游標的殘影起始明亮程度 (0.1 ~ 1.0)',
    fieldTrailPreserveTrapezoid: '保持梯形透視 (Preserve Trapezoid)',
    hintTrailPreserveTrapezoid: '殘影淡出全程鎖定 3D 透視梯形形變角度',
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
    alertImportError: '匯入失敗：JSON 格式無效',

    tabPhysicsTitle: '📐 物理與動態調校',
    tabKeybindingsTitle: '⌨️ 按鍵設定與衝突管理',
    keybindingsSectionTitle: '快捷鍵設定與防衝突機制',
    keybindingsSectionDesc: '自訂所有 Vim 導航按鍵，並靈活應對 YouTube、GitHub、Gmail 等網頁專屬快捷鍵',
    conflictStrategyTitle: '網頁快捷鍵衝突防護策略',
    conflictStrategyDesc: '當瀏覽本身已有內建快捷鍵的網頁時，選擇 Muzen Cursor 的接管方式',
    conflictModeActiveOnly: '僅游標喚醒時接管 (推薦)',
    conflictModeActiveOnlyDesc: '平常放行單鍵給 YouTube、Gmail；按下切換鍵 (alt + v) 或點擊文字喚醒游標後才接管，按 Esc 隱藏後立即歸還網頁。',
    conflictModeAlways: '隨時接管模式 (經典 Vim)',
    conflictModeAlwaysDesc: '隨時響應單鍵快捷鍵（可能與 YouTube、Gmail 原生按鍵重疊）。',
    conflictModeRequireModifier: '修飾鍵模式 (alt 組合鍵)',
    conflictModeRequireModifierDesc: '所有導航鍵強制搭配 alt 修飾鍵 (例如 alt + j/k)，100% 杜絕與任何網頁單鍵衝突。',
    passthroughSitesTitle: '快捷鍵直通網站清單 (Passthrough Sites)',
    passthroughSitesDesc: '在此清單內的網域中，自動避讓網頁原生快捷鍵，平時不誤彈出；按 alt + v 可隨時喚醒接管',
    passthroughPlaceholder: '每行一個網域，例如：\ngithub.com\nyoutube.com\nmail.google.com\nnotion.so',
    savePassthroughBtn: '儲存直通清單',
    passthroughSavedBtn: '✓ 直通名單已儲存',
    siteRulesTitle: '網站規則與相容性管理',
    siteRulesDesc: '分區管理「快捷鍵直通名單」與「完全停用名單」，徹底杜絕衝突與混淆',

    groupSystemKeysTitle: '系統與喚醒控制',
    groupMoveKeysTitle: '游標字元與跳行移動',
    groupWordKeysTitle: '智慧跳詞與行邊界',
    groupPageKeysTitle: '翻頁與全文躍遷',
    groupVisualKeysTitle: 'Visual 選取與文字複製',

    actionToggleCursor: '啟動 / 凍結游標',
    descToggleCursor: '切換游標主開關，喚醒或休眠',
    actionEscape: '取消選取 / 隱藏游標',
    descEscape: '退出 Visual 模式，或隱藏游標並將單鍵交還網頁',
    actionMoveLeft: '向左移動 (Move Left)',
    descMoveLeft: '游標向左移動一個字元',
    actionMoveRight: '向右移動 (Move Right)',
    descMoveRight: '游標向右移動一個字元',
    actionMoveUp: '向上移動 (Move Up)',
    descMoveUp: '游標向上跳動一行',
    actionMoveDown: '向下移動 (Move Down)',
    descMoveDown: '游標向下跳動一行',
    actionWordForward: '向前跳詞 (Word Forward)',
    descWordForward: '智慧跳至下一個詞彙開頭',
    actionWordBackward: '向後退詞 (Word Backward)',
    descWordBackward: '智慧退回上一個詞彙開頭',
    actionWordEnd: '跳至詞尾 (Word End)',
    descWordEnd: '跳至當前或下一個詞彙結尾',
    actionLineStart: '跳至行首 (Line Start)',
    descLineStart: '瞬移至當前視覺行最前端',
    actionLineEnd: '跳至行尾 (Line End)',
    descLineEnd: '瞬移至當前視覺行最末端',
    actionHalfPageDown: '向下半頁 (Half-page Down)',
    descHalfPageDown: '視窗與游標向下推進半頁視野',
    actionHalfPageUp: '向上半頁 (Half-page Up)',
    descHalfPageUp: '視窗與游標向上回推半頁視野',
    actionDocStart: '跳至全文開頭 (Doc Start)',
    descDocStart: '連按兩次 g 跳回全文最頂部',
    actionDocEnd: '跳至全文結尾 (Doc End)',
    descDocEnd: '直接躍遷至文章最底部結尾',
    actionVisualMode: 'Visual 選取模式',
    descVisualMode: '進入文字高亮反白選取狀態',
    actionYank: '複製選取文字 (Yank)',
    descYank: '將 Visual 選取字句複製至剪貼簿',

    recordKeyBtn: '點擊錄製',
    recordingKeyPrompt: '請按下按鍵組合...',
    clearKeyBtn: '停用',
    resetKeybindingsBtn: '↺ 還原預設按鍵',
    keyConflictWarning: '此按鍵已被其他動作使用！',
    keyDisabledText: '已停用',
    toastKeybindingsReset: '✓ 按鍵設定已還原為官方預設值',
    openKeybindingsSettingsBtn: '⌨️ 自訂按鍵與防衝突設定'
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
    effectTrail: 'Motion Trail',
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
    groupPhysicsDesc: 'Signature 3D perspective bounce and jelly stretch ratios',
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
    groupTrailTitle: 'Motion Trail & Afterimages',
    groupTrailDesc: 'Leave behind fading luminous echoes that preserve 3D trapezoid perspective',
    fieldTrailMode: 'Trail Motion Mode',
    hintTrailMode: 'Cascade afterimages across each line or transition directly between endpoints',
    trailModeLine: 'Line Cascade (Pass through every line)',
    trailModeDirect: 'Direct Leap (Straight two-point transition)',
    fieldTrailCount: 'Trail Ghost Count',
    hintTrailCount: 'Number of discrete afterimage steps (2 - 8)',
    fieldTrailDurationMs: 'Trail Fade Duration',
    hintTrailDurationMs: 'Duration in milliseconds for ghosts to dissolve into the page (ms)',
    fieldTrailDecayExponent: 'Distance Decay Exponent',
    hintTrailDecayExponent: 'Higher values cause distant ghosts to fade out more sharply',
    fieldTrailMaxOpacity: 'Leading Ghost Opacity',
    hintTrailMaxOpacity: 'Peak initial opacity for the ghost nearest to cursor (0.1 - 1.0)',
    fieldTrailPreserveTrapezoid: 'Preserve 3D Trapezoid',
    hintTrailPreserveTrapezoid: 'Lock 3D perspective trapezoid deformation throughout ghost dissolution',
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
    alertImportError: 'Import failed: Invalid JSON format',

    tabPhysicsTitle: '📐 Physics & Motion',
    tabKeybindingsTitle: '⌨️ Keybindings & Shortcuts',
    keybindingsSectionTitle: 'Keybindings & Conflict Resolution',
    keybindingsSectionDesc: 'Customize Vim navigation keys and resolve conflicts with YouTube, GitHub, and Gmail shortcuts',
    conflictStrategyTitle: 'Web Shortcut Conflict Strategy',
    conflictStrategyDesc: 'Choose how Muzen Cursor intercepts keys when a web page has its own shortcuts',
    conflictModeActiveOnly: 'Only When Cursor Active (Recommended)',
    conflictModeActiveOnlyDesc: 'Pass keys to YouTube and Gmail when cursor is idle. Cursor intercepts keys only when active (via alt + v or click); pressing Esc releases keys back to the webpage immediately.',
    conflictModeAlways: 'Always Active (Classic Vim)',
    conflictModeAlwaysDesc: 'Always intercept single keys (may conflict with YouTube/Gmail built-in shortcuts).',
    conflictModeRequireModifier: 'Require Modifier (Alt Key)',
    conflictModeRequireModifierDesc: 'All navigation keys must be pressed with Alt (e.g., alt + j/k), 100% avoiding web shortcut clashes.',
    passthroughSitesTitle: 'Passthrough Sites List',
    passthroughSitesDesc: 'Single-key shortcuts pass directly to the webpage; press alt + v anytime to activate cursor',
    passthroughPlaceholder: 'One domain per line, e.g.:\ngithub.com\nyoutube.com\nmail.google.com\nnotion.so',
    savePassthroughBtn: 'Save Passthrough Sites',
    passthroughSavedBtn: '✓ Passthrough Sites Saved',
    siteRulesTitle: 'Site Rules & Compatibility',
    siteRulesDesc: 'Manage Passthrough Sites and Blacklist Excluded Sites side-by-side without conflicts',

    groupSystemKeysTitle: 'System & Activation',
    groupMoveKeysTitle: 'Cursor Movement',
    groupWordKeysTitle: 'Word Navigation & Line Boundaries',
    groupPageKeysTitle: 'Page Scrolling & Document Boundary',
    groupVisualKeysTitle: 'Visual Selection & Yank',

    actionToggleCursor: 'Toggle Cursor',
    descToggleCursor: 'Turn the cursor master switch on or off',
    actionEscape: 'Cancel / Hide Cursor',
    descEscape: 'Exit Visual mode or hide cursor and return keys to web',
    actionMoveLeft: 'Move Left',
    descMoveLeft: 'Move cursor left by one character',
    actionMoveRight: 'Move Right',
    descMoveRight: 'Move cursor right by one character',
    actionMoveUp: 'Move Up',
    descMoveUp: 'Move cursor up by one line',
    actionMoveDown: 'Move Down',
    descMoveDown: 'Move cursor down by one line',
    actionWordForward: 'Word Forward',
    descWordForward: 'Jump forward to the next word start',
    actionWordBackward: 'Word Backward',
    descWordBackward: 'Jump backward to previous word start',
    actionWordEnd: 'Word End',
    descWordEnd: 'Jump to end of current/next word',
    actionLineStart: 'Line Start',
    descLineStart: 'Jump to beginning of visual line',
    actionLineEnd: 'Line End',
    descLineEnd: 'Jump to end of visual line',
    actionHalfPageDown: 'Half-page Down',
    descHalfPageDown: 'Scroll down by half a page',
    actionHalfPageUp: 'Half-page Up',
    descHalfPageUp: 'Scroll up by half a page',
    actionDocStart: 'Document Start',
    descDocStart: 'Jump to very beginning of document (gg)',
    actionDocEnd: 'Document End',
    descDocEnd: 'Jump to very end of document (G)',
    actionVisualMode: 'Visual Selection Mode',
    descVisualMode: 'Toggle character highlight selection',
    actionYank: 'Copy Selection (Yank)',
    descYank: 'Copy selected text to clipboard',

    recordKeyBtn: 'Record Key',
    recordingKeyPrompt: 'Press key combination...',
    clearKeyBtn: 'Disable',
    resetKeybindingsBtn: '↺ Reset Default Keys',
    keyConflictWarning: 'Key is already assigned to another action!',
    keyDisabledText: 'Disabled',
    toastKeybindingsReset: '✓ Keybindings restored to defaults',
    openKeybindingsSettingsBtn: '⌨️ Custom Keybindings & Conflicts'
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
    effectTrail: '流光残像',
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
    groupPhysicsDesc: '独自の3D立体傾斜とゼリー状伸縮比率',
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
    groupTrailTitle: '流光残像と動態トレイル (Motion Trail & Afterimage)',
    groupTrailDesc: '移動時に遠くほど薄れ、3D台形パースペクティブを保持した流麗な残像を生成',
    fieldTrailMode: '残像トレイルモード (Trail Mode)',
    hintTrailMode: '行移動時に各行を流れるように通過するか、始点終点の直線遷移かを選択',
    trailModeLine: '逐行流光（行ごとに流れるカスケード）',
    trailModeDirect: '二点跳躍（始点・終点の直線トランジション）',
    fieldTrailCount: '残像ステップ数 (Trail Count)',
    hintTrailCount: '生成される残像の階数 (2 ~ 8 段階)',
    fieldTrailDurationMs: '残像消失時間 (Trail Duration)',
    hintTrailDurationMs: '残像が出現してから完全に消失するまでのミリ秒 (ms)',
    fieldTrailDecayExponent: '距離減衰指数 (Decay Exponent)',
    hintTrailDecayExponent: '値が大きいほど、カーソルから離れた残像がより急峻にフェードアウト',
    fieldTrailMaxOpacity: '最前面残像の不透明度 (Peak Opacity)',
    hintTrailMaxOpacity: 'カーソルに最も近い残像の初期不透明度 (0.1 ~ 1.0)',
    fieldTrailPreserveTrapezoid: '3D台形パースを保持 (Preserve Trapezoid)',
    hintTrailPreserveTrapezoid: '残像が消えるまで台形の立体パースペクティブ傾斜角を固定保持',
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
    alertImportError: 'インポート失敗：無効な JSON 形式です',

    tabPhysicsTitle: '📐 物理とモーション調律',
    tabKeybindingsTitle: '⌨️ キー設定と衝突管理',
    keybindingsSectionTitle: 'ショートカットキー設定と競合回避',
    keybindingsSectionDesc: 'Vim移動キーを自由にカスタマイズし、YouTubeやGitHub、Gmail等の独自ショートカットとの衝突を防止します',
    conflictStrategyTitle: 'Webショートカット衝突防止戦略',
    conflictStrategyDesc: 'ページ独自のショートカットが存在する場合の動作ポリシーを選択します',
    conflictModeActiveOnly: 'カーソル起動時のみ有効 (推奨)',
    conflictModeActiveOnlyDesc: '普段はキーをYouTubeやGmailにそのまま通し、起動キー(alt + v)またはクリック時のみVimキーが動作。Escで非表示にすると即座にページへ返却します。',
    conflictModeAlways: '常時有効モード (クラシック Vim)',
    conflictModeAlwaysDesc: 'カーソル状態に関わらず常にキーを捕捉します（YouTube等の独自キーと競合する可能性があります）。',
    conflictModeRequireModifier: '修飾キー併用モード (Alt キー)',
    conflictModeRequireModifierDesc: '全ての移動キーにAltの併用を必須とし、Webページの単一キーとの衝突を100%防止します。',
    passthroughSitesTitle: 'キー直通サイトリスト (Passthrough Sites)',
    passthroughSitesDesc: 'このリスト内のドメインでは単一キーをWebページへ優先。誤クリックを防ぎ、alt + v でいつでも起動可能',
    passthroughPlaceholder: '1行に1ドメインを入力（例）：\ngithub.com\nyoutube.com\nmail.google.com\nnotion.so',
    savePassthroughBtn: '直通リストを保存',
    passthroughSavedBtn: '✓ 直通リスト保存完了',
    siteRulesTitle: 'サイト規則と互換性管理',
    siteRulesDesc: '「キー直通リスト」と「完全無効化リスト」を同一画面で一括管理し、競合を解消します',

    groupSystemKeysTitle: 'システムと起動制御',
    groupMoveKeysTitle: '文字・行移動',
    groupWordKeysTitle: '単語移動と行境界',
    groupPageKeysTitle: 'ページスクロールと文書境界',
    groupVisualKeysTitle: 'Visual選択とコピー',

    actionToggleCursor: 'カーソル有効/無効',
    descToggleCursor: 'カーソルのメインスイッチを切り替えます',
    actionEscape: '選択解除 / カーソル非表示',
    descEscape: 'Visualモードを解除、またはカーソルを非表示にしてキーを返却',
    actionMoveLeft: '左へ移動',
    descMoveLeft: 'カーソルを1文字左へ移動',
    actionMoveRight: '右へ移動',
    descMoveRight: 'カーソルを1文字右へ移動',
    actionMoveUp: '上へ移動',
    descMoveUp: 'カーソルを1行上へ移動',
    actionMoveDown: '下へ移動',
    descMoveDown: 'カーソルを1行下へ移動',
    actionWordForward: '次の単語へ',
    descWordForward: '次の単語の先頭へジャンプ',
    actionWordBackward: '前の単語へ',
    descWordBackward: '前の単語の先頭へ戻る',
    actionWordEnd: '単語の末尾へ',
    descWordEnd: '現在または次の単語の末尾へジャンプ',
    actionLineStart: '行頭へジャンプ',
    descLineStart: '現在の行の先頭へ瞬時に移動',
    actionLineEnd: '行末へジャンプ',
    descLineEnd: '現在の行の末尾へ瞬時に移動',
    actionHalfPageDown: '半ページ下へ',
    descHalfPageDown: '画面を半ページ分下へ進める',
    actionHalfPageUp: '半ページ上へ',
    descHalfPageUp: '画面を半ページ分上へ戻す',
    actionDocStart: '文書の先頭へ (gg)',
    descDocStart: 'g を連続2回押して文書の最上部へ',
    actionDocEnd: '文書の末尾へ (G)',
    descDocEnd: '文書の最下部へ直接ジャンプ',
    actionVisualMode: 'Visual選択モード',
    descVisualMode: '文字のハイライト選択を開始/終了',
    actionYank: '選択文字をコピー (Yank)',
    descYank: '選択範囲のテキストをクリップボードにコピー',

    recordKeyBtn: 'キー割り当て',
    recordingKeyPrompt: 'キーを押してください...',
    clearKeyBtn: '無効化',
    resetKeybindingsBtn: '↺ キー設定を初期化',
    keyConflictWarning: 'このキーは既に他の操作に割り当てられています！',
    keyDisabledText: '無効',
    toastKeybindingsReset: '✓ キー設定を初期値に戻しました',
    openKeybindingsSettingsBtn: '⌨️ キー設定と衝突管理'
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
