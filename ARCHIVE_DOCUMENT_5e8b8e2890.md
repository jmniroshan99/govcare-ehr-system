# CKD AI-CDSS integration

The attached `dataset.csv` was profiled and used to fit the embedded logistic model. `Diagnosis` was the target; `PatientID` and `DoctorInCharge` were excluded to prevent identity leakage. The service uses 17 validated numeric renal/metabolic features, standardized using training-set means and standard deviations, and stores every prediction with a model version, request ID, hospital, patient, input snapshot, contributing factors, and recommendations.

The model is decision support only and is not clinically validated. Thresholds are application risk bands and must be reviewed by an authorized clinician before clinical deployment.

Frontend route: `/ai-cdss/ckd`

Backend endpoints:

- `POST /api/ai-cdss/ckd/predict`
- `GET /api/ai-cdss/ckd/patients/{patientId}/predictions`

Migration: `V20__ai_ckd_predictions.sql`
