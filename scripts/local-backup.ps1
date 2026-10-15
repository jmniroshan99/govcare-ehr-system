param(
  [string]$DestinationRoot,
  [switch]$Zip,
  [switch]$ExcludeEnv
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProjectName = Split-Path $ProjectRoot -Leaf

if ([string]::IsNullOrWhiteSpace($DestinationRoot)) {
  $WorkspaceRoot = Split-Path $ProjectRoot -Parent
  $DestinationRoot = Join-Path $WorkspaceRoot "backups\govcare-ehr-system"
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupName = "$ProjectName-$Timestamp"
$BackupPath = Join-Path $DestinationRoot $BackupName

New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null

$ExcludedDirectories = @(
  "node_modules",
  "dist",
  ".git",
  ".postgresql",
  ".vite",
  ".agents"
)

$ExcludedFiles = @(
  "*.log",
  "postgresql-debug.log",
  "vite-dev.err.log",
  "vite-dev.out.log"
)

if ($ExcludeEnv) {
  $ExcludedFiles += ".env"
}

Write-Host "Creating GovCare EHR local backup..." -ForegroundColor Cyan
Write-Host "Source:      $ProjectRoot"
Write-Host "Destination: $BackupPath"

$robocopyArgs = @(
  $ProjectRoot,
  $BackupPath,
  "/E",
  "/COPY:DAT",
  "/DCOPY:DAT",
  "/R:2",
  "/W:1",
  "/NFL",
  "/NDL",
  "/NP",
  "/XD"
) + $ExcludedDirectories + @("/XF") + $ExcludedFiles

& robocopy @robocopyArgs | Out-Host
$RoboCopyExitCode = $LASTEXITCODE

if ($RoboCopyExitCode -ge 8) {
  throw "Backup failed. Robocopy exit code: $RoboCopyExitCode"
}

$Manifest = [ordered]@{
  project = $ProjectName
  source = $ProjectRoot
  destination = $BackupPath
  createdAt = (Get-Date).ToString("s")
  excludedDirectories = $ExcludedDirectories
  excludedFiles = $ExcludedFiles
  nodeVersion = (& node --version)
  npmVersion = (& npm --version)
}

$ManifestPath = Join-Path $BackupPath "backup-manifest.json"
$Manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

if ($Zip) {
  $ZipPath = "$BackupPath.zip"
  if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }
  Compress-Archive -Path (Join-Path $BackupPath "*") -DestinationPath $ZipPath -Force
  Write-Host "Zip created: $ZipPath" -ForegroundColor Green
}

Write-Host "Backup completed successfully." -ForegroundColor Green
Write-Host "Backup folder: $BackupPath"
