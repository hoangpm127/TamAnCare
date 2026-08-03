param(
  [string]$ContentPath = "scripts\master-value-content.json",
  [string]$OutputPath = "Tue_Tam_Master_Value.docx"
)

$ErrorActionPreference = "Stop"
$projectRoot = if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) {
  (Get-Location).Path
} else {
  Split-Path -Parent $PSScriptRoot
}
$contentFile = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $ContentPath))
$outputFile = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
$content = Get-Content -LiteralPath $contentFile -Raw -Encoding UTF8 | ConvertFrom-Json

function Get-WordColor([string]$hex) {
  $value = $hex.TrimStart('#')
  $red = [Convert]::ToInt32($value.Substring(0, 2), 16)
  $green = [Convert]::ToInt32($value.Substring(2, 2), 16)
  $blue = [Convert]::ToInt32($value.Substring(4, 2), 16)
  return $red + ($green * 256) + ($blue * 65536)
}

$colorInk = Get-WordColor "#211817"
$colorBrown = Get-WordColor "#4B291C"
$colorRed = Get-WordColor "#9F1D20"
$colorGold = Get-WordColor "#D5A936"
$colorCream = Get-WordColor "#FFF7EC"
$colorRose = Get-WordColor "#FFF0ED"
$colorGreen = Get-WordColor "#EAF8F0"
$colorGreenText = Get-WordColor "#187248"
$colorGray = Get-WordColor "#6F625D"
$colorLine = Get-WordColor "#E7D8CE"
$colorWhite = Get-WordColor "#FFFFFF"

$wdCollapseEnd = 0
$wdPageBreak = 7
$wdAlignLeft = 0
$wdAlignCenter = 1
$wdAlignRight = 2
$wdAlignJustify = 3
$wdCellAlignCenter = 1
$wdAutoFitWindow = 2
$wdLineSpaceMultiple = 5
$wdFormatDocumentDefault = 16
$wdFieldPage = 33
$wdStyleNormal = -1
$wdStyleHeading1 = -2
$wdStyleHeading2 = -3
$wdStyleHeading3 = -4
$wdStyleTitle = -63
$wdStyleSubtitle = -75

