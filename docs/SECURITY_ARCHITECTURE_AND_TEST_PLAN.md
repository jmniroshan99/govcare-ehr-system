# GovCare EHR Security Architecture and Test Plan

## Security Architecture

GovCare EHR must use Firebase Authentication custom claims as the first identity boundary. Every user token should include `role`, `hospitalId`, `status`, and role-specific identifiers such as `patientId`, `departmentId`, or `wardIds`.

Core controls:

- Hospital isolation: every clinical document must include `hospitalId`; Firestore and Storage rules must compare it with `request.auth.token.hospitalId`.
- Least privilege: users receive only role-specific route access, Firestore access, and Cloud Function permissions.
- Patient release model: patients can read only their own records where `releaseStatus` is `released` or `approved`.
- Sensitive writes: admissions, bed allocation, prescriptions, medicine issuing, lab result approval, radiology report approval, user creation, OTP handling, and audit writes must go through Cloud Functions.
- App Check: enforce App Check on callable/HTTPS functions and Firebase clients before production.
- Storage protection: all files must live under hospital-scoped paths and include metadata for `hospitalId`, `patientId`, `module`, `visibilityLevel`, `uploadedBy`, and `role`.
- OTP protection: OTP documents must be inaccessible to clients; functions must hash OTPs, expire them in 5-10 minutes, cap attempts, throttle resends, and write audit logs.
- Audit logs: every create, update, approval, release, read-export, upload, download, and override must write immutable logs with before/after state where applicable.

## Security Test Matrix

| Test | Attack scenario | Expected result |
| --- | --- | --- |
| IDOR patient profile | Patient A reads `/patients/PAT-B` | Denied unless linked guardian and released |
| IDOR released report | Patient opens another patient lab/radiology report | Denied |
| Hospital escape | Staff from hospital A queries hospital B document | Denied |
| Role escalation | Nurse writes diagnosis or prescription | Denied |
| Unsafe bed update | Client updates `beds/{id}` directly | Denied; must use Cloud Function |
| Unsafe prescription issue | Client writes `prescriptions/{id}` directly | Denied; must use function |
| Lab result tampering | Lab technician edits approved result directly | Denied; approval function required |
| OTP leak | Client reads `emailOtps/{id}` | Denied |
| Audit tamper | Any normal user edits or deletes audit log | Denied |
| Storage IDOR | Patient reads unreleased file path | Denied |
| Cross-ward assignment | Adult male assigned to female ward without override | Function rejects and audits attempt |
| Child ward rule | Patient under 10 assigned to adult ward without override | Function rejects and audits attempt |

## Emulator Test Checklist

1. Start emulators with Auth, Firestore, Functions, Storage, and Hosting.
2. Seed users with custom claims for every role.
3. Run allow/deny Firestore rule tests for each role and collection.
4. Run Storage rule tests for staff upload, patient upload, released patient download, and unreleased patient denial.
5. Run Cloud Function tests for OTP rate limits, bed assignment locks, stock deduction, prescription issuing, and report release.
6. Confirm App Check enforcement is enabled in production and debug tokens are used only in local development.

