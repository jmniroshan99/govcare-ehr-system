# GovCare theme and Java verification report (theme baseline)

This report records the theme-only verification completed before the Super Admin facility update. The current source also contains backend and RBAC changes; use [SUPERADMIN_FACILITY_TESTING_REPORT.md](SUPERADMIN_FACILITY_TESTING_REPORT.md) as the current verification report.

Current delivery: 2026-10-04. Input: GovCare_Superadmin_AI_Fixed(1).zip.

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| npm run build | PASS — TypeScript and Vite production build | verification/theme/frontend-build.log |
| npm run test:roles | PASS — 44 checks | verification/theme/role-tests.log |
| npm run test:dashboard | PASS — 7 checks | verification/theme/dashboard-tests.log |
| npm run test:theme | PASS — 10 checks | verification/theme/theme-tests.log |
| npm run test:startup | PASS — 12 checks | verification/theme/startup-tests.log |
| npm run test:java:syntax | PASS — 137 Java files, zero syntax errors | verification/theme/java-syntax.log |
| npm run test:superadmin | PASS — 5 frontend contracts and 19 Java service checks | verification/theme/clinical-access-and-compilation.log |
| Java 21 focused type compilation | PASS — DashboardIntelligenceService and related clinical services, using temporary framework and SQL/JSON adapter doubles | verification/theme/clinical-access-and-compilation.log |
| cd spring-api; mvn clean test | BLOCKED before source compilation — Maven Central DNS resolution | verification/theme/maven-clean-test.log |
| Live role logins and PostgreSQL-backed integration | NOT EXECUTED | Requires a running Spring API and local database |
| Real browser rendering at 375 / 768 / 1366 / 1920 | NOT VERIFIED | Browser download failed; cloud browser rejected localhost |
| Requested dark/light/Super Admin/Doctor/Patient PNGs | NOT CAPTURED | Live verification script included |

Passing Node suites total 78 checks; the separate Java service harness adds 19. Static/isolated checks do not establish a live authenticated browser session or real database integration.

## Java audit and exact compilation scope

The reported semicolon errors are not present in the supplied source. The input already contains the earlier dashboard extra-parenthesis correction. Every Java source is parsed by the actual Java 21 compiler, which checks semicolons, quotes, JSON/SQL text-block boundaries, brackets, return statements and builder syntax. All 137 files pass. The dashboard service is additionally type-compiled with application classes and small framework and SQL/JSON adapter doubles in a temporary directory. Those doubles are never added to the Spring application's classpath.

No backend file was edited during the theme-only pass. The following hash identifies the dashboard service at that baseline, before the later PostgreSQL 18 alias correction:

`a8d6dca76a94601d8848286ca1a348164da6b9ae400d7ae36989b0f0d895278d`

The full requested Maven command was attempted. It failed resolving `org.springframework.boot:spring-boot-starter-parent:3.5.3` because `repo.maven.apache.org` could not be resolved. Maven did not reach Java compilation or JUnit execution. Therefore this report does not claim a complete Spring build or a passing Maven test suite. Older reports bundled with the original project describe earlier runs; this report is the evidence for this update.

## Theme evidence

Compiled frontend CSS uses the `.dark` class variant and contains no operating-system dark-mode media rule. All six required public CSS tokens are present. Application `.ts`, `.tsx` and `.css` files outside `src/theme` contain no remaining hex/rgb/rgba UI color literals. Fixed image artwork is not recolored. Generation freshness is checked automatically.

The contrast calculation uses relative luminance and composites translucent surfaces against their backgrounds. Minimum ratios among the checked foreground/surface pairs are:

| Foreground or mark | Light minimum | Dark minimum | Required test minimum |
| --- | --- | --- | --- |
| Primary body/card/hero/glass text | 12.29:1 | 12.19:1 | 4.5:1 |
| Secondary body/card/hero/glass text | 4.76:1 | 6.79:1 | 4.5:1 |
| Primary action text, including hover | 5.65:1 | 8.13:1 | 4.5:1 |
| Status text on its matched surface | 5.14:1 | 7.84:1 | 4.5:1 |
| Chart series on checked surfaces | 4.61:1 | 5.41:1 | 3:1 |

QR ink on paper reaches 17.85:1. Theme tests also cover saved light mode under a dark OS, simultaneous consumer updates, theme persistence, system preference behavior, cross-tab updates, denied storage and native color-scheme synchronization. Contrast checks are token-level evidence; they do not replace full rendered accessibility testing.

## Privacy, data and responsive scope

At the theme-only baseline, authentication, RBAC, hospital isolation, PostgreSQL/Flyway, CKD model and FHIR code were byte-identical to the input. The current facility update adds a Super Admin permission, facility endpoints, bulk bed creation and corrected dashboard SQL while preserving the existing clinical access rules. The Java harness exercises cross-hospital Super Admin selection, preserved patient tenant/operator identity, doctor assignment restrictions, patient/guardian ownership, revoked permissions, temporary-account gates, document release rules and AI write scopes.

Responsive source changes remove the global mobile table minimum, give shared tables a local scroller, retain mobile worklist cards, remove overflow masking from main content and allow long hero/metric text to wrap. This is source-level evidence only. No pixel rendering, hover inspection or viewport screenshot pass is claimed.

## Remaining release checks

Run `mvn clean test` in an environment that can resolve its dependencies. Start the application against the intended local PostgreSQL test database, verify the role accounts and relationship scopes with `npm run verify:roles`, and run `npm run test:theme:browser` with completed-password-change accounts. Inspect its dark/light screenshots and exercise chart tooltips, long labels and unavailable data states.

The source fixes and reproducible checks are delivered. Full production certification remains incomplete until the blocked Maven, live database/login and browser checks pass. No synthetic screenshots, dummy API values or authentication bypasses are supplied to conceal these gaps.
