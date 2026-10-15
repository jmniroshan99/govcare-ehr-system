# GovCare Dashboard Role and Permission Matrix

This matrix describes the dashboard layer. Existing module permissions remain authoritative for all CRUD and workflow APIs.

The current Super Admin patient directory and AI access extension is described in
[SUPERADMIN_NETWORK_ACCESS_FIX.md](SUPERADMIN_NETWORK_ACCESS_FIX.md). Network dashboard charts
remain aggregate views; the separate patient directory permits Super Admin to access patient records
across hospitals with `PATIENT_VIEW`, clinical data with `PATIENT_VIEW_CLINICAL`, and AI writes with
`CONSULTATION_CREATE` or `CONSULTATION_UPDATE`. These permissions do not grant other roles network access.

Every dashboard requires `DASHBOARD_VIEW`. A builder with a missing content permission returns
Data unavailable with reason `not_authorized` before reading its data sources. All listed permissions
are required; `*` is accepted by the service for explicit privileged profiles.

| Requested role | Canonical role | Dashboard | Required content permissions | Data scope |
| --- | --- | --- | --- | --- |
| Super Admin | `super_admin` | Network / selected hospital | USER_VIEW, PATIENT_VIEW, QUEUE_VIEW, ADMISSION_VIEW, AUDIT_VIEW, LOGIN_ACTIVITY_VIEW, LAB_REQUEST_VIEW | Network or validated selected hospital; aggregates |
| Hospital Admin | `hospital_admin` | Hospital operations | QUEUE_VIEW, ADMISSION_VIEW, BED_VIEW, USER_VIEW, PRESCRIPTION_VIEW, LAB_REQUEST_VIEW | Assigned hospital |
| Doctor | `doctor` | Clinical decisions | CONSULTATION_VIEW, PATIENT_VIEW_CLINICAL, APPOINTMENT_VIEW, QUEUE_VIEW, PRESCRIPTION_VIEW, LAB_REQUEST_VIEW, RADIOLOGY_REQUEST_VIEW | Assigned clinician relationships in assigned hospital |
| Nurse | `nurse` | Nursing readiness | No patient data until assignment source exists | No hospital-wide patient list or statistics |
| Front Desk Officer | `receptionist` | Arrival / registration | QUEUE_VIEW, APPOINTMENT_VIEW, PATIENT_VIEW | Assigned hospital access workflow |
| OPD Officer | `opd_officer` | OPD flow | QUEUE_VIEW, APPOINTMENT_VIEW, PATIENT_VIEW | Assigned hospital current queue |
| Ward Manager | `ward_manager` | Ward operations | WARD_VIEW, ADMISSION_VIEW, BED_VIEW, WARD_PATIENT_LIST, PATIENT_VIEW_CLINICAL | Hospital capacity; patient identities only in assigned department |
| Laboratory Technician | `lab_technician` | Laboratory | LAB_REQUEST_VIEW, PATIENT_VIEW | Assigned hospital laboratory work |
| Radiology Technician | `radiology_technician` | Imaging | RADIOLOGY_REQUEST_VIEW, PATIENT_VIEW | Assigned hospital imaging work |
| Pharmacist | `pharmacist` | Medication operations | PRESCRIPTION_VIEW, PATIENT_VIEW | Assigned hospital prescription workflow |
| Inventory Officer | `inventory_officer` | Inventory | INVENTORY_VIEW | Assigned hospital stock; no patient identities |
| Finance Officer | `finance_officer` | Finance readiness | FINANCE_VIEW | No billing data until ledger exists |
| Records Officer | `records_officer` | Records | PATIENT_VIEW | Assigned hospital demographics |
| Patient | `patient` | Personal health | PATIENT_VIEW_SELF, APPOINTMENT_VIEW, PRESCRIPTION_VIEW, LAB_REQUEST_VIEW, RADIOLOGY_REQUEST_VIEW | Authenticated patient identity; released records |
| Guardian | `guardian` | Dependent care readiness | No patient data until trusted link exists | No patient records in this release |
| Emergency Staff | `emergency_staff` | Emergency coordination | EMERGENCY_VIEW, QUEUE_VIEW, ADMISSION_VIEW, BED_VIEW, PATIENT_VIEW | Assigned hospital urgent workflow |
| Quality Officer | `quality_officer` | Quality / safety | QUALITY_VIEW, AUDIT_VIEW | Assigned hospital aggregates |
| IT Administrator | `ict_admin` | System operations | SYSTEM_MONITOR_VIEW, LOGIN_ACTIVITY_VIEW, AUDIT_VIEW | Assigned hospital technical activity; no clinical patient list |

## Specialist compatibility mappings

| Existing role | Dashboard experience | Reason |
| --- | --- | --- |
| `surgeon` | Doctor | Clinician-assigned appointments, visits, reports, and decisions |
| `anesthetist` | Doctor | Clinician-assigned workload and clinical follow-up |
| `lab_manager` | Laboratory | Same governed laboratory workflow with manager permissions |
| `pathologist` | Laboratory | Laboratory verification and critical-result workflow |
| `radiologist` | Radiology | Reporting and verification workflow |
| `mortuary_officer` | Mortuary readiness | No authoritative mortuary event source in supplied schema |

## Role permissions added by V31 / V32 / V33

| Role | Permissions added |
| --- | --- |
| All dashboard-capable roles | `DASHBOARD_VIEW` |
| `opd_officer` | patient view/create/demographic update, self-registration management, appointment view/create/update, queue view/manage, report view |
| `ward_manager` | patient clinical view, ward/room/bed operations, admission/transfer/discharge operations, ward list, report view |
| `inventory_officer` | inventory view/manage, report view/download |
| `finance_officer` | finance view, report view/download |
| `emergency_staff` | emergency view, patient clinical view, queue operations, ward/bed view, admission view/create, identity confirmation, report view |
| `quality_officer` | quality view, report view/download, audit view |
| `ict_admin` | system monitor view |
| `super_admin` | Every current permission, including newly inserted permissions |

V33 adds `HOSPITAL_MANAGE` and grants it only to `super_admin`. Existing ward and bed mutations continue to require `WARD_MANAGE` and `BED_MANAGE`.

## Authorization principles

- A hidden menu item is not an authorization control; the Spring API is authoritative.
- The caller cannot request another role's dashboard.
- A non-Super Admin cannot select another hospital.
- Doctor data is assignment-scoped, not merely hospital-scoped.
- Patient data is identity-scoped and release-scoped.
- Unsupported identity relationships return no records.
- Missing sources return unavailable states, never fabricated numbers.
## Account administration and common pages

| Workflow | Who may access | Permission |
| --- | --- | --- |
| Own profile / password change | Every active supported role | Own authenticated identity |
| Staff management | Super Admin / Hospital Admin | USER_MANAGE |
| Create hospitals and view network facility totals | Super Admin only | HOSPITAL_MANAGE |
| Create wards in a selected hospital | Super Admin / Hospital Admin / Ward Manager within their permitted scope | WARD_MANAGE |
| Create one or bulk beds | Super Admin / Hospital Admin / Ward Manager within their permitted scope | BED_MANAGE |
| Assign Hospital Admin / IT Administrator | Super Admin only | USER_MANAGE plus server role checks |
| Create or modify Super Admin through staff role changes | Disallowed | Dedicated existing recovery procedure |
| Patient / Guardian portal dashboard | Corresponding logged-in role | DASHBOARD_VIEW |
| Cross-hospital selector | Super Admin | Server-validated hospital scope |

Local test logins and source-seeded initial credentials are listed in LOCAL_ROLE_CREDENTIALS.md.
