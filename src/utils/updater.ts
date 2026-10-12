/**
 * Muzen Cursor 版本檢查與更新模組
 * 負責透過 GitHub Releases API 檢查最新發布版本，並提供版本比較與下載資訊
 */

export interface ReleaseInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
}

const GITHUB_REPO = 'alvin999/muzen-cursor';
const CACHE_KEY = 'muzen_version_check_cache';
const CACHE_DURATION_MS = 1000 * 60 * 60 * 2; // 2 小時本機快取，防範 GitHub API Rate Limit (60次/hr)

/**
 * 比較語意化版本號 (SemVer)
 * @returns 1 若 v1 > v2; -1 若 v1 < v2; 0 若相等
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').trim();
  const clean2 = v2.replace(/^v/, '').trim();

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * 取得目前擴充套件版本
 */
export function getCurrentVersion(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    return chrome.runtime.getManifest().version;
  }
  return '0.1.2';
}

/**
 * 檢查擴充套件是否有新版本
 * @param forceCheck 是否強制略過快取直接向 GitHub API 發送請求
 */
export async function checkExtensionUpdate(forceCheck = false): Promise<ReleaseInfo | null> {
  const currentVersion = getCurrentVersion();

  // 1. 若非強制檢查，優先從 chrome.storage.local 讀取快取
  if (!forceCheck && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const cached = await chrome.storage.local.get(CACHE_KEY);
      const cacheObj = cached[CACHE_KEY];
      if (cacheObj && Date.now() - cacheObj.timestamp < CACHE_DURATION_MS) {
        const cachedData = cacheObj.data as ReleaseInfo;
        // 重新比對當前版本，以防使用者已更新
        cachedData.currentVersion = currentVersion;
        cachedData.hasUpdate = compareVersions(cachedData.latestVersion, currentVersion) > 0;
        return cachedData;
      }
    } catch (e) {
      console.warn('[Muzen Updater] 讀取快取失敗:', e);
    }
  }

  // 2. 請求 GitHub Releases API
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.warn(`[Muzen Updater] GitHub API 回應錯誤: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const tagName = (data.tag_name || '').trim();
    const latestVersion = tagName.replace(/^v/, '');

    // 尋找發布產物中的 ZIP 檔 (例如 muzen-cursor-v0.1.2.zip)
    let downloadUrl = data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`;
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const zipAsset = data.assets.find((asset: { name?: string; browser_download_url?: string }) =>
        asset.name?.toLowerCase().endsWith('.zip')
      );
      if (zipAsset?.browser_download_url) {
        downloadUrl = zipAsset.browser_download_url;
      }
    }

    const releaseInfo: ReleaseInfo = {
      currentVersion,
      latestVersion,
      hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
      releaseName: data.name || tagName,
      releaseNotes: data.body || '',
      downloadUrl,
      publishedAt: data.published_at || '',
    };

    // 寫入快取
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({
          [CACHE_KEY]: {
            timestamp: Date.now(),
            data: releaseInfo,
          },
        });
      } catch (err) {
        console.warn('[Muzen Updater] 儲存快取失敗:', err);
      }
    }

    return releaseInfo;
  } catch (error) {
    console.error('[Muzen Updater] 檢查版本時發生例外:', error);
    return null;
  }
}
