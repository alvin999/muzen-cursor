# Muzen Cursor 本機一鍵自動升級腳本 (Windows PowerShell)
# 用途：自動從 GitHub Releases 下載最新版發布產物並解壓縮覆蓋當前目錄

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repo = "alvin999/muzen-cursor"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "⛩️ Muzen Cursor 一鍵更新小工具" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. 取得本機目前版本
$manifestPath = Join-Path $projectRoot "manifest.json"
$currentVersion = "未知"
if (Test-Path $manifestPath) {
    $manifestJson = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $currentVersion = $manifestJson.version
}
Write-Host "📌 本機目前版本: v$currentVersion" -ForegroundColor Yellow

# 2. 查詢 GitHub 最新 Release
Write-Host "🔍 正在檢查 GitHub 最新版本..." -ForegroundColor Gray
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ "User-Agent" = "Muzen-Updater" }
    $latestTag = $release.tag_name
    $latestVersion = $latestTag.TrimStart("v")
    Write-Host "✨ 雲端最新版本: $latestTag" -ForegroundColor Green
} catch {
    Write-Host "❌ 無法取得 GitHub 版本資訊: $_" -ForegroundColor Red
    exit 1
}

if ($currentVersion -eq $latestVersion) {
    Write-Host "`n🎉 目前已是最新版本 (v$currentVersion)，無需更新！" -ForegroundColor Green
    Read-Host "按 Enter 鍵結束"
    exit 0
}

# 3. 尋找 ZIP 資產下載連結
$zipAsset = $release.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1
if (-not $zipAsset) {
    Write-Host "⚠️ 最新 Release 未包含打包好的 ZIP 發布檔，請前往網頁手動查看: $($release.html_url)" -ForegroundColor Yellow
    Start-Process $release.html_url
    exit 0
}

Write-Host "⬇️ 正在下載最新版本產物: $($zipAsset.name)..." -ForegroundColor Cyan
$tempZip = Join-Path $env:TEMP "muzen-cursor-latest.zip"
Invoke-WebRequest -Uri $zipAsset.browser_download_url -OutFile $tempZip

Write-Host "📦 正在解壓縮並套用更新..." -ForegroundColor Cyan
Expand-Archive -Path $tempZip -DestinationPath $projectRoot -Force
Remove-Item $tempZip -Force

Write-Host "`n✅ 更新成功升級至 $latestTag！" -ForegroundColor Green
Write-Host "💡 提示：請回到 Chrome 的 chrome://extensions 頁面，點擊 Muzen Cursor 上的「重新載入 (🔄)」按鈕即可生效。" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

Read-Host "按 Enter 鍵結束"
