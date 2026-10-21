# Initial inventory — 20 October 2026

All integration paths named in the request exist. Executable code and JSON metadata take precedence over older version reports.

| Area | Implemented before this enhancement | Gap and planned addition |
|---|---|---|
| React outlook | Two/five-year KFRE, dated observations, evidence sources, scenarios, comparison, care plans, loading/error states, abort handling | Explicit learned-model readiness and result type; prevent transient display of another patient's assessment |
| Spring outlook | Adult G3–G5 eligibility, verified no KRT, dated eGFR/urine ACR, immutable snapshots, append-only reviews, tenant/patient scope, audit, stored-evidence PDF | Machine-readable learned five-year blocker in snapshots and reports |
| Django | Dedicated service JWT, hash-checked local artifacts, shared causal feature builder, persistence/learned short-term inference | Strict compatibility checks and separate outlook readiness/approved-artifact boundary |
| Packaged training | Hb/URR regressors (Ridge, RF, XGBoost, LightGBM); separate logistic hyperkalemia; fixed patient split; validation baseline gates | Seven-family/three-task benchmark, bounded grouped tuning, grouped SVC calibration, per-candidate manifests/cards/results |
| Survival training | No learned five-year endpoint pipeline | Seven real adapters, event/censoring contract, readiness gates, supported-horizon metrics and competing-risk semantics |
| Data | Packaged cleaned monthly CSV; historical provenance/quality reports and split manifest | Recalculate audit from actual CSV; preserve original bytes; derived labels/features and transformation hashes |
| Adapter scaffold | `ai-cdss-service` reports NOT_INSTALLED; separate scaffold, not the renal inference route | Document only; do not activate |
| Verification | Existing Python, Django, Java and browser tests, retained historical evidence | Execute relevant checks and retain new evidence separately |

Existing `ml-training/artifacts/` remains the serving location. New runs are staged under `runs/`; research selection is distinct from deployment approval. No existing entry point or file is moved. Existing unrelated Spring log changes are preserved.

The supplied historical audit reports maintenance hemodialysis, unknown secondary-use permission and possible interpolation before the historical split. The new audit will measure current-file facts separately; it cannot reconstruct absent original measurements or prove freedom from upstream leakage.
