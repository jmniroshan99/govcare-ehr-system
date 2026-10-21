# Directory guide

| Path | Responsibility and important files |
|---|---|
| `src/` | React clinical application. `components/ai/CkdFiveYearOutlook.tsx` owns the existing workflow; `components/ai/outlook/LearnedModelReadiness.tsx` explains unavailable learned estimates. `lib/ckdOutlook.ts` formats actual dates/risks. |
| `spring-api/` | Authorization, hospital/patient scope, source collection, immutable assessment snapshots, append-only reviews, audit and PDF. `CkdOutlookEngine`, `CkdOutlookService`, `CkdOutlookController`, `CkdOutlookReport` remain in place. |
| `ML_Server/renal_service/` | Existing authenticated Django short-term inference. `inference.py` loads trusted local artifacts; `artifact_contract.py` checks identity, units, ordered features and dependency compatibility. |
| `ML_Server/renal_service/outlook/` | Packaged learned-outlook readiness handling. No clinical five-year artifact is installed; no training imports or automatic model activation. |
| `ml-training/data/` | Original supplied CSV, preserved unchanged. Historical audit refers to absent upstream workbooks; it does not substitute for the current-file audit. |
| `ml-training/data_contracts/` | `survival_endpoint.json` defines endpoint, eligibility, predictors, units, ascertainment and censoring. `current_five_year_readiness.json` is a packaged offline audit conclusion. |
| `ml-training/configs/tasks/` | Population, targets, actual 14–62-day window, split, thresholds, selection and survival readiness policies. |
| `ml-training/configs/algorithms/` | Two bounded configurations per family, separately for short-horizon and survival candidates. |
| `ml-training/preprocessing/` | Canonical shared `longitudinal_features.py`, unit normalization, current-file audit and survival endpoint validation. Serving and training import this same feature builder. |
| `ml-training/training/algorithms/short_horizon/` | Seven estimator factories with `build(task, parameters, seed)` interface. |
| `ml-training/training/algorithms/survival/` | Seven real survival adapters with `fit(X,event,time)` and `survival(X,times)` interface. `common.py` validates curves and integrates paired cause-specific hazards. |
| `ml-training/training/algorithm_registry.py` | Central family IDs and lazy module mapping. Registration does not mean fitting or approval. |
| `ml-training/training/tasks/` | Offline grouped regression/classification benchmark and gated future survival orchestration. |
| `ml-training/training/baselines.py` | Persistence, training constants, prevalence and majority-class comparators. Survival AJ/KM baselines are in `evaluation/survival.py`. |
| `ml-training/evaluation/` | Existing physical-unit metrics plus grouped uncertainty, validation gates, exploratory calibration and survival IPCW/competing-risk evaluation. |
| `ml-training/explainability/` | Existing explanations of the methods actually served: Hb persistence, URR XGBoost and hyperkalemia logistic regression. Rejected/new benchmark explanations are never substituted. |
| `ml-training/model_registry/` | Versioned run/status and deployed-method manifests, with promotion/retention decisions. |
| `ml-training/runs/<run_id>/` | Configuration snapshot, code/data hashes, split, audit, derived feature/target CSV, transformations, every candidate artifact/manifest/card/metrics, predictions and frozen validation selection. Research artifacts are not automatically loaded by Django. |
| `ml-training/artifacts/` | Existing trusted serving location; retained for compatibility. `metadata.json` declares the actual served method, not merely the serialized research candidate. |
| `ml-training/reports/cdss/` | Recomputed current-CSV audit and all seven blocked-survival statuses. |
| `docs/cdss/algorithms/` | One explanation per family, with command/config/module/artifact/results/status. |
| `scripts/` | Existing startup/verification wrappers. New offline readiness packaging and synthetic browser/native integration verifiers. |
| `verification/cdss-enhancement/` | New execution logs, software-test results, synthetic screenshots/PDF and live integration evidence. Historical verification directories are retained. |
| `ai-cdss-service/` | Separate NOT_INSTALLED adapter scaffold. Not started, migrated into, or counted as the production renal service. |

The active boundary remains React → Spring → Django for learned short-term inference. KFRE is the published equation evaluated by Spring. PDF reads stored assessments; neither UI rendering nor export trains a model.

The unreadable original Hb/URR research pickles were backed up under `runs/cdss-20261020-serving-repair/original-artifacts/` and rebuilt through the retained legacy specification. This repaired serialization, with a recorded URR validation gate; Hb persistence and original hyperkalemia logistic serving remain. New seven-family artifacts are staged separately. The native integration fixes also handle JDBC timestamps, normalized JSONB maps, stable evidence fingerprints and the report audit resource ID. Older immutable assessments remain stored; the fingerprint policy upgrade can require a fresh current assessment without rewriting history.

No source file was moved. The old-path → new-path mapping is identity for every existing file. All existing entry points (`run_training.py`, `train_packaged_models.py`, `train_hyperkalemia_from_packaged.py`, Django and Spring launchers) remain available. `benchmark_cdss.py` is an additional offline entry point, not a replacement wrapper.

`.venv-cdss312/` and `.venv-cdss/` are ignored local environments, not source/artifacts. `derived.csv` is derived research data; `test_cdss_enhancement.py` generates synthetic software fixtures only in memory/temp directories. The native integration database has a random `govcare_cdss_qa_` prefix and contains synthetic records only.
