# JPA repository startup fix

Fixes Spring Boot startup failure where repository auto-discovery reported `Found 0 JPA repository interfaces`, causing `AppUserRepository` to be unavailable to `UserSecurityService` / `JwtAuthenticationFilter`.

Changes:
- Explicit `@EnableJpaRepositories(basePackages = "lk.gov.health.govcare")`
- Explicit `@EntityScan(basePackages = "lk.gov.health.govcare")`
- Removed packaged `spring-api/target` build output so Windows performs a clean compile from the corrected sources.
- Retains backend port 4002 and the prior Flyway V12 repair compatibility fix.
