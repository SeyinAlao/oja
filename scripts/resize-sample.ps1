param([string]$Src, [string]$Dst, [int]$Max)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Src)
$scale = [Math]::Min(1.0, $Max / [Math]::Max($img.Width, $img.Height))
$w = [int][Math]::Round($img.Width * $scale); $h = [int][Math]::Round($img.Height * $scale)
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($img, 0, 0, $w, $h)
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$p = New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 85L
$bmp.Save($Dst, $enc, $p)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
"$Dst ${w}x${h}"
