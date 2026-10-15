# E-Prescription Hospital ID Build Fix

The TypeScript production build previously failed in `src/pages/EPrescription.tsx` because `profile?.hospitalId ?? selectedPatient.hospitalId` had type `string | undefined`, while `CreatePrescriptionFromConsultationPayload.hospitalId` requires a definite `string`.

The signing workflow now resolves the hospital ID before creating the payload. If neither the authenticated profile nor the selected patient supplies a hospital, signing is stopped with a clear user-visible message. Once the guard passes, TypeScript narrows `hospitalId` to `string` and the payload remains hospital-scoped without introducing a hard-coded fallback hospital.
