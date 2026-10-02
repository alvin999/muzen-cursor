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
  shapeLabel: string;
  shapeBlock: string;
  shapeHollow: string;
  shapeUnderline: string;
  effectsLabel: string;
  effectSmooth: string;
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
    shapeLabel: '游標形態',
    shapeBlock: '實心方塊 (Block)',
    shapeHollow: '空心外框 (Hollow)',
    shapeUnderline: '閱讀底線 (Underline)',
    effectsLabel: '動態特效 (可複選)',
    effectSmooth: '平滑位移',
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
    statusStartPrompt: '點擊文字或按 j 開始'
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
    shapeLabel: 'Cursor Shape',
    shapeBlock: 'Solid Block',
    shapeHollow: 'Hollow Outline',
    shapeUnderline: 'Reading Underline',
    effectsLabel: 'Motion Effects (Multi-select)',
    effectSmooth: 'Smooth Motion',
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
    statusStartPrompt: 'Click text or press j to begin'
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
    shapeLabel: 'カーソル形状',
    shapeBlock: 'ソリッドブロック (Block)',
    shapeHollow: 'ホローアウトライン (Hollow)',
    shapeUnderline: 'アンダーライン (Underline)',
    effectsLabel: 'モーション効果 (複数選択可)',
    effectSmooth: 'スムーズ移動',
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
    statusStartPrompt: 'クリックまたは j で開始'
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
