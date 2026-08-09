# Smart Form Test Checklist

## Reference and location data

- [ ] All 9 Sri Lankan provinces are available.
- [ ] All 25 districts are available.
- [ ] Province selection filters districts correctly.
- [ ] District selection can infer its province.
- [ ] An invalid province/district pair is rejected by Spring Boot.
- [ ] Country search is case-insensitive and limited.

## Entity relationships

- [ ] Hospital selection loads only its active departments.
- [ ] Department selection loads only its wards.
- [ ] Closed, inactive and full wards appear disabled.
- [ ] Ward selection loads only available beds.
- [ ] A forged department, ward or bed ID is rejected.
- [ ] Non-super-admin users cannot search another hospital.

## Search controls

- [ ] Patient, admission, staff and medicine search are debounced.
- [ ] Search supports partial names, codes and identifiers.
- [ ] Loading, no-results, error, retry and clear states display correctly.
- [ ] Arrow keys, Enter, Escape and Tab work.
- [ ] Large lists are paged/limited and are not fully loaded into the browser.

## Patient and staff forms

- [ ] DOB cannot be in the future.
- [ ] Age updates automatically from DOB.
- [ ] NIC, passport, phone and email validate only when entered.
- [ ] Optional fields may remain blank.
- [ ] Required fields cannot be skipped.
- [ ] Blood group, gender, title, marital status and language use controlled values.
- [ ] Staff search stores the staff ID, not only a display name.

## Clinical and pharmacy forms

- [ ] Diagnosis search returns code and description.
- [ ] Medicine search returns generic/brand, strength, form and stock context.
- [ ] Prescription route, frequency and duration controls work.
- [ ] Authenticated prescriber ID, name, department and hospital are recorded.
- [ ] Laboratory requests store `test_catalog_id` and preserve the test text.
- [ ] Radiology requests store `study_catalog_id` and preserve the study text.
- [ ] Narrative clinical fields remain editable free text.

## Measurements

- [ ] Numeric fields reject alphabetic input.
- [ ] Temperature, pulse, BP, respiratory rate, SpO2, height and weight show units.
- [ ] Invalid ranges display a clear error and are not silently changed.
- [ ] Dark-mode validation and critical warnings remain readable.

## Build and migration

- [ ] `npm install`
- [ ] `npm run build`
- [ ] `npm run spring:build`
- [ ] Flyway validates migrations V1–V15.
- [ ] V15 applies without deleting legacy data.
- [ ] Existing pharmacy, ward/bed, admission and nurse workflows still pass regression checks.
