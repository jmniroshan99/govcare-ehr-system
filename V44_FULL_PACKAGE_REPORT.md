# GovCare V44 Full Package Report

This package is the **full V44 delivery** built by preserving the complete V43 application and verification evidence, then overlaying the V44 Windows/PostgreSQL target-validation hardening changes.

## Preserved from V43
- All application source, ML artifacts, documentation and database migrations.
- V43 renal verification JSON evidence.
- Four renal UI verification screenshots (light/dark, desktop/mobile).
- Existing modern UI, responsive, persistence, PDF, theme and facility verification evidence.

## V44 changes retained
- `scripts/run-renal-ml.cjs` loads `ML_Server/.env` and fails closed if the renal service credential is missing/too short.
- Windows/PostgreSQL target verification PowerShell + BAT entrypoint.
- Native PostgreSQL/Flyway V42 verifier.
- Live CKD assessment/PDF verifier.
- Renal ML environment regression test.
- V44 target validation documentation and modified-file report.

## Clinical/research status
- Hyperkalemia remains a research risk model (`LK-RENAL-HYPERK-1.0`).
- Hyperkalemia probability calibration is not established.
- Renal deterioration composite is a heuristic directional composite, not a validated prognosis score.
- Clinical validation is not completed.
- Dataset permission/governance status remains to be confirmed by the research team.

## Target execution
Run on the intended Windows/PostgreSQL machine:

```cmd
verify-target-windows-postgres.bat -SkipLiveFixtures
```

For live patient + CKD PDF verification, supply the private QA accounts fixture as documented in `TARGET_WINDOWS_POSTGRESQL_VALIDATION.md`.
