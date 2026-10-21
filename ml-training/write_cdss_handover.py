"""Generate linked algorithm documentation and deployed/research registry from a completed run."""
import argparse,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parent

SHORT={
 'regularized_linear':('Regularized linear models (Ridge / Logistic Regression)','A weighted sum of normalized inputs with shrinkage to reduce unstable coefficients.','A simple regularized comparator is essential with only 42 patients.','alpha increases Ridge shrinkage; C decreases logistic shrinkage when increased.','Interpretable global associations; linear assumptions miss interactions and coefficients are not causal effects.'),
 'random_forest':('Random Forest regression / classification','Averages many trees fitted on bootstrap samples with random feature subsets.','Tests modest nonlinear interactions with conservative tree size.','n_estimators=100; max_depth=4; min_samples_leaf=5 or 10; max_features=0.6.','Averaging controls variance, but repeated-patient patterns and small event counts can still overfit; probability calibration is not guaranteed.'),
 'extra_trees':('Extremely Randomized Trees regression / classification','Averages trees that randomize split thresholds as well as candidate features.','Adds a distinct tree family with stronger randomization than Random Forest.','100 trees; depth 4; minimum leaf 5 or 10; feature fraction 0.6.','Fast variance reduction; random cut points may miss small clinical signals and remain sensitive to cohort shift.'),
 'hist_gradient_boosting':('Histogram Gradient Boosting regression / classification','Adds small trees that correct previous errors using binned feature values.','Tests bounded boosting without an external tree library.','80 iterations, 7 leaves, learning rate 0.05, L2=10; minimum leaf 10 or 20. Early stopping disabled to avoid a hidden row-level validation split.','Captures interactions; small cohorts and many correlated features can still yield unstable improvements.'),
 'xgboost':('Extreme Gradient Boosting (XGBoost) regression / classification','Adds shallow regularized trees with subsampling and shrinkage.','Compares the existing project tree family against the other six families.','80 trees, depth 2, learning rate 0.05, lambda=10, subsample=0.8, feature fraction=0.7; child weight 5 or 10.','Flexible nonlinear prediction; complexity does not establish clinical usefulness and negative test R² remains possible.'),
 'support_vector':('Support Vector Regression / Support Vector Classification','Fits a regularized kernel boundary or regression function based on influential training examples.','Provides a distinct kernel family for a small dataset.','RBF kernel; gamma=scale; C=0.1 or 1. SVC probability=False; grouped sigmoid calibration wraps the full preprocessing pipeline.','Scaling is essential. Eighty-four correlated features and small patient counts can destabilize distances and calibration.'),
 'nearest_neighbors':('k-Nearest Neighbours regression / classification','Predicts from the closest normalized training observations, weighted by distance.','Provides a simple local similarity comparator.','k=5 or 15; inverse-distance weights.','Transparent local matching; high dimensionality, correlated visits and sparse patient coverage can make neighbours unreliable.'),
}
SURVIVAL={
 'cox_elastic_net':('Elastic-net Cox proportional hazards','A regularized relative-hazard model with an estimated baseline survival function.','A standard low-complexity time-to-event comparator.','l1_ratio=0.5 or 0.9; alpha=0.05; fit_baseline_model=True.','Requires proportional hazards; baseline survival is mandatory for horizon probabilities, and extrapolation is not validated.'),
 'weibull_aft':('Weibull accelerated failure time','Predictors stretch or shorten event time under a Weibull distribution.','A distinct parametric alternative to proportional hazards.','penalizer=0.1 or 1.0; median imputation and standardization inside fitting data.','Strong parametric assumptions can help small data but can misrepresent hazards; mathematical extrapolation is not evidence of five-year accuracy.'),
 'random_survival_forest':('Random Survival Forest','Averages tree-based survival functions while accounting for right censoring.','Tests nonlinear interactions without a linear hazard specification.','100 trees; depth 4; minimum leaf 10 or 20.','Survival functions are different from ranking scores. Many events and at-risk follow-up are needed for stable terminal-node estimates.'),
 'extra_survival_trees':('Extra Survival Trees','Combines randomized survival trees with censoring-aware fitting.','Compares stronger tree randomization against survival forests.','100 trees; depth 4; minimum leaf 10 or 20.','Randomization reduces correlated trees but sparse events still make probabilities unstable.'),
 'gradient_boosting_survival':('Gradient-boosted survival trees','Builds an additive sequence of shallow trees using a Cox survival objective.','Tests bounded nonlinear survival boosting.','80 trees; learning rate 0.05; depth 1 or 2.','Boosting can capture associations but may overfit event-poor cohorts; proportional-hazard and censoring assumptions still matter.'),
 'xgboost_aft':('XGBoost accelerated failure time','Fits boosted log-time location predictions under a specified AFT distribution.','Provides a separate boosted AFT family rather than another Cox parameter setting.','normal log-time noise; scale=1.2; depth 1 or 2; 80 rounds; event bounds [t,t], right-censor bounds [t,+inf].','Deriving probabilities requires the recorded distribution and scale. Treating a point time prediction as a probability would be wrong.'),
 'logistic_hazard':('Discrete-time Logistic Hazard (penalized pooled logistic)','Expands known risk intervals and fits logistic event hazards with clinical predictors and time-bin indicators.','Provides a documented discrete-time family without an unjustified neural network.','C=0.1 or 1.0; at most six event-quantile bins, fitted only using fitting patients; at least five fitting events per bin.','Partial censored intervals are omitted. Within-bin hazards are piecewise constant; grid choice and independent censoring assumptions require validation. Neural mode has a separate complexity gate and is not implemented by this non-neural estimator.'),
}
MODULES={'xgboost':'xgboost_model'}

