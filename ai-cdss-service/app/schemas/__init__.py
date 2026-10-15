"""Explicit availability and provenance contracts; no prediction is implied."""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ForecastMethod(str, Enum):
    TREND_PROJECTION = "TREND_PROJECTION"
    VALIDATED_EQUATION = "VALIDATED_EQUATION"
    RULE_BASED = "RULE_BASED"
    RESEARCH_MODEL = "RESEARCH_MODEL"


class PredictionStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    NOT_LOCALLY_VALIDATED = "NOT_LOCALLY_VALIDATED"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    NOT_INSTALLED = "NOT_INSTALLED"
    BLOCKED_BY_SAFETY_GATE = "BLOCKED_BY_SAFETY_GATE"


class ValidationStatus(str, Enum):
    NOT_INSTALLED = "NOT_INSTALLED"
    NOT_LOCALLY_VALIDATED = "NOT_LOCALLY_VALIDATED"
    CLINICALLY_VALIDATED = "CLINICALLY_VALIDATED"


class ModelDescriptor(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    modelKey: str
    modelName: str
    modelVersion: str | None = None
    adapterVersion: str = "1.0.0"
    targetOutcome: str
    method: ForecastMethod
    validationStatus: ValidationStatus = ValidationStatus.NOT_INSTALLED
    localValidationStatus: ValidationStatus = ValidationStatus.NOT_LOCALLY_VALIDATED
    requiredInputs: tuple[str, ...]
    inputSpecificationStatus: str = "PRELIMINARY_ADAPTER_CONTRACT"
    forecastHorizonMonths: tuple[int, ...] = ()
    reference: str | None = None
    lastValidationDate: str | None = None
    reason: str


class ModelMonitoring(BaseModel):
    request_count: int = 0
    prediction_count: int = 0
    failure_count: int = 0
    unavailable_count: int = 0
    input_missing_rate: float | None = None
    latency_ms: float | None = None
    mean_latency_ms: float | None = None
    risk_distribution: dict[str, int] = Field(default_factory=dict)
    model_version: str | None = None
    data_drift_status: str = "NOT_EVALUATED"
    last_validation_date: str | None = None
    persistence: str = "PROCESS_LOCAL_NOT_A_CLINICAL_AUDIT"


class ModelView(ModelDescriptor):
    status: PredictionStatus = PredictionStatus.NOT_INSTALLED
    installed: bool = False
    registryActive: bool = True
    governanceReviewed: bool = False
    reasonCode: str = "MODEL_NOT_INSTALLED"
    monitoring: ModelMonitoring = Field(default_factory=ModelMonitoring)


class PredictionResult(ModelView):
    probability: float | None = Field(default=None, ge=0, le=1)
    twoYearRisk: float | None = Field(default=None, ge=0, le=1)
    fiveYearRisk: float | None = Field(default=None, ge=0, le=1)
    prediction: str | None = None
    riskLevel: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    missingInputs: list[str] = Field(default_factory=list)
    inputAccepted: bool = False
    inputClinicallyValidated: bool = False
    forecastAllowed: bool = False


class LegacyPredictionResult(BaseModel):
    status: PredictionStatus = PredictionStatus.NOT_INSTALLED
    method: ForecastMethod = ForecastMethod.RESEARCH_MODEL
    validationStatus: ValidationStatus = ValidationStatus.NOT_INSTALLED
    localValidationStatus: ValidationStatus = ValidationStatus.NOT_LOCALLY_VALIDATED
    modelVersion: None = None
    risk_level: None = None
    confidence: None = None
    probability: None = None
    twoYearRisk: None = None
    fiveYearRisk: None = None
    prediction: None = None
    factors: list[str] = Field(default_factory=list)
    reason: str = (
        "No default predictive model is installed. Call /predict/{modelKey} "
        "for an explicitly registered model."
    )
