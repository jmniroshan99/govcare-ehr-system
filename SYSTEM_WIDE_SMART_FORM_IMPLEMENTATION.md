# GovCare EHR System-Wide Smart Form Implementation

## Scope

This release introduces a shared controlled-selection and form-validation framework for the GovCare EHR React, Spring Boot and PostgreSQL application. Existing authentication, RBAC, patient records, clinical narratives, admission/ward/bed workflows, pharmacy verification, audit logging and Flyway history are preserved.

The implementation concentrates on high-frequency operational forms and provides reusable components and APIs that can be extended to future modules without duplicating option lists or search logic.

## Frontend architecture

Shared components are available under:

- `src/components/forms/`
- `src/components/selectors/`
- `src/data/referenceOptions.ts`
- `src/hooks/useDebouncedValue.ts`
- `src/services/referenceDataService.ts`

The framework provides:

- searchable and asynchronous searchable dropdowns;
- keyboard navigation, debounced search and clear/retry states;
- linked Hospital → Department → Ward → Available Bed selectors;
- linked Sri Lanka Province → District selection;
- multi-select chips for allergies and chronic diseases;
- Yes/No/Unknown controls;
- date, time, numeric, measurement, phone and identifier controls;
- searchable patient, admission, staff, medicine, diagnosis, laboratory and radiology selectors;
- dark-mode-compatible menus, focus states, disabled states and validation messages.

## Central reference data

Static typed reference data is centralised for values such as:

- title, gender, marital status, blood group and language;
- clinical priority, admission type and isolation requirement;
- smoking, alcohol and organ-donor status;
- medicine route, frequency, dose and duration units;
- specimen type, radiology modality and body region;
- measurement units and safe input ranges;
- all 9 Sri Lankan provinces and all 25 districts.

Dynamic operational values are loaded from PostgreSQL through secured Spring Boot endpoints.

## Backend reference APIs

The reference-data service supplies:

- province, district, country, blood-group and language reference values;
- hospital search and hospital-scoped department lists;
- department-scoped ward lists with availability state;
- patient and active-admission search;
- active staff search with hospital, department, role and permission filters;
- active hospital formulary search with available stock;
- diagnosis, laboratory-test and radiology-study catalog search.

Search endpoints apply result limits, hospital scoping, active-record filtering and parent-child validation. The server validates entity IDs instead of trusting display labels submitted by the browser.

## Database additions

Flyway migration `V15__system_wide_smart_form_reference_catalogs.sql` adds:

- `diagnosis_reference`;
- `laboratory_test_catalog`;
- `radiology_study_catalog`;
- search indexes;
- optional catalog foreign keys on laboratory and radiology requests;
- a small starter catalog and minimal hospital formulary where equivalent records do not already exist.

The migration is additive. Existing free-text diagnoses, test names, study names and historical records are retained. The diagnosis catalog is ready for an authorised full ICD-10 import; this package seeds common demonstration/reference codes rather than claiming to include the complete licensed national catalog.

## Updated operational forms

Controlled inputs and selectors are applied to:

- patient registration and self-registration;
- patient and user profile editing;
- staff management;
- appointments;
- atomic inpatient admission;
- admissions management entry point;
- internal and inter-hospital transfer;
- ward bed allocation;
- nurse vital-sign recording;
- doctor workspace vital signs, medicines, laboratory and radiology orders;
- e-prescription medicine, diagnosis, route, frequency and duration entry;
- medical decision doctor assignment;
- report filtering.

The e-prescription workflow records the authenticated prescriber and hospital rather than a hard-coded demonstration doctor.

## Narrative fields preserved

Clinical narrative fields remain free text, including:

- presenting complaint;
- clinical indication;
- provisional diagnosis narrative;
- assessment and treatment plan;
- admission and transfer reasons;
- progress notes;
- pharmacist notes;
- radiology findings;
- discharge summary.

This avoids forcing nuanced clinical decisions into incomplete option lists.

## Compatibility

- No existing migration is edited or reordered.
- Existing data is not deleted.
- Existing text values remain readable.
- JWT authentication and RBAC remain unchanged.
- Previous patient-age, pharmacy, ward/bed, nurse and dark-mode fixes are retained.
