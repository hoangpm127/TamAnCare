param(
    [Parameter(Mandatory = $true)][string]$InputDocx,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

$docxPath = (Resolve-Path -LiteralPath $InputDocx).Path
$outputDir = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$stem = [System.IO.Path]::GetFileNameWithoutExtension($docxPath)
$pdfPath = Join-Path $outputDir ($stem + '.pdf')
$prefix = Join-Path $outputDir 'page'
$pdftoppm = 'C:\Users\DELL\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\override\pdftoppm.cmd'

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false
    $word.Options.Pagination = $false
    $word.Options.CheckSpellingAsYouType = $false
    $word.Options.CheckGrammarAsYouType = $false
    $word.Options.UpdateFieldsAtPrint = $false
    Write-Host '[WORD-QA] Opening document'
    $document = $word.Documents.Open($docxPath, $false, $true)
    Write-Host '[WORD-QA] Saving as PDF'
    $document.SaveAs2($pdfPath, 17)
    Write-Host '[WORD-QA] PDF saved'
    $document.Close($false)
    $word.Quit()
} finally {
    if ($document) {
        try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) } catch {}
    }
    if ($word) {
        try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) } catch {}
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

Get-ChildItem -LiteralPath $outputDir -Filter 'page-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force
& $pdftoppm -png -r 180 $pdfPath $prefix
if ($LASTEXITCODE -ne 0) {
    throw "pdftoppm failed with exit code $LASTEXITCODE"
}

$pages = Get-ChildItem -LiteralPath $outputDir -Filter 'page-*.png' | Sort-Object Name
[pscustomobject]@{
    Pdf = $pdfPath
    PdfBytes = (Get-Item -LiteralPath $pdfPath).Length
    PageCount = $pages.Count
    FirstPage = if ($pages.Count) { $pages[0].FullName } else { $null }
} | ConvertTo-Json -Compress
