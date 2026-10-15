# GovCare modern UI and integrated CKD workspace

> Latest update (2026-10-06): see `START_HERE_DISEASE_PROBABILITIES.md` for the related-disease cards, matching PDF section, additive V36 migration and current test limitations. The original 2026-10-05 UI update described below remains preserved.

This update applies the supplied Predictive Clinical Intelligence design reference across the application: mint/light surfaces or dark green surfaces, rounded panels, compact controls, a clear page hierarchy and restrained motion. Role-specific dashboards retain their own metrics, workflows and API scopes.

## Open the integrated clinical workspace

1. Sign in with an account that already has CKD assessment permission.
2. Choose **CKD & Clinical Intelligence** in the Clinical Intelligence menu, or open `/ai-cdss/ckd`.
3. Select one authorized patient. Super Admin can narrow the authorized network list by hospital; other users retain the existing server-enforced patient scope.
4. Use **CKD risk assessment** to import reports, verify inputs, save drafts and run the existing CKD model.
5. Eligible clinicians can select **Predictive clinical intelligence** to review dated measurements, care gaps, evidence quality and the clinical timeline for that same patient.

Switching views preserves assessment entries and its result. Changing patients clears the assessment and cancels its old requests. Predictive data loads only when its view is open and a patient is selected. Returning to it reloads its server aggregate so newly saved measurements and assessment evidence can appear.

Old `/ai-cdss/ckd/predictive-intelligence?patientId=<UUID>` links still work and open the intelligence view inside the integrated workspace. They do not grant additional permissions. The shared patient selector resolves the identifier through the authorized API.

## Use your current database and configuration

The original 2026-10-05 UI update added no Java changes or database migration. The subsequent related-disease update adds Java report/snapshot changes and V36; follow its current guide. Keep your existing `.env` configuration, PostgreSQL database and accounts. The full source preserves the earlier V35 integration, Java `Observation` compilation fix and Windows/API port selection fixes. Private environment files and generated build directories are excluded from the source ZIP.

With Node 22.12+ (or a supported newer version), Java 21 and Maven available:

```bash
npm ci
npm run build
npm run test:roles
npm run test:dashboard
npm run test:theme
npm run test:ckd-workspace
npm run test:predictive
cd spring-api
mvn clean test
```

From the project root, use `npm run dev:full` for the existing full-stack launcher. `npm run dev:open` retains the detached Windows launch flow and available-port selection. Existing production deployment configuration remains applicable.

## Delivery documents

- `docs/UNIFIED_THEME_SYSTEM.md`: shared components, theme tokens, motion and extension rules.
- `docs/CKD_WORKSPACE_INTEGRATION.md`: patient context, permissions and API compatibility.
- `docs/UNIFIED_UI_COVERAGE.md`: page-level source audit.
- `docs/UNIFIED_UI_MODIFIED_FILES.md`: exact file changes relative to the previous ZIP.
- `docs/UNIFIED_UI_TEST_REPORT.md`: fresh results and outstanding live verification.

Forecast adapters remain uninstalled in the current research foundation. No future probabilities, projected eGFR values or fabricated chart numbers are introduced by this UI integration.
