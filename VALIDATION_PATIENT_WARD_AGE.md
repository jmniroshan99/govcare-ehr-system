# Patient Ward Selection and Automatic Age Validation

## Completed static validation

- Java 21 syntax parsing: 82 source files passed.
- TypeScript/TSX syntax transpilation: 148 source files passed.
- TypeScript configuration parsing: 3 files passed.
- JSON, XML, and YAML configuration parsing passed.
- Flyway sequence validated continuously from V1 through V13.
- Automatic age tests passed for birthday-today, birthday-tomorrow, newborn, future date, invalid date, stale stored age, and stored-age fallback cases.
- Required ward endpoint, ward filtering, profile age display, and migration integration tokens were verified.

## Runtime behavior to verify locally

1. Start PostgreSQL and the application.
2. Confirm Flyway applies `V13__patient_age_and_ward_identification.sql`.
3. Open `/patients/search`.
4. Select a ward and click **Load ward** to list active admitted patients.
5. Search or scan a patient while the ward is selected and confirm results stay within that ward.
6. Open a patient profile and confirm age is calculated from date of birth.
7. Change a patient's date of birth and confirm age changes automatically.
8. Open OPD, Doctor, Pharmacy, and PDF reports and confirm the current age is shown.

## Environment limitation

A full dependency build was not completed in the repair environment because the configured npm registry returned a package 404 and Maven was unavailable. The source, configuration, migration sequence, and age calculation logic passed the validations listed above.
