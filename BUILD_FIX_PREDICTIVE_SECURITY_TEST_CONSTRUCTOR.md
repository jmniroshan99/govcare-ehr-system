# GovCare Predictive Intelligence Test-Compile Fix

## Problem
`run-windows.bat` started the frontend successfully but the Spring Boot startup stopped during Maven `testCompile`.

The failing test was:

`spring-api/src/test/java/lk/gov/health/govcare/ai/PredictiveIntelligenceSecurityTest.java`

`PredictiveIntelligenceService` was extended for Future Disease Forecasting and now requires six constructor dependencies:

1. `SqlSupport`
2. `JsonSupport`
3. `ObjectMapper`
4. `ClinicalPatientAccess`
5. `CkdProgressionForecastService`
6. `KidneyFailureRiskCalculator`

The security test still constructed the service with the previous four-argument constructor, so Maven failed during test compilation before Spring Boot could start.

## Fix Applied
Updated all three manual `new PredictiveIntelligenceService(...)` calls in `PredictiveIntelligenceSecurityTest` to supply mocked forecasting dependencies:

- `mock(CkdProgressionForecastService.class)`
- `mock(KidneyFailureRiskCalculator.class)`

Added the predictive package import required by the test.

## Why This Is the Correct Fix
The new production dependencies are valid parts of the forecasting architecture. The security tests are specifically checking that authorization fails before clinical data access. Mocking these downstream forecasting dependencies preserves that test boundary and avoids weakening the production constructor or security design.

## Functional Impact
No production runtime behavior, clinical rules, database schema, API behavior, or existing patient data was changed by this build fix.

## Validation
Static validation completed:

- Confirmed the production constructor requires six dependencies.
- Confirmed all three stale four-argument test constructor calls were updated.
- Confirmed both new dependency classes exist in the project source.
- Confirmed no remaining `new PredictiveIntelligenceService(...)` call uses the old signature in the test tree.

Full Maven execution could not be rerun in the packaging environment because Apache Maven is not installed here. Run the commands below on the target Windows machine where the original error occurred.

## Windows Validation
From the project root:

```bat
cd spring-api
mvn clean test
mvn clean package
cd ..
run-windows.bat
```

Expected result: the previous `actual and formal argument lists differ in length` error in `PredictiveIntelligenceSecurityTest` should no longer occur.
