# Leakage audit

## Newly implemented pipeline
- PASS: Training/validation/test patient sets are disjoint and saved in the manifest.
- PASS: Identifiers, source row, target and future date are excluded from feature order.
- PASS: Rolling features end at the current row; lag/differences use earlier rows only.
- PASS: Numeric target is the immediate subsequent observation of the same patient, with a 14–62 day interval.
- PASS: Median imputer and scaler fit on train only; grouped CV fits preprocessing independently inside each fold.
- PASS: Model selection uses validation only; no test-set threshold/model tuning.
- PASS: Temporal experiment purges training outcomes after its cutoff; test origins begin at cutoff.
- PASS: No legacy pickle is loaded. No outcome/diagnosis/subject numeric proxy is used.

## Unresolved upstream source limitation
UNVERIFIED: The original monthly preprocessing notebook performs bidirectional interpolation before splitting. Pre-cleaning raw files are absent. The supplied matrices may already contain future-derived values; no new algorithm can establish their original measurement provenance. Therefore a claim of completely leakage-free clinical validation would be false. All outputs are research only and carry this limitation.

## Legacy IDH/dry-weight findings
IDH MLP targets derived from SYS <=90 retain SYS in inputs. IDH and dry-weight notebooks contain row-random splits and missing source files. Those fitted legacy artifacts and metrics are not accepted.
