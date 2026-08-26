$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frameRoot = Join-Path $projectRoot "docs\store-assets\video-frames"
$outputPath = Join-Path $projectRoot "docs\store-assets\demo-video-1280x720.mp4"
$frames = @(
  (Join-Path $frameRoot "01-activate-picker.png"),
  (Join-Path $frameRoot "02-react-component.png"),
  (Join-Path $frameRoot "03-accessible-input.png"),
  (Join-Path $frameRoot "04-semantic-panel.png")
)

foreach ($frame in $frames) {
  if (-not (Test-Path -LiteralPath $frame -PathType Leaf)) {
    throw "Missing video frame: $frame. Run node scripts/browser-smoke-test.mjs first."
  }
}

$filter = @"
[0:v]crop=1280:720:0:40,format=yuv420p,setpts=PTS-STARTPTS[v0];
[1:v]crop=1280:720:0:40,format=yuv420p,setpts=PTS-STARTPTS[v1];
[2:v]crop=1280:720:0:40,format=yuv420p,setpts=PTS-STARTPTS[v2];
[3:v]crop=1280:720:0:40,format=yuv420p,setpts=PTS-STARTPTS[v3];
[v0][v1]xfade=transition=fade:duration=0.5:offset=2.5[x1];
[x1][v2]xfade=transition=fade:duration=0.5:offset=5.0[x2];
[x2][v3]xfade=transition=fade:duration=0.5:offset=7.5[outv]
"@ -replace "`r?`n", ""

& ffmpeg -hide_banner -loglevel error -y `
  -loop 1 -t 3 -i $frames[0] `
  -loop 1 -t 3 -i $frames[1] `
  -loop 1 -t 3 -i $frames[2] `
  -loop 1 -t 3 -i $frames[3] `
  -filter_complex $filter -map "[outv]" -t 10.5 -r 30 `
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart -an $outputPath

if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed to generate the demo video." }
Write-Host "Created $outputPath"
