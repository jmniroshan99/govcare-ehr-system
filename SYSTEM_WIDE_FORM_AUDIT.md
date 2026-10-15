# System-Wide Form Audit

## Classification rules

| Field category | Preferred control | Examples |
|---|---|---|
| Static reference | Typed searchable/static select | blood group, gender, priority |
| Database entity | Async searchable selector | patient, staff, medicine |
| Dependent entity | Linked selector | hospital → department → ward → bed |
| Multi-value reference | Multi-select chips | allergies, chronic diseases |
| Three-state value | Yes/No/Unknown | pregnancy, isolation, consent status |
| Date/time | Date or date-time control | DOB, appointment, transfer time |
| Numeric measurement | Unit-aware number field | temperature, SpO2, weight |
| Identifier | Normalised validated input | NIC, passport, phone |
| Narrative | Text area | clinical notes, reason, findings |

## Audit results

### Patient and demographic forms

- Province and district use linked Sri Lankan reference values.
- DOB uses a date control, rejects future dates and drives automatic age.
- blood group, title, gender, marital status and language use controlled values.
- NIC, passport and phone values are normalised and validated only when supplied.
- allergies and chronic diseases support controlled multi-select plus custom values.
- optional fields remain optional and do not display intrusive OPTIONAL badges.

### Staff and profile forms

- hospital and department values retain database relationships.
- staff title, gender, DOB, phone and identifiers use controlled input types.
- user preferred hospital uses database search.
- active staff selectors return IDs and display role, department and hospital context.

### Admission, ward and transfer forms

- patient identity and active admission use searchable database selectors.
- hospital, department, ward and bed relationships are loaded and revalidated by the backend.
- unavailable or inactive resources cannot be selected.
- priority, admission type, isolation and ward requirements use controlled values.
- transfer and admission reasons remain narrative.

### Clinical, pharmacy, laboratory and radiology forms

- medicine, diagnosis, test and imaging study searches use PostgreSQL catalogs.
- prescription route, frequency, duration and quantity use controlled/unit-aware inputs.
- vital signs use numeric fields with units and configured limits.
- laboratory and radiology requests retain narrative clinical indication while linking catalog IDs.
- authenticated staff identity is used for controlled operational actions.

### Reporting and administrative filters

- staff, diagnosis, medicine, laboratory and radiology filters use searchable selectors.
- dates, status, priority and gender use controlled inputs.
- broad report text search fields remain text where multi-domain matching is intentional.

## Deliberately retained text fields

The following remain free text because a rigid list would reduce clinical accuracy or usability:

- addresses, city/village and postal address;
- detailed history and clinical notes;
- presenting complaint and assessment;
- provisional diagnosis narrative;
- prescription instructions and custom clinical directions;
- admission, transfer and discharge narratives;
- report notes and document descriptions.
