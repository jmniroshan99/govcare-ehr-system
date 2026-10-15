# Clinical workspace permission matrix

This matrix concerns the new clinical workspace only. Existing dashboards and workflows retain their current roles and permissions. There are no new wildcard grants or role/account changes.

| Role | New workspace / trends / capability checks | Verified entry / clinician review | Patient scope |
| --- | --- | --- | --- |
| Super Admin (`super_admin`) | PATIENT_VIEW and PATIENT_VIEW_CLINICAL | Clinical read plus CONSULTATION_CREATE or CONSULTATION_UPDATE | Authorized network; stored patient hospital determines scope. |
| Hospital Admin (`hospital_admin`) | Denied | Denied | Existing administrative workflows retained. |
| Doctor (`doctor`) | PATIENT_VIEW_CLINICAL | Clinical read plus CONSULTATION_CREATE or CONSULTATION_UPDATE | Own hospital and assigned clinical relationship. |
| Nurse (`nurse`) | Denied | Denied | Existing nurse/ward access retained. |
| Front Desk (`receptionist`) | Denied | Denied | Existing registration/queue access retained. |
| OPD Officer (`opd_officer`) | Denied | Denied | Existing OPD access retained. |
| Ward Manager (`ward_manager`) | Denied | Denied | Existing ward access retained. |
| Laboratory Technician (`lab_technician`) | Denied | Denied | Existing laboratory access retained. |
| Radiology Technician (`radiology_technician`) | Denied | Denied | Existing radiology access retained. |
| Pharmacist (`pharmacist`) | Denied | Denied | Existing prescription/pharmacy access retained. |
| Inventory Officer (`inventory_officer`) | Denied | Denied | Existing inventory access retained. |
| Finance Officer (`finance_officer`) | Denied | Denied | Existing finance access retained. |
| Records Officer (`records_officer`) | Denied | Denied | Existing records access retained. |
| Patient (`patient`) | Denied | Denied | Own existing portal records only. |
| Guardian (`guardian`) | Denied | Denied | Existing authorized portal boundary retained. |
| Emergency Staff (`emergency_staff`) | Denied | Denied | Existing emergency workflows retained. |
| Quality Officer (`quality_officer`) | Denied | Denied | Existing quality/audit access retained. |
| IT Administrator (`ict_admin`) | Denied | Denied | Existing IT workflows retained. |
| Surgeon (`surgeon`) | PATIENT_VIEW_CLINICAL | Clinical read plus CONSULTATION_CREATE or CONSULTATION_UPDATE | Own hospital and assigned clinical relationship. |
| Anesthetist (`anesthetist`) | PATIENT_VIEW_CLINICAL | Clinical read plus CONSULTATION_CREATE or CONSULTATION_UPDATE | Own hospital and assigned clinical relationship. |
| Pathologist / Lab Manager / Radiologist | Denied | Denied | Existing department permissions retained. |

Active accounts with completed temporary-password changes are required. A wildcard permission does not allow a prohibited role through the clinical role boundary. The frontend route, sidebar and CKD navigation link follow the same role restriction; the server independently checks patient access before every query/write.

Assignments reuse existing `ClinicalPatientAccess` relationships: doctor-associated visits, consultations, prescriptions, requested laboratory/radiology work or a qualifying consultant admission. No client assignment/hospital claims are accepted.

The new module intentionally does not expand hospital-admin, nurse, patient or guardian access into the clinician's detailed intelligence workspace. Extending it to additional care roles would require an explicit backend assignment policy and separate patient-centered presentation.
