"""Public catalogue, fail-closed, authentication and privacy contracts."""

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.adapters import PredictiveRiskAdapter
from app.main import create_app
from app.registry import ModelRegistry, RegistryEntry
from app.schemas import ForecastMethod, ModelDescriptor, PredictionResult, PredictionStatus, ValidationStatus


MODEL_KEYS = {
    "ckd_progression", "kfre", "aki", "hyperkalemia", "anemia", "cardiovascular", "hospitalization"
}


class SyntheticReviewedAdapter(PredictiveRiskAdapter):
    """Isolated test seam; it is never included in the production catalogue."""
    def __init__(self, locally_validated=True):
        self.calls = []
        self._descriptor = ModelDescriptor(
            modelKey="synthetic_test_only", modelName="Synthetic registry contract adapter", modelVersion="test-1",
            targetOutcome="TEST_ONLY", method=ForecastMethod.RESEARCH_MODEL, requiredInputs=("test_input",),
            validationStatus=ValidationStatus.CLINICALLY_VALIDATED,
            localValidationStatus=(ValidationStatus.CLINICALLY_VALIDATED if locally_validated else ValidationStatus.NOT_LOCALLY_VALIDATED),
            reason="Test-only adapter for registry gating."
        )

    @property
    def descriptor(self):
        return self._descriptor

    @property
    def installed(self):
        return True

    def can_run(self, data):
        self.calls.append("can_run")
        return True

    def calculate(self, data):
        self.calls.append("calculate")
        return PredictionResult(**self.descriptor.model_dump(), status=PredictionStatus.AVAILABLE,
                                probability=0.25, forecastAllowed=True)


class CatalogContractTests(unittest.TestCase):
    def setUp(self):
        self.token = "test-service-token"
        self.environment = patch.dict(os.environ, {"GOVCARE_AI_SERVICE_TOKEN": self.token})
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def request_headers(self):
        return {"X-Service-Token": self.token}

    def test_every_advertised_model_declares_inputs(self):
        with TestClient(create_app()) as client:
            response = client.get("/models", headers=self.request_headers())
        self.assertEqual(200, response.status_code)
        self.assertEqual(MODEL_KEYS, {model["modelKey"] for model in response.json()})
        for model in response.json():
            with self.subTest(model=model["modelKey"]):
                self.assertGreater(len(model["requiredInputs"]), 0)
                self.assertEqual("NOT_INSTALLED", model["status"])
                self.assertFalse(model["installed"])
                self.assertEqual("NOT_INSTALLED", model["validationStatus"])
                self.assertEqual("NOT_LOCALLY_VALIDATED", model["localValidationStatus"])

    def test_health_is_explicit_about_readiness(self):
        with TestClient(create_app()) as client:
            ready = client.get("/health")
        self.assertEqual(200, ready.status_code)
        self.assertEqual("ready", ready.json()["status"])
        self.assertTrue(ready.json()["authenticationConfigured"])
        self.assertEqual(0, ready.json()["installedModelCount"])
        self.assertFalse(ready.json()["clinicalPredictionReady"])

        with patch.dict(os.environ, {"GOVCARE_AI_SERVICE_TOKEN": ""}):
            with TestClient(create_app()) as client:
                degraded = client.get("/health")
                protected = client.get("/models", headers=self.request_headers())
        self.assertEqual("degraded", degraded.json()["status"])
        self.assertFalse(degraded.json()["authenticationConfigured"])
        self.assertEqual(503, protected.status_code)

    def test_protected_endpoints_reject_missing_or_wrong_token(self):
        with TestClient(create_app()) as client:
            missing = client.get("/models")
            wrong = client.get("/models", headers={"X-Service-Token": "wrong"})
        self.assertEqual(401, missing.status_code)
        self.assertEqual(401, wrong.status_code)

    def test_every_prediction_adapter_fails_closed_without_fabricated_values(self):
        sentinel = "sensitive-patient-value-7291"
        with TestClient(create_app()) as client:
            models = client.get("/models", headers=self.request_headers()).json()
            for model in models:
                body = {name: sentinel for name in model["requiredInputs"]}
                response = client.post(
                    f"/predict/{model['modelKey']}", headers=self.request_headers(), json=body
                )
                with self.subTest(model=model["modelKey"]):
                    self.assertEqual(200, response.status_code)
                    result = response.json()
                    self.assertEqual("NOT_INSTALLED", result["status"])
                    self.assertIsNone(result["probability"])
                    self.assertIsNone(result["twoYearRisk"])
                    self.assertIsNone(result["fiveYearRisk"])
                    self.assertIsNone(result["prediction"])
                    self.assertFalse(result["forecastAllowed"])
                    self.assertNotIn(sentinel, response.text)

            monitored = client.get("/models/ckd_progression", headers=self.request_headers())
        self.assertEqual(200, monitored.status_code)
        self.assertEqual(1, monitored.json()["monitoring"]["request_count"])
        self.assertEqual(1, monitored.json()["monitoring"]["unavailable_count"])
        self.assertNotIn(sentinel, monitored.text)
        self.assertEqual("PROCESS_LOCAL_NOT_A_CLINICAL_AUDIT", monitored.json()["monitoring"]["persistence"])

    def test_unknown_model_is_a_sanitized_not_found(self):
        with TestClient(create_app()) as client:
            response = client.get("/models/not-a-real-model", headers=self.request_headers())
        self.assertEqual(404, response.status_code)
        self.assertEqual({"detail": "Unknown model key"}, response.json())

    def test_legacy_endpoint_does_not_select_an_implicit_model(self):
        with TestClient(create_app()) as client:
            response = client.post("/predict", headers=self.request_headers(), json={"egfr": 42})
        self.assertEqual(200, response.status_code)
        self.assertEqual("NOT_INSTALLED", response.json()["status"])
        self.assertIsNone(response.json()["probability"])

    def test_validation_errors_do_not_echo_submitted_patient_values(self):
        sentinel = "patient-secret-5f1048"
        with TestClient(create_app()) as client:
            response = client.post(
                "/predict/ckd_progression", headers=self.request_headers(), json=[sentinel]
            )
        self.assertEqual(422, response.status_code)
        self.assertNotIn(sentinel, response.text)

    def test_inactive_or_unreviewed_installed_adapter_is_never_executed(self):
        for active, reviewed, reason_code in (
            (False, True, "REGISTRY_INACTIVE"),
            (True, False, "GOVERNANCE_REVIEW_REQUIRED"),
        ):
            with self.subTest(active=active, reviewed=reviewed):
                adapter = SyntheticReviewedAdapter()
                registry = ModelRegistry([RegistryEntry(adapter, active=active, governance_reviewed=reviewed)])
                result = registry.predict(adapter.descriptor.modelKey, {"test_input": 1})
                self.assertEqual(PredictionStatus.NOT_INSTALLED, result.status)
                self.assertEqual(reason_code, result.reasonCode)
                self.assertEqual([], adapter.calls)
                self.assertIsNone(result.probability)

    def test_reviewed_adapter_provenance_controls_runtime_status(self):
        adapter = SyntheticReviewedAdapter(locally_validated=True)
        registry = ModelRegistry([RegistryEntry(adapter, active=True, governance_reviewed=True)])

        result = registry.predict(adapter.descriptor.modelKey, {"test_input": 1})

        self.assertEqual(PredictionStatus.AVAILABLE, result.status)
        self.assertEqual(["can_run", "calculate"], adapter.calls)
        self.assertEqual(0.25, result.probability)
        self.assertEqual("MODEL_REGISTERED", result.reasonCode)


if __name__ == "__main__":
    unittest.main()
