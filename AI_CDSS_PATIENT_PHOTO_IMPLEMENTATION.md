# AI-CDSS CKD Patient Photo Integration

Implemented on `/ai-cdss/ckd`.

- Reuses the existing `patients.profile_photo_url` field and `PatientPhoto` component.
- No duplicate photo database or AI-CDSS-specific image copy is created.
- Authorized patient results now expose existing photo, gender, NIC and update metadata already returned by the patient API.
- Selected patient card shows real photo with initials fallback, patient name/number, DOB, calculated age, gender and NIC when present.
- CKD result panel repeats a compact identity header to reduce wrong-patient risk.
- Age is calculated from date of birth via the existing `calculateAgeYears` helper.
- Broken/missing images automatically fall back to initials through the existing `PatientPhoto` implementation.
- Existing patient authorization, PDF autofill, draft and CKD prediction workflows are unchanged.

No dummy/random profile images were added.
