# One-time local recovery for a Super Admin locked by the legacy mfa_enabled flag.
# Requires the PostgreSQL administrator password and the V29 Flyway migration.
# Run from a trusted PowerShell window on the machine hosting the database.
[CmdletBinding()]
param(
    [string]$DbHost = '127.0.0.1',
    [int]$DbPort = 5432,
    [string]$DbName = 'govcare_ehr_v2',
    [string]$DbUser = 'postgres'
)

$ErrorActionPreference = 'Stop'
if ($DbPort -lt 1 -or $DbPort -gt 65535) { throw 'DbPort must be between 1 and 65535.' }

$psqlCommand = Get-Command 'psql.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
$psqlPath = if ($psqlCommand) { $psqlCommand.Source } else { $null }
if (-not $psqlPath) {
    $postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $postgresRoot) {
        $candidate = Get-ChildItem $postgresRoot -Directory |
            Sort-Object { try { [version]$_.Name } catch { [version]'0.0' } } -Descending |
            ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' } |
            Where-Object { Test-Path $_ } | Select-Object -First 1
        $psqlPath = $candidate
    }
}
if (-not $psqlPath) {
    throw 'psql.exe was not found. Add the PostgreSQL bin folder to PATH or install the PostgreSQL command-line tools.'
}

# The password is generated inside PostgreSQL and returned once. It never appears
# in a PowerShell command argument or in a source file.
$query = @'
with temporary_credential as (
  select encode(gen_random_bytes(24), 'hex') as password
)
update app_users u
   set password_hash = crypt(t.password, gen_salt('bf')),
       mfa_enabled = false,
       must_change_password = true,
       credentials_version = u.credentials_version + 1,
       updated_at = now()
  from temporary_credential t
 where u.email = 'superadmin@govcare.gov.lk'
   and u.role = 'super_admin'
   and u.status = 'active'
   and u.mfa_enabled = true
returning u.email || '|' || t.password;
'@

Write-Host "Connecting to PostgreSQL at ${DbHost}:${DbPort}/${DbName} as ${DbUser}." 
Write-Host 'PostgreSQL may prompt for the database password.'
$output = & $psqlPath -X -qAt -v 'ON_ERROR_STOP=1' -h $DbHost -p $DbPort -U $DbUser -d $DbName -c $query 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Recovery did not complete. PostgreSQL output: $($output -join ' ')"
}
$credential = @($output) | Where-Object { $_ -match '^superadmin@govcare\.gov\.lk\|[0-9a-f]{48}$' } | Select-Object -First 1
if (-not $credential) {
    throw 'No active Super Admin with mfa_enabled=true was found in this database. Check the database selected by spring-api/.env and the account email.'
}
$temporaryPassword = ($credential -split '\|', 2)[1]
Write-Host ''
Write-Host 'Recovery completed. All earlier JWTs for this account were revoked.'
Write-Host 'Email: superadmin@govcare.gov.lk'
Write-Host "One-time temporary password: $temporaryPassword"
Write-Host 'Sign in and change this password immediately on the temporary-password page.'