$word = $null
$document = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.ScreenUpdating = $false
  $word.Options.Pagination = $false
  $document = $word.Documents.Add()
  $script:selection = $word.Selection
  $selection = $script:selection

  $document.PageSetup.TopMargin = 50
  $document.PageSetup.BottomMargin = 46
  $document.PageSetup.LeftMargin = 54
  $document.PageSetup.RightMargin = 54
  $document.PageSetup.HeaderDistance = 22
  $document.PageSetup.FooterDistance = 22
  $document.PageSetup.DifferentFirstPageHeaderFooter = $true

  $normal = $document.Styles.Item($wdStyleNormal)
  $normal.Font.Name = "Aptos"
  $normal.Font.Size = 10.5
  $normal.Font.Color = $colorInk
  $normal.ParagraphFormat.Alignment = $wdAlignJustify
  $normal.ParagraphFormat.SpaceAfter = 7
  $normal.ParagraphFormat.LineSpacingRule = $wdLineSpaceMultiple
  $normal.ParagraphFormat.LineSpacing = 14.5

  $heading1 = $document.Styles.Item($wdStyleHeading1)
  $heading1.Font.Name = "Aptos Display"
  $heading1.Font.Size = 24
  $heading1.Font.Bold = $true
  $heading1.Font.Color = $colorBrown
  $heading1.ParagraphFormat.SpaceBefore = 0
  $heading1.ParagraphFormat.SpaceAfter = 12
  $heading1.ParagraphFormat.KeepWithNext = $true

  $heading2 = $document.Styles.Item($wdStyleHeading2)
  $heading2.Font.Name = "Aptos Display"
  $heading2.Font.Size = 15
  $heading2.Font.Bold = $true
  $heading2.Font.Color = $colorRed
  $heading2.ParagraphFormat.SpaceBefore = 12
  $heading2.ParagraphFormat.SpaceAfter = 6
  $heading2.ParagraphFormat.KeepWithNext = $true

  $heading3 = $document.Styles.Item($wdStyleHeading3)
  $heading3.Font.Name = "Aptos"
  $heading3.Font.Size = 11.5
  $heading3.Font.Bold = $true
  $heading3.Font.Color = $colorBrown
  $heading3.ParagraphFormat.SpaceBefore = 8
  $heading3.ParagraphFormat.SpaceAfter = 4
  $heading3.ParagraphFormat.KeepWithNext = $true

  $header = $document.Sections.Item(1).Headers.Item(1).Range
  $header.Text = "TUỆ TÂM MASTER VALUE   |   HỆ SINH THÁI CHĂM SÓC SỨC KHỎE CHỦ ĐỘNG"
  $header.Font.Name = "Aptos"
  $header.Font.Size = 8
  $header.Font.Bold = $true
  $header.Font.Color = $colorRed
  $header.ParagraphFormat.Alignment = $wdAlignRight
  $header.Borders.Item(-3).LineStyle = 1
  $header.Borders.Item(-3).Color = $colorGold
  $header.Borders.Item(-3).LineWidth = 4

  $footer = $document.Sections.Item(1).Footers.Item(1).Range
  $footer.Text = "TUỆ TÂM CARE  •  MASTER VALUE  •  "
  $footer.Font.Name = "Aptos"
  $footer.Font.Size = 8
  $footer.Font.Color = $colorGray
  $footer.ParagraphFormat.Alignment = $wdAlignCenter
  $footer.Collapse($wdCollapseEnd)
  [void]$footer.Fields.Add($footer, $wdFieldPage)

  function Set-SelectionNormal {
    $script:selection.Style = $wdStyleNormal
    $script:selection.Font.Name = "Aptos"
    $script:selection.Font.Size = 10.5
    $script:selection.Font.Bold = $false
    $script:selection.Font.Italic = $false
    $script:selection.Font.Color = $colorInk
    $script:selection.ParagraphFormat.Alignment = $wdAlignJustify
    $script:selection.ParagraphFormat.SpaceAfter = 7
    $script:selection.ParagraphFormat.LeftIndent = 0
    $script:selection.ParagraphFormat.FirstLineIndent = 0
  }

  function Add-Paragraph([string]$text, [switch]$Lead, [switch]$Center, [switch]$Italic) {
    Set-SelectionNormal
    if ($Lead) {
      $script:selection.Font.Size = 12
      $script:selection.Font.Color = $colorBrown
      $script:selection.Font.Bold = $true
      $script:selection.ParagraphFormat.LineSpacing = 16
      $script:selection.ParagraphFormat.SpaceAfter = 10
    }
    if ($Center) { $script:selection.ParagraphFormat.Alignment = $wdAlignCenter }
    if ($Italic) { $script:selection.Font.Italic = $true }
    $script:selection.TypeText($text)
    $script:selection.TypeParagraph()
  }

  function Add-Heading([string]$text, [int]$level = 2) {
    $style = if ($level -eq 1) { $wdStyleHeading1 } elseif ($level -eq 2) { $wdStyleHeading2 } else { $wdStyleHeading3 }
    $script:selection.Style = $style
    $script:selection.TypeText($text)
    $script:selection.TypeParagraph()
    Set-SelectionNormal
  }

  function Add-Bullets($items) {
    foreach ($item in $items) {
      Set-SelectionNormal
      $script:selection.ParagraphFormat.LeftIndent = 18
      $script:selection.ParagraphFormat.FirstLineIndent = -10
      $script:selection.ParagraphFormat.SpaceAfter = 4
      $script:selection.Font.Color = $colorInk
      $script:selection.TypeText("•  " + [string]$item)
      $script:selection.TypeParagraph()
    }
    Set-SelectionNormal
  }

  function Add-Numbered($items) {
    $index = 1
    foreach ($item in $items) {
      Set-SelectionNormal
      $script:selection.ParagraphFormat.LeftIndent = 20
      $script:selection.ParagraphFormat.FirstLineIndent = -14
      $script:selection.ParagraphFormat.SpaceAfter = 5
      $script:selection.Font.Color = $colorInk
      $script:selection.TypeText(("{0:00}.  " -f $index) + [string]$item)
      $script:selection.TypeParagraph()
      $index += 1
    }
    Set-SelectionNormal
  }

  function Add-Callout([string]$title, [string]$text, [string]$tone = "gold") {
    $background = if ($tone -eq "red") { $colorRose } elseif ($tone -eq "green") { $colorGreen } else { $colorCream }
    $titleColor = if ($tone -eq "green") { $colorGreenText } else { $colorRed }
    $range = $script:selection.Range
    $table = $document.Tables.Add($range, 1, 1)
    $table.AllowAutoFit = $true
    $table.AutoFitBehavior($wdAutoFitWindow)
    $cell = $table.Cell(1, 1)
    $cell.Shading.BackgroundPatternColor = $background
    $cell.VerticalAlignment = $wdCellAlignCenter
    $cell.TopPadding = 8
    $cell.BottomPadding = 8
    $cell.LeftPadding = 10
    $cell.RightPadding = 10
    $cell.Range.Text = $title + [Environment]::NewLine + $text
    $cell.Range.Font.Name = "Aptos"
    $cell.Range.Font.Size = 10
    $cell.Range.Font.Color = $colorInk
    $cell.Range.Paragraphs.Item(1).Range.Font.Bold = $true
    $cell.Range.Paragraphs.Item(1).Range.Font.Size = 11
    $cell.Range.Paragraphs.Item(1).Range.Font.Color = $titleColor
    $cell.Borders.OutsideLineStyle = 1
    $cell.Borders.OutsideColor = $colorLine
    $cell.Borders.OutsideLineWidth = 4
    $script:selection.SetRange($table.Range.End, $table.Range.End)
    $script:selection.TypeParagraph()
    Set-SelectionNormal
  }

  function Add-Table($headers, $rows, [string]$style = "standard") {
    if ($null -eq $headers -or $headers.Count -eq 0) { return }
    $rowCount = $rows.Count + 1
    $columnCount = $headers.Count
    $range = $script:selection.Range
    $table = $document.Tables.Add($range, $rowCount, $columnCount)
    $table.AllowAutoFit = $true
    $table.AutoFitBehavior($wdAutoFitWindow)
    $table.Rows.Item(1).HeadingFormat = $true
    $table.Rows.AllowBreakAcrossPages = $false
    $table.TopPadding = 5
    $table.BottomPadding = 5
    $table.LeftPadding = 5
    $table.RightPadding = 5

    for ($column = 1; $column -le $columnCount; $column += 1) {
      $cell = $table.Cell(1, $column)
      $cell.Range.Text = [string]$headers[$column - 1]
      $cell.Shading.BackgroundPatternColor = if ($style -eq "dark") { $colorBrown } else { $colorRed }
      $cell.Range.Font.Name = "Aptos"
      $cell.Range.Font.Size = 8.5
      $cell.Range.Font.Bold = $true
      $cell.Range.Font.Color = $colorWhite
      $cell.Range.ParagraphFormat.Alignment = $wdAlignLeft
      $cell.VerticalAlignment = $wdCellAlignCenter
    }

    for ($row = 0; $row -lt $rows.Count; $row += 1) {
      for ($column = 0; $column -lt $columnCount; $column += 1) {
        $cell = $table.Cell($row + 2, $column + 1)
        $value = if ($column -lt $rows[$row].Count) { [string]$rows[$row][$column] } else { "" }
        $cell.Range.Text = $value
        $cell.Range.Font.Name = "Aptos"
        $cell.Range.Font.Size = 8.5
        $cell.Range.Font.Color = $colorInk
        $cell.Range.ParagraphFormat.SpaceAfter = 1
        $cell.Range.ParagraphFormat.LineSpacing = 11
        $cell.VerticalAlignment = $wdCellAlignCenter
        if (($row % 2) -eq 0) { $cell.Shading.BackgroundPatternColor = $colorCream }
      }
    }
    $table.Borders.OutsideLineStyle = 1
    $table.Borders.InsideLineStyle = 1
    $table.Borders.OutsideColor = $colorLine
    $table.Borders.InsideColor = $colorLine
    $table.Borders.OutsideLineWidth = 2
    $table.Borders.InsideLineWidth = 2
    $script:selection.SetRange($table.Range.End, $table.Range.End)
    $script:selection.TypeParagraph()
    Set-SelectionNormal
  }

  function Add-Steps($items) {
    $headers = @()
    $row = @()
    $index = 1
    foreach ($item in $items) {
      $headers += ("BƯỚC " + $index)
      $row += [string]$item
      $index += 1
    }
    Add-Table $headers @($row) "dark"
  }

  function Add-Image([string]$relativePath, [string]$caption, [double]$width = 235) {
    $absolutePath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))
    if (-not (Test-Path -LiteralPath $absolutePath)) { return }
    Set-SelectionNormal
    $script:selection.ParagraphFormat.Alignment = $wdAlignCenter
    $shape = $script:selection.InlineShapes.AddPicture($absolutePath, $false, $true, $script:selection.Range)
    $shape.LockAspectRatio = $true
    if ($shape.Width -gt $width) { $shape.Width = $width }
    if ($shape.Height -gt 390) { $shape.Height = 390 }
    $script:selection.SetRange($shape.Range.End, $shape.Range.End)
    $script:selection.TypeParagraph()
    if ($caption) {
      $script:selection.Font.Name = "Aptos"
      $script:selection.Font.Size = 8.5
      $script:selection.Font.Italic = $true
      $script:selection.Font.Color = $colorGray
      $script:selection.ParagraphFormat.Alignment = $wdAlignCenter
      $script:selection.TypeText($caption)
      $script:selection.TypeParagraph()
    }
    Set-SelectionNormal
  }

  function Add-ChapterHero([string]$number, [string]$title, [string]$subtitle) {
    $script:selection.InsertBreak($wdPageBreak)
    $range = $script:selection.Range
    $table = $document.Tables.Add($range, 1, 1)
    $table.AutoFitBehavior($wdAutoFitWindow)
    $cell = $table.Cell(1, 1)
    $cell.Shading.BackgroundPatternColor = $colorBrown
    $cell.TopPadding = 18
    $cell.BottomPadding = 18
    $cell.LeftPadding = 16
    $cell.RightPadding = 16
    $cell.Range.Text = $number + [Environment]::NewLine + $title + [Environment]::NewLine + $subtitle
    $cell.Range.Font.Name = "Aptos Display"
    $cell.Range.Font.Color = $colorWhite
    $cell.Range.Paragraphs.Item(1).Range.Font.Size = 10
    $cell.Range.Paragraphs.Item(1).Range.Font.Bold = $true
    $cell.Range.Paragraphs.Item(1).Range.Font.Color = $colorGold
    $cell.Range.Paragraphs.Item(2).Range.Font.Size = 23
    $cell.Range.Paragraphs.Item(2).Range.Font.Bold = $true
    $cell.Range.Paragraphs.Item(3).Range.Font.Size = 10
    $cell.Range.Paragraphs.Item(3).Range.Font.Italic = $true
    $cell.Range.Paragraphs.Item(3).Range.Font.Color = Get-WordColor "#F3DDD5"
    foreach ($border in $cell.Borders) { $border.LineStyle = 0 }
    $script:selection.SetRange($table.Range.End, $table.Range.End)
    $script:selection.TypeParagraph()
    Add-Heading $title 1
  }

  # Cover page
  $selection.ParagraphFormat.Alignment = $wdAlignCenter
  $selection.ParagraphFormat.SpaceAfter = 10
  $logoPath = Join-Path $projectRoot "public\icon-512.png"
  if (Test-Path -LiteralPath $logoPath) {
    $logo = $selection.InlineShapes.AddPicture($logoPath, $false, $true, $selection.Range)
    $logo.LockAspectRatio = $true
    $logo.Width = 88
    $selection.SetRange($logo.Range.End, $logo.Range.End)
    $selection.TypeParagraph()
  }
  $selection.Style = $wdStyleTitle
  $selection.Font.Name = "Aptos Display"
  $selection.Font.Size = 34
  $selection.Font.Bold = $true
  $selection.Font.Color = $colorBrown
  $selection.TypeText($content.title)
  $selection.TypeParagraph()
  $selection.Style = $wdStyleSubtitle
  $selection.Font.Name = "Aptos"
  $selection.Font.Size = 16
  $selection.Font.Color = $colorRed
  $selection.TypeText($content.subtitle)
  $selection.TypeParagraph()
  $selection.TypeParagraph()
  $selection.Font.Size = 11
  $selection.Font.Bold = $true
  $selection.Font.Color = $colorGold
  $selection.TypeText($content.tagline)
  $selection.TypeParagraph()
  $selection.TypeParagraph()

  $coverRange = $selection.Range
  $coverTable = $document.Tables.Add($coverRange, 3, 1)
  $coverTable.AutoFitBehavior($wdAutoFitWindow)
  $coverTable.Cell(1, 1).Range.Text = "BẢN GIỚI THIỆU CHIẾN LƯỢC & GIÁ TRỊ DỰ ÁN"
  $coverTable.Cell(2, 1).Range.Text = $content.coverStatement
  $coverTable.Cell(3, 1).Range.Text = $content.version
  for ($row = 1; $row -le 3; $row += 1) {
    $cell = $coverTable.Cell($row, 1)
    $cell.Shading.BackgroundPatternColor = if ($row -eq 2) { $colorCream } else { $colorBrown }
    $cell.Range.Font.Name = "Aptos"
    $cell.Range.Font.Size = if ($row -eq 2) { 11 } else { 9 }
    $cell.Range.Font.Bold = if ($row -eq 2) { $false } else { $true }
    $cell.Range.Font.Color = if ($row -eq 2) { $colorBrown } else { $colorWhite }
    $cell.Range.ParagraphFormat.Alignment = $wdAlignCenter
    $cell.TopPadding = 9
    $cell.BottomPadding = 9
    $cell.LeftPadding = 12
    $cell.RightPadding = 12
    $cell.Borders.OutsideLineStyle = 1
    $cell.Borders.OutsideColor = $colorGold
    $cell.Borders.OutsideLineWidth = 4
  }
  $selection.SetRange($coverTable.Range.End, $coverTable.Range.End)
  $selection.TypeParagraph()
  $selection.ParagraphFormat.Alignment = $wdAlignCenter
  $selection.Font.Name = "Aptos"
  $selection.Font.Size = 9
  $selection.Font.Color = $colorGray
  $selection.TypeText("Tuệ Tâm Care  •  Hà Nội  •  2026")
  $selection.TypeParagraph()

  # Table of contents
  $selection.InsertBreak($wdPageBreak)
  Add-Heading "Mục lục" 1
  Add-Paragraph "Tài liệu được tổ chức theo hành trình giá trị: từ tầm nhìn xã hội đến trải nghiệm từng vai trò, vận hành tài chính, quản trị tăng trưởng và lộ trình triển khai." -Italic
  $tocRange = $selection.Range
  $toc = $document.TablesOfContents.Add($tocRange, $true, 1, 3)
  $selection.SetRange($toc.Range.End, $toc.Range.End)
  $selection.TypeParagraph()

  foreach ($chapter in $content.chapters) {
    Add-ChapterHero ([string]$chapter.number) ([string]$chapter.title) ([string]$chapter.subtitle)
    foreach ($block in $chapter.blocks) {
      switch ([string]$block.type) {
        "heading" { Add-Heading ([string]$block.text) ([int]$block.level) }
        "lead" { Add-Paragraph ([string]$block.text) -Lead }
        "paragraph" { Add-Paragraph ([string]$block.text) }
        "center" { Add-Paragraph ([string]$block.text) -Center }
        "bullets" { Add-Bullets $block.items }
        "numbered" { Add-Numbered $block.items }
        "callout" { Add-Callout ([string]$block.title) ([string]$block.text) ([string]$block.tone) }
        "table" { Add-Table $block.headers $block.rows ([string]$block.style) }
        "steps" { Add-Steps $block.items }
        "image" { Add-Image ([string]$block.path) ([string]$block.caption) ([double]$block.width) }
      }
    }
  }

  $selection.InsertBreak($wdPageBreak)
  $selection.ParagraphFormat.Alignment = $wdAlignCenter
  $selection.Font.Name = "Aptos Display"
  $selection.Font.Size = 28
  $selection.Font.Bold = $true
  $selection.Font.Color = $colorBrown
  $selection.TypeText("TUỆ TÂM MASTER VALUE")
  $selection.TypeParagraph()
  $selection.Font.Size = 14
  $selection.Font.Color = $colorRed
  $selection.TypeText("Chăm sóc bằng sự tử tế. Vận hành bằng sự minh bạch. Tăng trưởng bằng giá trị thật.")
  $selection.TypeParagraph()
  $selection.TypeParagraph()
  $selection.Font.Name = "Aptos"
  $selection.Font.Size = 10.5
  $selection.Font.Bold = $false
  $selection.Font.Color = $colorGray
  $selection.TypeText("Tài liệu này là nền tảng thống nhất để đội ngũ, đối tác, nhà đầu tư và cộng đồng cùng hiểu Tuệ Tâm Care đang xây dựng điều gì, vì ai và bằng cách nào.")
  $selection.TypeParagraph()

  $word.Options.Pagination = $true
  [void]$toc.Update()

  $document.SaveAs2($outputFile, $wdFormatDocumentDefault)
  $pageCount = $document.ComputeStatistics(2)
  $wordCount = $document.ComputeStatistics(0)
  $document.Close($false)
  $word.Quit()
  $document = $null
  $word = $null
  [gc]::Collect()
  [gc]::WaitForPendingFinalizers()

  [pscustomobject]@{
    output = $outputFile
    pages = $pageCount
    words = $wordCount
    bytes = (Get-Item -LiteralPath $outputFile).Length
  } | ConvertTo-Json
}
catch {
  if ($null -ne $document) { try { $document.Close($false) } catch {} }
  if ($null -ne $word) { try { $word.Quit() } catch {} }
  throw
}
