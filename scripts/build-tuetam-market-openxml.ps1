$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$workspace = 'C:\Users\DELL\Desktop\Kyoto Masage'
$reportDir = Join-Path $workspace 'artifacts\tuetam-market-report'
$htmlPath = Join-Path $reportDir 'Tue_Tam_Care_Bao_Cao_Thi_Truong.html'
$docxPath = Join-Path $workspace 'artifacts\Tue_Tam_Care_Bao_Cao_Tiem_Nang_Thi_Truong_Ha_Noi_TPHCM_v1.0.docx'
$tempDir = Join-Path $reportDir 'openxml-package'
$logoPath = Join-Path $workspace 'public\logo.png'
$capacityChart = Join-Path $reportDir 'assets\capacity-scenarios.png'
$marketChart = Join-Path $reportDir 'assets\business-market-scenarios.png'

$resolvedTemp = [System.IO.Path]::GetFullPath($tempDir)
$resolvedRoot = [System.IO.Path]::GetFullPath($reportDir)
if (-not $resolvedTemp.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Temporary package path escaped the report directory.'
}
if (Test-Path -LiteralPath $resolvedTemp) { Remove-Item -LiteralPath $resolvedTemp -Recurse -Force }
$packageDirs = @(
    (Join-Path $tempDir '_rels'),
    (Join-Path $tempDir 'docProps'),
    (Join-Path $tempDir 'word'),
    (Join-Path $tempDir 'word\_rels'),
    (Join-Path $tempDir 'word\media')
)
New-Item -ItemType Directory -Force -Path $packageDirs | Out-Null

function Escape-Xml([string]$Text) {
    if ($null -eq $Text) { return '' }
    return [System.Security.SecurityElement]::Escape($Text)
}

function Get-NodeText([System.Xml.XmlNode]$Node) {
    $parts = New-Object System.Collections.Generic.List[string]
    function Walk-Text([System.Xml.XmlNode]$Current) {
        if ($Current.NodeType -eq [System.Xml.XmlNodeType]::Text) {
            [void]$parts.Add($Current.Value)
            return
        }
        if ($Current.Name -eq 'br') {
            [void]$parts.Add("`n")
            return
        }
        foreach ($child in $Current.ChildNodes) { Walk-Text $child }
    }
    Walk-Text $Node
    return (($parts -join '') -replace '[ \t\r\n]+',' ' -replace ' ?\n ?',"`n").Trim()
}

