# CKD Multi-PDF Non-Blocking Selection Fix

The CKD AI-CDSS multi-PDF workflow no longer treats different values for the same feature as a mandatory conflict.

## Behavior
- The large mandatory conflict-resolution panel was removed.
- Duplicate report values no longer block prediction by themselves.
- Existing clinician `MANUAL_OVERRIDE` values take priority.
- Otherwise, a candidate with the latest available clinical/report timestamp is selected.
- If no usable clinical timestamp is present, the most recently processed candidate is selected.
- Other valid values are retained as non-blocking alternatives and can be expanded under the field.
- Alternative candidates are deduplicated by report/feature/date/value/unit.
- Removing a report recalculates imported selections from remaining alternatives without replacing manual overrides.
- Draft schema v2 preserves both values and source/provenance metadata; older drafts remain restorable.
- Existing required-feature, range, unit/model and patient authorization validation remains unchanged.

No selection is based on severity, highest/lowest value, or predicted CKD risk.
