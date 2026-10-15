"""Bounded process-local counters. Never retain patient input or output values."""

from threading import Lock

from app.schemas import ModelDescriptor, ModelMonitoring, PredictionResult, PredictionStatus


class ModelMonitor:
    def __init__(self):
        self._lock = Lock()
        self._metrics: dict[str, dict] = {}

    def record(
        self,
        descriptor: ModelDescriptor,
        elapsed_ms: float,
        missing_inputs: bool,
        result: PredictionResult | None = None,
        failed: bool = False,
    ) -> None:
        with self._lock:
            item = self._metrics.setdefault(
                descriptor.modelKey,
                {
                    "requests": 0,
                    "predictions": 0,
                    "failures": 0,
                    "unavailable": 0,
                    "missing": 0,
                    "elapsed": 0.0,
                    "last_elapsed": 0.0,
                    "risks": {},
                },
            )
            item["requests"] += 1
            item["failures"] += int(failed)
            item["missing"] += int(missing_inputs)
            item["elapsed"] += max(0.0, elapsed_ms)
            item["last_elapsed"] = max(0.0, elapsed_ms)
            produced = result is not None and result.status in (
                PredictionStatus.AVAILABLE,
                PredictionStatus.NOT_LOCALLY_VALIDATED,
            )
            item["predictions"] += int(produced)
            item["unavailable"] += int(not produced and not failed)
            if produced and result.riskLevel:
                item["risks"][result.riskLevel] = item["risks"].get(result.riskLevel, 0) + 1

    def snapshot(self, descriptor: ModelDescriptor) -> ModelMonitoring:
        with self._lock:
            item = self._metrics.get(descriptor.modelKey)
            metadata = {
                "model_version": descriptor.modelVersion,
                "last_validation_date": descriptor.lastValidationDate,
            }
            if item is None:
                return ModelMonitoring(**metadata)
            return ModelMonitoring(
                **metadata,
                request_count=item["requests"],
                prediction_count=item["predictions"],
                failure_count=item["failures"],
                unavailable_count=item["unavailable"],
                input_missing_rate=item["missing"] / item["requests"],
                latency_ms=round(item["last_elapsed"], 3),
                mean_latency_ms=round(item["elapsed"] / item["requests"], 3),
                risk_distribution=dict(item["risks"]),
            )
