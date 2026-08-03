$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$workspace = 'C:\Users\DELL\Desktop\Kyoto Masage'
$outputDir = Join-Path $workspace 'artifacts\tuetam-market-report'
$assetDir = Join-Path $outputDir 'assets'
$renderDir = Join-Path $outputDir 'rendered'
$docxPath = Join-Path $workspace 'artifacts\Tue_Tam_Care_Bao_Cao_Tiem_Nang_Thi_Truong_Ha_Noi_TPHCM_v1.0.docx'
$pdfPath = Join-Path $renderDir 'Tue_Tam_Care_Bao_Cao_Tiem_Nang_Thi_Truong_Ha_Noi_TPHCM_v1.0.pdf'
$logoPath = Join-Path $workspace 'public\logo.png'

New-Item -ItemType Directory -Force -Path $outputDir, $assetDir, $renderDir | Out-Null

function Get-WordColor([int]$r, [int]$g, [int]$b) {
    return $r + (256 * $g) + (65536 * $b)
}

$C = @{
    Navy = Get-WordColor 31 77 120
    Blue = Get-WordColor 46 116 181
    Red = Get-WordColor 173 27 38
    DeepRed = Get-WordColor 128 16 28
    Gold = Get-WordColor 190 142 34
    Dark = Get-WordColor 31 41 55
    Gray = Get-WordColor 90 99 112
    LightGray = Get-WordColor 242 244 247
    PaleBlue = Get-WordColor 239 246 253
    PaleGold = Get-WordColor 252 247 232
    PaleRed = Get-WordColor 253 242 242
    White = Get-WordColor 255 255 255
    Green = Get-WordColor 22 132 91
}

function New-BarChart {
    param(
        [string]$Path,
        [string]$Title,
        [string]$Subtitle,
        [string[]]$Labels,
        [double[]]$Values,
        [string]$Unit,
        [System.Drawing.Color[]]$Colors
    )
    $w = 1600; $h = 900
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
        $g.Clear([System.Drawing.Color]::White)
        $titleFont = New-Object System.Drawing.Font('Arial', 34, [System.Drawing.FontStyle]::Bold)
        $subFont = New-Object System.Drawing.Font('Arial', 19, [System.Drawing.FontStyle]::Regular)
        $labelFont = New-Object System.Drawing.Font('Arial', 22, [System.Drawing.FontStyle]::Bold)
        $valueFont = New-Object System.Drawing.Font('Arial', 22, [System.Drawing.FontStyle]::Bold)
        $noteFont = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Italic)
        $darkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(31,41,55))
        $grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(99,109,122))
        $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(226,232,240), 2)
        $g.DrawString($Title, $titleFont, $darkBrush, 78, 55)
        $g.DrawString($Subtitle, $subFont, $grayBrush, 80, 115)

        $plotX = 420; $plotW = 1030; $barH = 92; $gap = 78; $startY = 235
        $max = ($Values | Measure-Object -Maximum).Maximum
        for ($i = 0; $i -lt 5; $i++) {
            $x = $plotX + ($plotW * $i / 4)
            $g.DrawLine($gridPen, [float]$x, 205, [float]$x, 720)
        }
        for ($i = 0; $i -lt $Values.Count; $i++) {
            $y = $startY + ($i * ($barH + $gap))
            $g.DrawString($Labels[$i], $labelFont, $darkBrush, 80, $y + 21)
            $barW = [math]::Max(8, [math]::Round($plotW * $Values[$i] / $max))
            $barBrush = New-Object System.Drawing.SolidBrush($Colors[$i % $Colors.Count])
            $g.FillRectangle($barBrush, $plotX, $y, $barW, $barH)
            $valueText = ('{0:N2} {1}' -f $Values[$i], $Unit)
            $valueSize = $g.MeasureString($valueText, $valueFont)
            if ($barW -gt ($valueSize.Width + 40)) {
                $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
                $g.DrawString($valueText, $valueFont, $whiteBrush, $plotX + $barW - $valueSize.Width - 22, $y + 25)
                $whiteBrush.Dispose()
            } else {
                $g.DrawString($valueText, $valueFont, $darkBrush, $plotX + $barW + 18, $y + 25)
            }
            $barBrush.Dispose()
        }
        $g.DrawString('Nguồn: mô hình hoạch định Tuệ Tâm Care; giá trị là kịch bản, không phải dự báo doanh thu.', $noteFont, $grayBrush, 80, 805)
        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
        $titleFont.Dispose(); $subFont.Dispose(); $labelFont.Dispose(); $valueFont.Dispose(); $noteFont.Dispose()
        $darkBrush.Dispose(); $grayBrush.Dispose(); $gridPen.Dispose()
    } finally {
        $g.Dispose(); $bmp.Dispose()
    }
}

function New-GroupedBarChart {
    param([string]$Path)
    $w = 1600; $h = 900
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
        $g.Clear([System.Drawing.Color]::White)
        $titleFont = New-Object System.Drawing.Font('Arial', 34, [System.Drawing.FontStyle]::Bold)
        $subFont = New-Object System.Drawing.Font('Arial', 19)
        $labelFont = New-Object System.Drawing.Font('Arial', 21, [System.Drawing.FontStyle]::Bold)
        $valueFont = New-Object System.Drawing.Font('Arial', 18, [System.Drawing.FontStyle]::Bold)
        $noteFont = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Italic)
        $dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(31,41,55))
        $gray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(99,109,122))
        $hn = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(31,77,120))
        $hcm = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(190,142,34))
        $grid = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(226,232,240), 2)
        $g.DrawString('Dung lượng chi tiêu Business theo kịch bản', $titleFont, $dark, 78, 55)
        $g.DrawString('Ước tính từ diện tích văn phòng có người sử dụng và tần suất tham gia giả định', $subFont, $gray, 80, 115)
        $plotX = 405; $plotW = 1050; $max = 37.0; $startY = 245
        for ($i = 0; $i -lt 5; $i++) {
            $x = $plotX + ($plotW * $i / 4)
            $g.DrawLine($grid, [float]$x, 205, [float]$x, 735)
        }
        $labels = @('Thận trọng','Cơ sở','Tăng trưởng')
        $hnValues = @(1.43,6.53,28.66)
        $hcmValues = @(1.85,8.43,36.96)
        for ($i = 0; $i -lt 3; $i++) {
            $y = $startY + ($i * 170)
            $g.DrawString($labels[$i], $labelFont, $dark, 80, $y + 36)
            $w1 = [math]::Max(8, [math]::Round($plotW * $hnValues[$i] / $max))
            $w2 = [math]::Max(8, [math]::Round($plotW * $hcmValues[$i] / $max))
            $g.FillRectangle($hn, $plotX, $y, $w1, 52)
            $g.FillRectangle($hcm, $plotX, $y + 63, $w2, 52)
            $g.DrawString(('{0:N2}' -f $hnValues[$i]), $valueFont, $dark, $plotX + $w1 + 12, $y + 13)
            $g.DrawString(('{0:N2}' -f $hcmValues[$i]), $valueFont, $dark, $plotX + $w2 + 12, $y + 76)
        }
        $g.FillRectangle($hn, 80, 758, 42, 22); $g.DrawString('Hà Nội', $subFont, $dark, 135, 750)
        $g.FillRectangle($hcm, 300, 758, 42, 22); $g.DrawString('TP.HCM lõi đô thị', $subFont, $dark, 355, 750)
        $g.DrawString('Đơn vị: tỷ đồng/năm. Kịch bản định hướng; chưa trừ chi phí, khuyến mại và thuế.', $noteFont, $gray, 80, 820)
        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
        $titleFont.Dispose(); $subFont.Dispose(); $labelFont.Dispose(); $valueFont.Dispose(); $noteFont.Dispose()
        $dark.Dispose(); $gray.Dispose(); $hn.Dispose(); $hcm.Dispose(); $grid.Dispose()
    } finally {
        $g.Dispose(); $bmp.Dispose()
    }
}

$capacityChart = Join-Path $assetDir 'capacity-scenarios.png'
$samChart = Join-Path $assetDir 'business-market-scenarios.png'
New-BarChart -Path $capacityChart -Title 'Doanh thu công suất hai cơ sở theo kịch bản' -Subtitle '16 KTV; block phục vụ bình quân 90 phút; vé bình quân 300.000đ' -Labels @('25% công suất','40% công suất','55% công suất') -Values @(4.32,6.912,9.504) -Unit 'tỷ đồng/năm' -Colors @([System.Drawing.Color]::FromArgb(31,77,120),[System.Drawing.Color]::FromArgb(46,116,181),[System.Drawing.Color]::FromArgb(173,27,38))
New-GroupedBarChart -Path $samChart

$word = $null
$doc = $null

function Add-Paragraph {
    param(
        [string]$Text,
        [int]$Size = 11,
        [int]$Color = $C.Dark,
        [bool]$Bold = $false,
        [bool]$Italic = $false,
        [int]$Align = 3,
        [double]$Before = 0,
        [double]$After = 6,
        [double]$Line = 1.10,
        [string]$Style = ''
    )
    $r = $doc.Content
    $r.Collapse(0)
    $p = $doc.Paragraphs.Add($r)
    $p.Range.Text = $Text
    if ($Style) { $p.Range.Style = $Style }
    $p.Range.Font.Name = 'Calibri'
    $p.Range.Font.Size = $Size
    $p.Range.Font.Color = $Color
    $p.Range.Font.Bold = [int]$Bold
    $p.Range.Font.Italic = [int]$Italic
    $p.Format.Alignment = $Align
    $p.Format.SpaceBefore = $Before
    $p.Format.SpaceAfter = $After
    $p.Format.LineSpacingRule = 0
    $p.Format.LineSpacing = 12 * $Line
    return $p
}

