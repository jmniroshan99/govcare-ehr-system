# Migration Validation Notes

Validation completed in the packaging environment:

- Java source files were parsed with Java 21 `javac`; no Java syntax/brace errors were detected.
- Frontend TypeScript/TSX files were parsed with the available TypeScript compiler; no TypeScript syntax diagnostics were detected.
- Active npm scripts were checked to confirm that `dev:full`, `postgres:api` and `postgres:build` now target Spring Boot.
- The old `server/` Express backend was removed from this distribution.
- Actual `.env`, build output, dependency and upload folders are excluded.
- PostgreSQL migrations include the base schema, workflow extensions, RBAC seed, active-token compatibility and minimum local seed.

A complete dependency build was not executable in the packaging environment because Apache Maven was not installed and external package repositories were unavailable. Run these commands locally after installing the prerequisites:

```cmd
npm install
npm run build
npm run spring:build
npm run dev:full
```
