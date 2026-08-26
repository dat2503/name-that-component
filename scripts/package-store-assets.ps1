$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifest = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "manifest.json") | ConvertFrom-Json
$releaseRoot = Join-Path $projectRoot "release"
$stagingRoot = Join-Path $releaseRoot "store-assets-$($manifest.version)"
$zipPath = Join-Path $releaseRoot "chrome-web-store-assets-$($manifest.version).zip"

$resolvedReleaseRoot = [IO.Path]::GetFullPath($releaseRoot).TrimEnd('\') + '\'
$resolvedStagingRoot = [IO.Path]::GetFullPath($stagingRoot)
if (-not $resolvedStagingRoot.StartsWith($resolvedReleaseRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe staging path: $resolvedStagingRoot"
}

$assets = @{
  "listing.md" = "docs/chrome-web-store-listing.md"
  "privacy-policy.md" = "PRIVACY.md"
  "store-icon-128.png" = "icons/icon128.png"
  "screenshot-1280x800.png" = "docs/store-assets/screenshot-1280x800.png"
  "small-promo-440x280.png" = "docs/store-assets/small-promo-440x280.png"
  "marquee-promo-1400x560.png" = "docs/store-assets/marquee-promo-1400x560.png"
  "demo-video-1280x720.mp4" = "docs/store-assets/demo-video-1280x720.mp4"
  "extension-upload.zip" = "release/name-that-component-$($manifest.version).zip"
}

foreach ($source in $assets.Values) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $source) -PathType Leaf)) {
    throw "Missing Store asset: $source"
  }
}

if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -Recurse -Force -LiteralPath $stagingRoot }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -Force -LiteralPath $zipPath }
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

foreach ($entry in $assets.GetEnumerator()) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $entry.Value) -Destination (Join-Path $stagingRoot $entry.Key)
}

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force -LiteralPath $stagingRoot
Write-Host "Created $zipPath"
