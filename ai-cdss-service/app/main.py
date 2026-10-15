"""Optional service boundary. Patient authorization remains in Spring Boot."""

import hmac
import os
from time import perf_counter
from typing import Annotated, Any

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.monitoring import ModelMonitor
from app.registry import ModelRegistry, UnknownModelError
from app.schemas import LegacyPredictionResult, ModelView, PredictionResult

SERVICE_VERSION = "0.3.0"


def authorize(x_service_token: Annotated[str | None, Header()] = None) -> None:
    expected = os.environ.get("GOVCARE_AI_SERVICE_TOKEN", "")
    if not expected.strip():
        raise HTTPException(status_code=503, detail="AI service authentication is not configured")
    if not x_service_token or not hmac.compare_digest(
        x_service_token.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Service authentication required")


def create_app(registry: ModelRegistry | None = None) -> FastAPI:
    registry = registry if registry is not None else ModelRegistry()
    monitor = ModelMonitor()
    application = FastAPI(title="GovCare AI-CDSS Model Service", version=SERVICE_VERSION)
    protected = APIRouter(dependencies=[Depends(authorize)])

    @application.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, exc: RequestValidationError):
        # Framework validation errors may otherwise echo a submitted patient body.
        return JSONResponse(status_code=422, content={
            "detail": [{"loc": list(error["loc"]), "type": error["type"], "msg": error["msg"]}
                       for error in exc.errors()]
        })

    @application.exception_handler(UnknownModelError)
    async def unknown_model(_request: Request, _exc: UnknownModelError):
        return JSONResponse(status_code=404, content={"detail": "Unknown model key"})

    @application.get("/health")
    def health():
        configured = bool(os.environ.get("GOVCARE_AI_SERVICE_TOKEN", "").strip())
        return {
            "status": "ready" if configured else "degraded",
            "service": "GovCare AI-CDSS Model Service",
            "version": SERVICE_VERSION,
            "authenticationConfigured": configured,
            "installedModelCount": sum(int(registry.get(key).adapter.installed) for key in registry.keys()),
            "clinicalPredictionReady": False,
        }

    def model_view(model_key: str) -> ModelView:
        view = registry.describe(model_key)
        return view.model_copy(update={"monitoring": monitor.snapshot(view)})

    @protected.get("/models", response_model=list[ModelView])
    def models():
        return [model_view(key) for key in registry.keys()]

    @protected.get("/models/{model_key}", response_model=ModelView)
    def model(model_key: str):
        return model_view(model_key)

    @protected.post("/predict/{model_key}", response_model=PredictionResult)
    def predict(model_key: str, data: dict[str, Any]):
        entry = registry.get(model_key)
        descriptor = entry.adapter.descriptor
        started = perf_counter()
        missing = False
        try:
            missing = bool(entry.adapter.missing_inputs(data))
            result = registry.predict(model_key, data)
        except Exception:
            # An unavailable adapter must not expose exception text or patient data.
            monitor.record(descriptor, (perf_counter() - started) * 1000, missing, failed=True)
            raise HTTPException(status_code=503, detail="Model adapter is unavailable") from None
        monitor.record(descriptor, (perf_counter() - started) * 1000, missing, result=result)
        return result.model_copy(update={"monitoring": monitor.snapshot(descriptor)})

    @protected.post("/predict", response_model=LegacyPredictionResult)
    def legacy_predict(data: dict[str, Any]):
        # Kept for old clients. No default model is implicitly selected or trained.
        return LegacyPredictionResult()

    application.include_router(protected)
    return application


app = create_app()
