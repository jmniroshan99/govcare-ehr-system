# Legacy SQL Reference

The active Spring Boot backend uses Flyway migrations from:

```text
spring-api/src/main/resources/db/migration/
```

Files under this `database/` directory are retained only as historical/reference SQL from the earlier project version. For a new installation, create an empty `govcare_ehr_v2` database and allow Spring Boot Flyway to apply the canonical migrations automatically.
