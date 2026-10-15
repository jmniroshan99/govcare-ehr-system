param(
  [string]$AccountsFile = "",
  [switch]$SkipDependencyInstall,
  [switch]$SkipLiveFixtures
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root
$VerificationDir = Join-Path $Root "verification\target-windows-postgres"
New-Item -ItemType Directory -Force -Path $VerificationDir | Out-Null
$Started = @()
$Results = [System.Collections.Generic.List[object]]::new()

function Add-Result([string]$Name,[string]$Status,[string]$Detail="") {
  $Results.Add([pscustomobject]@{ name=$Name; status=$Status; detail=$Detail }) | Out-Null
  Write-Host ("[{0}] {1}{2}" -f $Status,$Name,($(if($Detail){": $Detail"}else{""})))
}
function Invoke-Step([string]$Name,[scriptblock]$Action) {
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  try { & $Action; Add-Result $Name "PASS" }
  catch { Add-Result $Name "FAIL" $_.Exception.Message; throw }
}
function Command-Exists([string]$Name) { return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue) }
function Stop-Tree($Process) {
  if ($null -eq $Process) { return }
  try { & taskkill.exe /PID $Process.Id /T /F *> $null } catch { try { Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue } catch {} }
}
function Wait-Http([string]$Url,[int]$Seconds=120) {
  $deadline=(Get-Date).AddSeconds($Seconds)
  do {
    try {
      $r=Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
      if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ return $r }
    } catch {}
    Start-Sleep -Seconds 2
  } while((Get-Date) -lt $deadline)
  throw "Timed out waiting for $Url"
}
function Read-DotEnv([string]$Path) {
  $map=@{}
  if(!(Test-Path $Path)){ return $map }
  foreach($raw in Get-Content $Path){
    $line=$raw.Trim(); if(!$line -or $line.StartsWith('#')){continue}
    $i=$line.IndexOf('='); if($i -le 0){continue}
    $k=$line.Substring(0,$i).Trim(); $v=$line.Substring($i+1).Trim().Trim('"').Trim("'")
    $map[$k]=$v
  }
  return $map
}
function Start-LoggedProcess([string]$Name,[string]$File,[string[]]$Args,[string]$WorkDir=$Root) {
  $stdout=Join-Path $VerificationDir "$Name.out.log"; $stderr=Join-Path $VerificationDir "$Name.err.log"
  $p=Start-Process -FilePath $File -ArgumentList $Args -WorkingDirectory $WorkDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $script:Started += $p
  return $p
}

