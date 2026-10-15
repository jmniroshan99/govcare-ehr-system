"""Explicit registry: inactive, missing and unreviewed models fail closed."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

from app.adapters import PredictiveRiskAdapter, UnavailableRiskAdapter
from app.schemas import ModelView, PredictionResult, PredictionStatus, ValidationStatus

from .catalog import default_descriptors


class UnknownModelError(KeyError):
    pass


@dataclass(frozen=True)
class RegistryEntry:
    adapter: PredictiveRiskAdapter
    active: bool = True
    governance_reviewed: bool = False


class ModelRegistry:
    def __init__(self, entries: Iterable[RegistryEntry] | None = None):
        defaults = (RegistryEntry(UnavailableRiskAdapter(item)) for item in default_descriptors())
        self._entries: dict[str, RegistryEntry] = {}
        for entry in defaults if entries is None else entries:
            key = entry.adapter.descriptor.modelKey
            if key in self._entries:
                raise ValueError(f"Duplicate registered model key: {key}")
            self._entries[key] = entry

    def keys(self) -> tuple[str, ...]:
        return tuple(self._entries)

    def get(self, model_key: str) -> RegistryEntry:
        try:
            return self._entries[model_key]
        except KeyError:
            raise UnknownModelError(model_key) from None

    def describe(self, model_key: str) -> ModelView:
        entry = self.get(model_key)
        descriptor = entry.adapter.descriptor
        values = descriptor.model_dump()
        values.update(installed=entry.adapter.installed, registryActive=entry.active,
                      governanceReviewed=entry.governance_reviewed)
        if not entry.active:
            values.update(reasonCode="REGISTRY_INACTIVE", reason="This adapter is inactive in the service registry; calculation is disabled.")
        elif not entry.adapter.installed:
            values.update(reasonCode="MODEL_NOT_INSTALLED")
        elif not entry.governance_reviewed:
            values.update(reasonCode="GOVERNANCE_REVIEW_REQUIRED", reason="This implementation has no recorded approval for use in the service registry.")
        elif not descriptor.modelVersion or descriptor.validationStatus == ValidationStatus.NOT_INSTALLED:
            values.update(reasonCode="MODEL_METADATA_INCOMPLETE", reason="Installed adapter metadata is incomplete; calculation is disabled.")
        else:
            locally_validated = descriptor.localValidationStatus == ValidationStatus.CLINICALLY_VALIDATED
            values.update(
                status=PredictionStatus.AVAILABLE if locally_validated else PredictionStatus.NOT_LOCALLY_VALIDATED,
                reasonCode="MODEL_REGISTERED",
            )
        return ModelView(**values)

    def predict(self, model_key: str, data: Mapping[str, Any]) -> PredictionResult:
        entry = self.get(model_key)
        view = self.describe(model_key)
        missing = entry.adapter.missing_inputs(data)
        initial = PredictionResult(**view.model_dump(), missingInputs=missing, inputAccepted=bool(data))
        if view.status == PredictionStatus.NOT_INSTALLED:
            # Do not call calculate or can_run for missing/inactive/unreviewed adapters.
            return initial
        if missing or not entry.adapter.can_run(data):
            return initial.model_copy(update={
                "status": PredictionStatus.INSUFFICIENT_DATA,
                "reasonCode": "INPUTS_NOT_ELIGIBLE",
                "reason": "Required model inputs are missing or failed adapter eligibility checks.",
            })
        result = entry.adapter.calculate(data)
        # Registry provenance is authoritative. An adapter cannot silently claim
        # local validation or override its installation / approval state.
        trusted = view.model_dump()
        trusted.update(result.model_dump(include={
            "probability", "twoYearRisk", "fiveYearRisk", "prediction", "riskLevel",
            "confidence", "forecastAllowed", "inputClinicallyValidated",
        }))
        trusted.update(inputAccepted=bool(data), missingInputs=[])
        if result.status not in (PredictionStatus.AVAILABLE, PredictionStatus.NOT_LOCALLY_VALIDATED):
            trusted.update(
                status=result.status, reason=result.reason, reasonCode=result.reasonCode,
                probability=None, twoYearRisk=None, fiveYearRisk=None, prediction=None,
                confidence=None, riskLevel=None, forecastAllowed=False,
            )
        return PredictionResult(**trusted)
