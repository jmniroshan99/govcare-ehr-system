# AI Intelligence Center Integration

Added `/ai-dashboard` as a full-stack clinical decision-support interface while preserving the existing AI-CDSS and CKD modules.

## Added
- React AI Intelligence Center with six prediction workflows: CKD, diabetes, cardiovascular, sepsis, readmission and length-of-stay.
- Spring Boot `/api/ai/dashboard`, `/api/ai/predict/{module}`, and `/api/ai/history/{patientId}` endpoints.
- Flyway V25 tables for predictions, model registry, recommendations and audit logging.
- Patient-linked persistence, hospital scoping and authenticated user audit attribution.
- Development rule-based prediction engine with explicit clinical decision-support warning.

## Important
The new multi-model engine is a development CDSS scaffold, not a validated diagnostic model. Replace the rule engine with validated/versioned ML services before clinical deployment and retain clinician review, calibration, monitoring and model-governance controls.