try {
  Invoke-Step "Windows prerequisite check" {
    if($env:OS -ne "Windows_NT"){ throw "This script must be executed on the target Windows machine." }
    foreach($cmd in @('node','npm','java','mvn')){ if(!(Command-Exists $cmd)){ throw "$cmd is not available in PATH." } }
    if(!(Command-Exists 'psql') -and !$env:GOVCARE_PSQL_PATH){ throw "PostgreSQL psql is not available. Add PostgreSQL bin to PATH or set GOVCARE_PSQL_PATH." }
    $nodeVersion=& node -p "process.versions.node"; $parts=$nodeVersion.Split('.'); $maj=[int]$parts[0]; $min=[int]$parts[1]
    if(!(($maj -eq 22 -and $min -ge 12) -or $maj -ge 24)){ throw "Node 22.12+ or Node 24+ is required; found $nodeVersion." }
    $javaText=(& java -version 2>&1 | Out-String); if($javaText -notmatch 'version\s+"21[\.]'){ throw "Java 21 is required.`n$javaText" }
    $mvnText=(& mvn -version 2>&1 | Out-String); if($mvnText -notmatch 'Apache Maven 3\.(9|[1-9][0-9])'){ throw "Apache Maven 3.9+ is required.`n$mvnText" }
  }

  Invoke-Step "Local PostgreSQL configuration safety check" {
    $springEnvPath=Join-Path $Root 'spring-api\.env'
    if(!(Test-Path $springEnvPath)){
      Copy-Item (Join-Path $Root 'spring-api\.env.example') $springEnvPath
      throw "spring-api\.env was created from the example. Configure DB_PASSWORD and a strong JWT_SECRET, then rerun."
    }
    $cfg=Read-DotEnv $springEnvPath
    $dbUrl=if($cfg.ContainsKey('DB_URL')){$cfg['DB_URL']}else{'jdbc:postgresql://localhost:5432/govcare_ehr_v2'}
    if($dbUrl -notmatch '^jdbc:postgresql://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/[^/?#]+$'){ throw "Target verifier refuses non-loopback DB_URL: $dbUrl" }
    $jwt=if($cfg.ContainsKey('JWT_SECRET')){$cfg['JWT_SECRET']}else{''}
    if([Text.Encoding]::UTF8.GetByteCount($jwt) -lt 32 -or $jwt -like 'change-this-*'){ throw "Set spring-api\.env JWT_SECRET to a non-placeholder value of at least 32 UTF-8 bytes." }
  }

  if(!$SkipDependencyInstall){
    Invoke-Step "Frontend dependency installation" { & npm.cmd ci --no-audit --no-fund; if($LASTEXITCODE -ne 0){ throw "npm ci failed." } }
  } else { Add-Result "Frontend dependency installation" "SKIP" "Requested by -SkipDependencyInstall" }

  Invoke-Step "Renal service secret configuration" { & node scripts\configure-renal-local.cjs; if($LASTEXITCODE -ne 0){ throw "renal:configure failed." } }
  Invoke-Step "Renal ML launcher .env regression" { & node --test scripts\renal-ml-env.test.cjs; if($LASTEXITCODE -ne 0){ throw "renal ML .env regression failed." } }

  $Py=Join-Path $Root 'ML_Server\.venv\Scripts\python.exe'
  if(!$SkipDependencyInstall){
    Invoke-Step "Django environment installation" {
      if(!(Test-Path $Py)){
        if(Command-Exists 'py'){ & py -3 -m venv ML_Server\.venv } elseif(Command-Exists 'python'){ & python -m venv ML_Server\.venv } else { throw "Python 3.12+ was not found." }
        if($LASTEXITCODE -ne 0){ throw "Unable to create ML_Server\.venv." }
      }
      & $Py -c "import sys; assert sys.version_info >= (3,12), sys.version"; if($LASTEXITCODE -ne 0){ throw "Python 3.12+ is required." }
      & $Py -m pip install --disable-pip-version-check -r ML_Server\requirements.txt; if($LASTEXITCODE -ne 0){ throw "ML_Server requirements installation failed." }
    }
  } elseif(!(Test-Path $Py)){ throw "ML_Server\.venv is missing while -SkipDependencyInstall was selected." }

  Invoke-Step "Flyway V45 migration through Spring startup" {
    $env:GOVCARE_API_PORT='4002'; $env:PORT='4002'
    $spring=Start-LoggedProcess 'migration-spring' 'node.exe' @('scripts\run-spring.mjs','run')
    Wait-Http 'http://127.0.0.1:4002/actuator/health' 180 | Out-Null
    & npm.cmd run test:postgres:v42; if($LASTEXITCODE -ne 0){ throw "Native PostgreSQL V42 verification failed." }
    & npm.cmd run test:postgres:v43; if($LASTEXITCODE -ne 0){ throw "Native PostgreSQL V43 verification failed." }
    & npm.cmd run test:postgres:v44; if($LASTEXITCODE -ne 0){ throw "Native PostgreSQL V44 verification failed." }
    & npm.cmd run test:postgres:v45; if($LASTEXITCODE -ne 0){ throw "Native PostgreSQL V45 verification failed." }
    Stop-Tree $spring
  }

  Invoke-Step "Spring Maven test suite" { & mvn.cmd -f spring-api\pom.xml clean test; if($LASTEXITCODE -ne 0){ throw "Spring Maven tests failed." } }
  Invoke-Step "Django system check" { & $Py ML_Server\manage.py check; if($LASTEXITCODE -ne 0){ throw "Django check failed." } }
  Invoke-Step "Django renal_service tests" { & $Py ML_Server\manage.py test renal_service -v 2; if($LASTEXITCODE -ne 0){ throw "Django renal_service tests failed." } }
  Invoke-Step "Renal graphics regression" { & npm.cmd run test:renal:graphics; if($LASTEXITCODE -ne 0){ throw "Renal graphics regression failed." } }
  Invoke-Step "CKD workspace regression" { & npm.cmd run test:ckd-workspace; if($LASTEXITCODE -ne 0){ throw "CKD workspace regression failed." } }
  Invoke-Step "PostgreSQL-compatible renal migration regression" { & npm.cmd run test:renal:migration; if($LASTEXITCODE -ne 0){ throw "PGlite renal migration regression failed." } }
  Invoke-Step "Unified CKD clinical feature mapping regression" { & npm.cmd run test:ckd:features; if($LASTEXITCODE -ne 0){ throw "Clinical feature regression failed." } }
  Invoke-Step "Renal readiness and clinical context regression" { & npm.cmd run test:renal:readiness; if($LASTEXITCODE -ne 0){ throw "Readiness regression failed." } }
  Invoke-Step "Six-module persistence regression" { & npm.cmd run test:renal:six-modules; if($LASTEXITCODE -ne 0){ throw "Six-module regression failed." } }
  Invoke-Step "Full frontend production build" { & npm.cmd run build; if($LASTEXITCODE -ne 0){ throw "Frontend production build failed." } }

  if($SkipLiveFixtures){
    Add-Result "Live patient renal API verification" "SKIP" "Requested by -SkipLiveFixtures"
    Add-Result "CKD PDF end-to-end export verification" "SKIP" "Requested by -SkipLiveFixtures"
  } else {
    if(!$AccountsFile){ $AccountsFile=Join-Path $Root 'verification\local-renal-accounts.json' }
    if(!(Test-Path $AccountsFile)){
      Add-Result "Live patient renal API verification" "PENDING" "Create a private local fixture file at $AccountsFile; see TARGET_WINDOWS_POSTGRESQL_VALIDATION.md"
      Add-Result "CKD PDF end-to-end export verification" "PENDING" "Requires the same private disposable-local fixture"
    } else {
      Invoke-Step "Start live Spring + Django + frontend" {
        $env:GOVCARE_API_PORT='4002'; $env:PORT='4002'; $env:GOVCARE_FRONTEND_PORT='5300'
        $ml=Start-LoggedProcess 'live-ml' 'node.exe' @('scripts\run-renal-ml.cjs')
        $spring=Start-LoggedProcess 'live-spring' 'node.exe' @('scripts\run-spring.mjs','run')
        $front=Start-LoggedProcess 'live-frontend' 'npm.cmd' @('run','dev','--','--host','127.0.0.1','--port','5300','--strictPort')
        $mlHealth=Wait-Http 'http://127.0.0.1:8001/api/ml/health/' 180
        $mlJson=$mlHealth.Content | ConvertFrom-Json
        if($mlJson.status -ne 'ready' -or !$mlJson.authentication_configured){ throw "Django renal service is not authentication-ready." }
        Wait-Http 'http://127.0.0.1:4002/actuator/health' 180 | Out-Null
        Wait-Http 'http://127.0.0.1:5300/' 120 | Out-Null
      }
      $env:GOVCARE_VISUAL_ACCOUNTS=(Resolve-Path $AccountsFile).Path
      $env:GOVCARE_VISUAL_API='http://127.0.0.1:4002'
      $env:GOVCARE_VISUAL_URL='http://127.0.0.1:5300'
      $env:GOVCARE_RENAL_TEST_MUTATIONS='disposable-local'
      $env:GOVCARE_VERIFICATION_DB_ENGINE='PostgreSQL'
      Invoke-Step "Live patient renal API verification" { & node scripts\verify-renal-api.mjs; if($LASTEXITCODE -ne 0){ throw "Live renal API verification failed." } }
      Invoke-Step "CKD PDF end-to-end export verification" { & node scripts\verify-live-ckd-pdf.mjs; if($LASTEXITCODE -ne 0){ throw "Live CKD PDF export verification failed." } }
    }
  }
}
finally {
  foreach($p in $Started){ Stop-Tree $p }
  $jsonPath=Join-Path $VerificationDir 'target-validation-results.json'
  $Results | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $jsonPath
  $failed=@($Results | Where-Object {$_.status -eq 'FAIL'}).Count
  $pending=@($Results | Where-Object {$_.status -eq 'PENDING'}).Count
  $md=@('# GovCare target Windows/PostgreSQL validation','',("Generated: {0:o}" -f (Get-Date)),'', '| Step | Status | Detail |','|---|---|---|')
  foreach($r in $Results){ $d=([string]$r.detail).Replace('|','\|').Replace("`r",' ').Replace("`n",' '); $md += "| $($r.name) | $($r.status) | $d |" }
  $md += ''; $md += "Failed: $failed"; $md += "Pending: $pending"; $md += ''; $md += 'Operational fixtures are QA-only and are not clinical validation subjects.'
  $md | Set-Content -Encoding UTF8 (Join-Path $VerificationDir 'TARGET_VALIDATION_RESULTS.md')
  Write-Host "`nValidation artifacts: $VerificationDir"
}

if(@($Results | Where-Object {$_.status -eq 'FAIL'}).Count -gt 0){ exit 1 }
if(@($Results | Where-Object {$_.status -eq 'PENDING'}).Count -gt 0){ exit 2 }
exit 0
