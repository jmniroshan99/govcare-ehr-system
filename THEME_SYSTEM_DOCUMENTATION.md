# GovCare healthcare theme system

Updated: 2026-10-04. Current evidence: [THEME_VERIFICATION_REPORT.md](THEME_VERIFICATION_REPORT.md).

## Root cause and implementation

The previous toggle changed `html.dark`, while Tailwind's default `dark:` utilities followed the operating-system preference. A saved light preference could therefore coexist with dark utility colors. Broad `html.dark ... !important` overrides then changed text, controls and cards independently. Several dashboard heroes and the CKD result screen also retained fixed dark surfaces and pale text in light mode.

`src/index.css` now declares `@custom-variant dark (&:where(.dark, .dark *));`. Tailwind utilities and the generated root variables follow the same class. The broad color overrides are removed. Application UI colors are centralized in `src/theme/colors.ts`; `src/theme/tokens.css` is generated from that file, rather than maintained as a second palette.

## Token architecture

| File | Responsibility |
| --- | --- |
| src/theme/colors.ts | Exact brand palette, accessible action and status colors, chart series, glass, shadows and export colors |
| src/theme/tokens.css | Generated light `:root` and dark `:root.dark` CSS variables |
| src/theme/themeStore.ts | Shared preference, HTML class, native color scheme, cross-tab synchronization and system preference fallback |
| src/hooks/useTheme.ts | React subscription to the single theme store |
| src/theme/ChartTooltip.tsx | Theme-aware Recharts tooltip and legend |
| scripts/theme-source.mjs | Loads TypeScript tokens using the existing compiler, without requiring Node's native TypeScript loader |
| scripts/generate-theme.mjs | Generates CSS or rejects stale generated CSS with `--check` |

| Required token | Dark | Light |
| --- | --- | --- |
| background / --bg-primary | #061F1B | #F4FAF8 |
| surface / --bg-surface | #0D2924 | #FFFFFF |
| card / --bg-card | rgba(255,255,255,0.08) | #FFFFFF |
| brand primary / --brand-primary | #00C9A7 | #008F78 |
| text / --text-primary | #FFFFFF | #12312D |
| muted / --text-secondary | #A8C8C0 | #52706A |
| chart axis / --chart-axis | #B7DCD3 | #355E56 |
| chart grid / --chart-grid | rgba(255,255,255,0.1) | rgba(0,0,0,0.1) |
| glass / --glass-background | rgba(13,41,36,0.85) | rgba(255,255,255,0.92) |

Other public variables include `--border-color`, `--control-border`, `--card-shadow`, `--action-primary`, `--action-primary-hover`, `--on-primary`, `--text-accent`, `--bg-muted`, `--chart-series-1` through `--chart-series-8`, and four variables per semantic status tone. Tailwind semantic utilities resolve those variables using `@theme inline`.

Use `bg-surface text-foreground border-border` for ordinary panels, `bg-muted text-muted-foreground` for supporting content, and matched pairs such as `bg-danger-surface text-danger border-danger-border` for status messages. Filled status controls use `bg-danger-solid text-on-solid`; primary controls use `bg-primary text-primary-foreground hover:bg-primary-hover`. Use `border-control-border` for form controls and outlined buttons.

### Brand color and readable action labels

The requested light brand color remains exactly #008F78. White text on that color has contrast 4.04:1, below the 4.5:1 normal-text threshold. The light action token is therefore #007561 with white text, reaching 5.65:1. In dark mode the mint action token uses dark forest text, reaching 8.13:1. Body links and accent labels use separate readable foreground tokens. Brand, action and text colors have distinct jobs.

### Glass and motion

`.glass-panel` uses `--glass-background` and both standard and WebKit `backdrop-filter: blur(15px)`. Shared dashboard chart and worklist panels use this class. Text remains fully opaque; opacity is applied only to disabled controls, decorative elements, chart fills or existing fade animations. The card shimmer and existing motion retain reduced-motion support.

## Role-specific dashboards

Role selection, content permissions, query keys and payloads are preserved. The router still chooses distinct Super Admin, Hospital Admin, Doctor, Nurse, Front Desk, OPD, Ward, Laboratory, Radiology, Pharmacy, Inventory, Finance, Records, Patient, Guardian, Emergency, Quality, IT and Mortuary experiences. Specialist aliases remain mapped to their existing clinical or diagnostic experiences.

`RoleDashboardPage` supplies shared presentation for each role's own definition and server payload. Its hero, metric cards, worklists, unavailable states and chart panels use semantic colors. Existing module dashboards, the personal health portal, clinical forms, document dialogs, search, notifications, patient identity cards and CKD result presentation are also migrated. This update does not combine their analytics or change authorization.

The authoritative architecture and permissions remain documented in [ROLE_INTELLIGENCE_DASHBOARD_ARCHITECTURE.md](ROLE_INTELLIGENCE_DASHBOARD_ARCHITECTURE.md) and [ROLE_DASHBOARD_PERMISSION_MATRIX.md](ROLE_DASHBOARD_PERMISSION_MATRIX.md).

## Charts and patient identifiers

Chart axes, grids, legends, tooltip surfaces, series, area fills and CKD risk strokes use CSS variables. Switching theme changes their rendered colors without adding a dashboard query or invalidating its cache. Recharts remains lazily loaded by the role dashboard.

The heatmap uses the recorded value to blend `--heatmap-high` with the surface; its foreground stays opaque. Progress widths and risk scores retain their original calculations. QR codes and printed identifiers use the centralized fixed `exportColors` paper/ink palette, so changing the screen theme cannot invert a code or make a printed card unreadable. Static image artwork is retained.

## Responsive behavior

The global mobile table minimum-width rule is removed from CSS. Shared tables contain their own horizontal scroller; dashboard worklists retain mobile cards and desktop tables. The main content no longer hides viewport overflow, and hero/metric text can wrap long labels. Existing mobile, tablet and large-screen grid breakpoints remain intact.

The live verification script targets 375, 768, 1366 and 1920 CSS pixels in both themes. Browser execution and actual screenshots remain unverified in this environment; see the testing report for the exact blocker.

## API, database and maintenance

The theme-only change did not alter Spring APIs, SQL, RBAC, FHIR or CKD calculations. The current archive also includes the later Super Admin facility APIs, Flyway V33 and PostgreSQL 18 dashboard query correction described in [SUPERADMIN_FACILITY_ADMINISTRATION.md](SUPERADMIN_FACILITY_ADMINISTRATION.md). The theme system itself creates no hospital or patient data.

Edit tokens in `colors.ts`, then run `npm run theme:generate`. `npm run build` and `npm run dev` regenerate tokens automatically. `npm run test:theme` checks generation freshness and contrast/preference behavior. Keep new UI colors in the token source instead of introducing local hex, rgba or palette-shade utilities.
