param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [Parameter(Mandatory = $true)]
  [string]$TargetDatabaseUrl,
  [Parameter(Mandatory = $true)]
  [ValidateSet("RESTORE_TUE_TAM_DATABASE")]
  [string]$ConfirmTargetDatabase
)

$ErrorActionPreference = "Stop"
$resolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) { throw "Không tìm thấy pg_restore trong PATH." }

Write-Host "Đang phục hồi vào CSDL đích đã xác nhận. Script không tự xóa schema; CSDL đích phải trống."
& pg_restore --dbname=$TargetDatabaseUrl --exit-on-error --no-owner --no-acl $resolvedBackup
if ($LASTEXITCODE -ne 0) { throw "pg_restore thất bại với mã $LASTEXITCODE." }
Write-Host "Phục hồi hoàn tất. Hãy chạy npm run db:deploy và bài kiểm tra smoke trước khi chuyển traffic."
