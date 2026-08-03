$ErrorActionPreference = "Stop"
$generatorPath = Join-Path (Get-Location).Path "scripts\generate-master-value-word.ps1"
$generatorSource = Get-Content -LiteralPath $generatorPath -Raw -Encoding UTF8
$generator = [ScriptBlock]::Create($generatorSource)
& $generator
