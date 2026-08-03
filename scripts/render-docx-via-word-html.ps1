param(
    [Parameter(Mandatory = $true)][string]$InputDocx,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

$docxPath = (Resolve-Path -LiteralPath $InputDocx).Path
$outputDir = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$htmlPath = Join-Path $outputDir 'document.html'
$pdfPath = Join-Path $outputDir 'document-html-render.pdf'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
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
    $document = $word.Documents.Open($docxPath, $false, $true)
    # wdFormatFilteredHTML = 10. This route does not require Word's slow PDF
    # pagination but preserves the document's text, tables, images and styles.
    $document.SaveAs2($htmlPath, 10)
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

$fileUrl = 'file:///' + ($htmlPath -replace '\\','/')
& $edge --headless=new --disable-gpu --allow-file-access-from-files --print-to-pdf=$pdfPath --no-pdf-header-footer $fileUrl
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $pdfPath)) {
    throw "Edge PDF rendering failed with exit code $LASTEXITCODE"
}

Get-ChildItem -LiteralPath $outputDir -Filter 'html-page-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force
& $pdftoppm -png -r 150 $pdfPath (Join-Path $outputDir 'html-page')
if ($LASTEXITCODE -ne 0) {
    throw "pdftoppm failed with exit code $LASTEXITCODE"
}

$pages = Get-ChildItem -LiteralPath $outputDir -Filter 'html-page-*.png' | Sort-Object Name
[pscustomobject]@{
    Html = $htmlPath
    Pdf = $pdfPath
    PdfBytes = (Get-Item -LiteralPath $pdfPath).Length
    PageCount = $pages.Count
} | ConvertTo-Json -Compress
