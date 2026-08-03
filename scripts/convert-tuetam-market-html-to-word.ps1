$ErrorActionPreference = 'Stop'

$workspace = 'C:\Users\DELL\Desktop\Kyoto Masage'
$reportDir = Join-Path $workspace 'artifacts\tuetam-market-report'
$htmlPath = Join-Path $reportDir 'Tue_Tam_Care_Bao_Cao_Thi_Truong.html'
$docxPath = Join-Path $workspace 'artifacts\Tue_Tam_Care_Bao_Cao_Tiem_Nang_Thi_Truong_Ha_Noi_TPHCM_v1.0.docx'
$pdfPath = Join-Path $reportDir 'rendered\Tue_Tam_Care_Bao_Cao_Tiem_Nang_Thi_Truong_Ha_Noi_TPHCM_v1.0.pdf'
$logoSource = Join-Path $workspace 'public\logo.png'
$logoTarget = Join-Path $reportDir 'assets\logo.png'

New-Item -ItemType Directory -Force -Path (Split-Path $pdfPath -Parent), (Split-Path $logoTarget -Parent) | Out-Null
Copy-Item -LiteralPath $logoSource -Destination $logoTarget -Force

function Get-WordColor([int]$r, [int]$g, [int]$b) {
    return $r + (256 * $g) + (65536 * $b)
}

$word = $null
$doc = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false
    $word.Options.CheckSpellingAsYouType = $false
    $word.Options.CheckGrammarAsYouType = $false
    $doc = $word.Documents.Open($htmlPath, $false, $false)

    foreach ($section in $doc.Sections) {
        $section.PageSetup.PageWidth = 612
        $section.PageSetup.PageHeight = 792
        $section.PageSetup.TopMargin = 72
        $section.PageSetup.BottomMargin = 72
        $section.PageSetup.LeftMargin = 72
        $section.PageSetup.RightMargin = 72
        $section.PageSetup.HeaderDistance = 35.4
        $section.PageSetup.FooterDistance = 35.4
        $section.PageSetup.DifferentFirstPageHeaderFooter = -1

        $header = $section.Headers.Item(1).Range
        $header.Text = 'TUỆ TÂM CARE  |  BÁO CÁO TIỀM NĂNG THỊ TRƯỜNG'
        $header.Font.Name = 'Calibri'
        $header.Font.Size = 8
        $header.Font.Bold = 1
        $header.Font.Color = Get-WordColor 90 99 112
        $header.ParagraphFormat.Alignment = 2

        $footer = $section.Footers.Item(1).Range
        $footer.Text = 'Tài liệu hoạch định nội bộ  •  25/07/2026  |  '
        $footer.Font.Name = 'Calibri'
        $footer.Font.Size = 8
        $footer.Font.Color = Get-WordColor 90 99 112
        $footer.ParagraphFormat.Alignment = 1
        $footer.Collapse(0)
        [void]$footer.Fields.Add($footer, 33)
    }

    $doc.SaveAs2($docxPath, 12)
    $doc.ExportAsFixedFormat($pdfPath, 17)
    $doc.Close($false)
    $word.Quit()

    [pscustomobject]@{
        Docx = $docxPath
        DocxBytes = (Get-Item $docxPath).Length
        Pdf = $pdfPath
        PdfBytes = (Get-Item $pdfPath).Length
    } | ConvertTo-Json -Compress
} finally {
    if ($doc) { try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc) } catch {} }
    if ($word) { try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) } catch {} }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
