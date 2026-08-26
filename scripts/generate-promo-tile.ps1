$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputPath = Join-Path $projectRoot "docs\store-assets\small-promo-440x280.png"
$marqueePath = Join-Path $projectRoot "docs\store-assets\marquee-promo-1400x560.png"
$iconPath = Join-Path $projectRoot "icons\icon128.png"
$screenshotPath = Join-Path $projectRoot "docs\store-assets\screenshot-1280x800.png"

$bitmap = [Drawing.Bitmap]::new(440, 280)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$bounds = [Drawing.Rectangle]::new(0, 0, 440, 280)
$gradient = [Drawing.Drawing2D.LinearGradientBrush]::new(
  $bounds,
  [Drawing.Color]::FromArgb(18, 24, 40),
  [Drawing.Color]::FromArgb(91, 74, 194),
  25
)
$graphics.FillRectangle($gradient, $bounds)

$glow = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(36, 190, 174, 255))
$graphics.FillEllipse($glow, 300, -90, 230, 230)

$icon = [Drawing.Image]::FromFile($iconPath)
$graphics.DrawImage($icon, [Drawing.Rectangle]::new(34, 32, 64, 64))

$white = [Drawing.SolidBrush]::new([Drawing.Color]::White)
$muted = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(210, 223, 231, 255))
$accent = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 170, 239, 204))
$titleFont = [Drawing.Font]::new("Segoe UI", 25, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$bodyFont = [Drawing.Font]::new("Segoe UI", 17, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
$smallFont = [Drawing.Font]::new("Segoe UI", 13, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)

$graphics.DrawString("Name That Component", $titleFont, $white, 34, 112)
$graphics.DrawString("Inspect any UI. Know what it is.", $bodyFont, $muted, 35, 157)

$pillPath = [Drawing.Drawing2D.GraphicsPath]::new()
$pillPath.AddArc(34, 211, 20, 20, 90, 180)
$pillPath.AddArc(346, 211, 20, 20, 270, 180)
$pillPath.CloseFigure()
$pillBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(35, 255, 255, 255))
$graphics.FillPath($pillBrush, $pillPath)
$graphics.DrawString("REACT  /  VUE  /  ANGULAR  /  ASTRO", $smallFont, $accent, 47, 215)

$bitmap.Save($outputPath, [Drawing.Imaging.ImageFormat]::Png)

$marquee = [Drawing.Bitmap]::new(1400, 560)
$marqueeGraphics = [Drawing.Graphics]::FromImage($marquee)
$marqueeGraphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$marqueeGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$marqueeGraphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$marqueeBounds = [Drawing.Rectangle]::new(0, 0, 1400, 560)
$marqueeGradient = [Drawing.Drawing2D.LinearGradientBrush]::new(
  $marqueeBounds,
  [Drawing.Color]::FromArgb(18, 24, 40),
  [Drawing.Color]::FromArgb(91, 74, 194),
  20
)
$marqueeGraphics.FillRectangle($marqueeGradient, $marqueeBounds)
$marqueeGlow = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(30, 190, 174, 255))
$marqueeGraphics.FillEllipse($marqueeGlow, 1080, -280, 700, 700)
$marqueeGraphics.DrawImage($icon, [Drawing.Rectangle]::new(70, 67, 88, 88))

$marqueeTitleFont = [Drawing.Font]::new("Segoe UI", 47, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$marqueeBodyFont = [Drawing.Font]::new("Segoe UI", 24, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
$marqueeSmallFont = [Drawing.Font]::new("Segoe UI", 17, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$marqueeGraphics.DrawString("Name That Component", $marqueeTitleFont, $white, 70, 186)
$marqueeGraphics.DrawString("Inspect any UI. Know what it is.", $marqueeBodyFont, $muted, 73, 253)
$marqueeGraphics.DrawString("REACT  /  VUE  /  ANGULAR  /  ASTRO", $marqueeSmallFont, $accent, 74, 322)
$marqueeGraphics.DrawString("Fully offline. Temporary tab access only.", $marqueeBodyFont, $muted, 73, 384)

if (Test-Path -LiteralPath $screenshotPath) {
  $screenshot = [Drawing.Image]::FromFile($screenshotPath)
  $frameBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(55, 7, 12, 24))
  $marqueeGraphics.FillRectangle($frameBrush, 638, 38, 728, 484)
  $marqueeGraphics.DrawImage($screenshot, [Drawing.Rectangle]::new(652, 52, 700, 438))
  $frameBrush.Dispose()
  $screenshot.Dispose()
}

$marquee.Save($marqueePath, [Drawing.Imaging.ImageFormat]::Png)
$marqueeSmallFont.Dispose()
$marqueeBodyFont.Dispose()
$marqueeTitleFont.Dispose()
$marqueeGlow.Dispose()
$marqueeGradient.Dispose()
$marqueeGraphics.Dispose()
$marquee.Dispose()

$pillBrush.Dispose()
$pillPath.Dispose()
$smallFont.Dispose()
$bodyFont.Dispose()
$titleFont.Dispose()
$accent.Dispose()
$muted.Dispose()
$white.Dispose()
$icon.Dispose()
$glow.Dispose()
$gradient.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Created $outputPath"
Write-Host "Created $marqueePath"
