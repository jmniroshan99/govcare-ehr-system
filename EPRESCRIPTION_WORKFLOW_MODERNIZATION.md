# Doctor Workspace e-Prescription Modernization

Date: 2026-10-04

## Outcome

The Doctor Workspace prescribing area now uses a guided hospital workflow instead of a dense four-column form. The existing Spring Boot endpoints, PostgreSQL formulary, prescription payload, digital-signature flow, patient isolation, and RBAC checks remain unchanged.

## Guided workflow

1. **Clinical indication** — confirms the prescription diagnosis shared with the consultation.
2. **Select medicine** — searches the authorized PostgreSQL-backed formulary and displays available generic name, dosage form, category, and stock data only when returned by the API.
3. **Dose and schedule** — captures dose, route, frequency, duration, and quantity in a responsive layout.
4. **Patient instructions** — records clear dispensing instructions before the medicine is added.
5. **Review and send** — presents readable medication cards, the digital signature, and the existing Pharmacy submission action.

## Safety and data integrity

- A medicine cannot be added until medicine, dose, frequency, and duration are complete.
- Recorded patient allergies are compared against selected brand and generic medicine names. A possible conflict is shown with an icon and text and blocks the add action.
- Duplicate medicine-and-strength combinations are detected before adding.
- Editing an existing line excludes that line from duplicate comparison.
- Formulary and stock values come from the existing `/api/prescriptions/medicines` response; missing stock is shown as `Stock data unavailable` rather than a fabricated number.
- The final submission still saves the current consultation first and then calls the existing prescription API with the verified patient, visit, consultation, diagnosis, signature, and medicine lines.

## Accessibility and responsive behavior

- Required fields use the shared high-contrast `Required` badge and ARIA-required state.
- Each step has a semantic heading and associated labels/help text.
- Readiness, allergy, and duplicate feedback is announced through an ARIA live region.
- Status is communicated with icons and text, not colour alone.
- Controls retain logical top-to-bottom keyboard order.
- Entry fields use one column on phones, two columns on tablets, and at most three columns on wide screens.
- Medication review uses wrapping cards, avoiding a page-level horizontal table overflow.
- Formulary, route, frequency, Laboratory, specimen, Imaging study, and body-area selectors detect available viewport space. Menus near the bottom open upward and keep their results in a scrollable visible area.
- All surfaces, borders, foregrounds, focus states, and status colours use existing semantic theme classes for both light and dark mode.

## Verification

```bash
npm run test:doctor-workspace
npm run test:searchable-select
npm run build
npm run test:roles
npm run test:dashboard
npm run test:theme
```

Observed result: all commands passed. The focused Doctor Workspace suite passed 5/5, selector placement passed 3/3, RBAC passed 45/45, dashboard contracts passed 7/7, theme contracts passed 10/10, and the production frontend build completed successfully.
