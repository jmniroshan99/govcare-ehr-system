package lk.gov.health.govcare.ai.predictive;

import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CkdProgressionForecastServiceTest {
    private final CkdProgressionForecastService service = new CkdProgressionForecastService();

    @Test
    void projectsDecliningEgfrFromLongitudinalHistory() {
        Instant now = Instant.parse("2026-10-01T00:00:00Z");
        List<ClinicalIntelligenceEngine.RawObservation> raw = List.of(
                egfr("1", 52, now.minus(365, ChronoUnit.DAYS)),
                egfr("2", 48, now.minus(270, ChronoUnit.DAYS)),
                egfr("3", 44, now.minus(180, ChronoUnit.DAYS)),
                egfr("4", 40, now.minus(90, ChronoUnit.DAYS)),
                egfr("5", 38, now.minus(5, ChronoUnit.DAYS)),
                creatinine("c1", 1.3, now.minus(90, ChronoUnit.DAYS)),
                creatinine("c2", 1.4, now.minus(5, ChronoUnit.DAYS))
        );
        var analysis = ClinicalIntelligenceEngine.analyze(raw, now, LocalDate.of(1970,1,1));
        var result = service.calculate(analysis, 6, false);
        assertEquals("AVAILABLE", result.status());
        assertEquals("TREND_PROJECTION", result.method());
        assertNotNull(result.projectedEgfr());
        assertTrue(result.projectedEgfr() < result.currentEgfr());
        assertEquals("DECLINING", result.trendDirection());
        assertNotNull(result.projectedEgfrLow());
        assertNotNull(result.projectedEgfrHigh());
    }

    @Test
    void blocksProjectionWhenAkiSafetyTriggerIsPresent() {
        Instant now = Instant.parse("2026-10-01T00:00:00Z");
        List<ClinicalIntelligenceEngine.RawObservation> raw = List.of(
                egfr("1", 48, now.minus(180, ChronoUnit.DAYS)),
                egfr("2", 45, now.minus(90, ChronoUnit.DAYS)),
                egfr("3", 42, now.minus(2, ChronoUnit.DAYS)),
                creatinine("c1", 1.0, now.minus(2, ChronoUnit.DAYS)),
                creatinine("c2", 1.5, now.minus(1, ChronoUnit.DAYS))
        );
        var analysis = ClinicalIntelligenceEngine.analyze(raw, now, LocalDate.of(1970,1,1));
        var result = service.calculate(analysis, 6, false);
        assertEquals("BLOCKED_BY_SAFETY_GATE", result.status());
        assertNull(result.projectedEgfr());
    }

    @Test
    void returnsInsufficientDataForSingleEgfr() {
        Instant now = Instant.parse("2026-10-01T00:00:00Z");
        var analysis = ClinicalIntelligenceEngine.analyze(List.of(egfr("1", 45, now.minus(10, ChronoUnit.DAYS))), now, LocalDate.of(1970,1,1));
        var result = service.calculate(analysis, 12, false);
        assertEquals("INSUFFICIENT_DATA", result.status());
    }

    @Test
    void twoPointHistoryProducesLowReliabilityPointEstimateWithoutInventedInterval() {
        Instant now = Instant.parse("2026-10-01T00:00:00Z");
        var analysis = ClinicalIntelligenceEngine.analyze(List.of(
                egfr("e1", 50, now.minus(90, ChronoUnit.DAYS)),
                egfr("e2", 48, now),
                creatinine("c1", 1.2, now)
        ), now, LocalDate.of(1970, 1, 1));

        var result = service.calculate(analysis, 3, false);

        assertEquals("AVAILABLE", result.status());
        assertEquals("LOW", result.reliability());
        assertNull(result.projectedEgfrLow());
        assertNull(result.projectedEgfrHigh());
        assertEquals("NOT_ESTIMATED_TWO_POINT_HISTORY", result.intervalMethod());
    }

    @Test
    void requiresEgfrHistoryToSpanNinetyDays() {
        Instant now = Instant.parse("2026-10-01T00:00:00Z");
        var analysis = ClinicalIntelligenceEngine.analyze(List.of(
                egfr("e1", 50, now.minus(89, ChronoUnit.DAYS)),
                egfr("e2", 48, now),
                creatinine("c1", 1.2, now)
        ), now, LocalDate.of(1970, 1, 1));

        var result = service.calculate(analysis, 3, false);

        assertEquals("INSUFFICIENT_DATA", result.status());
        assertTrue(result.explanation().contains("span at least 90 days"));
    }

    @Test
    void forecastHorizonStartsAtCalculationTimeRatherThanLatestObservation() {
        Instant now = Instant.parse("2026-10-01T00:00:00Z");
        var analysis = ClinicalIntelligenceEngine.analyze(List.of(
                egfr("e1", 52, now.minus(180, ChronoUnit.DAYS)),
                egfr("e2", 50, now.minus(2, ChronoUnit.DAYS)),
                creatinine("c1", 1.1, now.minus(2, ChronoUnit.DAYS))
        ), now, LocalDate.of(1970, 1, 1));

        var result = service.calculate(analysis, 6, false);

        assertEquals(now, result.forecastOriginDate());
        assertEquals(Instant.parse("2027-04-01T00:00:00Z"), result.forecastDate());
    }

    private static ClinicalIntelligenceEngine.RawObservation egfr(String id, double value, Instant at) {
        return new ClinicalIntelligenceEngine.RawObservation(id,"egfr",value,"mL/min/1.73m2",at.toString(),"TEST",null,null,null,"48642-3");
    }
    private static ClinicalIntelligenceEngine.RawObservation creatinine(String id, double value, Instant at) {
        return new ClinicalIntelligenceEngine.RawObservation(id,"creatinine",value,"mg/dL",at.toString(),"TEST",null,null,null,"2160-0");
    }
}
