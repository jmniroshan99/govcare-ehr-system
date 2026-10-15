# GovCare EHR - HL7 FHIR R4 Architecture Base

This package introduces the FHIR R4 migration foundation.

Architecture:
Application Modules -> FHIR Service Layer -> FHIR Resources -> Database

Planned resources:
- Patient
- Encounter
- Observation
- Condition
- MedicationRequest
- DiagnosticReport
- ClinicalImpression
- AuditEvent
- Organization
- Practitioner

Migration principle:
Existing entities remain the source data. They are mapped into FHIR-compatible resources without duplicate patient creation.

Required next implementation stages:
1. Add HAPI FHIR R4 server dependency
2. Create FHIR mapping services
3. Add FHIR resource persistence
4. Add validation interceptor
5. Expose /fhir REST endpoints
6. Migrate module by module
