# Login and logging repair validation

## Passed checks

- TypeScript/TSX syntax parsing: 147 files, 0 parsing failures.
- Frontend locale JSON parsing: passed.
- Spring `application.yml` parsing: passed.
- Maven `pom.xml` XML parsing: passed.
- Flyway migration sequence: V1 through V12, no duplicate or missing version.
- UTF-8 source/document scan: passed.
- Changed Java files: `javac` completed the parser stage with no Java syntax diagnostics.
- Final ZIP integrity: checked after packaging with `unzip -t`.

## Environment limitation

A complete frontend dependency build could not be run in the isolated repair environment because the npm package registry was unavailable. A complete Spring Boot dependency build could not be run because Maven was not installed and external dependency retrieval was unavailable. The package therefore includes static syntax/configuration validation rather than a live PostgreSQL integration run.

## First local run

1. Keep or create `spring-api/.env` with the correct PostgreSQL connection.
2. Run `npm install`.
3. Run `npm run build`.
4. Run `npm run spring:build`.
5. Run `npm run dev:full`.
6. Confirm `http://127.0.0.1:4001/actuator/health` is healthy.
7. Sign in with one of the documented demo accounts.
8. Check `spring-api/logs/govcare-spring-api.log` if startup fails.
