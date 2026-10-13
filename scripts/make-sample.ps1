Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 900, 1100
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#EFE6CF'))
$bag = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#C2410C'))
$g.FillRectangle($bag, 220, 420, 460, 520)
$pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#7C2D12')), 26
$g.DrawArc($pen, 300, 180, 300, 520, 180, 180)
$stripe = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#FACC15'))
$teal = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#0F766E'))
for ($i = 0; $i -lt 5; $i++) { $y = 500 + $i * 90; $g.FillRectangle($stripe, 220, $y, 460, 26); $g.FillEllipse($teal, 250 + $i * 80, $y + 34, 36, 36) }
$bmp.Save('C:\oja\test-assets\sample.jpg', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose(); $bmp.Dispose()
