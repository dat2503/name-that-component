param(
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

if ($manifest.manifest_version -ne 3) { throw "Chrome Web Store requires Manifest V3." }
if ($manifest.description.Length -gt 132) { throw "Manifest description exceeds 132 characters." }
if ($manifest.version -notmatch '^\d+(\.\d+){0,3}$') { throw "Manifest version is invalid." }
if ($manifest.host_permissions) { throw "Unexpected persistent host permissions in manifest.json." }

$required = @(
  "manifest.json", "background.js", "bridge.js", "content.js", "popup.html", "popup.js",
  "icons/icon16.png", "icons/icon48.png", "icons/icon128.png"
)

foreach ($relativePath in $required) {
  $fullPath = Join-Path $projectRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    throw "Required extension file is missing: $relativePath"
  }
}

foreach ($scriptName in @("background.js", "bridge.js", "content.js", "popup.js")) {
  & node --check (Join-Path $projectRoot $scriptName)
  if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $scriptName" }
}

if ($ValidateOnly) {
  Write-Host "Validated Name That Component $($manifest.version)."
  exit 0
}

$releaseRoot = Join-Path $projectRoot "release"
$stagingRoot = Join-Path $releaseRoot "name-that-component-$($manifest.version)"
$zipPath = Join-Path $releaseRoot "name-that-component-$($manifest.version).zip"

if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -Recurse -Force -LiteralPath $stagingRoot }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -Force -LiteralPath $zipPath }
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

foreach ($relativePath in $required) {
  $destination = Join-Path $stagingRoot $relativePath
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $projectRoot $relativePath) -Destination $destination
}

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force -LiteralPath $stagingRoot
Write-Host "Created $zipPath"
