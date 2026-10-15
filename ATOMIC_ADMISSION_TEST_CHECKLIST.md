# Atomic Admission Test Checklist

1. Open `/admissions/new`.
2. Search by patient number, NIC, passport, phone or name.
3. Select the correct patient and confirm identity.
4. Verify an existing active admission prevents a duplicate admission.
5. For a patient without an active admission, enter admission details.
6. Confirm incompatible, inactive or full wards cannot be selected.
7. Confirm only available beds from the selected ward are loaded.
8. Test bed-type and accessible-bed filters.
9. Confirm the final summary shows patient, admission, ward and bed.
10. Submit and verify admission number, active admission, occupied bed and active allocation in PostgreSQL.
11. Open the patient profile and confirm the “Currently admitted” location.
12. Open the Bed Board and confirm the occupied bed.
13. Open the Nurse Module, select the ward and confirm the patient appears.
14. Verify patient identity from the Nurse Module.
15. Attempt a second active admission for the same patient; expect HTTP 409.
16. Attempt concurrent assignment of the same bed; only one transaction may succeed.
17. Transfer the patient and verify the old bed becomes `CLEANING`.
18. Discharge the patient and verify the active allocation ends and the bed becomes `CLEANING`.
19. Mark the cleaned bed available using the existing bed-cleaning workflow.
20. Verify audit logs, movement history and nursing notification entries.
