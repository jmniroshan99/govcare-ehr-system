# GovCare Entity to FHIR Mapping

PatientEntity -> Patient
Visit/Admission -> Encounter
Vital signs -> Observation
Laboratory results -> Observation + DiagnosticReport
Diagnosis -> Condition
Prescription -> MedicationRequest
AIResult -> ClinicalImpression
AI reports -> DiagnosticReport
Users -> Practitioner / PractitionerRole
Hospital/Ward -> Organization / Location
Audit logs -> AuditEvent
