"""Stable seam for future reviewed adapters, independent of ML libraries."""

from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import Any

from app.schemas import ModelDescriptor, PredictionResult


class PredictiveRiskAdapter(ABC):
    @property
    @abstractmethod
    def descriptor(self) -> ModelDescriptor:
        """Return immutable model, input, horizon and validation metadata."""

    @property
    @abstractmethod
    def installed(self) -> bool:
        """True only for an intentionally installed implementation/artifact."""

    def missing_inputs(self, data: Mapping[str, Any]) -> list[str]:
        # This only checks presence. Future adapters must validate types, units,
        # timestamps, provenance and model-specific eligibility in can_run.
        return [
            name
            for name in self.descriptor.requiredInputs
            if name not in data
            or data[name] is None
            or (isinstance(data[name], str) and not data[name].strip())
            or (isinstance(data[name], (list, dict)) and not data[name])
        ]

    @abstractmethod
    def can_run(self, data: Mapping[str, Any]) -> bool:
        """Validate model-specific inputs and safety before any calculation."""

    @abstractmethod
    def calculate(self, data: Mapping[str, Any]) -> PredictionResult:
        """Calculate only after registry, governance and input gates succeed."""


class UnavailableRiskAdapter(PredictiveRiskAdapter):
    def __init__(self, descriptor: ModelDescriptor):
        self._descriptor = descriptor

    @property
    def descriptor(self) -> ModelDescriptor:
        return self._descriptor

    @property
    def installed(self) -> bool:
        return False

    def can_run(self, data: Mapping[str, Any]) -> bool:
        return False

    def calculate(self, data: Mapping[str, Any]) -> PredictionResult:
        return PredictionResult(
            **self.descriptor.model_dump(),
            missingInputs=self.missing_inputs(data),
            inputAccepted=bool(data),
        )
