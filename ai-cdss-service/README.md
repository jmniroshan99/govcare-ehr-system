# GovCare AI-CDSS Model Service

Safe model-serving scaffold for outcome-specific predictive adapters.

## Endpoints
- `GET /health`
- `GET /models` (requires `X-Service-Token`)
- `GET /models/{modelKey}`
- `POST /predict/{modelKey}`
- `POST /predict` legacy compatibility endpoint

The service intentionally returns `NOT_INSTALLED` until a reviewed model/equation adapter is activated. It must never fabricate a probability to satisfy the UI.

## Local verification

```bash
python -m pip install -r requirements-dev.txt
pytest -q
```

Set `GOVCARE_AI_SERVICE_TOKEN` before starting the service. `/health` is deliberately `degraded` while authentication is unconfigured, and every other endpoint requires the token in `X-Service-Token`. Process-local counters never retain submitted patient values and are not a substitute for the Spring clinical audit trail.