function New-RunXml {
    param(
        [string]$Text,
        [bool]$Bold = $false,
        [bool]$Italic = $false,
        [int]$Size = 22,
        [string]$Color = '1F2937'
    )
    $rPr = "<w:rPr><w:rFonts w:ascii=`"Calibri`" w:hAnsi=`"Calibri`" w:eastAsia=`"Calibri`"/>"
    if ($Bold) { $rPr += '<w:b/><w:bCs/>' }
    if ($Italic) { $rPr += '<w:i/><w:iCs/>' }
    $rPr += "<w:color w:val=`"$Color`"/><w:sz w:val=`"$Size`"/><w:szCs w:val=`"$Size`"/></w:rPr>"
    $segments = $Text -split "`n", -1
    $runs = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $segments.Count; $i++) {
        if ($i -gt 0) { [void]$runs.Add("<w:r>$rPr<w:br/></w:r>") }
        if ($segments[$i].Length -gt 0) {
            $safe = Escape-Xml $segments[$i]
            [void]$runs.Add("<w:r>$rPr<w:t xml:space=`"preserve`">$safe</w:t></w:r>")
        }
    }
    return ($runs -join '')
}

function New-ParagraphXml {
    param(
        [string]$Text,
        [string]$Style = 'Normal',
        [string]$Align = '',
        [bool]$Bold = $false,
        [bool]$Italic = $false,
        [int]$Size = 22,
        [string]$Color = '1F2937',
        [int]$NumId = 0,
        [bool]$PageBreakBefore = $false,
        [string]$Shading = '',
        [string]$BorderColor = ''
    )
    $pPr = "<w:pPr><w:pStyle w:val=`"$Style`"/>"
    if ($PageBreakBefore) { $pPr += '<w:pageBreakBefore/>' }
    if ($NumId -gt 0) { $pPr += "<w:numPr><w:ilvl w:val=`"0`"/><w:numId w:val=`"$NumId`"/></w:numPr>" }
    if ($BorderColor) {
        $pPr += "<w:pBdr><w:top w:val=`"single`" w:sz=`"8`" w:space=`"6`" w:color=`"$BorderColor`"/><w:left w:val=`"single`" w:sz=`"8`" w:space=`"6`" w:color=`"$BorderColor`"/><w:bottom w:val=`"single`" w:sz=`"8`" w:space=`"6`" w:color=`"$BorderColor`"/><w:right w:val=`"single`" w:sz=`"8`" w:space=`"6`" w:color=`"$BorderColor`"/></w:pBdr>"
    }
    if ($Shading) { $pPr += "<w:shd w:val=`"clear`" w:color=`"auto`" w:fill=`"$Shading`"/>" }
    if ($BorderColor) { $pPr += '<w:spacing w:before="120" w:after="160"/><w:ind w:left="160" w:right="160"/>' }
    if ($Align) { $pPr += "<w:jc w:val=`"$Align`"/>" }
    $pPr += '</w:pPr>'
    $runs = New-RunXml -Text $Text -Bold $Bold -Italic $Italic -Size $Size -Color $Color
    return "<w:p>$pPr$runs</w:p>"
}

function New-ImageParagraphXml {
    param(
        [string]$RelId,
        [string]$Name,
        [string]$Alt,
        [long]$WidthEmu,
        [long]$HeightEmu,
        [int]$DocPrId
    )
    $safeName = Escape-Xml $Name
    $safeAlt = Escape-Xml $Alt
    return @"
<w:p><w:pPr><w:spacing w:before="120" w:after="80"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
<wp:extent cx="$WidthEmu" cy="$HeightEmu"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="$DocPrId" name="$safeName" descr="$safeAlt"/>
<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="$safeName"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="$RelId" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="$WidthEmu" cy="$HeightEmu"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
"@
}

function New-TableXml([System.Xml.XmlNode]$TableNode) {
    $rows = @($TableNode.SelectNodes('./tr'))
    if ($rows.Count -eq 0) { return '' }
    $firstCells = @($rows[0].SelectNodes('./th|./td'))
    $colCount = [math]::Max(1, $firstCells.Count)
    $colWidth = [math]::Floor(9360 / $colCount)
    $xml = New-Object System.Text.StringBuilder
    [void]$xml.Append('<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D1D5DB"/><w:left w:val="single" w:sz="4" w:color="D1D5DB"/><w:bottom w:val="single" w:sz="4" w:color="D1D5DB"/><w:right w:val="single" w:sz="4" w:color="D1D5DB"/><w:insideH w:val="single" w:sz="4" w:color="E2E8F0"/><w:insideV w:val="single" w:sz="4" w:color="E2E8F0"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>')
    [void]$xml.Append('<w:tblGrid>')
    for ($i = 0; $i -lt $colCount; $i++) { [void]$xml.Append("<w:gridCol w:w=`"$colWidth`"/>") }
    [void]$xml.Append('</w:tblGrid>')
    for ($rowIndex = 0; $rowIndex -lt $rows.Count; $rowIndex++) {
        [void]$xml.Append('<w:tr><w:trPr><w:cantSplit/></w:trPr>')
        $cells = @($rows[$rowIndex].SelectNodes('./th|./td'))
        for ($cellIndex = 0; $cellIndex -lt $colCount; $cellIndex++) {
            $cell = if ($cellIndex -lt $cells.Count) { $cells[$cellIndex] } else { $null }
            $text = if ($cell) { Get-NodeText $cell } else { '' }
            $isHeader = $cell -and $cell.Name -eq 'th'
            $align = if ($cell -and $cell.Attributes['class']) { $cell.Attributes['class'].Value } else { '' }
            $jc = if ($align -eq 'center') {'center'} elseif ($align -eq 'right') {'right'} else {'left'}
            $fill = if ($isHeader) {'F2F4F7'} elseif (($rowIndex % 2) -eq 0) {'F9FAFB'} else {'FFFFFF'}
            [void]$xml.Append("<w:tc><w:tcPr><w:tcW w:w=`"$colWidth`" w:type=`"dxa`"/><w:shd w:val=`"clear`" w:fill=`"$fill`"/><w:vAlign w:val=`"center`"/></w:tcPr>")
            [void]$xml.Append((New-ParagraphXml -Text $text -Style 'TableText' -Align $jc -Bold $isHeader -Size 19 -Color '1F2937'))
            [void]$xml.Append('</w:tc>')
        }
        [void]$xml.Append('</w:tr>')
    }
    [void]$xml.Append('</w:tbl>')
    return $xml.ToString()
}

$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)
$html = $html -replace '<meta charset="utf-8">','<meta charset="utf-8" />'
$html = $html -replace '<br>','<br />'
$html = [regex]::Replace($html, '<img([^>]*?)(?<!/)>', '<img$1 />')
$xmlDoc = New-Object System.Xml.XmlDocument
$xmlDoc.PreserveWhitespace = $false
$xmlDoc.LoadXml($html)

$bodyParts = New-Object System.Collections.Generic.List[string]
$script:docPrId = 10
$script:nextOrderedNumId = 2

function Add-Node([System.Xml.XmlNode]$Node) {
    if ($Node.NodeType -ne [System.Xml.XmlNodeType]::Element) { return }
    $name = $Node.Name.ToLowerInvariant()
    $class = if ($Node.Attributes['class']) { $Node.Attributes['class'].Value } else { '' }
    switch ($name) {
        'section' {
            foreach ($child in $Node.ChildNodes) { Add-Node $child }
            if ($class -eq 'cover') { [void]$bodyParts.Add('<w:p><w:r><w:br w:type="page"/></w:r></w:p>') }
        }
        'h1' {
            [void]$bodyParts.Add((New-ParagraphXml -Text (Get-NodeText $Node) -Style 'Heading1' -PageBreakBefore:($class -eq 'page-break') -Bold $true -Size 32 -Color '2E74B5'))
        }
        'h2' { [void]$bodyParts.Add((New-ParagraphXml -Text (Get-NodeText $Node) -Style 'Heading2' -Bold $true -Size 26 -Color '2E74B5')) }
        'h3' { [void]$bodyParts.Add((New-ParagraphXml -Text (Get-NodeText $Node) -Style 'Heading3' -Bold $true -Size 24 -Color '1F4D78')) }
        'p' {
            $text = Get-NodeText $Node
            if (-not $text) { return }
            switch ($class) {
                'brand' { [void]$bodyParts.Add((New-ParagraphXml -Text $text -Style 'Brand' -Align 'center' -Bold $true -Size 22 -Color 'AD1B26')) }
                'cover-meta' { [void]$bodyParts.Add((New-ParagraphXml -Text $text -Style 'CoverMeta' -Align 'center' -Size 20 -Color '5A6370')) }
                'disclaimer' { [void]$bodyParts.Add((New-ParagraphXml -Text $text -Style 'Caption' -Align 'center' -Italic $true -Size 18 -Color 'AD1B26')) }
                'caption' { [void]$bodyParts.Add((New-ParagraphXml -Text $text -Style 'Caption' -Align 'center' -Italic $true -Size 18 -Color '5A6370')) }
                'small' { [void]$bodyParts.Add((New-ParagraphXml -Text $text -Style 'Caption' -Italic $true -Size 18 -Color '5A6370')) }
                'source' { [void]$bodyParts.Add((New-ParagraphXml -Text $text -Style 'Source' -Size 19 -Color '1F2937')) }
                'url' { [void]$bodyParts.Add((New-ParagraphXml -Text $text -Style 'URL' -Size 17 -Color '2E74B5')) }
                default { [void]$bodyParts.Add((New-ParagraphXml -Text $text -Style 'Normal' -Size 22 -Color '1F2937')) }
            }
        }
        'div' {
            if ($class -match 'figure') {
                $img = $Node.SelectSingleNode('./img')
                if ($img) { Add-Node $img }
                foreach ($caption in $Node.SelectNodes('./p')) { Add-Node $caption }
            } elseif ($class -match 'callout') {
                $text = Get-NodeText $Node
                $fill = 'EFF6FD'; $border = '2E74B5'
                if ($class -match 'gold') { $fill = 'FCF7E8'; $border = 'BE8E22' }
                if ($class -match 'red') { $fill = 'FDF2F2'; $border = 'AD1B26' }
                [void]$bodyParts.Add((New-ParagraphXml -Text $text -Style 'Callout' -Bold $true -Size 22 -Color '1F2937' -Shading $fill -BorderColor $border))
            } elseif ($class -eq 'cover-title') {
                [void]$bodyParts.Add((New-ParagraphXml -Text (Get-NodeText $Node) -Style 'CoverTitle' -Align 'center' -Bold $true -Size 50 -Color '1F2937' -BorderColor 'BE8E22'))
            } elseif ($class -eq 'cover-subtitle') {
                [void]$bodyParts.Add((New-ParagraphXml -Text (Get-NodeText $Node) -Style 'CoverSubtitle' -Align 'center' -Bold $true -Size 30 -Color '1F4D78'))
            } elseif ($class -eq 'cover-scope') {
                [void]$bodyParts.Add((New-ParagraphXml -Text (Get-NodeText $Node) -Style 'CoverScope' -Align 'center' -Size 24 -Color '5A6370'))
            } else {
                foreach ($child in $Node.ChildNodes) { Add-Node $child }
            }
        }
        'ul' {
            foreach ($li in $Node.SelectNodes('./li')) { [void]$bodyParts.Add((New-ParagraphXml -Text (Get-NodeText $li) -Style 'ListParagraph' -NumId 1 -Size 22 -Color '1F2937')) }
        }
        'ol' {
            $orderedNumId = $script:nextOrderedNumId
            $script:nextOrderedNumId++
            foreach ($li in $Node.SelectNodes('./li')) { [void]$bodyParts.Add((New-ParagraphXml -Text (Get-NodeText $li) -Style 'ListParagraph' -NumId $orderedNumId -Size 22 -Color '1F2937')) }
        }
        'table' { [void]$bodyParts.Add((New-TableXml $Node)) }
        'img' {
            $src = $Node.Attributes['src'].Value
            $alt = if ($Node.Attributes['alt']) { $Node.Attributes['alt'].Value } else { 'Hình minh họa' }
            if ($src -match 'logo') {
                [void]$bodyParts.Add((New-ImageParagraphXml -RelId 'rId10' -Name 'Logo Tuệ Tâm Care' -Alt $alt -WidthEmu 787400 -HeightEmu 787400 -DocPrId $script:docPrId))
            } elseif ($src -match 'capacity') {
                [void]$bodyParts.Add((New-ImageParagraphXml -RelId 'rId11' -Name 'Biểu đồ công suất' -Alt $alt -WidthEmu 5943600 -HeightEmu 3343275 -DocPrId $script:docPrId))
            } elseif ($src -match 'business-market') {
                [void]$bodyParts.Add((New-ImageParagraphXml -RelId 'rId12' -Name 'Biểu đồ thị trường Business' -Alt $alt -WidthEmu 5943600 -HeightEmu 3343275 -DocPrId $script:docPrId))
            }
            $script:docPrId++
        }
        default {
            foreach ($child in $Node.ChildNodes) { Add-Node $child }
        }
    }
}

foreach ($node in $xmlDoc.SelectSingleNode('/html/body').ChildNodes) { Add-Node $node }

$stylesXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri"/><w:color w:val="1F2937"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="320" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="2E74B5"/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2E74B5"/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="1F4D78"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160" w:line="280" w:lineRule="auto"/><w:ind w:left="720" w:hanging="360"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60" w:line="228" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Callout"><w:name w:val="Callout"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="80" w:after="160" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Brand"><w:name w:val="Brand"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="300"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="CoverTitle"><w:name w:val="Cover Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="220" w:after="220"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="CoverSubtitle"><w:name w:val="Cover Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="260"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="CoverScope"><w:name w:val="Cover Scope"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="360"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="CoverMeta"><w:name w:val="Cover Meta"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="300" w:after="120"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Source"><w:name w:val="Source"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="60" w:after="20"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="URL"><w:name w:val="URL"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="100"/><w:jc w:val="left"/></w:pPr></w:style>
</w:styles>
'@

$numberInstances = New-Object System.Text.StringBuilder
[void]$numberInstances.Append('<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>')
for ($numIndex = 2; $numIndex -lt $script:nextOrderedNumId; $numIndex++) {
    [void]$numberInstances.Append("<w:num w:numId=`"$numIndex`"><w:abstractNumId w:val=`"2`"/></w:num>")
}
$numberingXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
$($numberInstances.ToString())
</w:numbering>
"@

$headerXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="E2E8F0"/></w:pBdr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="5A6370"/><w:sz w:val="16"/></w:rPr><w:t>TUỆ TÂM CARE  |  BÁO CÁO TIỀM NĂNG THỊ TRƯỜNG</w:t></w:r></w:p></w:hdr>
'@

$footerXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="5A6370"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Tài liệu hoạch định nội bộ  •  25/07/2026  |  </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="5A6370"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>
'@

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>
$($bodyParts -join "`n")
<w:sectPr><w:headerReference w:type="default" r:id="rId4"/><w:footerReference w:type="default" r:id="rId5"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720"/><w:titlePg/><w:docGrid w:linePitch="360"/></w:sectPr>
</w:body></w:document>
"@

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
'@

$rootRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>
'@

$docRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/><Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/capacity-scenarios.png"/><Relationship Id="rId12" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/business-market-scenarios.png"/></Relationships>
'@

$settingsXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:updateFields w:val="true"/></w:settings>
'@

$coreXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Báo cáo tiềm năng thị trường Tuệ Tâm Care</dc:title><dc:subject>Hà Nội, TP.HCM, phục vụ tại điểm và Tuệ Tâm Business</dc:subject><dc:creator>Tuệ Tâm Care</dc:creator><cp:keywords>market research; wellness; business; Hà Nội; TP.HCM</cp:keywords><dc:description>Báo cáo hoạch định thị trường và chiến lược vận hành.</dc:description><cp:lastModifiedBy>Tuệ Tâm Care</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-07-25T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-07-25T00:00:00Z</dcterms:modified></cp:coreProperties>
'@

$appXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Office Word</Application><AppVersion>16.0000</AppVersion><Company>Tuệ Tâm Care</Company></Properties>
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Write-Utf8NoBom([string]$Path, [string]$Content) { [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom) }

Write-Utf8NoBom (Join-Path $tempDir '[Content_Types].xml') $contentTypes
Write-Utf8NoBom (Join-Path $tempDir '_rels\.rels') $rootRels
Write-Utf8NoBom (Join-Path $tempDir 'docProps\core.xml') $coreXml
Write-Utf8NoBom (Join-Path $tempDir 'docProps\app.xml') $appXml
Write-Utf8NoBom (Join-Path $tempDir 'word\document.xml') $documentXml
Write-Utf8NoBom (Join-Path $tempDir 'word\styles.xml') $stylesXml
Write-Utf8NoBom (Join-Path $tempDir 'word\numbering.xml') $numberingXml
Write-Utf8NoBom (Join-Path $tempDir 'word\settings.xml') $settingsXml
Write-Utf8NoBom (Join-Path $tempDir 'word\header1.xml') $headerXml
Write-Utf8NoBom (Join-Path $tempDir 'word\footer1.xml') $footerXml
Write-Utf8NoBom (Join-Path $tempDir 'word\_rels\document.xml.rels') $docRels
Copy-Item -LiteralPath $logoPath -Destination (Join-Path $tempDir 'word\media\logo.png') -Force
Copy-Item -LiteralPath $capacityChart -Destination (Join-Path $tempDir 'word\media\capacity-scenarios.png') -Force
Copy-Item -LiteralPath $marketChart -Destination (Join-Path $tempDir 'word\media\business-market-scenarios.png') -Force

if (Test-Path -LiteralPath $docxPath) { Remove-Item -LiteralPath $docxPath -Force }
$zipStream = [System.IO.File]::Open($docxPath, [System.IO.FileMode]::CreateNew)
$zipArchive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
try {
    foreach ($packageFile in Get-ChildItem -LiteralPath $tempDir -Recurse -File) {
        $relativeName = $packageFile.FullName.Substring($tempDir.Length).TrimStart('\') -replace '\\','/'
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $packageFile.FullName, $relativeName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {
    $zipArchive.Dispose()
    $zipStream.Dispose()
}

[pscustomobject]@{
    Docx = $docxPath
    Bytes = (Get-Item $docxPath).Length
    ParagraphBlocks = $bodyParts.Count
} | ConvertTo-Json -Compress