function Add-Heading {
    param([string]$Text, [int]$Level = 1)
    Write-Host ("[REPORT] {0}" -f $Text)
    $sizes = @{1=16;2=13;3=12}
    $befores = @{1=16;2=12;3=8}
    $afters = @{1=8;2=6;3=4}
    $colors = @{1=$C.Blue;2=$C.Blue;3=$C.Navy}
    $p = Add-Paragraph -Text $Text -Size $sizes[$Level] -Color $colors[$Level] -Bold $true -Align 0 -Before $befores[$Level] -After $afters[$Level]
    $p.Range.Style = "Heading $Level"
    $p.Range.Font.Name = 'Calibri'
    $p.Range.Font.Size = $sizes[$Level]
    $p.Range.Font.Color = $colors[$Level]
    $p.Range.Font.Bold = 1
    return $p
}

function Add-BulletList {
    param([string[]]$Items, [int]$Level = 1)
    foreach ($item in $Items) {
        $p = Add-Paragraph -Text $item -Size 11 -Color $C.Dark -Align 0 -After 8 -Line 1.167
        $p.Range.ListFormat.ApplyBulletDefault()
        $p.Format.LeftIndent = 36
        $p.Format.FirstLineIndent = -18
    }
}

function Add-NumberList {
    param([string[]]$Items)
    foreach ($item in $Items) {
        $p = Add-Paragraph -Text $item -Size 11 -Color $C.Dark -Align 0 -After 8 -Line 1.167
        $p.Range.ListFormat.ApplyNumberDefault()
        $p.Format.LeftIndent = 36
        $p.Format.FirstLineIndent = -18
    }
}

function Add-Callout {
    param([string]$Text, [string]$Kind = 'blue')
    $fill = $C.PaleBlue; $border = $C.Blue
    if ($Kind -eq 'gold') { $fill = $C.PaleGold; $border = $C.Gold }
    if ($Kind -eq 'red') { $fill = $C.PaleRed; $border = $C.Red }
    $p = Add-Paragraph -Text $Text -Size 11 -Color $C.Dark -Bold $true -Align 0 -Before 4 -After 8 -Line 1.15
    $p.Format.LeftIndent = 12
    $p.Format.RightIndent = 12
    $p.Range.Shading.BackgroundPatternColor = $fill
    $p.Range.Borders.Enable = 1
    for ($i = 1; $i -le 4; $i++) {
        $p.Range.Borders.Item($i).Color = $border
    }
    return $p
}

function Add-Table {
    param(
        [string[]]$Headers,
        [object[][]]$Rows,
        [double[]]$Widths,
        [int[]]$Alignments = @()
    )
    $range = $doc.Content
    $range.Collapse(0)
    $table = $doc.Tables.Add($range, $Rows.Count + 1, $Headers.Count)
    $table.AllowAutoFit = $false
    $table.PreferredWidthType = 3
    $table.PreferredWidth = 468
    $table.Rows.AllowBreakAcrossPages = 0
    $table.TopPadding = 4; $table.BottomPadding = 4; $table.LeftPadding = 6; $table.RightPadding = 6
    $table.Borders.Enable = 1
    $table.Borders.OutsideColor = Get-WordColor 209 213 219
    $table.Borders.InsideColor = Get-WordColor 226 232 240
    for ($colIndex = 1; $colIndex -le $Headers.Count; $colIndex++) {
        $cell = $table.Cell(1,$colIndex)
        $cell.Range.Text = $Headers[$colIndex-1]
        $cell.Range.Font.Name = 'Calibri'
        $cell.Range.Font.Size = 10
        $cell.Range.Font.Bold = 1
        $cell.Range.Font.Color = $C.Dark
        $cell.Shading.BackgroundPatternColor = $C.LightGray
        $cell.VerticalAlignment = 1
        if ($Widths.Count -ge $colIndex) { $table.Columns.Item($colIndex).Width = $Widths[$colIndex-1] }
    }
    for ($rowIndex = 0; $rowIndex -lt $Rows.Count; $rowIndex++) {
        for ($colIndex = 0; $colIndex -lt $Headers.Count; $colIndex++) {
            $cell = $table.Cell($rowIndex+2,$colIndex+1)
            $cell.Range.Text = [string]$Rows[$rowIndex][$colIndex]
            $cell.Range.Font.Name = 'Calibri'
            $cell.Range.Font.Size = 9.5
            $cell.Range.Font.Color = $C.Dark
            $cell.Range.ParagraphFormat.SpaceAfter = 3
            $cell.VerticalAlignment = 1
            if ($Alignments.Count -gt $colIndex) { $cell.Range.ParagraphFormat.Alignment = $Alignments[$colIndex] }
            if (($rowIndex % 2) -eq 1) { $cell.Shading.BackgroundPatternColor = Get-WordColor 249 250 251 }
        }
    }
    $after = $doc.Content
    $after.Collapse(0)
    $after.InsertParagraphAfter()
    return $table
}

function Add-Figure {
    param([string]$Path, [string]$AltText, [string]$Caption)
    $r = $doc.Content; $r.Collapse(0)
    $shape = $doc.InlineShapes.AddPicture($Path, $false, $true, $r)
    $shape.LockAspectRatio = -1
    $shape.Width = 468
    $shape.AlternativeText = $AltText
    $p = $shape.Range.Paragraphs.Item(1)
    $p.Format.Alignment = 1
    $p.Format.SpaceBefore = 5
    $p.Format.SpaceAfter = 4
    Add-Paragraph -Text $Caption -Size 9 -Color $C.Gray -Italic $true -Align 1 -After 8 | Out-Null
}

