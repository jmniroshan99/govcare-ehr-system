# CKD Clinical Risk Graphics - Validation Report

Date: 2026-10-11

## Passed checks

1. `npm run test:renal:graphics`
   - 4/4 tests passed.
   - Verified all four visual modules are present.
   - Verified patient renal observations are used for Hb, potassium and URR visual series.
   - Verified Hb and URR outputs use existing governed research snapshots.
   - Verified non-diagnostic wording and conceptual-image disclosure.
   - Verified the infographic asset is packaged and responsive CSS exists.

2. `npm run test:ckd-workspace`
   - 30/30 tests passed.
   - Existing CKD Predictive Intelligence role/access boundaries and patient-switch cancellation checks remain intact.

3. TypeScript syntax transpilation
   - `SriLankanRenalPanel.tsx` transpiled with 0 TypeScript syntax diagnostics using the available compiler runtime.

4. Infographic asset validation
   - PNG: 1672 x 941, RGB, valid non-interlaced PNG.

## Environment-limited checks

- Full `npm run build` could not be completed in this execution environment because npm package retrieval failed with DNS/network `EAI_AGAIN`, leaving local dependencies unavailable. The build failure occurred in dependency resolution before application source compilation.
- Spring/Maven tests could not be rerun because Apache Maven is not installed in this execution environment. No Spring backend source was changed by this revision.

## Recommended local verification

With normal internet/dependency access:

```cmd
npm install
npm run test:renal:graphics
npm run test:ckd-workspace
npm run build
npm run spring:build
```

Then start the full renal stack and verify the CKD Predictive Intelligence view at desktop, tablet and mobile widths.
