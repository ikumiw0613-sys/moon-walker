# Reuse the original moon texture; no generated/repainted image is involved.
# Run on Windows: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-app-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourcePath = Join-Path $projectRoot 'public/moon-image.png'
$geometryPath = Join-Path $projectRoot 'src/features/moon/moonDiscGeometry.ts'
$geometryText = [System.IO.File]::ReadAllText($geometryPath)
$sourceGeometry = [regex]::Match($geometryText, 'const SOURCE_MOON_IMAGE = \{([^}]+)\}', 'Singleline')
if (-not $sourceGeometry.Success) { throw 'Source moon geometry was not found.' }

function Read-SourceNumber([string]$name) {
  $numberMatch = [regex]::Match($sourceGeometry.Groups[1].Value, "${name}:\s*([0-9.]+)")
  if (-not $numberMatch.Success) { throw "Missing source geometry: $name" }
  return [double]::Parse($numberMatch.Groups[1].Value, [System.Globalization.CultureInfo]::InvariantCulture)
}

$sourceCenterX = Read-SourceNumber 'centerX'
$sourceCenterY = Read-SourceNumber 'centerY'
$sourceDiameter = Read-SourceNumber 'diameter'
$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
try {
  if ($sourceImage.Width -ne (Read-SourceNumber 'width') -or $sourceImage.Height -ne (Read-SourceNumber 'height')) {
    throw 'The source image dimensions do not match moonDiscGeometry.ts.'
  }
  $iconSpecs = @(
    @{ Size = 180; MoonRatio = 0.74; Path = 'public/apple-touch-icon.png' },
    @{ Size = 192; MoonRatio = 0.74; Path = 'public/icons/icon-192.png' },
    @{ Size = 512; MoonRatio = 0.74; Path = 'public/icons/icon-512.png' },
    @{ Size = 512; MoonRatio = 0.70; Path = 'public/icons/icon-maskable-512.png' }
  )
  foreach ($iconSpec in $iconSpecs) {
    $size = $iconSpec.Size
    $scale = $size * $iconSpec.MoonRatio / $sourceDiameter
    $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      # Match the app background, filling the entire image including its corners.
      $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#0c1424'))
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $imageRect = [System.Drawing.RectangleF]::new(
        [single]($size / 2 - $sourceCenterX * $scale),
        [single]($size / 2 - $sourceCenterY * $scale),
        [single]($sourceImage.Width * $scale),
        [single]($sourceImage.Height * $scale)
      )
      $graphics.DrawImage($sourceImage, $imageRect)
      $outputPath = Join-Path $projectRoot $iconSpec.Path
      [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($outputPath)) | Out-Null
      $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output "$($iconSpec.Path): ${size}x${size}"
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
} finally {
  $sourceImage.Dispose()
}
