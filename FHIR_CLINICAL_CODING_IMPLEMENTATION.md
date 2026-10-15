# GovCare FHIR R4 Clinical Coding & Terminology Engine

Implemented as a compatibility layer; existing workflows/tables are preserved.

## Added
- HAPI FHIR R4 parser/model dependency.
- Flyway V26: `fhir_resource`, `fhir_terminology`, `fhir_condition`, `fhir_observation`, `fhir_medication`.
- CKD ICD-10 catalogue and CKD-relevant LOINC catalogue.
- Authenticated terminology endpoints: `/fhir/CodeSystem/search`, `/fhir/ValueSet/search`, `/fhir/$validate-code`.
- Authenticated generic R4 resource CRUD: `/fhir/{resourceType}` and `/fhir/{resourceType}/{id}`.
- FHIR resource parser/type validation and versioned JSON persistence.
- `TerminologyService`, `FHIRCodeValidationService`, `FHIRMappingService`, `ClinicalCodingService`, `FHIRResourceManager`.
- Reusable React `ClinicalCodeSelector` with 400 ms debounce, keyboard navigation, validation, and clear action.

## Safety / scope
The bundled catalogue contains only the explicitly configured CKD ICD-10 and LOINC concepts. SNOMED CT and RxNorm are architecturally supported by canonical system URIs, but no unlicensed or fabricated terminology content is seeded. Production deployments should connect an authorized terminology server/package and validate against the applicable national implementation guide.

Existing patient rows are not duplicated. `fhir_resource` is a projection/interoperability store and is hospital-scoped.
