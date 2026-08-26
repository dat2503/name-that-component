$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputPath = Join-Path $projectRoot "docs\store-assets\small-promo-440x280.png"
$iconPath = Join-Path $projectRoot "icons\icon128.png"

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
