# GovCare related disease probabilities — 2026-10-06

The CKD care workspace now shows a modern **Related disease probabilities** section after a successful assessment. It follows the existing patient selection → report import → input verification → CKD assessment → result → PDF/Print workflow.

The current CKD percentage is the existing model output. Six related outcomes are displayed separately: CKD progression, kidney failure, acute kidney injury, cardiovascular disease, hyperkalemia and anemia. **Their runtime adapters are not installed in this source project, so their cards and reports show “Data unavailable.”** No percentages are derived from CKD confidence, laboratory thresholds or another disease's score.

## Use the feature

1. Open `/ai-cdss/ckd` with an existing authorized account.
2. Select an authorized patient and complete the existing CKD assessment workflow.
3. Review the new cards. Expand **Model & evidence details** to see model availability, validation metadata and purpose.
4. **Available probabilities** filters the screen. **All outcomes** restores the complete list.
5. **PDF report** saves and downloads the existing server-generated report, now including every outcome, its probability or unavailable state, time horizon, model and reason.
6. **Print** includes the same complete assessment snapshot, regardless of the screen filter. Print colors use the light healthcare tokens in either display theme.

Changing patients clears the result and cancels pending export requests. Repeat export clicks are blocked while a PDF is being prepared. Clinical data is not saved to browser storage.

## Update and verify

Keep the existing PostgreSQL configuration and accounts. This release adds **V36**, a nullable JSONB assessment snapshot and validation/immutability checks. Flyway applies it during normal API startup. Earlier migrations and historic assessments are preserved. The new backend should be deployed with its migration before using the new frontend; older APIs remain readable but cannot capture the new snapshot.

Use the existing Node/Java/Maven setup (Node 22.12+ supported, Java 21):

```bash
npm ci
npm run build
npm run test:roles
npm run test:dashboard
npm run test:theme
npm run test:ckd-workspace
npm run test:disease-probabilities
npm run test:predictive
cd spring-api
mvn clean test
```

From the project root, the existing `npm run dev:full` and Windows `npm run dev:open` launchers are retained.

`npm run test:disease-probabilities` runs actual TypeScript/React rendering checks, dependency-independent Java 21 checks, and isolated PGlite migration/SQL checks. Synthetic test fixtures are confined to tests; they are not demo hospital data or installed disease predictions.

## Delivery documents

- `docs/DISEASE_PROBABILITY_ARCHITECTURE.md`: UI, API, database, clinical boundaries, permissions and extension contract.
- `docs/DISEASE_PROBABILITY_TEST_REPORT.md`: fresh verification and material limits.
- `docs/DISEASE_PROBABILITY_MODIFIED_FILES.md`: file changes relative to the preceding source ZIP.

The delivery environment passed the frontend build and the reported isolated checks. Maven stopped before compilation because Maven Central DNS resolution failed. Actual server-PDF generation/layout, live authentication and responsive browser checks remain unverified for this release; this package does not assert production or clinical validation certification.
