# GovCare EHR access hardening notes

This archive contains the original full source and targeted changes made from the attached role/access review. It has **not** been validated as a production-ready EHR release.

## Changed access boundaries

- CKD patient profiles now check hospital, permission, and patient/guardian self-link.
- Generic FHIR reads/writes/deletes and clinical coding require a clinician assigned to the local patient. FHIR resources without an existing local patient association are denied until safely reconciled.
- AI risk, CKD, clinical extraction, stored observations, and generated report paths use the same clinician/patient relationship. AI dashboards and patient selectors are scoped to those relationships.
- Patient media uploads must enter the governed document index. Upload cannot request an already released state. Legacy release requires an indexed, verified document and a release-capable role; unindexed legacy media stays unavailable pending reconciliation.
- Governance roles cannot open clinical documents through the document-service full-access shortcut. Legacy clinical PDFs check role, patient link, and patient release/verification state.
- Laboratory, radiology, and pharmacy status shortcuts no longer directly grant verification, release, or dispensing; dedicated workflows apply.
- Staff mutations through `/api/users` reuse staff role/tenant/department policy. The new V29 migration removes records-officer patient-delete and admission-create grants, while allowing registration staff to create administrative documents through the governed registry.
- Public self-registration returns the same generic response for duplicate and new submissions, consumes a token use for both, and never exposes a matching patient identity. The browser no longer treats an API failure as a locally completed registration.
- Temporary-password accounts are blocked from other API routes until the password changes. Password change/reset increments a credential version; tokens issued before it become invalid. MFA-enabled accounts are denied password-only login until a genuine server-side MFA provider is configured. A missing JWT secret generates an ephemeral signing key instead of using the known fallback.
- Client-submitted audit events are labeled as client telemetry. The optional FastAPI predictor requires `GOVCARE_AI_SERVICE_TOKEN`; without it, `/predict` is unavailable. Browser clinical caches are cleared on logout and account switch.

## Important remaining work before production

1. **Known seeded accounts** (`GovCare@123`, including super administrator) and login-page demo buttons still exist. Remove/rotate these in a controlled provisioning flow before any network deployment. Also replace default database credentials and set a private persistent `JWT_SECRET` of at least 32 bytes. An ephemeral JWT key invalidates sessions on restart and cannot be shared between instances.
2. MFA and password recovery do **not** have a delivery/verification provider. MFA-enabled users cannot log in; reset/OTP request endpoints return service unavailable. Integrate an identity provider or implement audited enrollment, rate limits, challenge verification, and recovery before enabling MFA for staff.
3. Ordinary logout clears the browser token but does not revoke a still valid JWT presented elsewhere. Password change and staff reset do revoke old tokens. Add session identifiers or a server-side denylist for immediate logout revocation.
4. Public patient-account creation does not establish a verified `patientId` link; the portal therefore cannot claim a newly self-registered patient automatically. Implement identity proofing and staff-approved linking.
5. Legacy browser workflows still persist clinical data locally while a user is signed in. Switching accounts and logging out now clear named caches, but a full move to backend-backed, account-scoped records is needed. Frontend unknown routes still default to allow; server policies must remain authoritative. Mortuary-role grants need a defined workflow/policy.
6. Confirm patient release rules and clinician assignment against real operational roles, then write database-backed authorization tests for patient, guardian, doctor, records officer, laboratory, radiology, and administrator scenarios. Some old clinical records with null FHIR patient associations and unindexed media are intentionally inaccessible until reconciled.

## Verification and migration

`npm run test:startup` passed 12/12 launcher tests. `python3 -m py_compile ai-cdss-service/app.py` passed. Spring/TypeScript builds and database-backed tests could not run in this workspace (Java 21, Maven, PostgreSQL and project dependencies unavailable). Apply the new Flyway V29 migration on a backup/test database first; it invalidates existing JWTs because old tokens lack the new credential version claim. A production security review is required after runtime testing.
