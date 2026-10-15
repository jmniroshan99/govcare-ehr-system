FHIR service layer location.

Implement:
- FHIRResourceManager
- FHIRValidationService
- FHIRMappingService
- FHIRApiController

Target endpoints:
GET /fhir/{resourceType}/{id}
POST /fhir/{resourceType}
PUT /fhir/{resourceType}/{id}
DELETE /fhir/{resourceType}/{id}
