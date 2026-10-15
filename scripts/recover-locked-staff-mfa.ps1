# Recover an active staff account locked by the legacy mfa_enabled flag.
# Run only by the PostgreSQL administrator on the database host. V29 is required.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Email,
    [string]$DbHost = '127.0.0.1',
    [int]$DbPort = 5432,
    [string]$DbName = 'govcare_ehr_v2',
    [string]$DbUser = 'postgres'
)

$ErrorActionPreference = 'Stop'
$accountEmail = $Email.Trim().ToLowerInvariant()
if ($accountEmail -cnotmatch '^[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}$') {
    throw 'Enter a valid staff email address.'
}
if ($DbPort -lt 1 -or $DbPort -gt 65535) { throw 'DbPort must be between 1 and 65535.' }

$psqlCommand = Get-Command 'psql.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
$psqlPath = if ($psqlCommand) { $psqlCommand.Source } else { $null }
if (-not $psqlPath) {
    $postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $postgresRoot) {
        $psqlPath = Get-ChildItem $postgresRoot -Directory |
            Sort-Object { try { [version]$_.Name } catch { [version]'0.0' } } -Descending |
            ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' } |
            Where-Object { Test-Path $_ } | Select-Object -First 1
    }
}
if (-not $psqlPath) {
    throw 'psql.exe was not found. Add the PostgreSQL bin folder to PATH or install the PostgreSQL command-line tools.'
}

# psql substitutes a quoted SQL literal, not raw user input. PostgreSQL generates
# the password; it never appears in the script file or a process command line.
$query = @'
with temporary_credential as (
  select encode(gen_random_bytes(24), 'hex') as password
), recovered as (
  update app_users u
     set password_hash = crypt(t.password, gen_salt('bf')),
         mfa_enabled = false,
         must_change_password = true,
         credentials_version = u.credentials_version + 1,
         updated_at = now()
    from temporary_credential t
   where lower(u.email) = :'target_email'
     and u.status = 'active'
     and u.mfa_enabled = true
     and u.role::text not in ('patient', 'guardian')
  returning u.email, u.role::text as role, t.password
)
select email || '|' || role || '|' || password from recovered;
'@

$sqlFile = Join-Path ([IO.Path]::GetTempPath()) ("govcare-recover-" + [guid]::NewGuid().ToString('N') + '.sql')
try {
    [IO.File]::WriteAllText($sqlFile, $query, [Text.UTF8Encoding]::new($false))
    Write-Host "Connecting to PostgreSQL at ${DbHost}:${DbPort}/${DbName} as ${DbUser}."
    Write-Host 'PostgreSQL may prompt for the database password.'
    $output = & $psqlPath -X -qAt -v 'ON_ERROR_STOP=1' -v "target_email=$accountEmail" -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $sqlFile 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Recovery did not complete. PostgreSQL output: $($output -join ' ')"
    }
    $credential = @($output) | Where-Object { $_ -match '^[^|\s]+\|[a-z_]+\|[0-9a-f]{48}$' } | Select-Object -First 1
    if (-not $credential) {
        throw 'No active MFA-locked staff account was found. Check the selected database, email and account status. Existing passwords were not changed.'
    }
    $parts = $credential -split '\|', 3
    Write-Host ''
    Write-Host 'Recovery completed. Earlier JWTs for this account were revoked.'
    Write-Host "Email: $($parts[0])"
    Write-Host "Role: $($parts[1])"
    Write-Host "One-time temporary password: $($parts[2])"
    Write-Host 'Sign in and change this password immediately on the temporary-password page.'
} finally {
    Remove-Item -LiteralPath $sqlFile -ErrorAction SilentlyContinue
}
