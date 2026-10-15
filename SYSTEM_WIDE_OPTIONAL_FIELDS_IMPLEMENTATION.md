# System-wide Optional Field Policy

## Goal

GovCare data-entry screens now distinguish between:

- **Required** fields: minimum identity, account-security, or clinical-safety data needed to complete the current transaction.
- **Optional** fields: information that may be left blank and completed later.
- **Read-only/system fields**: generated identifiers, calculated ages, hospital context, and other values that users do not enter.

## Patient registration

The minimum required patient data is:

- First name
- Last name
- Date of birth

The following are optional at initial registration and are validated only when supplied:

- NIC, passport, and birth-certificate numbers
- Gender
- Phone, email, and address
- District, province, and postal code
- Emergency contact
- Guardian details
- Blood group and nationality
- Allergies, chronic diseases, disability details, family history, immunisation, pregnancy history, and social information
- Patient photograph and consent checkbox

Age remains calculated automatically from date of birth. Future or invalid dates are rejected.

## Existing field-policy upgrade

Patient field settings stored in browser local storage are upgraded to policy version 2. Legacy mandatory phone, address, emergency-contact, and guardian settings become optional unless a hospital administrator later explicitly changes them through the Patient Field Policy page.

## Patient self-registration

Only full name and date of birth are mandatory. Phone, address, gender, emergency contact, identifiers, and medical background are optional. The Spring Boot endpoint accepts omitted optional values and stores safe null/empty JSON values.

## Other data-entry workflows

- Staff creation: full name, email, hospital, role, and temporary password remain required; supporting personal and employment fields are labelled optional.
- Inpatient admission: admission reason remains required; referring department, admitting doctor, complaint, provisional diagnosis, special nursing requirements, and notes are optional.
- Child appointment: child name, guardian name, and guardian phone remain required; birth-certificate number and guardian NIC are optional.

## Safety boundaries

The change does not relax transaction-critical requirements such as:

- Authentication and role assignment
- Patient identity minimums
- Admission reason, ward, and bed assignment
- Prescription medicine, dose, frequency, and duration
- Laboratory/radiology order items
- Pharmacy rejection reason and dispensing quantities
- Document file and permission checks

No database migration is required because existing patient columns already permit null values for the fields made optional.
