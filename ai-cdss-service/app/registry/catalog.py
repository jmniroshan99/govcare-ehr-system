"""Declared future contracts. None of these definitions installs a model."""

from app.schemas import ForecastMethod, ModelDescriptor


def default_descriptors() -> tuple[ModelDescriptor, ...]:
    return (
        ModelDescriptor(
            modelKey="ckd_progression",
            modelName="CKD progression research adapter",
            targetOutcome="CKD_PROGRESSION",
            method=ForecastMethod.RESEARCH_MODEL,
            requiredInputs=("dated_egfr_series", "acr", "age"),
            forecastHorizonMonths=(3, 6, 12),
            reason="No reviewed CKD progression ML artifact is installed. EHR trend projection is provided separately by the Spring clinical layer.",
        ),
        ModelDescriptor(
            modelKey="kfre",
            modelName="Kidney failure equation adapter",
            targetOutcome="KIDNEY_FAILURE",
            method=ForecastMethod.VALIDATED_EQUATION,
            requiredInputs=("age", "sex", "egfr", "acr"),
            forecastHorizonMonths=(24, 60),
            reason="No reviewed kidney-failure equation implementation is installed. Equation choice, applicability and references require review.",
        ),
        ModelDescriptor(
            modelKey="aki",
            modelName="AKI research adapter",
            targetOutcome="AKI",
            method=ForecastMethod.RESEARCH_MODEL,
            requiredInputs=("dated_creatinine_series", "dated_egfr_series", "acute_illness_context", "medications"),
            reason="No future AKI probability model is installed. Current renal safety gates run separately in the Spring clinical layer.",
        ),
        ModelDescriptor(
            modelKey="hyperkalemia",
            modelName="Hyperkalemia research adapter",
            targetOutcome="HYPERKALEMIA",
            method=ForecastMethod.RESEARCH_MODEL,
            requiredInputs=("dated_potassium_series", "dated_egfr_series", "medications"),
            reason="No hyperkalemia probability model is installed. The Spring clinical layer provides a separate rule-based review signal.",
        ),
        ModelDescriptor(
            modelKey="anemia",
            modelName="Anemia research adapter",
            targetOutcome="ANEMIA",
            method=ForecastMethod.RESEARCH_MODEL,
            requiredInputs=("dated_hemoglobin_series", "dated_egfr_series", "age", "sex"),
            reason="No anemia probability model is installed. The Spring clinical layer provides a separate anemia review signal, not a diagnosis.",
        ),
        ModelDescriptor(
            modelKey="cardiovascular",
            modelName="Cardiovascular equation adapter",
            targetOutcome="CARDIOVASCULAR",
            method=ForecastMethod.VALIDATED_EQUATION,
            requiredInputs=("age", "sex", "systolic_bp", "total_cholesterol", "hdl_cholesterol", "smoking_status", "diabetes_status", "antihypertensive_treatment"),
            reason="No reviewed cardiovascular equation is installed. Listed candidate inputs are preliminary; an equation and its applicability have not been selected.",
        ),
        ModelDescriptor(
            modelKey="hospitalization",
            modelName="Hospitalization research adapter",
            targetOutcome="HOSPITALIZATION",
            method=ForecastMethod.RESEARCH_MODEL,
            requiredInputs=("dated_encounter_history", "dated_egfr_series", "comorbidities", "medications"),
            reason="No hospitalization research model is installed. Its horizon and complete input specification await a reviewed model.",
        ),
    )
