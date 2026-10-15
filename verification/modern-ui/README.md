# Verification evidence

Date: 2026-10-05. Toolchain: Node 24.19.0, Java 21, Maven 3.9.11.

These are the final recorded logs for the source delivery. `predictive-tests-final.log` is the completed grouped command; the individual final domain/access/migration logs preserve their independent results. The Java domain engine and SQL checks run against production source and an ephemeral PGlite database. No live hospital data or accounts were used.

`maven-clean-test.log` records a failed parent-POM download before full backend compilation. `browser-install.log` records the failed local Chromium installation. No screenshot files are included because no live browser verification succeeded.

Read `docs/PREDICTIVE_INTELLIGENCE_TEST_REPORT.md` for the exact scope and limitations of every result.
