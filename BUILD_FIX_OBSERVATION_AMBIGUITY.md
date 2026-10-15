# Backend build fix — Observation type ambiguity

Date: 2026-10-05.

## Cause

The previous `PredictiveIntelligenceService.java` imported both `org.hl7.fhir.r4.model.*` and static members of `ClinicalIntelligenceEngine.*`. Both expose a type named `Observation`. Java could not resolve the normalized-measurement variable at the previously reported line 124.

## Correction

Only one production file changes in this hotfix:

`spring-api/src/main/java/lk/gov/health/govcare/ai/PredictiveIntelligenceService.java`

- Replace the FHIR wildcard import with explicit imports for ClinicalImpression, Identifier, Patient, Provenance and Reference.
- Declare the normalized measurement as `ClinicalIntelligenceEngine.Observation`.

The declaration is now:

```java
ClinicalIntelligenceEngine.Observation normalized=checked.trends().stream().filter(t->t.metric().equals(key)).findFirst().orElseThrow().latest();
```

The FHIR resource names, serializers, clinical algorithms, API contracts, authentication, RBAC and database migration are unchanged. No new dependency or migration is needed.

## Apply to the existing Windows installation

Either extract the complete corrected ZIP into a separate source directory, or copy the corrected Java file from it over the same file in your current project. Your current frontend build already completed successfully; this import fix does not require frontend changes.

From the project root in PowerShell:

```powershell
npm run spring:build
cd spring-api
mvn clean test
```

`spring:build` performs `clean package -DskipTests`; it skips test execution. Run `mvn clean test` separately to execute the Java tests. Use the same Java 21/Maven installation that reached compilation in your supplied log.

## Verification

- Fresh Java syntax audit: all 147 Java files parsed, zero syntax errors.
- Fresh predictive checks: 53 actual Java domain checks, 24 frontend access tests and 23 ephemeral PGlite migration/database checks pass.
- Audited the clinical-intelligence files for the same FHIR/domain import overlap. The service no longer imports the FHIR Observation type by wildcard.
- Fresh Maven `clean test` attempt in the delivery environment remains blocked before compilation by DNS failure resolving the Spring Boot 3.5.3 parent from Maven Central. This is recorded as blocked, not a full compiler/test pass.

Raw hotfix evidence is included under `verification/modern-ui/observation-build-fix-*.log`. Full backend type linking and JUnit execution must be confirmed on the working Maven installation. The existing browser/screenshot verification limits remain unchanged.
