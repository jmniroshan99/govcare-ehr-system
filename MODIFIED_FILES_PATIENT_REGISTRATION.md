# Modified Files — Quick Patient Registration

This list is relative to the supplied `GovCare_EHR_Access_Roles_FIXED_FULL_SOURCE` archive.

| File | Change |
| --- | --- |
| `src/pages/PatientRegistration.tsx` | Rebuilt the page around default Quick Registration, conditional identification, duplicate checking, grouped/collapsible details, age/guardian logic, field progress, unsaved protection, and safe submission states |
| `src/pages/DoctorWorkspace.tsx` | Automatically collapses the large sticky patient profile when clinical notes receive focus; adds an accessible Show/Hide control; and rebuilds e-Prescribing as a guided, responsive workflow with formulary context, completion status, allergy/duplicate protection, readable medicine review cards, and a clear sign/send stage |
| `src/components/forms/SearchableSelect.tsx` | Makes local-option selectors open above fields near the bottom of the viewport, keeps the options list within available space, and recalculates placement during scrolling/resizing |
| `src/components/forms/AsyncSearchableSelect.tsx` | Applies the same collision-aware behavior to PostgreSQL/API-backed searches such as Laboratory test and Imaging study |
| `src/components/forms/useAdaptiveDropdownPlacement.ts` | Adds the shared viewport measurement and adaptive above/below dropdown placement logic |
| `src/validations/patient.ts` | Added quick-field, identifier-type, registration-type, phone, location, and date validation |
| `src/components/ui/form-field-label.tsx` | Replaced the small asterisk with an accessible, high-contrast Required badge |
| `src/index.css` | Added semantic-token registration sections, focus-within rows, responsive 1/2/3-column grids, and a glass sticky action bar |
| `src/services/patientService.ts` | Added the optional create request `registrationType` and response `registration_type` types |
| `spring-api/src/main/java/lk/gov/health/govcare/patient/PatientEntity.java` | Mapped `registration_type` with a backward-compatible pre-persist default |
| `spring-api/src/main/java/lk/gov/health/govcare/patient/PatientService.java` | Validated, stored, updated, and serialized registration type |
| `spring-api/src/main/resources/db/migration/V34__patient_registration_workflow.sql` | Added the PostgreSQL column, value constraint, default, and hospital workflow index |
| `scripts/patient-registration.test.cjs` | Added Quick Registration, accessibility, layout, RBAC/isolation, migration, and browser-storage contract tests |
| `scripts/doctor-workspace-profile.test.cjs` | Added regression checks for automatic note-focus collapse, the manual toggle, persistent patient identification, the guided prescription workflow, and live medication safety/readiness states |
| `scripts/searchable-select-placement.test.cjs` | Added regression checks for static and API-backed selector placement, viewport recalculation, and bounded option-list height |
| `scripts/verify-patient-registration-migration.mjs` | Added executable PostgreSQL-semantic migration verification |
| `package.json` | Added `npm run test:patient-registration`, `npm run test:doctor-workspace`, and `npm run test:searchable-select` |
| `PATIENT_REGISTRATION_QUICK_WORKFLOW.md` | Added architecture, security, API/database, RBAC, and build documentation |
| `PATIENT_REGISTRATION_TEST_REPORT.md` | Added reproducible verification results and the Maven environment limitation |
| `EPRESCRIPTION_WORKFLOW_MODERNIZATION.md` | Added the interaction, safety, data-source, accessibility, responsive-layout, and verification notes for the redesigned prescribing workspace |
| `DROPDOWN_VISIBILITY_FIX.md` | Added the root cause, corrected behavior, affected controls, and update instructions for the clipped selector issue |
| `MODIFIED_FILES_PATIENT_REGISTRATION.md` | Added this change inventory |
