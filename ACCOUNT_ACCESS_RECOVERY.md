# Account access and MFA recovery

The screenshot showing `admin@govcare.gov.lk` and “This account requires server-side MFA verification” indicates that this particular database account has the older `mfa_enabled=true` flag. The current Spring API has no configured MFA verifier, so it rejects the login rather than issuing a JWT. `admin@govcare.gov.lk` is not one of the Flyway seed accounts; its current password and precise role cannot be inferred from the source.

## Recover an existing staff account

If Super Admin is already signed in, open `/admin/staff`, find the staff account, and choose **Reset Password**. The API now clears the unsupported legacy MFA flag as part of this privileged reset, generates a forced password-change state, revokes earlier JWTs, and audits the action. The selected temporary password is displayed once in the management dialog after the reset succeeds. Pass it to the account holder privately. A Hospital Admin can reset only permitted accounts in the same hospital; elevated roles remain Super Admin only.

If Super Admin cannot access the UI, run this local PowerShell recovery as the PostgreSQL database administrator on the database host, after migration V29 has completed:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\recover-locked-staff-mfa.ps1" -Email "admin@govcare.gov.lk"
```

The script updates an **existing active staff account** only when `mfa_enabled=true`; it does not create accounts or change patients/guardians. It generates a unique random one-time password in PostgreSQL, clears the stranded MFA flag, requires password change, increments `credentials_version` to revoke earlier JWTs, and prints the email, actual role, and password once. It refuses a second run after recovery because the flag is then false. Check `spring-api/.env` for the actual database host, name and port; the script accepts `-DbHost`, `-DbPort`, `-DbName`, and `-DbUser`. If the account already has MFA disabled, use the authorized Staff Management password reset instead.

The older `scripts/recover-superadmin-mfa.ps1` remains for a Super Admin who is still MFA locked. Do not rerun it for an account that was already recovered. The one-time password from a prior recovery output must be changed at the temporary-password page; it is **not** the original seed password.

## Seed accounts and other roles

Flyway seeds these only on a new database or when their email is absent:

| Role | Email | Initial password on an untouched account |
| --- | --- | --- |
| Super Admin | `superadmin@govcare.gov.lk` | `GovCare@123` |
| Doctor | `doctor@govcare.gov.lk` | `GovCare@123` |
| Patient | `patient@govcare.gov.lk` | `GovCare@123` |

No shared or retrievable password exists for other roles. In `/admin/staff` select the hospital, role and staff identity, generate a unique temporary password, create the account, and give that password to the person privately. Each new staff account must change its temporary password on first sign-in. The available staff roles are:

| Hospital administration | Clinical and operational | Diagnostics and support |
| --- | --- | --- |
| `hospital_admin` | `doctor` | `lab_technician` |
| `ict_admin` | `surgeon` | `lab_manager` |
| `records_officer` | `anesthetist` | `pathologist` |
| `receptionist` | `nurse` | `radiology_technician` |
| | `mortuary_officer` | `radiologist` |
| | | `pharmacist` |

`super_admin` is a separately governed system role. `patient` uses registration or the patient seed; `guardian` requires a linked-patient relationship and is not created through Staff Management. The API checks assignment privileges and hospital scope; only a Super Admin may create `hospital_admin` and `ict_admin`. All 15 staff roles offered by the API are represented in the Staff Management client.

Passwords already stored in PostgreSQL are bcrypt hashes and cannot be read back. Do not treat passwords printed by migration files as the current passwords of an existing installation. The login page never autofills or submits a shared demonstration password.
