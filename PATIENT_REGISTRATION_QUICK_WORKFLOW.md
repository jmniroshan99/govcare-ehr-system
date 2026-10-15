# GovCare Quick Patient Registration

## Outcome

`/patients/register` now opens in **Quick Registration** mode. It keeps the existing Spring Boot, PostgreSQL, authentication, RBAC, FHIR, and CKD AI-CDSS integrations while reducing the initial form to the information required to safely create a patient.

No patient field or existing database mapping was removed. Less frequently used fields are available in the collapsed **Additional patient details** section.

## Registration workflow

1. The page generates a provisional patient number and focuses the identification-number field.
2. Staff choose NIC, passport, or birth certificate and enter one identification number.
3. The form maps that value back to the existing `nic`, `passportNo`, or `birthCertificateNo` API property.
4. After a complete identifier is entered, the existing duplicate endpoint checks PostgreSQL. Phone plus name and date of birth can also produce a possible-match warning.
5. Staff complete the minimum demographic, contact, location, registration, and risk fields.
6. Date of birth calculates age automatically. Patients under 18 reveal the guardian section.
7. Province selection filters the district list and clears an incompatible district.
8. The sticky review bar shows required-field progress and prevents repeated submissions while a request is running.
9. Submission runs the duplicate check again before calling the create endpoint.
10. The success message shows the server-confirmed patient number and opens the saved PostgreSQL patient profile.

## Quick-registration fields

| Section | Field | Required | Behaviour |
| --- | --- | --- | --- |
| Patient identification | Identification type | Yes | NIC, passport, or birth certificate |
| Patient identification | Identification number | Yes | Type-specific validation and duplicate check |
| Patient identification | Patient ID | Generated | Server still resolves any hospital-level collision |
| Personal information | First name | Yes | Validated on blur and submit |
| Personal information | Last name | Yes | Validated on blur and submit |
| Personal information | Date of birth | Yes | Future dates rejected; age calculated automatically |
| Personal information | Gender | Yes | Existing configured options retained |
| Personal information | Phone number | Yes | Sri Lankan phone validation |
| Contact and location | Province | Yes | Sri Lankan province list |
| Contact and location | District | Yes | Filtered by the selected province |
| Registration and risk | Registration type | Yes | Walk-in, appointment, emergency, referral, transfer, or newborn |
| Registration and risk | Risk category | Yes | Routine, moderate, high, or critical |

Defaults remain deliberately conservative: nationality is `Sri Lankan`, language is `English`, registration type is `walk_in`, and risk is `routine`.

## Form and accessibility design

- One column below 768 px, two columns from 768 px, and three columns from 1440 px.
- No four-column registration layout.
- Each required label has a visible, theme-aware **Required** badge.
- Required controls expose `required` and `aria-required="true"`.
- Invalid controls expose `aria-invalid`, an associated error description, and icon-plus-text feedback.
- The first invalid control receives focus and scrolls into view.
- Entire field containers highlight with `:focus-within`.
- The form preserves valid input after errors.
- The sticky action bar remains usable at mobile and desktop widths.
- Reduced-motion preferences continue to use the global GovCare rule.
- All new display styling uses the existing semantic theme tokens; no new hard-coded UI colours were introduced.

## Duplicate protection and privacy

The UI uses `POST /api/patients/duplicate-check` before saving and repeats that check inside the server-side create transaction. The query always includes:

```sql
where hospital_id = :hospitalId and status <> 'deleted'
```

The endpoint requires `PATIENT_CREATE`. It does not expose patients from a different hospital context. Exact NIC, passport, birth-certificate, or email matches block registration. Phone or name-plus-date-of-birth matches are shown as possible matches for staff review.

Manual search continues to accept patient number, identifier, name, or phone and is protected by the existing patient directory authorization.

Patient form values are not saved to browser `localStorage`. The only persistence action is the authorized Spring Boot API request. Unsaved-change protection covers browser unload and internal link navigation.

## RBAC matrix

The route continues to use the existing central `routePolicies` and PostgreSQL permissions. This change does not add role fallbacks or bypass permissions.

| Role | Route eligibility | Required API permission | Data scope |
| --- | --- | --- | --- |
| Super Admin | Allowed by existing route policy | `PATIENT_CREATE` | Authenticated hospital context for registration writes |
| Hospital Admin | Allowed by existing route policy | `PATIENT_CREATE` | Own hospital |
| Receptionist / Front Desk | Allowed by existing route policy | `PATIENT_CREATE` | Own hospital |
| OPD Officer | Allowed by existing route policy | `PATIENT_CREATE` | Own hospital |
| Records Officer | Allowed by existing route policy | `PATIENT_CREATE` | Own hospital |
| All other roles | Denied unless the central route policy is intentionally changed | Not applicable | No registration access |

Backend enforcement remains authoritative through Spring Security `@PreAuthorize("hasAuthority('PATIENT_CREATE')")` on both duplicate-check and create operations.

## API change

The patient-create request accepts one new optional property:

```json
{
  "registrationType": "walk_in"
}
```

Allowed values are:

- `walk_in`
- `appointment`
- `emergency`
- `referral`
- `transfer`
- `newborn`

Older clients may omit the property and receive the backward-compatible `walk_in` default. Invalid values return HTTP 400. Patient responses include `registration_type`.

## PostgreSQL change

Flyway migration `V34__patient_registration_workflow.sql`:

- Adds `patients.registration_type text not null default 'walk_in'`.
- Adds a check constraint for the six supported values.
- Adds a partial operational index on `(hospital_id, registration_type, created_at desc)` for non-deleted records.

Flyway applies the migration automatically when Spring Boot starts against the configured PostgreSQL database.

## Build and run

Requirements: Node.js 22 or newer, npm, Java 21, Maven 3.9+, and PostgreSQL configured through the existing GovCare environment settings.

```bash
npm ci
npm run build
npm run test:patient-registration
npm run test:roles
npm run test:dashboard

cd spring-api
mvn clean test
```

Do not disable Flyway for the first deployment of this release. Take the normal PostgreSQL backup before applying migrations in production.
