param(
  [Parameter(Mandatory = $true)]
  [string]$DestinationDirectory,
  [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"
if (-not $DatabaseUrl) { throw "DATABASE_URL chưa được cấu hình." }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw "Không tìm thấy pg_dump trong PATH." }

$destination = [IO.Path]::GetFullPath($DestinationDirectory)
if (-not (Test-Path -LiteralPath $destination)) {
  New-Item -ItemType Directory -Path $destination | Out-Null
}
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$backupPath = Join-Path $destination "tamancare-$stamp.dump"

& pg_dump --dbname=$DatabaseUrl --format=custom --compress=9 --no-owner --no-acl --file=$backupPath
if ($LASTEXITCODE -ne 0) { throw "pg_dump thất bại với mã $LASTEXITCODE." }

$hash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash
[pscustomobject]@{
  Backup = $backupPath
  Sha256 = $hash
  Bytes = (Get-Item -LiteralPath $backupPath).Length
  CreatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
} | Format-List
