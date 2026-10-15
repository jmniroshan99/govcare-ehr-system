"""Reproducible research-only next-period hyperkalemia classifier from the packaged de-identified cohort.

This script deliberately uses the persisted patient split manifest and current/past-only longitudinal
features. It does not claim clinical calibration or clinical validation.
"""
from __future__ import annotations

import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import sklearn

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from preprocessing.longitudinal_features import feature_frame  # noqa: E402
from evaluation.metrics import classification_metrics  # noqa: E402

THRESHOLD_MMOL_L = 5.5
MIN_GAP_DAYS = 14
MAX_GAP_DAYS = 62
MODEL_KEY = "hyperkalemia"
MODEL_ID = "LK-RENAL-HYPERK-1.0"
MODEL_VERSION = "1.0.0"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_write(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=False), encoding="utf-8")


def main() -> None:
    data_path = ROOT / "data" / "deidentified_monthly.csv"
    split_path = ROOT / "reports" / "patient_split_manifest.json"
    artifact_dir = ROOT / "artifacts" / "hyperkalemia-risk"
    report_dir = ROOT / "reports" / "hyperkalemia-risk"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    frame = pd.read_csv(data_path)
    frame["observed_at"] = pd.to_datetime(frame["observed_at"], utc=True)
    frame = frame.sort_values(["patient_id", "observed_at"]).reset_index(drop=True)
    X = feature_frame(frame)

    next_k = frame.groupby("patient_id", sort=False)["potassium_pre"].shift(-1)
    target_date = frame.groupby("patient_id", sort=False)["observed_at"].shift(-1)
    gap_days = (target_date - frame["observed_at"]).dt.total_seconds() / 86400.0
    eligible = frame["potassium_pre"].notna() & next_k.notna() & gap_days.between(MIN_GAP_DAYS, MAX_GAP_DAYS)
    y = (next_k >= THRESHOLD_MMOL_L).astype(int)

    manifest = json.loads(split_path.read_text(encoding="utf-8"))
    partition_by_patient = {
        patient: partition
        for partition, details in manifest.items()
        for patient in details["patients"]
    }
    partition = frame["patient_id"].map(partition_by_patient)
    if partition.isna().any():
        raise RuntimeError("Packaged split manifest does not cover every cohort patient")

    feature_names = list(X.columns)
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", LogisticRegression(C=0.1, max_iter=3000, random_state=42)),
    ])

    train_mask = eligible & partition.eq("train")
    val_mask = eligible & partition.eq("validation")
    test_mask = eligible & partition.eq("test")
    pipeline.fit(X.loc[train_mask, feature_names], y.loc[train_mask])

    metrics = {}
    predictions = {}
    for name, mask in [("train", train_mask), ("validation", val_mask), ("test", test_mask)]:
        prob = pipeline.predict_proba(X.loc[mask, feature_names])[:, 1]
        metrics[name] = classification_metrics(y.loc[mask].to_numpy(), prob, threshold=0.5)
        metrics[name]["Prevalence"] = float(y.loc[mask].mean())
        predictions[name] = prob
        rows = frame.loc[mask, ["patient_id", "observed_at"]].copy()
        rows["target_date"] = target_date.loc[mask].to_numpy()
        rows["next_potassium_pre_mmol_l"] = next_k.loc[mask].to_numpy()
        rows["target_hyperkalemia_ge_5_5"] = y.loc[mask].to_numpy()
        rows["research_probability"] = prob
        rows["split"] = name
        rows.to_csv(report_dir / f"{name}_predictions.csv", index=False, date_format="%Y-%m-%d")

    # Pre-specified interpretable logistic research model. The held-out test is untouched until this point.
    val_auc = roc_auc_score(y.loc[val_mask], predictions["validation"])
    val_pr = average_precision_score(y.loc[val_mask], predictions["validation"])
    test_auc = roc_auc_score(y.loc[test_mask], predictions["test"])
    test_pr = average_precision_score(y.loc[test_mask], predictions["test"])

    transformed_test = pipeline[:-1].transform(X.loc[test_mask, feature_names])
    coef = pipeline.named_steps["model"].coef_[0]
    contributions = transformed_test * coef
    ranking = pd.DataFrame({
        "feature": feature_names,
        "mean_absolute_log_odds_contribution": np.abs(contributions).mean(axis=0),
        "coefficient": coef,
    }).sort_values("mean_absolute_log_odds_contribution", ascending=False)
    ranking.to_csv(report_dir / "top_features.csv", index=False)

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    top = ranking.head(15).sort_values("mean_absolute_log_odds_contribution")
    fig, ax = plt.subplots(figsize=(9, 6))
    ax.barh(top["feature"], top["mean_absolute_log_odds_contribution"])
    ax.set_xlabel("Mean absolute standardized log-odds contribution")
    ax.set_title("Held-out Sri Lankan research cohort: hyperkalemia model associations")
    fig.tight_layout()
    fig.savefig(report_dir / "shap_summary.png", dpi=180, bbox_inches="tight")
    plt.close(fig)

    joblib.dump(pipeline, artifact_dir / "model.joblib")
    artifact_hash = sha256(artifact_dir / "model.joblib")
    source_hash = sha256(data_path)
    now = datetime.now(timezone.utc).isoformat()

    limitations = [
        "Small single Sri Lankan maintenance-hemodialysis cohort; no external or prospective clinical validation.",
        "Research label is next pre-dialysis potassium >=5.5 mmol/L within the next observed 14–62 day interval; it is not a diagnosis or treatment threshold decision.",
        "Held-out discrimination is modest and probability calibration is not established; the output must be displayed as a research risk score only.",
        "Original raw data are absent from this packaged training run; upstream interpolation or preprocessing leakage cannot be fully excluded.",
        "Secondary research-use permission remains UNVERIFIED in the supplied project documentation.",
        "Medication exposure, dialysis prescription/dose, diet, residual kidney function and acute illness confounders are not available.",
        "Model output does not replace the separate rule-based current-potassium safety gate or clinician review.",
    ]
    partitions = {}
    for name, mask in [("train", train_mask), ("validation", val_mask), ("test", test_mask)]:
        partitions[name] = {
            "patients": int(frame.loc[mask, "patient_id"].nunique()),
            "observations": int(mask.sum()),
            "positive_events": int(y.loc[mask].sum()),
            "prevalence": float(y.loc[mask].mean()),
        }

    metadata = {
        "model_key": MODEL_KEY,
        "model": MODEL_ID,
        "model_version": MODEL_VERSION,
        "status": "RESEARCH_MODEL",
        "algorithm": "LogisticRegression",
        "served_method": "RESEARCH_MODEL",
        "accepted_for_experimental_forecast": True,
        "selection_reason": "Pre-specified interpretable logistic research baseline; no candidate was selected using held-out test performance.",
        "feature_names": feature_names,
        "feature_order": feature_names,
        "target": "Next chronological pre-dialysis potassium >=5.5 mmol/L for the same patient within 14–62 days",
        "target_definition": {"variable": "potassium_pre", "operator": ">=", "threshold": THRESHOLD_MMOL_L, "unit": "mmol/L"},
        "horizon_days": 30,
        "horizon_definition": "Next observed measurement 14–62 days; display anchor +30 days",
        "unit": "probability",
        "probability": "RESEARCH_RISK_SCORE_NOT_CLINICALLY_CALIBRATED",
        "threshold": THRESHOLD_MMOL_L,
        "population": "Sri Lankan maintenance-hemodialysis cohort (packaged de-identified longitudinal matrix)",
        "country": "Sri Lanka",
        "validation_status": "INTERNAL_RESEARCH_EVALUATION",
        "clinical_validation": "NOT_COMPLETED",
        "dataset_permission_status": "UNVERIFIED",
        "requires_clinician_review": True,
        "packaged_cleaned_dataset_sha256": source_hash,
        "source_dataset_sha256": source_hash,
        "artifact_sha256": artifact_hash,
        "training_date": now,
        "cleaned_observation_count": int(len(frame)),
        "eligible_observation_count": int(eligible.sum()),
        "cohort_patient_count": int(frame.patient_id.nunique()),
        "partitions": partitions,
        "group_split_manifest": "reports/patient_split_manifest.json",
        "group_split_seed": 42,
        "validation_seed": 43,
        "selection_uses_test": False,
        "research_validation_metrics": metrics["validation"],
        "research_test_metrics": metrics["test"],
        "research_test_discrimination": {"ROC_AUC": float(test_auc), "PR_AUC": float(test_pr)},
        "validation_discrimination": {"ROC_AUC": float(val_auc), "PR_AUC": float(val_pr)},
        "hyperparameters": pipeline.named_steps["model"].get_params(),
        "required_measurements": ["potassium_pre", "potassium_post", "creatinine_pre", "creatinine_post", "hb", "albumin", "calcium", "sodium", "urea_pre", "urea_post"],
        "limitations": limitations,
        "versions": {"python": platform.python_version(), "numpy": np.__version__, "pandas": pd.__version__, "scikit-learn": sklearn.__version__, "joblib": joblib.__version__},
        "xai": {"method": "LINEAR_SHAP_LOG_ODDS", "contribution_unit": "log-odds", "top_features": ranking.head(10).to_dict(orient="records")},
    }
    json_write(artifact_dir / "metadata.json", metadata)
    json_write(artifact_dir / "metrics.json", {"model": MODEL_ID, "metrics": metrics, "limitations": limitations})
    (report_dir / "README.md").write_text(
        "# Sri Lankan longitudinal hyperkalemia research model\n\n"
        f"Target: next pre-HD potassium >= {THRESHOLD_MMOL_L} mmol/L within 14–62 days.\n\n"
        f"Validation ROC-AUC: {val_auc:.4f}; validation PR-AUC: {val_pr:.4f}.\n"
        f"Held-out test ROC-AUC: {test_auc:.4f}; test PR-AUC: {test_pr:.4f}.\n\n"
        "This is internal retrospective research evaluation only. The returned probability is not clinically calibrated and must not be used as an autonomous diagnosis or treatment decision.\n",
        encoding="utf-8",
    )
    print(json.dumps({"artifact": str(artifact_dir), "partitions": partitions, "validation": metrics["validation"], "test": metrics["test"]}, indent=2))


if __name__ == "__main__":
    main()