def save(path,text):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text.strip()+'\n',encoding='utf-8')
def main(run):
    run=Path(run).resolve();summary=json.loads((run/'summary.json').read_text());docs=PROJECT/'docs/cdss';rows=[]
    for algorithm,description in SHORT.items():
        name,simple,why,params,limits=description;module=MODULES.get(algorithm,algorithm)
        results=[]
        for task,result in summary['tasks'].items():
            entry=result['candidates'][algorithm];metric='MAE' if result['kind']=='regression' else 'BrierScore'
            results.append(f"| {task} | {entry['training_status']} | {entry['evaluated']} | {entry.get('validation',{}).get(metric)} | {entry.get('test',{}).get(metric)} | {entry.get('passed_validation_gate',False)} | no |")
            rows.append(f"| {task} | [{algorithm}](algorithms/short_horizon/{algorithm}.md) | {entry['training_status']} | {entry['evaluated']} | {entry.get('passed_validation_gate',False)} | no |")
        save(docs/f'algorithms/short_horizon/{algorithm}.md',f'''# {name}

{simple}

Included because: {why}

Supported tasks: next-observed hemoglobin regression (g/dL), URR regression (%), and hyperkalemia classification (next pre-HD potassium ≥5.5 mmol/L). The target is the immediate next observation within inclusive 14–62 days, not an exact 30-day outcome.

Inputs: 84 canonical current/past laboratory and trend features from `preprocessing/longitudinal_features.py`. Patient ID, row references, future observations, uncertain absolute urea/UA and outcomes are excluded. Training-only median imputation and standardization are fitted anew inside every tuning/calibration partition. Initial origins may have missing historical features. The unchanged serving contract is stricter and requires two eligible observations.

Important hyperparameters: {params}

Strengths and limitations: {limits} Suitability is exploratory: only 42 source patients, with 24/9/9 historical train/validation/test patients; outcome eligibility can reduce these counts. Grouping reduces new within-pipeline leakage but cannot undo possible upstream interpolation. Dataset permission is unverified; clinical validation is not completed.

Training command (runs this family together with the other six):

```powershell
.venv-cdss312/Scripts/python.exe ml-training/benchmark_cdss.py --output ml-training/runs/NEW_UNIQUE_RUN
```

Implementation: `ml-training/training/algorithms/short_horizon/{module}.py`.
Configuration: `ml-training/configs/algorithms/short_horizon.json`, key `{algorithm}`; task policy in `configs/tasks/short_horizon.json`.
Artifacts: `ml-training/runs/{run.name}/short_horizon/<task>/{algorithm}/model.joblib`, with `manifest.json`, `MODEL_CARD.md`, `metrics.json`, `training_status.json` and dated `test_predictions.csv`.

| Task | Training status | Evaluated | Validation MAE/Brier | Reused test MAE/Brier | Validation gate passed | New artifact served |
|---|---|---|---:|---:|---|---|
{chr(10).join(results)}

Validation selects using prespecified MAE/Brier and baseline gates before test evaluation. Every candidate is evaluated after freezing selection; an evaluated result is not a clinical approval. Full RMSE/R², discrimination, threshold confusion, descriptive calibration, per-patient variation and patient-bootstrap uncertainty are retained in the metrics file as applicable. One-class metrics are explicitly unavailable.

Serving: these newly fitted candidates are staged. See the main catalog for the retained deployed Hb persistence / URR XGBoost / hyperkalemia logistic regression methods. The deployed algorithm name alone does not identify one of these new artifacts.
''')
    for algorithm,description in SURVIVAL.items():
        name,simple,why,params,limits=description;status=summary['survival']['candidates'][algorithm]
        rows.append(f"| first KRT survival | [{algorithm}](algorithms/survival/{algorithm}.md) | {status['status']} | false | unavailable | no |")
        save(docs/f'algorithms/survival/{algorithm}.md',f'''# {name}

{simple}

Included because: {why}

Supported task: time from a prespecified eligible nondialysis CKD origin to first maintenance KRT. Predictor order is age, verified sex indicator, eGFR (mL/min/1.73m²), urine ACR (mg/g). Predictor dates must be at/before origin; imputation/scaling are fitted only on fitting patients. Serum albumin cannot supply urine ACR. Temporary acute dialysis and prior KRT are excluded.

Important hyperparameters: {params}

Strengths and limitations: {limits}

Output semantics: each adapter produces cause-specific net survival. The default orchestration fits separate kidney-failure and competing-death adapters and integrates them on a daily grid to estimate research CIF; the optional net estimand is labelled separately. These outputs are not clinically validated. No unsupported-horizon extrapolation is allowed. Discrete grids and all fitted preprocessing are confined to development fitting data.

Suitability: the actual current data contain no event/censoring contract and are a maintenance-dialysis cohort. This candidate is not feasible for clinical five-year training. Future event-count, partition, horizon and censoring-support gates must pass; a more complex estimator does not avoid these requirements.

Training/readiness command:

```powershell
../.venv-cdss312/Scripts/python.exe -m training.tasks.survival --source data/deidentified_monthly.csv --output runs/NEW_SURVIVAL_READINESS
```

Run from `ml-training`. For genuine future data add `--split PATH_TO_PRESPECIFIED_MANIFEST`. Never use synthetic test fixtures as clinical training/evaluation records.

Implementation: `ml-training/training/algorithms/survival/{algorithm}.py`.
Configuration: `ml-training/configs/algorithms/survival.json`, key `{algorithm}`; gates in `configs/tasks/survival.json`; endpoint in `data_contracts/survival_endpoint.json`.
Current artifact: none. Status evidence: `ml-training/runs/{run.name}/survival/readiness.json`.
Future artifacts, only after readiness: `<survival-output>/{algorithm}/model.joblib`, `manifest.json`, `MODEL_CARD.md`, `metrics.json`.

Status: **{status['status']}**. Registered: yes. Trained on current clinical data: no. Evaluated on clinical five-year outcomes: no. Served: no.

Reason: {status['reason']}

Clinical five-year metrics are null. Synthetic fitting/curve/censoring tests verify software behaviour only. The full data-collection and estimand specification is in `FIVE_YEAR_MODEL_READINESS.md`.
''')
    deployed={}
    for task,folder in [('hb','hb-risk'),('urr','urr-risk'),('hyperkalemia','hyperkalemia-risk')]:
        meta_path=ROOT/'artifacts'/folder/'metadata.json';meta=json.loads(meta_path.read_text());deployed[task]={
            'actual_method':'LAST_OBSERVATION_CARRIED_FORWARD' if meta['served_method']=='PERSISTENCE_BASELINE' else meta['algorithm'],
            'served_method':meta['served_method'],'model_version':meta['model_version'],'metadata_path':str(meta_path.relative_to(PROJECT)),
            'artifact_sha256':meta.get('artifact_sha256'),'artifact_revision':meta.get('artifact_revision'),'research_serving_status':'BASELINE_SELECTED' if task=='hb' else 'RESEARCH_SERVING_APPROVED',
            'approval_scope':'Existing packaged research serving only; not clinical approval','clinical_validation':'NOT_COMPLETED','new_benchmark_artifact':False}
    registry={'schema_version':1,'run_id':run.name,'dataset_sha256':summary['dataset_sha256'],'test_set_is_new':False,
        'new_candidates':{task:{a:{k:e.get(k) for k in ['training_status','evaluated','served','passed_validation_gate','reason']} for a,e in task_result['candidates'].items()} for task,task_result in summary['tasks'].items()},
        'survival':summary['survival'],'deployed':deployed,'promotion':{t:{'research_selected':r['selection']['selected_method'],'deployment':'SAME_METHOD_SERIALIZATION_REPAIR' if t in ['hb','urr'] else 'RETAINED_EXISTING_ARTIFACT','reason':'New seven-family candidates remain staged. Unreadable legacy Hb/URR research artifacts were explicitly rebuilt with the retained legacy specification; Hb persistence remains served; URR passed its original validation gate. Originals are preserved in the serving-repair run.'} for t,r in summary['tasks'].items()}}
    registry_dir=ROOT/'model_registry';registry_dir.mkdir(exist_ok=True)
    (registry_dir/(run.name+'.json')).write_text(json.dumps(registry,indent=2))
    save(registry_dir/'README.md',f'''# Model registry

Current enhancement snapshot: `{run.name}.json`. New artifacts remain under their run directory; the unchanged `artifacts/` directories are the trusted serving locations. Hashes identify exact serialized objects. Metadata identifies the actual served method, even when an unused research candidate also exists in a directory.

The benchmark freezes research selection before test evaluation. That selection does not activate a new artifact. All seven-family candidates are TRAINED_RESEARCH_ONLY and all seven survival candidates are BLOCKED_MISSING_ENDPOINT. Deployed methods remain Hb persistence / URR XGBoost / hyperkalemia logistic regression. Unreadable Hb/URR legacy research pickles were explicitly rebuilt through the retained legacy workflow, with versioned repair decisions and original artifacts preserved under `runs/cdss-20261020-serving-repair/`. No clinician request retrains or copies artifacts.
''')
    selection_rows=[]
    for task,r in summary['tasks'].items():
        metric='MAE' if r['kind']=='regression' else 'BrierScore';v=r['selection'];selection_rows.append(f"| {task} | {v['selected_method']} | {v['status']} | {r['selected_test'][metric]:.6f} | {deployed[task]['actual_method']} |")
    save(docs/'ALGORITHM_CATALOG.md',f'''# Algorithm catalog and actual status

Canonical completed run: `ml-training/runs/{run.name}/`. Seven families × three short-horizon tasks = 21 trained and evaluated candidates. Seven separate survival candidates are registered and blocked by absent endpoints. KFRE is a published equation, not a model trained on this dataset. Hyperparameter settings and baselines are not additional algorithm families.

| Task | Research selection | Selection status | Reused test MAE/Brier | Method actually served |
|---|---|---|---:|---|
{chr(10).join(selection_rows)}

New seven-family artifacts are staged. Deployed URR XGBoost was repaired through a separate legacy-specification replay after the original pickle failed to load in both environments; this is not the new seven-family XGBoost artifact. The original artifacts, validation gate, new checksum and revision are retained in `runs/cdss-20261020-serving-repair/serving_repair.json`. Hyperkalemia retains the original logistic object; Hb retains persistence. Dataset permission UNVERIFIED and clinical validation NOT_COMPLETED apply to all these research outputs.

| Task | Algorithm documentation | Training status | Evaluated | Passed validation baseline gate | New artifact served |
|---|---|---|---|---|---|
{chr(10).join(rows)}

Each per-algorithm page links its implementation, configuration, command, artifacts and measured results. Every successful short-horizon candidate has a versioned manifest and model card. `runs/{run.name}/COMPARISON.md` includes explicit baselines; task results include full metrics, patient variation and patient-bootstrap uncertainty. `model_registry/{run.name}.json` is the machine-readable deployment/status snapshot.

REGISTERED means an implementation exists. TRAINED_RESEARCH_ONLY means fitted, staged and not served. `evaluated=true` records an actual held-out calculation and does not imply validation approval. BASELINE_SELECTED records a failed promotion gate. BLOCKED_MISSING_ENDPOINT records a data blocker with a reason. RESEARCH_SERVING_APPROVED in the deployed snapshot describes only the existing packaged research-serving scope, not clinical approval.

Measured limitations in this run: selected URR XGBoost has reused-test R² = -0.013710 and MAE = 11.095649 percentage points (persistence MAE = 12.121505). Selected hyperkalemia Random Forest has AUC = 0.584577, sensitivity = 0 at threshold 0.5, and Brier = 0.161778, worse than the test training-prevalence baseline of 0.132010. Hb persistence has MAE = 0.870886 g/dL. Selection was frozen on validation before these test results; these weak results are reported, not used to retune on the test cohort. Read the confusion matrices and uncertainty; a validation ranking is not evidence of clinical utility.
''')
    save(docs/'README.md',f'''# GovCare CDSS enhancement handover

Read [the directory guide](DIRECTORY_GUIDE.md), [dataset audit](../../ml-training/reports/cdss/DATASET_AUDIT.md), [algorithm catalog](ALGORITHM_CATALOG.md), [five-year readiness](FIVE_YEAR_MODEL_READINESS.md), then [reproduction commands](REPRODUCIBILITY.md) and [verification evidence](../../verification/cdss-enhancement/VERIFICATION_REPORT.md).

The implementation adds a reproducible seven-family benchmark for next-observed Hb, URR and hyperkalemia; seven real survival adapters behind explicit endpoint/event/follow-up gates; versioned research artifacts and manifests; a current-file audit; clearer learned-model readiness in outlook/snapshots/PDF; strict inference artifact compatibility; and fixes for stale patient presentation and a collapsed observation chart. React → Spring → Django service boundaries, scope checks, immutable history and the inactive adapter scaffold are retained.

Actual current data: 386 observations, 42 patients, January–December 2024, maximum observation span 335 days. The CSV checksum is `{summary['dataset_sha256']}` and its bytes were preserved. Derived data are stored separately with transformation records. Possible upstream interpolation before the historical split cannot be excluded.

**Trained/evaluated:** all 21 short-term candidates, using the preserved 24/9/9 patient split and patient-grouped tuning; the previously examined test cohort is reused. Read the catalog and `runs/{run.name}/COMPARISON.md` for measured results and baseline decisions.

**Served:** Hb persistence, legacy-specification URR XGBoost, original hyperkalemia logistic regression, and eligible published KFRE at two/five years. The unreadable original Hb/URR research pickles were explicitly rebuilt through the existing offline workflow; URR passed its original validation gate and Hb persistence remains served. Original artifacts and repair decisions are retained in `runs/cdss-20261020-serving-repair/`. New seven-family benchmark artifacts remain staged. Clinical validation is not completed and dataset permission is unverified. Short-term targets are the immediate next observation within 14–62 days; 30 days is only a display anchor.

**Five-year learned outcome:** INSUFFICIENT_LONG_TERM_OUTCOME_DATA. No clinical five-year survival model was fitted or evaluated; no unavailable probability is represented as zero. The future workflow requires an eligible nondialysis cohort, adjudicated first maintenance-KRT dates, competing deaths, verified follow-up/censoring and sufficient horizon support. Synthetic software fitting does not constitute clinical training or validation.

No files were moved. Existing entry points and the `artifacts/` serving convention remain compatible. See the directory guide and final changed-file inventory in `verification/cdss-enhancement/`.
''')
    print('Wrote 14 algorithm pages, catalog and model registry for',run.name)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run',required=True);main(p.parse_args().run)
