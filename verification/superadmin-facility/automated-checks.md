# Automated checks — 2026-10-04

| Command | Result |
| --- | --- |
| `npm run build` | PASS — TypeScript and Vite production build |
| `npm run test:roles` | PASS — 45 checks |
| `npm run test:dashboard` | PASS — 7 checks |
| `npm run test:facilities` | PASS — 6 checks |
| `npm run test:theme` | PASS — 10 checks |
| `npm run test:startup` | PASS — 12 checks |
| `npm run test:superadmin` | PASS — 11 Node contracts and 20 Java service checks |
| `npm run test:java:syntax` | PASS — 140 Java sources, zero syntax errors |
| PostgreSQL semantic check | PASS — 30 date rows and 10 generated beds |
| `mvn clean test` | BLOCKED before project compilation because Maven Central DNS was unavailable |

The Node suite count is 85 distinct checks: roles 45, dashboard 7, theme 10, startup 12, and the 11 Super Admin tests. The six facility contracts are included inside the 11 Super Admin tests.
