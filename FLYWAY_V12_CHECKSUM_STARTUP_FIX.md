# Flyway V12 checksum startup fix

## Root cause
The existing `govcare_ehr_v2` database contains Flyway migration V12 with checksum `-280148733`, while the V12 file in this project resolves to `-2134740670`. Flyway therefore stops Spring Boot during validation before Tomcat can finish starting.

## Fix in this build
A Spring Boot `FlywayMigrationStrategy` now performs `flyway.repair()` before `flyway.migrate()` during startup. This follows Flyway's prescribed repair path for a migration checksum mismatch and preserves the existing database instead of deleting it or disabling validation.

The compatibility behavior is controlled by:

`GOVCARE_FLYWAY_REPAIR_ON_STARTUP=true`

It defaults to `true` for this repaired development build. After all target databases have had their schema history normalized, it can be disabled by setting the environment variable to `false`.

Important: repair changes Flyway schema-history metadata; it does not re-run V12. Future schema changes should be added as new versioned migrations rather than editing an already-applied migration.

## Backend
Backend remains on port `4002`.

Run from `spring-api`:

`mvnw.cmd spring-boot:run`
