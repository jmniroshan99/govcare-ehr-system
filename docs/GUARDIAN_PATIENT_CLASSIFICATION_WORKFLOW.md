# Guardian-Driven Patient Classification Workflow

GovCare EHR should treat the patient and guardian relationship as the source of truth for ward eligibility. Ward Management should consume classification data; it should not independently decide patient category without referencing `patientId`, `guardianId`, and `hospitalId`.

## Classification Rules

| Rule | Dependent category | Ward recommendation |
| --- | --- | --- |
| Patient age is under 10 | `child_under_guardian` | Children Ward |
| Patient age is 10 or above and gender is male | `adult_male` | Male Ward |
| Patient age is 10 or above and gender is female | `adult_female` | Female Ward |
| Gender is missing, unknown, or requires review | `clinical_review` | Clinical override required |

## Required Patient Fields

Store these fields on `patients/{patientId}`:

- `hospitalId`
- `patientId`
- `guardianId`
- `age`
- `gender`
- `dependentCategory`
- `recommendedWardCategory`
- `recommendedWardLabel`
- `classificationReason`
- `classificationEvaluatedAt`
- `updatedAt`
- `updatedBy`

## Required Guardian Link Fields

Store these fields on `guardianDependents/{guardianId_patientId}`:

- `hospitalId`
- `guardianId`
- `patientId`
- `relationshipToPatient`
- `dependentCategory`
- `recommendedWardCategory`
- `classificationEvaluatedAt`
- `status`
- `createdAt`
- `updatedAt`

## Recalculation Triggers

Recalculate classification when:

- Patient date of birth or age changes.
- Patient gender changes.
- Guardian assignment changes.
- Guardian relationship is revoked or reactivated.
- Emergency registration is merged into a permanent patient record.

## Downstream Consumers

The following modules should read patient classification by `patientId` before routing:

- OPD queue and clinic routing
- Emergency admission request
- Admission approval
- Ward and bed allocation
- Transfer request review
- Discharge and follow-up planning

Production backend API jobs should reject adult male/female/children cross-assignment unless an authorized clinical override is recorded with reason, approver, timestamp, and audit log.

