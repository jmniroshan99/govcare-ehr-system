package lk.gov.health.govcare.ai.predictive;

import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MonitoringRiskServicesTest {
    private static final Instant NOW = Instant.parse("2026-10-01T00:00:00Z");
    private static final LocalDate ADULT_DOB = LocalDate.of(1970, 1, 1);

    @ParameterizedTest
    @CsvSource({"5.49,LOW", "5.5,MODERATE", "6.0,HIGH", "6.5,CRITICAL"})
    void appliesTransparentPotassiumBoundaryCategories(double value, String expected) {
        var analysis = analyze(potassium("k1", value, NOW.minus(1, ChronoUnit.DAYS)));

        var result = new HyperkalemiaRiskService().calculate(analysis, List.of("ACEi", "ACEi"), true);

        assertEquals(expected, result.category());
        assertTrue(result.reason().contains("probability"));
        assertEquals("FRESH", result.freshness());
        assertTrue(result.reasoning().stream().anyMatch(line -> line.contains("ACEi")));
    }

    @Test
    void withholdsPotassiumCategoryWhenTheLatestResultIsStale() {
        var analysis = analyze(potassium("k1", 6.5, NOW.minus(91, ChronoUnit.DAYS)));

        var result = new HyperkalemiaRiskService().calculate(analysis, List.of(), false);

        assertEquals("INSUFFICIENT_DATA", result.status());
        assertNull(result.category());
        assertEquals("STALE", result.freshness());
    }

    @ParameterizedTest
    @CsvSource({"12.2,NORMAL", "11.5,MONITOR", "10.5,MODERATE_CONCERN", "9.9,HIGH_CONCERN"})
    void appliesAnemiaReviewBandsAgainstSourceLowerReference(double value, String expected) {
        var analysis = analyze(hemoglobin("h1", value, 12.0, NOW.minus(1, ChronoUnit.DAYS)));

        var result = new AnemiaRiskService().calculate(analysis, "female", ADULT_DOB);

        assertEquals(expected, result.category());
        assertTrue(result.reason().contains("does not confirm"));
        assertTrue(result.reasoning().stream().anyMatch(line -> line.contains("source laboratory")));
    }

    @Test
    void anemiaFallbackFailsClosedWithoutRecordedSexOrSourceRange() {
        var analysis = analyze(hemoglobin("h1", 10.0, null, NOW.minus(1, ChronoUnit.DAYS)));

        var result = new AnemiaRiskService().calculate(analysis, null, ADULT_DOB);

        assertEquals("INSUFFICIENT_DATA", result.status());
        assertNull(result.category());
        assertTrue(result.reason().contains("recorded sex"));
    }

    @Test
    void renalSafetyGateSuppressesLongTermProjectionAtAkiReviewBoundary() {
        var analysis = ClinicalIntelligenceEngine.analyze(List.of(
                egfr("e1", 46, NOW.minus(100, ChronoUnit.DAYS)),
                egfr("e2", 45, NOW.minus(1, ChronoUnit.DAYS)),
                creatinine("c1", 1.0, NOW.minus(2, ChronoUnit.DAYS)),
                creatinine("c2", 1.3, NOW.minus(1, ChronoUnit.DAYS))
        ), NOW, ADULT_DOB);

        assertEquals("POSSIBLE_AKI", analysis.safety().status());
        assertTrue(analysis.safety().forecastSuppressed());
        assertTrue(analysis.safety().reasons().stream().anyMatch(reason -> reason.contains("0.3 mg/dL")));
    }

    private static ClinicalIntelligenceEngine.Analysis analyze(ClinicalIntelligenceEngine.RawObservation observation) {
        return ClinicalIntelligenceEngine.analyze(List.of(observation), NOW, ADULT_DOB);
    }

    private static ClinicalIntelligenceEngine.RawObservation potassium(String id, double value, Instant at) {
        return new ClinicalIntelligenceEngine.RawObservation(id, "potassium", value, "mmol/L", at.toString(),
                "TEST", null, 3.5, 5.4, "2823-3");
    }

    private static ClinicalIntelligenceEngine.RawObservation hemoglobin(String id, double value, Double lower, Instant at) {
        return new ClinicalIntelligenceEngine.RawObservation(id, "hemoglobin", value, "g/dL", at.toString(),
                "TEST", null, lower, 17.0, "718-7");
    }

    private static ClinicalIntelligenceEngine.RawObservation egfr(String id, double value, Instant at) {
        return new ClinicalIntelligenceEngine.RawObservation(id, "egfr", value, "mL/min/1.73m2", at.toString(),
                "TEST", null, null, null, "48642-3");
    }

    private static ClinicalIntelligenceEngine.RawObservation creatinine(String id, double value, Instant at) {
        return new ClinicalIntelligenceEngine.RawObservation(id, "creatinine", value, "mg/dL", at.toString(),
                "TEST", null, null, null, "2160-0");
    }
}
