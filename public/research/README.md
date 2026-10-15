# CKD research infographic - V45

Use the versioned PNG for presentation slides or posters and the versioned PDF for a single 16:9 landscape slide. The PNG is 1672 x 941 pixels; the PDF canvas is 960 x 540 points (16:9), fitting the original image without cropping or distortion. The image was generated and corrected with the built-in imagegen tool. Its hyperkalemia method label is **Research risk model**, while Hb remains **Baseline forecast**.

The React component renders these files from Vite's configured base URL. No patient information is embedded in either asset. The full HTML transcript describes all modules, indicators, the URR formula, workflow and research-method context for small screens and assistive technology.

These charts are illustrative. G5D means verified maintenance dialysis in this project. Hb is a persistence baseline; URR is a research forecast; hyperkalemia risk is not clinically calibrated; renal deterioration is a directional composite, not a disease probability. The live clinical cards remain separate and retain their existing review controls.

Optional PDF reproduction (not required for app installation): install `reportlab` in an artifact-authoring Python environment, then run `python scripts/export-renal-research-infographic.py` from the project root. The committed PDF is already ready to use. The earlier `ckd-risk-predictive-intelligence-dashboard.png` is preserved as a legacy asset.
