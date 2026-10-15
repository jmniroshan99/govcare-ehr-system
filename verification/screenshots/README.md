# Screenshot capture status

No dashboard PNGs were captured in this environment. The local Chromium download returned an invalid/empty archive, and the cloud browser rejected `http://127.0.0.1:4173` with `net::ERR_BLOCKED_BY_CLIENT` during the theme verification attempt.

Run the included live verifier on your local GovCare installation as documented in `THEME_BUILD_INSTRUCTIONS.md`. It captures the real Super Admin, Doctor and Patient dashboards in both modes at 375, 768, 1366 and 1920 pixels, plus every additional role supplied in the private credentials file. Successful output includes PNG files and `browser-report.json`.