function Add-PageBreak {
    $r = $doc.Content; $r.Collapse(0); $r.InsertBreak(7)
}

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false
    $word.Options.Pagination = $false
    $word.Options.CheckSpellingAsYouType = $false
    $word.Options.CheckGrammarAsYouType = $false
    $word.Options.UpdateFieldsAtPrint = $false
    $doc = $word.Documents.Add()
    $doc.TrackRevisions = $false

    $section = $doc.Sections.Item(1)
    $section.PageSetup.PageWidth = 612
    $section.PageSetup.PageHeight = 792
    $section.PageSetup.TopMargin = 72
    $section.PageSetup.BottomMargin = 72
    $section.PageSetup.LeftMargin = 72
    $section.PageSetup.RightMargin = 72
    $section.PageSetup.HeaderDistance = 35.4
    $section.PageSetup.FooterDistance = 35.4

    $normal = $doc.Styles.Item('Normal')
    $normal.Font.Name = 'Calibri'; $normal.Font.Size = 11; $normal.Font.Color = $C.Dark
    $normal.ParagraphFormat.SpaceAfter = 6; $normal.ParagraphFormat.LineSpacing = 13.2
    $normal.ParagraphFormat.Alignment = 3

    foreach ($pair in @(@('Heading 1',16,$C.Blue,16,8),@('Heading 2',13,$C.Blue,12,6),@('Heading 3',12,$C.Navy,8,4))) {
        $s = $doc.Styles.Item($pair[0]); $s.Font.Name = 'Calibri'; $s.Font.Size = $pair[1]; $s.Font.Bold = 1; $s.Font.Color = $pair[2]
        $s.ParagraphFormat.SpaceBefore = $pair[3]; $s.ParagraphFormat.SpaceAfter = $pair[4]; $s.ParagraphFormat.KeepWithNext = -1
    }

    $header = $section.Headers.Item(1).Range
    $header.Text = 'TUỆ TÂM CARE  |  BÁO CÁO TIỀM NĂNG THỊ TRƯỜNG'
    $header.Font.Name = 'Calibri'; $header.Font.Size = 8; $header.Font.Bold = 1; $header.Font.Color = $C.Gray
    $header.ParagraphFormat.Alignment = 2
    $header.Borders.Item(-3).LineStyle = 1
    $header.Borders.Item(-3).Color = Get-WordColor 226 232 240

    $footer = $section.Footers.Item(1).Range
    $footer.Text = 'Tài liệu hoạch định nội bộ  •  25/07/2026  |  '
    $footer.Font.Name = 'Calibri'; $footer.Font.Size = 8; $footer.Font.Color = $C.Gray
    $footer.ParagraphFormat.Alignment = 1
    $footer.Collapse(0)
    $footer.Fields.Add($footer, 33) | Out-Null

    # COVER — editorial_cover
    $spacer = Add-Paragraph -Text '' -After 18
    $r = $doc.Content; $r.Collapse(0)
    $logo = $doc.InlineShapes.AddPicture($logoPath, $false, $true, $r)
    $logo.LockAspectRatio = -1; $logo.Width = 62; $logo.AlternativeText = 'Biểu trưng Tuệ Tâm Care'
    $logo.Range.Paragraphs.Item(1).Format.Alignment = 1
    Add-Paragraph -Text 'TUỆ TÂM CARE' -Size 11 -Color $C.Red -Bold $true -Align 1 -Before 12 -After 16 | Out-Null
    $title = Add-Paragraph -Text 'BÁO CÁO TIỀM NĂNG THỊ TRƯỜNG' -Size 25 -Color $C.Dark -Bold $true -Align 1 -After 8 -Line 1.0
    $title.Format.Borders.Item(-3).LineStyle = 1; $title.Format.Borders.Item(-3).Color = $C.Gold
    Add-Paragraph -Text 'Mô hình chăm sóc tại điểm & Tuệ Tâm Business tại doanh nghiệp vào buổi trưa' -Size 15 -Color $C.Navy -Bold $true -Align 1 -Before 14 -After 18 -Line 1.10 | Out-Null
    Add-Paragraph -Text 'Hai điểm neo Hà Nội: Công viên Cầu Giấy và C17 BCA – Mỗ Lao\nĐịnh hướng mở rộng: toàn Hà Nội và Thành phố Hồ Chí Minh' -Size 12 -Color $C.Gray -Align 1 -After 28 -Line 1.15 | Out-Null
    Add-Callout -Text 'Mục tiêu: xác định nơi nên tập trung nguồn lực, quy mô có thể phục vụ, cấu trúc thử nghiệm và điều kiện cần chứng minh trước khi mở rộng.' -Kind 'gold' | Out-Null
    Add-Paragraph -Text 'Phiên bản 1.0  •  25/07/2026\nDữ liệu công khai cập nhật đến 25/07/2026' -Size 10 -Color $C.Gray -Align 1 -Before 30 -After 6 | Out-Null
    Add-Paragraph -Text 'Tài liệu hoạch định – không phải dự báo tài chính hoặc cam kết doanh thu' -Size 9 -Color $C.Red -Italic $true -Align 1 -After 0 | Out-Null
    Add-PageBreak

    # TOC
    Add-Paragraph -Text 'MỤC LỤC' -Size 18 -Color $C.Dark -Bold $true -Align 0 -After 12 | Out-Null
    $tocRange = $doc.Content; $tocRange.Collapse(0)
    $toc = $doc.TablesOfContents.Add($tocRange, $true, 1, 3)
    $tocRange = $doc.Content; $tocRange.Collapse(0); $tocRange.InsertParagraphAfter()
    Add-Callout -Text 'Cách đọc nhanh: bắt đầu từ Tóm tắt điều hành, xem hai bản đồ cơ hội tại Cầu Giấy và Mỗ Lao, sau đó dùng các “cổng quyết định” 90 ngày để phê duyệt mở rộng.' -Kind 'blue' | Out-Null
    Add-PageBreak

    Add-Heading '1. Tóm tắt điều hành' 1 | Out-Null
    Add-Callout -Text 'Kết luận trung tâm: Tuệ Tâm Care nên vận hành theo mô hình “hub-and-pod” — hai cơ sở cố định tại Hà Nội là nơi kiểm soát chất lượng và giữ chân khách; một đội Tuệ Tâm Business chuyên trách mang trải nghiệm 15–30 phút tới doanh nghiệp vào buổi trưa. TP.HCM nên được vào bằng hợp đồng thử nghiệm B2B trước, chưa nên ký mặt bằng ngay.' -Kind 'red' | Out-Null
    Add-Heading 'Quyết định ưu tiên' 2 | Out-Null
    Add-NumberList @(
        'Công viên Cầu Giấy là điểm ưu tiên số 1 cho chiến lược kết hợp: phục vụ tại điểm ngoài giờ hành chính và làm hub điều phối Business tới trục Duy Tân – Trần Thái Tông – Yên Hòa – Nam Từ Liêm.',
        'C17 BCA – Mỗ Lao là điểm ưu tiên giữ chân khách địa phương, gói dài hạn và nhu cầu gia đình; B2B nên đánh vào doanh nghiệp vừa và nhỏ, trường học, phòng khám và văn phòng dọc trục Nguyễn Văn Lộc – Tố Hữu – Quang Trung.',
        'Không mở thêm giường trước khi tăng công suất KTV. Với 60 giường và 16 KTV, tỷ lệ sử dụng đồng thời tối đa chỉ khoảng 26,7%; nguồn lực khan hiếm là giờ KTV.',
        'Khởi động một đội Business bốn KTV chuyên trách tại Cầu Giấy. Chỉ lập đội thứ hai khi đội đầu đạt các cổng: tối thiểu ba khách hàng doanh nghiệp trả tiền, lấp đầy từ 70%, đúng giờ từ 95% và biên đóng góp dương sau di chuyển.',
        'Tại TP.HCM, triển khai thử nghiệm trả phí 90 ngày với 3–5 doanh nghiệp neo tại Quận 7, Thủ Đức hoặc CBD trước khi chọn hub. Tách rõ dữ liệu “TP.HCM lõi” và “TP.HCM mở rộng sau 01/07/2025”.'
    )
    Add-Heading 'Bức tranh định lượng cần ghi nhớ' 2 | Out-Null
    Add-Table -Headers @('Chỉ dấu','Ước lượng hoạch định','Ý nghĩa vận hành') -Rows @(
        @('Công suất đồng thời','16 KTV / 60 giường = 26,7%','KTV là nút thắt; giường đang dư so với nhân sự.'),
        @('Công suất tại điểm','160 ca/ngày lý thuyết','Giả định 75 phút phục vụ + 15 phút chuyển ca; không phải mục tiêu bán.'),
        @('Doanh thu công suất','4,32–9,50 tỷ đồng/năm','Kịch bản 25%–55% công suất, vé bình quân 300.000đ, trước ưu đãi/thuế.'),
        @('Một pod Business','Khoảng 35,5 triệu đồng/tháng','4 KTV, 20 lượt/ngày, 22 ngày, giá 95.000đ và chiết khấu hỗn hợp 15%.'),
        @('Dải chi tiêu Business','HN 1,43–28,66; HCM 1,85–36,96 tỷ đồng/năm','Dải kịch bản từ proxy nhân sự văn phòng; không phải dự báo thị phần.')
    ) -Widths @(105,130,233) -Alignments @(0,1,0) | Out-Null
    Add-Heading 'Khuyến nghị một câu' 2 | Out-Null
    Add-Paragraph -Text 'Tăng trưởng bền vững không đến từ thêm diện tích; nó đến từ tăng tỷ lệ giờ KTV có doanh thu, tiêu chuẩn hóa trải nghiệm, ký hợp đồng doanh nghiệp lặp lại và biến mỗi phiên Business thành một kênh đưa khách về hai cơ sở.' | Out-Null

    Add-Heading '2. Phạm vi, phương pháp và mức độ tin cậy' 1 | Out-Null
    Add-Paragraph -Text 'Báo cáo kết hợp dữ liệu vận hành hiện có của nền tảng Tuệ Tâm Care, số liệu chính thức của Hà Nội và TP.HCM, báo cáo thị trường văn phòng của Savills/CBRE/Cushman & Wakefield, cùng một số quan sát giá công khai. Hai điểm phân tích được neo theo xác nhận: Công viên Cầu Giấy và C17 BCA – Mỗ Lao.' | Out-Null
    Add-Heading 'Ba lớp bằng chứng' 2 | Out-Null
    Add-Table -Headers @('Lớp','Nội dung','Cách sử dụng') -Rows @(
        @('Đã biết','Giờ mở cửa, số giường, số KTV, giá niêm yết, gói Business','Dùng trực tiếp trong mô hình công suất.'),
        @('Nguồn công khai','Dân số, doanh nghiệp, diện tích văn phòng, tỷ lệ lấp đầy, metro','Dùng để xác định mật độ cơ hội và so sánh thành phố.'),
        @('Giả định hoạch định','Mật độ m²/người, tỷ lệ tham gia, tần suất, tỷ lệ công suất','Luôn trình bày theo dải; cần kiểm chứng bằng pilot và dữ liệu thật.')
    ) -Widths @(90,190,188) | Out-Null
    Add-Callout -Text 'Kỷ luật dữ liệu: “dung lượng thị trường” không đồng nghĩa “doanh thu sẽ đạt”. Mọi quyết định thuê mặt bằng, tuyển đội hay đầu tư xe/thiết bị phải đi qua các cổng thử nghiệm có doanh thu thật.' -Kind 'gold' | Out-Null
    Add-Heading 'Ranh giới dữ liệu TP.HCM' 2 | Out-Null
    Add-Paragraph -Text 'Từ 01/07/2025, TP.HCM mở rộng sau sáp nhập có quy mô hơn 14 triệu dân và trên 6.700 km² [S9]. Trong khi đó, nhiều bộ số liệu văn phòng và lao động vẫn phản ánh địa bàn lõi trước sáp nhập. Báo cáo không trộn hai ranh giới: quy mô hành chính mới dùng để nhìn dư địa dài hạn; mô hình Business dùng thị trường văn phòng lõi để giữ tính so sánh.' | Out-Null
    Add-Heading 'Các giả định vận hành nền' 2 | Out-Null
    Add-BulletList @(
        'Hai cơ sở mở 09:00–24:00; nhận ca cuối 23:00 và chỉ nhận ca 60 phút lúc 23:00.',
        'Cơ sở 1 có 28 giường và 8 KTV; Cơ sở 2 có 32 giường và 8 KTV.',
        'Giá phổ biến: 250.000đ/60 phút, 350.000đ/90 phút, 450.000đ/120 phút; một số trị liệu chuyên sâu cao hơn.',
        'Business: 75.000đ/15 phút, 95.000đ/20 phút, 150.000đ/30 phút; hợp đồng tháng có mức ưu đãi theo tần suất.',
        'Tiền tip thuộc KTV và nằm ngoài bill dịch vụ; mọi mô hình doanh thu trong báo cáo loại trừ tip.'
    )

    Add-Heading '3. Hai mô hình kinh doanh và vai trò chiến lược' 1 | Out-Null
    Add-Table -Headers @('Tiêu chí','Phục vụ tại điểm','Business tại doanh nghiệp buổi trưa') -Rows @(
        @('Nhu cầu chính','Thư giãn sâu 60–120 phút; phục hồi sau giờ làm; gói dài hạn','Phiên 15–30 phút; sức khỏe định kỳ cho cả công ty; ít gián đoạn công việc'),
        @('Doanh thu','Vé cao hơn, bán gói, tái mua, upsell dịch vụ','Hợp đồng lặp lại, số lượng lớn, tạo lead cho cơ sở'),
        @('Tài sản','Mặt bằng, giường, phòng, tiếp tân, tiện ích','Đội KTV, dụng cụ di động, giao thông, setup tại văn phòng'),
        @('Rủi ro','Chi phí cố định, công suất thấp, ùn tắc/đỗ xe','Dồn tải 11:00–14:00, di chuyển, không gian riêng, quy trình mua hàng'),
        @('Vai trò','Hub kiểm soát chất lượng và giữ chân','Pod tạo cầu, phủ thương hiệu và mở tài khoản doanh nghiệp')
    ) -Widths @(100,184,184) | Out-Null
    Add-Heading 'Ưu điểm của phục vụ tại điểm' 2 | Out-Null
    Add-BulletList @(
        'Kiểm soát tốt hơn về vệ sinh, riêng tư, âm thanh, nhiệt độ và trải nghiệm 60–120 phút.',
        'Dễ chuẩn hóa chất lượng KTV, check-in/check-out, thanh toán, đánh giá và xử lý khiếu nại.',
        'Có khả năng bán gói dài hạn, cross-sell và tạo thói quen quay lại; giá vé mỗi lượt cao hơn Business.',
        'Không mất giờ KTV cho di chuyển; thuận lợi ghép lịch và tận dụng khách vãng lai.'
    )
    Add-Heading 'Hạn chế của phục vụ tại điểm' 2 | Out-Null
    Add-BulletList @(
        'Mang chi phí thuê, khấu hao, điện nước và nhân sự cố định; hiệu quả phụ thuộc mạnh vào công suất theo khung giờ.',
        'Khách phải vượt qua ma sát giao thông, đỗ xe và thời gian di chuyển — đặc biệt tại khu văn phòng Cầu Giấy.',
        'Cạnh tranh địa phương phân mảnh; cần chứng minh thương hiệu an toàn, minh bạch và phù hợp gia đình/doanh nghiệp.'
    )
    Add-Heading 'Ưu điểm của Business buổi trưa' 2 | Out-Null
    Add-BulletList @(
        'Đưa dịch vụ tới nơi có mật độ nhân sự cao, giảm ma sát đi lại và phù hợp với khoảng nghỉ trưa.',
        'Hợp đồng doanh nghiệp tạo doanh thu lặp lại, kế hoạch nhân sự rõ và chi phí thu hút khách thấp hơn nếu tái ký.',
        'Phiên ngắn là kênh trải nghiệm: mỗi người tham gia có thể nhận QR/tài khoản để đặt dịch vụ sâu tại cơ sở.',
        'Giúp Tuệ Tâm Care khác biệt bằng tiêu chuẩn vận hành, dữ liệu và chăm sóc định kỳ thay vì cạnh tranh giảm giá.'
    )
    Add-Heading 'Hạn chế của Business buổi trưa' 2 | Out-Null
    Add-BulletList @(
        'Đỉnh nhu cầu tập trung 11:00–14:00; điều KTV từ cơ sở có thể làm mất doanh thu tại điểm nếu không có đội riêng.',
        'Chi phí ẩn gồm di chuyển, chờ thang máy, setup, bãi xe, dụng cụ, thay đổi số người và hủy sát giờ.',
        'Cần quy trình vệ sinh, riêng tư, an toàn tại nơi làm việc, bảo hiểm trách nhiệm và cơ chế xử lý sự cố.',
        'Chu kỳ bán B2B dài hơn: phải qua HR/Admin/Procurement, ngân sách phúc lợi và phê duyệt địa điểm.'
    )
    Add-Callout -Text 'Thiết kế đúng không phải “một đội chạy cả hai nơi”. Nên có pod Business chuyên trách, còn hai cơ sở giữ vai trò hub dự phòng, đào tạo, vệ sinh và chuyển đổi khách.' -Kind 'blue' | Out-Null

    Add-Heading '4. Điểm kinh doanh 1 — Công viên Cầu Giấy' 1 | Out-Null
    Add-Paragraph -Text 'Công viên Cầu Giấy nằm trong vùng giao thoa giữa khu dân cư, trường học, dịch vụ và hành lang văn phòng – công nghệ phía Tây. Cầu Giấy được địa phương mô tả là nơi tập trung doanh nghiệp công nghệ, văn phòng hiện đại và lực lượng lao động trẻ, có kỹ năng [S3]. Đây là điểm neo phù hợp nhất để kết hợp bán lẻ tại chỗ với điều phối Business.' | Out-Null
    Add-Heading 'Tệp khách ưu tiên' 2 | Out-Null
    Add-BulletList @(
        'Nhân sự văn phòng tại Duy Tân – Trần Thái Tông – Yên Hòa – Nam Từ Liêm, sử dụng sau 17:30 hoặc cuối tuần.',
        'Cư dân trẻ, gia đình và người làm việc tự do quanh Cầu Giấy; ưu tiên đặt trước, minh bạch thời lượng và KTV.',
        'Doanh nghiệp công nghệ, tư vấn, tài chính, dịch vụ chuyên môn cần chương trình sức khỏe định kỳ tại công ty.',
        'Khách Business được chuyển đổi sang dịch vụ 60–90 phút tại điểm bằng QR, voucher định danh và lịch đề xuất.'
    )
    Add-Heading 'Điểm mạnh – điểm yếu vi mô' 2 | Out-Null
    Add-Table -Headers @('Điểm mạnh','Hạn chế/Rủi ro','Hàm ý') -Rows @(
        @('Mật độ văn phòng – công nghệ cao','Ùn tắc và đỗ xe làm giảm ý định đi xa','Tập trung bán kính ngắn; khung giờ sau cao điểm; hướng dẫn đỗ xe rõ.'),
        @('Tệp lao động trẻ, thu nhập ổn định','Cạnh tranh wellness/spa dày','Định vị minh bạch, gia đình và doanh nghiệp; không dùng ngôn ngữ y khoa.'),
        @('Có thể làm hub Business phía Tây','KTV bị kéo khỏi cơ sở vào buổi trưa','Pod riêng 4 KTV; hub chỉ hỗ trợ dự phòng.'),
        @('Khả năng chuyển đổi B2B → B2C','Voucher đại trà làm loãng biên lợi nhuận','Voucher định danh theo doanh nghiệp, có ngày hết hạn và đo chuyển đổi.')
    ) -Widths @(140,140,188) | Out-Null
    Add-Heading 'Đề xuất thương mại 90 ngày' 2 | Out-Null
    Add-NumberList @(
        'Lập danh sách 30 doanh nghiệp trong 15 phút di chuyển thực tế vào 10:30–11:00; ưu tiên 100–800 nhân sự và có không gian phúc lợi.',
        'Bán ba gói thử trả phí: 15 phút/75.000đ, 20 phút/95.000đ, 30 phút/150.000đ; không miễn phí toàn bộ phiên đầu.',
        'Mỗi phiên tạo QR doanh nghiệp riêng; đo số người tham gia, đánh giá, tỉ lệ quay lại và tỉ lệ đặt tại cơ sở trong 60 ngày.',
        'Điều chỉnh ca tại điểm: bảo vệ khung 17:30–22:30; không để Business buổi trưa gây thiếu KTV giờ cao điểm.'
    )

    Add-Heading '5. Điểm kinh doanh 2 — C17 BCA, Mỗ Lao' 1 | Out-Null
    Add-Paragraph -Text 'Điểm Mỗ Lao nằm trong vùng đô thị Hà Đông, gần trục Nguyễn Văn Lộc – Tố Hữu – Quang Trung. Hà Đông cùng Cầu Giấy nằm trong nhóm địa bàn có số đăng ký doanh nghiệp mới cao của Hà Nội trong năm 2025; riêng Hà Đông dẫn đầu số đăng ký mới đến 31/05/2025 với 1.307 doanh nghiệp [S4]. Tuyến metro Cát Linh – Hà Đông phục vụ 3,23 triệu lượt trong quý I/2025, tăng 13,3% so với cùng kỳ [S5], tạo thêm năng lực tiếp cận theo trục.' | Out-Null
    Add-Heading 'Tệp khách ưu tiên' 2 | Out-Null
    Add-BulletList @(
        'Cư dân căn hộ và khu đô thị Mỗ Lao – Văn Quán – Tố Hữu; nhu cầu sau giờ làm, cuối tuần, gói dài hạn.',
        'Gia đình, nhóm bạn và khách mời sếp/đối tác muốn đặt giường gần nhau; nhấn mạnh riêng tư và lịch xác nhận nhanh.',
        'Doanh nghiệp vừa và nhỏ, trường học, phòng khám, trung tâm đào tạo, văn phòng dịch vụ dọc các trục lân cận.',
        'Khách dùng chung gói/thẻ ở hai cơ sở; Mỗ Lao có thể là hub phía Tây Nam và điểm tiếp nhận khách metro.'
    )
    Add-Heading 'Điểm mạnh – điểm yếu vi mô' 2 | Out-Null
    Add-Table -Headers @('Điểm mạnh','Hạn chế/Rủi ro','Hàm ý') -Rows @(
        @('Tệp cư dân ổn định, phù hợp gói dài hạn','Mật độ văn phòng lớn thấp hơn hành lang Cầu Giấy','Ưu tiên B2C giữ chân; B2B chọn cụm nhỏ nhưng gần.'),
        @('Metro và trục đô thị tăng khả năng tiếp cận','Khách nhạy cảm giá và nhiều lựa chọn địa phương','Gói thành viên theo tần suất; nhấn chất lượng, dữ liệu và dùng chung hai cơ sở.'),
        @('32 giường tạo dư địa nhóm','Chỉ 8 KTV nên công suất đồng thời bị giới hạn','Không quảng bá “còn nhiều giường” nếu KTV không đủ; điều phối theo KTV.'),
        @('Có thể làm hub Tây Nam','Di chuyển Business sang khu khác dễ mất thời gian','Chỉ nhận tuyến có biên đóng góp dương; gom lịch theo cụm địa lý.')
    ) -Widths @(140,140,188) | Out-Null
    Add-Heading 'Đề xuất thương mại 90 ngày' 2 | Out-Null
    Add-BulletList @(
        'Thử “gói cư dân Mỗ Lao” theo 4/8/12 buổi, không giảm sâu một lần; ưu đãi bằng quyền đổi lịch, đặt nhóm và dùng cả hai cơ sở.',
        'Thiết lập chiến dịch sau giờ làm 18:00–21:30 và cuối tuần; đo riêng công suất theo giờ, không chỉ doanh thu ngày.',
        'B2B tập trung bán kính vận hành ngắn; nếu cần phục vụ xa, ghép tối thiểu số người để bù di chuyển và setup.',
        'Khai thác metro bằng nội dung chỉ đường, thời gian đi bộ và khung giờ có thể đặt; cần khảo sát thực địa trước khi truyền thông.'
    )

    Add-Heading '6. Thị trường Hà Nội' 1 | Out-Null
    Add-Paragraph -Text 'Hà Nội năm 2025 có khoảng 8,86 triệu dân và lực lượng lao động từ 15 tuổi trở lên khoảng 4,21 triệu người [S1][S2]. Thành phố có trên 223.000 doanh nghiệp thực tế hoạt động theo công bố địa phương tháng 10/2025; một nguồn cùng hệ thống công bố con số cao hơn nhưng khác phạm vi định nghĩa, vì vậy báo cáo dùng mốc thận trọng [S3].' | Out-Null
    Add-Heading 'Tín hiệu nhu cầu' 2 | Out-Null
    Add-BulletList @(
        'Nguồn cung văn phòng Hà Nội quý I/2025 khoảng 2,33 triệu m² tại 193 dự án, tỷ lệ lấp đầy 82%; nhu cầu đáng kể đến từ ICT, tư vấn và FIRE [S6].',
        'Khu phía Tây tiếp tục là cụm văn phòng hoạt động mạnh; Grade B chịu áp lực nhưng vẫn có mật độ người làm việc lớn [S7].',
        'Cầu Giấy và Hà Đông cùng nằm trong nhóm địa bàn có hoạt động đăng ký doanh nghiệp mới cao [S4].',
        'Dịch chuyển ra ngoài CBD tạo cơ hội cho mô hình đặt điểm/hub gần khu dân cư – văn phòng thay vì chỉ bám trung tâm.'
    )
    Add-Heading 'Bản đồ ưu tiên Hà Nội' 2 | Out-Null
    Add-Table -Headers @('Cụm','Mô hình ưu tiên','Lý do','Mức ưu tiên') -Rows @(
        @('Cầu Giấy – Nam Từ Liêm – Yên Hòa','Hub + Business pod','Mật độ văn phòng/công nghệ, gần Cơ sở 1','1'),
        @('Mỗ Lao – Thanh Xuân – Hà Đông','Tại điểm + B2B chọn lọc','Cư dân, doanh nghiệp mới, metro, gần Cơ sở 2','2'),
        @('CBD Hoàn Kiếm – Ba Đình','Business cao cấp/đối tác','Khả năng chi trả và thương hiệu; chi phí tiếp cận cao','3'),
        @('Long Biên – Gia Lâm','Pilot theo hợp đồng','Dân cư mới nhưng khoảng cách vận hành lớn','4')
    ) -Widths @(130,125,165,48) -Alignments @(0,0,0,1) | Out-Null
    Add-Callout -Text 'Chiến lược Hà Nội: tối ưu hai hub hiện có trước; chỉ mở điểm thứ ba khi công suất KTV theo giờ cao điểm duy trì trên 70%, tỷ lệ khách quay lại đủ mạnh và khu mới có dữ liệu lead trả tiền.' -Kind 'gold' | Out-Null

    Add-Heading '7. Thị trường Thành phố Hồ Chí Minh' 1 | Out-Null
    Add-Paragraph -Text 'TP.HCM mở rộng sau 01/07/2025 có hơn 14 triệu dân và khoảng 450.000 doanh nghiệp đang hoạt động theo nguồn địa phương [S9][S10]. Địa bàn lõi trước sáp nhập có khoảng 9,54 triệu dân và 4,73 triệu người có việc làm từ 15 tuổi trở lên năm 2024 [S11]. Quy mô lớn tạo dư địa, nhưng khoảng cách địa lý cũng khiến mô hình di động phải chia pod theo vùng.' | Out-Null
    Add-Heading 'Tín hiệu văn phòng và B2B' 2 | Out-Null
    Add-BulletList @(
        'Thị trường văn phòng lõi quý I/2025 có khoảng 2,8 triệu m², tỷ lệ lấp đầy 88%; ICT chiếm 35% động lực thuê, FIRE 14%, sản xuất 13% và tư vấn 10% [S12].',
        'Quý II/2025, nguồn cung khoảng 2,9 triệu m², giá thuê bình quân 843.000đ/m²/tháng và lấp đầy 88% [S13].',
        'Khu Nam TP.HCM ghi nhận văn phòng Grade A lấp đầy 93,5% trong quý II/2025, có sự hiện diện nổi bật của doanh nghiệp công nghệ [S14].',
        'TP.HCM có hệ sinh thái coworking lớn; mô hình Business có thể bán qua tòa nhà/coworking thay vì từng doanh nghiệp nhỏ [S15].'
    )
    Add-Heading 'Bản đồ ưu tiên TP.HCM' 2 | Out-Null
    Add-Table -Headers @('Cụm','Cơ hội','Rủi ro','Đề xuất') -Rows @(
        @('Quận 7 / Khu Nam','Grade A lấp đầy cao; campus kiểm soát tốt','Xa Cầu Giấy/Hà Nội không liên quan; cần đội địa phương','Pilot Business ưu tiên 1'),
        @('TP Thủ Đức','Công nghệ, khu đô thị và nguồn cung tương lai','Diện rộng, di chuyển khó','Pod phía Đông riêng; ưu tiên hợp đồng lớn'),
        @('CBD Quận 1–3 / Bình Thạnh','Khả năng chi trả, giá trị thương hiệu','Cạnh tranh, bãi xe, chi phí cao','B2B cao cấp; chưa mở mặt bằng sớm'),
        @('Tân Bình / Phú Nhuận','Văn phòng hỗn hợp, kết nối sân bay','Kẹt xe và phân tán','Bán theo cụm tòa nhà'),
        @('Bình Dương sau sáp nhập','Nhà máy, logistics, ca làm việc','Giao thức an toàn và lịch ca khác','Pod công nghiệp riêng sau pilot'),
        @('Bà Rịa – Vũng Tàu','Doanh nghiệp năng lượng/du lịch','Không thể phục vụ hiệu quả từ lõi TP.HCM','Đối tác hoặc đội địa phương riêng')
    ) -Widths @(100,135,130,103) | Out-Null
    Add-Callout -Text 'Trình tự vào TP.HCM: bán hợp đồng → chạy pilot trả phí → đo biên đóng góp theo tuyến → tuyển pod địa phương → chỉ sau đó mới cân nhắc hub. Không lấy quy mô dân số làm lý do thuê mặt bằng.' -Kind 'red' | Out-Null

    Add-Heading '8. Quy mô có thể phục vụ và kịch bản doanh thu' 1 | Out-Null
    Add-Heading '8.1. Năng lực tại hai cơ sở Hà Nội' 2 | Out-Null
    Add-Paragraph -Text 'Tổng nguồn lực là 16 KTV × 15 giờ mở cửa = 14.400 phút KTV/ngày. Với ca bình quân 75 phút và 15 phút chuyển ca, block nguồn lực là 90 phút, tương đương khoảng 160 ca/ngày lý thuyết. Trên 360 ngày vận hành, trần lý thuyết là 57.600 ca/năm.' | Out-Null
    Add-Figure -Path $capacityChart -AltText 'Biểu đồ thanh ngang ba kịch bản doanh thu công suất: 25 phần trăm 4,32 tỷ; 40 phần trăm 6,91 tỷ; 55 phần trăm 9,50 tỷ đồng mỗi năm.' -Caption 'Hình 1. Dải doanh thu công suất tại hai cơ sở; trước ưu đãi, hoàn/hủy, thuế và chi phí. Tip KTV không nằm trong doanh thu dịch vụ.'
    Add-Table -Headers @('Kịch bản','Công suất thực hiện','Ca/năm','Vé bình quân','Doanh thu gộp') -Rows @(
        @('Thận trọng','25%','14.400','300.000đ','4,320 tỷ đồng'),
        @('Cơ sở','40%','23.040','300.000đ','6,912 tỷ đồng'),
        @('Tăng trưởng','55%','31.680','300.000đ','9,504 tỷ đồng')
    ) -Widths @(90,90,88,92,108) -Alignments @(0,1,1,2,2) | Out-Null
    Add-Callout -Text 'Đây là doanh thu theo công suất, không phải lợi nhuận. Cần trừ khuyến mại, hoàn/hủy, lương KTV, mặt bằng, điện nước, khấu hao, nền tảng, thuế và các chi phí khác.' -Kind 'gold' | Out-Null
    Add-Heading '8.2. Proxy nhân sự văn phòng' 2 | Out-Null
    Add-Paragraph -Text 'Để tránh dùng dân số toàn thành phố cho một dịch vụ nhắm tới văn phòng, báo cáo ước lượng nhân sự từ diện tích văn phòng có người sử dụng. Giả định 8–12 m²/người tạo dải, 10 m²/người là trường hợp cơ sở. Đây là proxy, không phải số nhân sự chính thức.' | Out-Null
    Add-Table -Headers @('Thị trường','Nguồn cung','Lấp đầy','Diện tích sử dụng','Proxy nhân sự (dải)','Cơ sở') -Rows @(
        @('Hà Nội','2,33 triệu m²','82%','1,91 triệu m²','159.000–239.000','191.000'),
        @('TP.HCM lõi','2,80 triệu m²','88%','2,46 triệu m²','205.000–308.000','246.000')
    ) -Widths @(86,86,62,92,94,48) -Alignments @(0,2,1,2,2,2) | Out-Null
    Add-Heading '8.3. Dải chi tiêu có thể phục vụ cho Business' 2 | Out-Null
    Add-Paragraph -Text 'Ba kịch bản lần lượt giả định: (i) 3% nhân sự tham gia × 4 lượt/năm × 75.000đ; (ii) 6% × 6 lượt × 95.000đ; (iii) 10% × 8 lượt × 150.000đ. Kết quả là dải chi tiêu tiềm năng của tệp văn phòng, chưa phải doanh thu Tuệ Tâm Care.' | Out-Null
    Add-Figure -Path $samChart -AltText 'Biểu đồ nhóm so sánh dung lượng chi tiêu Business tại Hà Nội và thành phố Hồ Chí Minh theo ba kịch bản thận trọng, cơ sở và tăng trưởng.' -Caption 'Hình 2. Dải chi tiêu Business theo kịch bản. TP.HCM lớn hơn nhưng chi phí triển khai và địa lý cũng phức tạp hơn.'
    Add-Table -Headers @('Kịch bản','Hà Nội','TP.HCM lõi','Giải thích') -Rows @(
        @('Thận trọng','1,43 tỷ','1,85 tỷ','Tỷ lệ tham gia thấp, tần suất 4 lượt, gói 15 phút.'),
        @('Cơ sở','6,53 tỷ','8,43 tỷ','6% tệp văn phòng, 6 lượt/năm, gói 20 phút.'),
        @('Tăng trưởng','28,66 tỷ','36,96 tỷ','10% tệp, 8 lượt/năm, gói 30 phút; cần hệ thống phân phối lớn.')
    ) -Widths @(90,90,96,192) -Alignments @(0,2,2,0) | Out-Null
    Add-Heading '8.4. Kinh tế một pod Business' 2 | Out-Null
    Add-Table -Headers @('Thành phần','Giả định cơ sở','Kết quả') -Rows @(
        @('Nhân sự','4 KTV','4 nguồn lực song song'),
        @('Cửa sổ phục vụ','11:00–14:00','180 phút/ngày'),
        @('Block/lượt','20 phút phục vụ + 5 phút chuyển','25 phút'),
        @('Trần kỹ thuật','7 lượt/KTV/ngày','28 lượt/ngày'),
        @('Thực hiện cơ sở','70% trần','Khoảng 20 lượt/ngày'),
        @('Doanh thu cơ sở','20 × 22 ngày × 95.000đ × 85%','35,5 triệu đồng/tháng'),
        @('Trần niêm yết','28 × 22 × 95.000đ','58,5 triệu đồng/tháng')
    ) -Widths @(120,210,138) | Out-Null
    Add-Paragraph -Text 'Mô hình pod chưa tính lương, di chuyển, setup, thiết bị, quản lý, thuế và chi phí bán hàng. Cổng quyết định đúng là biên đóng góp sau các chi phí biến đổi, không phải doanh thu gộp.' | Out-Null

    Add-Heading '9. Chiến lược kết hợp “hub-and-pod”' 1 | Out-Null
    Add-Heading 'Vòng lặp tăng trưởng' 2 | Out-Null
    Add-NumberList @(
        'Doanh nghiệp ký lịch sức khỏe định kỳ và gửi danh sách/QR phiên.',
        'Nhân sự trải nghiệm 15–30 phút tại văn phòng, tạo tài khoản hoặc nhận voucher định danh.',
        'AI/CRM đề xuất dịch vụ sâu 60–90 phút tại Công viên Cầu Giấy hoặc Mỗ Lao theo vị trí và thời gian rảnh.',
        'Khách quay lại, mua gói dài hạn, giới thiệu Affiliate hoặc đặt nhóm/mời sếp.',
        'Dữ liệu đánh giá và tỷ lệ tham gia được tổng hợp cho doanh nghiệp; hợp đồng được gia hạn hoặc mở rộng.'
    )
    Add-Heading 'Nguyên tắc phân bổ KTV' 2 | Out-Null
    Add-BulletList @(
        'Pod Business có lịch và chỉ tiêu riêng; không rút KTV cơ sở nếu khiến khung cao điểm tại điểm thiếu nguồn lực.',
        'Mỗi tuyến phải có thời gian đệm giao thông; gom doanh nghiệp theo cụm và đặt mức người tối thiểu theo khoảng cách.',
        'QR KTV/Business ghi nhận bắt đầu–kết thúc, địa điểm, người phụ trách và số lượt; dữ liệu đẩy về Admin/Quản lý cơ sở.',
        'Tip tùy tâm trả trực tiếp/ghi nhận riêng cho KTV, không trộn vào bill hoặc doanh thu cơ sở.'
    )
    Add-Heading 'Kiến trúc sản phẩm thương mại' 2 | Out-Null
    Add-Table -Headers @('Tầng','Sản phẩm','Mục tiêu') -Rows @(
        @('Dùng thử','Phiên Business trả phí 15/20/30 phút','Giảm rủi ro mua; thu bằng chứng tham gia và đánh giá.'),
        @('Định kỳ','4/8/12 phiên mỗi tháng','Doanh thu lặp lại; kế hoạch KTV và tuyến ổn định.'),
        @('Chuyển đổi','Voucher định danh về cơ sở','Tăng vé 60–90 phút; đo CAC theo doanh nghiệp.'),
        @('Giữ chân','Gói dài hạn dùng chung hai cơ sở','Tăng tần suất, giá trị vòng đời và tiện lợi.'),
        @('Lan truyền','Affiliate, mời bạn, mời sếp','Tăng khách mới có ngữ cảnh quan hệ và đặt nhóm.')
    ) -Widths @(90,176,202) | Out-Null

    Add-Heading '10. Go-to-market theo địa bàn' 1 | Out-Null
    Add-Heading 'Hà Nội — 0 đến 6 tháng' 2 | Out-Null
    Add-BulletList @(
        'Công viên Cầu Giấy: 30 account mục tiêu, 10 buổi demo trả phí, chuyển tối thiểu 3 hợp đồng định kỳ.',
        'Mỗ Lao: chiến dịch cư dân và gói dài hạn; 10 account B2B gần; kiểm tra nhu cầu theo trường học/phòng khám/văn phòng.',
        'Lập bản đồ thời gian thực 11:00–14:00, bãi xe, thang máy, điểm setup và số người tối thiểu cho từng tuyến.',
        'Chuẩn hóa proposal một trang: lợi ích, quy trình, an toàn, dữ liệu báo cáo, SLA, giá và điều kiện hủy.'
    )
    Add-Heading 'TP.HCM — pilot 90 ngày' 2 | Out-Null
    Add-BulletList @(
        'Chọn một cụm duy nhất: Quận 7 là ưu tiên nếu có đối tác/tòa nhà neo; Thủ Đức nếu có khách công nghệ quy mô lớn.',
        'Tuyển/đối tác pod địa phương 4 KTV; đào tạo và kiểm định trước, không điều người từ Hà Nội.',
        'Ký 3–5 hợp đồng trả phí, không thuê hub; dùng không gian đối tác hoặc kho/điểm chuẩn bị nhỏ nếu cần.',
        'Sau 90 ngày, phê duyệt hub chỉ khi có doanh thu lặp lại, tuyến hiệu quả và pipeline hợp đồng đủ 6 tháng.'
    )
    Add-Heading 'Thông điệp bán hàng' 2 | Out-Null
    Add-Callout -Text '“Sức khỏe định kỳ cho cả công ty — phiên chăm sóc 15–30 phút ngay tại văn phòng, vận hành theo lịch, có dữ liệu tham gia và không làm gián đoạn ngày làm việc.”' -Kind 'blue' | Out-Null
    Add-Paragraph -Text 'Không sử dụng tuyên bố điều trị bệnh nếu chưa có cơ sở pháp lý và y khoa. WHO xem nơi làm việc là một bối cảnh quan trọng để nâng cao sức khỏe, nhưng dịch vụ Tuệ Tâm Care nên được truyền thông là wellness/thư giãn, không thay thế chẩn đoán hoặc điều trị [S16].' | Out-Null

    Add-Heading '11. Lộ trình 12 tháng và cổng quyết định' 1 | Out-Null
    Add-Table -Headers @('Giai đoạn','Việc phải làm','Cổng qua giai đoạn') -Rows @(
        @('0–30 ngày','Khảo sát thực địa; dữ liệu booking; bản đồ doanh nghiệp; SOP Business; proposal','Đủ giá thành theo ca/tuyến; danh sách 30 account Cầu Giấy + 10 Mỗ Lao.'),
        @('31–90 ngày','Pilot pod Cầu Giấy; đo lấp đầy, đúng giờ, chuyển đổi về cơ sở','≥3 khách trả tiền; ≥70% slot; ≥95% đúng giờ; biên đóng góp dương.'),
        @('Tháng 4–6','Gia hạn; chuẩn hóa CRM; thử pod 2 nếu đủ cầu','Ý định gia hạn >60%; chuyển đổi Business→cơ sở 8–12%/60 ngày.'),
        @('Tháng 7–9','Mở cụm Hà Nội thứ hai hoặc pilot TP.HCM','Pipeline trả tiền ≥6 tháng; đội địa phương đạt chuẩn.'),
        @('Tháng 10–12','Đánh giá hub TP.HCM/điểm thứ ba Hà Nội','Không ký mặt bằng nếu chưa đạt công suất, giữ chân và biên đóng góp mục tiêu.')
    ) -Widths @(82,218,168) | Out-Null
    Add-Heading 'Cơ chế dừng sớm' 2 | Out-Null
    Add-BulletList @(
        'Dừng tuyến nếu biên đóng góp âm ba phiên liên tiếp sau khi đã tối ưu lịch và số người tối thiểu.',
        'Dừng tuyển thêm KTV nếu công suất giờ có doanh thu chưa tăng tương ứng với pipeline đã ký.',
        'Không mở mặt bằng vì “nhiều người quan tâm”; chỉ mở khi có booking trả tiền và cohort quay lại.',
        'Không mở đồng thời nhiều cụm TP.HCM trong pilot; dữ liệu sẽ bị loãng và khó xác định nguyên nhân.'
    )

    Add-Heading '12. Bộ KPI quản trị' 1 | Out-Null
    Add-Table -Headers @('Nhóm','KPI','Định nghĩa quản trị') -Rows @(
        @('Tại điểm','Công suất KTV theo giờ','Phút KTV có doanh thu / phút KTV sẵn sàng; xem theo cơ sở và khung giờ.'),
        @('Tại điểm','Tỷ lệ quay lại 30/60/90 ngày','Khách có ca tiếp theo trong cửa sổ / khách hoàn tất ca đầu.'),
        @('Booking','No-show và đổi lịch','Tách lần đầu/lần hai trong tháng; đo tiền cọc mất và lý do.'),
        @('Business','Lấp đầy phiên','Lượt phục vụ thực tế / slot khả dụng đã bố trí.'),
        @('Business','Đúng giờ','Phiên bắt đầu trong SLA / tổng phiên.'),
        @('Business','Biên đóng góp theo tuyến','Doanh thu – KTV – di chuyển – setup – vật tư – hoàn/giảm.'),
        @('Chuyển đổi','Business → cơ sở','Người tham gia Business có booking trả tiền tại điểm trong 60 ngày.'),
        @('B2B','Proposal → hợp đồng','Doanh nghiệp ký trả tiền / proposal hợp lệ.'),
        @('B2B','Gia hạn','Doanh nghiệp gia hạn / hợp đồng đến hạn.'),
        @('Chất lượng','NPS/đánh giá & sự cố','Đánh giá sau ca, khiếu nại, vệ sinh, an toàn, SLA xử lý.'),
        @('KTV','Thu nhập & tip ngoài bill','Lương/trách nhiệm và tip tách riêng; đối soát cuối ngày.'),
        @('Tài chính','Lãi/lỗ cơ sở','Doanh thu dịch vụ trừ toàn bộ chi phí hạch toán theo cơ sở/hệ thống.')
    ) -Widths @(78,125,265) | Out-Null
    Add-Callout -Text 'Dashboard phải nối cùng một booking ID xuyên suốt: đặt lịch → cọc → xác nhận/điều phối → check-in → đồng hồ phục vụ → check-out → thanh toán còn lại → tip riêng → đánh giá → báo cáo cơ sở/doanh nghiệp.' -Kind 'red' | Out-Null

    Add-Heading '13. Rủi ro và biện pháp kiểm soát' 1 | Out-Null
    Add-Table -Headers @('Rủi ro','Tác động','Kiểm soát đề xuất') -Rows @(
        @('Công suất KTV thấp','Doanh thu không phủ chi phí cố định','Lập lịch theo giờ; không tăng giường; pilot pod; cổng tuyển dụng.'),
        @('KTV đi Business làm thiếu cơ sở','Mất doanh thu giờ cao điểm','Đội Business riêng; ngưỡng dự phòng; khóa lịch trước.'),
        @('Chậm do giao thông/thang máy','Giảm uy tín B2B','Buffer theo tuyến, check-in địa điểm, điều khoản trễ, cụm địa lý.'),
        @('Không gian không phù hợp','Riêng tư và trải nghiệm kém','Checklist ảnh/video trước, tiêu chuẩn tối thiểu, quyền từ chối setup.'),
        @('Thông điệp y khoa quá mức','Rủi ro pháp lý/niềm tin','Định vị wellness; duyệt nội dung; đào tạo KTV không chẩn đoán.'),
        @('Dữ liệu QR/tài chính sai','Mất đối soát và trải nghiệm','ID xuyên suốt, phân quyền, audit log, đối soát ngân hàng, backup.'),
        @('Mở TP.HCM quá sớm','Chi phí chìm và phân tán quản trị','Hợp đồng trước mặt bằng; pilot một cụm; pod địa phương.'),
        @('Giảm giá đại trà','Biên lợi nhuận và thương hiệu giảm','Voucher định danh, giới hạn một lần, đo cohort và LTV.')
    ) -Widths @(120,130,218) | Out-Null

    Add-Heading '14. Dữ liệu cần bổ sung trước quyết định đầu tư thật' 1 | Out-Null
    Add-Paragraph -Text 'Các mục dưới đây không ngăn cản chạy pilot, nhưng bắt buộc trước khi ký mặt bằng mới, tuyển đội lớn hoặc cam kết doanh thu với nhà đầu tư.' | Out-Null
    Add-NumberList @(
        'Tọa độ/điểm vào chính xác, bãi xe, biển hiệu, mặt tiền, thời gian đi bộ và pin Google Maps của hai cơ sở.',
        '90 ngày dữ liệu booking thật theo giờ, dịch vụ, nguồn khách, KTV, cơ sở, hủy/no-show, cọc và chuyển đổi.',
        'Chi phí thật: thuê, điện nước, lương/phụ cấp, khấu hao, vật tư, marketing, phần mềm, thuế và phí thanh toán.',
        'Lịch ca KTV, năng lực theo dịch vụ, thời gian chuyển ca, nghỉ, đào tạo, tỷ lệ vắng và giới hạn lao động.',
        'Khảo sát đối thủ bán kính thực tế: giá, thời lượng, đánh giá, công suất, đỗ xe, định vị và kênh bán.',
        'Danh sách 20–30 lead doanh nghiệp có người quyết định, quy mô nhân sự, ngân sách phúc lợi và quy trình mua.',
        'Đo thời gian tuyến 11:00–14:00 trong ít nhất 10 ngày làm việc, gồm bãi xe, thang máy và setup.',
        'Rà soát pháp lý, bảo hiểm trách nhiệm, vệ sinh, an toàn lao động, dữ liệu cá nhân và điều khoản dịch vụ tại doanh nghiệp.'
    )
    Add-Heading 'Thiết kế khảo sát thực địa tối thiểu' 2 | Out-Null
    Add-Table -Headers @('Mẫu','Số lượng','Câu hỏi quyết định') -Rows @(
        @('Khách quanh Cầu Giấy','80–120','Khung giờ, quãng đường chấp nhận, giá, KTV, lý do không quay lại.'),
        @('Khách quanh Mỗ Lao','80–120','Nhu cầu gói dài hạn, nhóm/gia đình, giá, metro/đỗ xe.'),
        @('HR/Admin doanh nghiệp HN','20–30','Ngân sách, số người, không gian, tần suất, quy trình phê duyệt.'),
        @('HR/Admin doanh nghiệp HCM','15–20','Cụm ưu tiên, SLA, yêu cầu pháp lý, mức giá và pilot trả phí.'),
        @('KTV','Toàn bộ','Năng lực, giới hạn di chuyển, thời lượng setup, thu nhập mong đợi.'),
        @('Đối thủ','10–15/điểm','Giá thật, công suất, đánh giá, trải nghiệm và định vị.')
    ) -Widths @(144,78,246) | Out-Null

    Add-Heading '15. Kết luận' 1 | Out-Null
    Add-Paragraph -Text 'Tuệ Tâm Care có cơ hội rõ nhất khi kết hợp hai tài sản: trải nghiệm sâu, kiểm soát tốt tại cơ sở và khả năng đưa dịch vụ ngắn tới nơi làm việc. Công viên Cầu Giấy phù hợp làm hub tăng trưởng chính; Mỗ Lao phù hợp làm hub giữ chân và phủ Tây Nam Hà Nội. Hai cơ sở đang dư giường so với KTV, vì vậy tăng công suất nhân sự và chất lượng dữ liệu quan trọng hơn mở rộng diện tích.' | Out-Null
    Add-Paragraph -Text 'Hà Nội nên là nơi chứng minh mô hình. TP.HCM có dung lượng văn phòng lớn hơn nhưng cũng phức tạp hơn về địa lý và vận hành. Đường vào hợp lý là một pilot B2B trả phí, một cụm, một pod địa phương, với cổng quyết định rõ. Khi dữ liệu booking, chi phí và hợp đồng thật đã đủ, mô hình có thể chuyển từ “câu chuyện thị trường” thành kế hoạch đầu tư có thể kiểm toán.' | Out-Null
    Add-Callout -Text 'Bước tiếp theo duy nhất nên làm ngay: hoàn tất bộ dữ liệu 90 ngày và chạy pod Business Cầu Giấy qua các cổng 30–60–90 ngày. Mọi mở rộng khác đứng sau bằng chứng này.' -Kind 'gold' | Out-Null

    Add-Heading 'Phụ lục A. Công thức và giả định' 1 | Out-Null
    Add-Table -Headers @('Chỉ số','Công thức') -Rows @(
        @('Công suất đồng thời','16 KTV / 60 giường = 26,7%'),
        @('Ca lý thuyết/ngày','16 KTV × 900 phút / (75 + 15 phút) = 160'),
        @('Doanh thu công suất','57.600 ca/năm × tỷ lệ công suất × 300.000đ'),
        @('Proxy nhân sự văn phòng','Nguồn cung × tỷ lệ lấp đầy / 8–12 m²/người'),
        @('Dải Business','Proxy nhân sự × tỷ lệ tham gia × lượt/năm × giá/lượt'),
        @('Doanh thu pod cơ sở','20 lượt × 22 ngày × 95.000đ × 85% = 35,53 triệu/tháng')
    ) -Widths @(170,298) | Out-Null
    Add-Paragraph -Text 'Toàn bộ số liệu tiền làm tròn; sai khác nhỏ có thể phát sinh do làm tròn. Không có tip KTV trong doanh thu dịch vụ. Kịch bản chưa tính VAT/thuế, hoàn/hủy và chi phí.' -Size 9 -Color $C.Gray -Italic $true -Align 0 -After 8 | Out-Null

    Add-Heading 'Phụ lục B. Danh mục nguồn' 1 | Out-Null
    $sources = @(
        @('S1','Sở Y tế Hà Nội — Kết quả công tác dân số 2025; dân số 8.855.946 người.','https://soyte.hanoi.gov.vn/dan-so-va-phat-trien/cong-tac-dan-so-va-phat-trien-thu-do-dat-nhieu-ket-qua-noi-bat-trong-nam-2025-2849260201220700908.htm'),
        @('S2','Thống kê Hà Nội — Báo cáo kinh tế xã hội 2025; lực lượng lao động khoảng 4,207 triệu.','https://ubnd-hanoi.mediacdn.vn/90649499933302784/2026/1/5/bc-295-tkt-1767577527946432317350.pdf'),
        @('S3','UBND phường Cầu Giấy — Gặp mặt doanh nghiệp 2025; đặc trưng văn phòng, công nghệ, lao động trẻ và doanh nghiệp hoạt động.','https://caugiay.hanoi.gov.vn/kinh-te-tai-chinh/pho-chu-tich-ubnd-tp-ha-noi-truong-viet-dung-gap-mat-doanh-nghiep-phuong-cau-giay-2805251012110827967.htm'),
        @('S4','Sở Tài chính Hà Nội — Tình hình đăng ký doanh nghiệp đến tháng 5/2025.','https://www.sotaichinh.hanoi.gov.vn/tinh-hinh-dang-ky-doanh-nghiep-tren-dia-ban-thanh-pho-ha-noi-thang-5-nam-2025-171610.html'),
        @('S5','Cổng thông tin Hà Nội — Hanoi Metro phục vụ 4,78 triệu lượt quý I/2025; tuyến 2A đạt 3,23 triệu.','https://hanoi.gov.vn/tin-tuc-su-kien-noi-bat/hanoi-metro-phuc-vu-478-trieu-luot-hanh-khach-trong-quy-i-2025-4250410182811455.htm'),
        @('S6','Savills — Hanoi Office Market Overview Q1/2025.','https://www.savills.in/blog/article/221308-0/vietnam-eng/office-market-overview-in-q1-2025.aspx'),
        @('S7','Cushman & Wakefield — Hanoi Office MarketBeat Q4/2025.','https://www.cushmanwakefield.com/en/vietnam/news/2026/02/q4-2025-hanoi-office-marketbeat-report'),
        @('S8','CBRE — Hanoi Figures Q4/2025.','https://www.cbrevietnam.com/insights/figures/hanoi-figures-q4-2025'),
        @('S9','ITPC — TP.HCM sau sáp nhập; hiệu lực 01/07/2025, hơn 14 triệu dân, trên 6.700 km².','https://itpc.hochiminhcity.gov.vn/-/tp-hcm-sau-sap-nhap-on-song-au-tu'),
        @('S10','Sở Khoa học và Công nghệ TP.HCM — hơn 14 triệu dân, khoảng 450.000 doanh nghiệp hoạt động.','https://dost.hochiminhcity.gov.vn/hoat-dong-so-khcn/so-khoa-hoc-va-cong-nghe-tphcm-lam-viec-voi-tet-education-group-ve-dao-tao-nguon-nhan-luc/'),
        @('S11','ITPC — Mục tiêu việc làm 2025; dữ liệu dân số và lao động lõi TP.HCM năm 2024.','https://itpc.hochiminhcity.gov.vn/-/tp-hcm-at-muc-tieu-giai-quyet-viec-lam-cho-300-000-lao-ong-trong-nam-2025'),
        @('S12','Savills — HCMC Market Report Q1/2025, office stock và cơ cấu nhu cầu thuê.','https://www.savills.com.vn/pdf-folder/hcmc-mrq12025-en.pdf'),
        @('S13','Savills — Thị trường văn phòng TP.HCM sau sáp nhập, Q2/2025.','https://www.savills.com.vn/blog/article/224781-0/vietnam-viet/thi-truong-van-phong-tp.-hcm-sau-sap-nhap.aspx'),
        @('S14','Cushman & Wakefield — HCMC South office market, Q2/2025.','https://www.cushmanwakefield.com/en/vietnam/news/2025/08/the-hcmc-south-office-market-transforms-with-the-wave-of-Technology-occupiers'),
        @('S15','ITPC — Co-working space tại TP.HCM; 120 trung tâm và 28 nhà cung cấp.','https://itpc.hochiminhcity.gov.vn/-/truoc-them-2025-thi-truong-co-working-space-tai-tp-hcm-co-dien-bien-ang-chu-y'),
        @('S16','WHO — Healthy Workplaces: a model for action.','https://iris.who.int/bitstream/handle/10665/113144/9789241500241_eng.pdf'),
        @('S17','Dữ liệu nội bộ Tuệ Tâm Care — cấu hình cơ sở, giờ vận hành, số KTV/giường, giá dịch vụ và gói Business.','Nội bộ nền tảng; trích xuất ngày 25/07/2026.')
    )
    foreach ($s in $sources) {
        $p = Add-Paragraph -Text ("{0}. {1}" -f $s[0],$s[1]) -Size 9.5 -Color $C.Dark -Bold $false -Align 0 -Before 3 -After 1 -Line 1.0
        Add-Paragraph -Text $s[2] -Size 8.5 -Color $C.Blue -Align 0 -After 5 -Line 1.0 | Out-Null
    }
    Add-Paragraph -Text 'Ghi chú nguồn: các báo cáo thị trường có thể dùng phạm vi phân hạng văn phòng khác nhau; báo cáo chỉ dùng số liệu cùng nguồn trong từng phép tính và nêu rõ ranh giới. Các quan sát đối thủ/giá công khai chỉ mang tính định hướng, cần khảo sát thực địa.' -Size 9 -Color $C.Gray -Italic $true -Align 0 -Before 8 -After 4 | Out-Null

    Write-Host '[REPORT] Repaginate and update TOC'
    $word.Options.Pagination = $true
    $doc.Repaginate()
    $toc.Update()
    $doc.Fields.Update() | Out-Null
    Write-Host '[REPORT] Save DOCX and export PDF'
    $doc.SaveAs2($docxPath, 12)
    $doc.ExportAsFixedFormat($pdfPath, 17)
    $doc.Close($false)
    $word.Quit()

    [pscustomobject]@{ Docx = $docxPath; Pdf = $pdfPath; Size = (Get-Item $docxPath).Length } | ConvertTo-Json -Compress
} finally {
    if ($doc) { try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc) } catch {} }
    if ($word) { try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) } catch {} }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
