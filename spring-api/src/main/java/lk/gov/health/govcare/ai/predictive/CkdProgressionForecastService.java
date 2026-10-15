package lk.gov.health.govcare.ai.predictive;

import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.Analysis;
import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.Observation;
import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.Trend;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

/** Patient-specific eGFR extrapolation; never a disease probability or future-stage diagnosis. */
@Service
public class CkdProgressionForecastService {
    public static final String MODEL_KEY = "egfr_trajectory";
    public static final String MODEL_VERSION = "trend-linear-2.0";
    public static final String METHOD = "TREND_PROJECTION";
    public static final String VALIDATION_STATUS = "STATISTICAL_PROJECTION_NOT_CLINICALLY_VALIDATED";
    public static final String LOCAL_VALIDATION_STATUS = "NOT_APPLICABLE";

    public record Forecast(
            String status, int horizonMonths, Double currentEgfr, Double projectedEgfr,
            Double projectedEgfrLow, Double projectedEgfrHigh, Double slopePerYear,
            String trendDirection, String trendSeverity, String reliability,
            int observationCount, long observationWindowDays, String method,
            String modelVersion, String validationStatus, String localValidationStatus,
            Instant forecastOriginDate, Instant forecastDate, String intervalMethod,
            String explanation
    ) {}

    public Forecast calculate(Analysis analysis, int horizonMonths, boolean historyTruncated) {
        if (analysis == null) throw new IllegalArgumentException("Clinical analysis is required.");
        if (!List.of(3, 6, 12).contains(horizonMonths))
            throw new IllegalArgumentException("Forecast horizon must be 3, 6 or 12 months.");

        Trend trend = analysis.trends().stream().filter(t -> "egfr".equals(t.metric())).findFirst().orElse(null);
        List<Observation> points = trend == null ? List.of() : trend.observations();
        Instant origin = analysis.generatedAt();
        Instant target = origin.atZone(ZoneOffset.UTC).plusMonths(horizonMonths).toInstant();

        if (historyTruncated)
            return unavailable("INSUFFICIENT_DATA", horizonMonths, trend, points, origin, target,
                    "The longitudinal record exceeds the bounded retrieval limit. A projection is not generated from partial history.");
        if (points.size() < 2)
            return unavailable("INSUFFICIENT_DATA", horizonMonths, trend, points, origin, target,
                    "At least two valid, dated eGFR observations are required for a patient-specific trajectory projection.");

        Observation first = points.getFirst();
        Observation latest = points.getLast();
        long windowDays = Math.max(0, Duration.between(first.observedAt(), latest.observedAt()).toDays());
        if (windowDays < 90)
            return unavailable("INSUFFICIENT_DATA", horizonMonths, trend, points, origin, target,
                    "The valid eGFR observations must span at least 90 days before long-term projection.");
        if (analysis.safety().forecastSuppressed())
            return unavailable("BLOCKED_BY_SAFETY_GATE", horizonMonths, trend, points, origin, target,
                    "Long-term projection is blocked by the renal safety/data-quality gate. "
                            + String.join(" ", analysis.safety().reasons()));

        double[] x = new double[points.size()];
        double[] y = new double[points.size()];
        for (int i = 0; i < points.size(); i++) {
            x[i] = yearsBetween(first.observedAt(), points.get(i).observedAt());
            y[i] = points.get(i).value();
        }
        double xbar = mean(x), ybar = mean(y), sxx = 0, sxy = 0;
        for (int i = 0; i < x.length; i++) {
            double dx = x[i] - xbar;
            sxx += dx * dx;
            sxy += dx * (y[i] - ybar);
        }
        if (sxx <= 0)
            return unavailable("INSUFFICIENT_DATA", horizonMonths, trend, points, origin, target,
                    "Distinct measurement dates are required for a longitudinal projection.");

        double slope = sxy / sxx;
        double intercept = ybar - slope * xbar;
        double targetX = yearsBetween(first.observedAt(), target);
        double projected = intercept + slope * targetX;
        if (!Double.isFinite(projected) || projected < 0 || projected > 200)
            return unavailable("INSUFFICIENT_DATA", horizonMonths, trend, points, origin, target,
                    "Linear extrapolation leaves the configured physiologic display guardrails; the result is suppressed rather than clipped.");

        Double low = null, high = null;
        String intervalMethod = points.size() == 2
                ? "NOT_ESTIMATED_TWO_POINT_HISTORY"
                : "NOT_ESTIMATED_ZERO_RESIDUAL_VARIANCE";
        if (points.size() >= 3) {
            double sse = 0;
            for (int i = 0; i < x.length; i++) {
                double residual = y[i] - (intercept + slope * x[i]);
                sse += residual * residual;
            }
            int degreesOfFreedom = points.size() - 2;
            if (sse > 1e-12) {
                double residualSd = Math.sqrt(sse / degreesOfFreedom);
                double predictionSe = residualSd * Math.sqrt(1.0 + 1.0 / points.size()
                        + Math.pow(targetX - xbar, 2) / sxx);
                double margin = studentTCritical95(degreesOfFreedom) * predictionSe;
                double candidateLow = projected - margin, candidateHigh = projected + margin;
                if (Double.isFinite(candidateLow) && Double.isFinite(candidateHigh)
                        && candidateLow >= 0 && candidateHigh <= 200) {
                    low = round(candidateLow);
                    high = round(candidateHigh);
                    intervalMethod = "OLS_STUDENT_T_95_PERCENT_PREDICTION_INTERVAL";
                } else intervalMethod = "NOT_ESTIMATED_INTERVAL_OUTSIDE_PLAUSIBLE_RANGE";
            }
        }

        String reliability = reliability(points.size(), windowDays, analysis.quality().completenessPercent(), intervalMethod);
        String direction = slope < -1.0 ? "DECLINING" : slope > 1.0 ? "IMPROVING" : "STABLE";
        String severity = slope <= -5 ? "RAPID_DECLINE_SIGNAL" : slope < -1 ? "DECLINING"
                : Math.abs(slope) <= 1 ? "STABLE" : "IMPROVING";
        String intervalText = low == null || high == null
                ? "No statistical prediction interval is displayed (" + intervalMethod + ")."
                : "Approximate 95% Student-t prediction interval: " + low + " to " + high + " mL/min/1.73m2.";
        String explanation = "Projected from this patient's valid dated eGFR history using an ordinary least-squares trend. "
                + "The horizon is measured from calculation date " + origin + ", not from an old laboratory date. "
                + "Current recorded eGFR " + round(latest.value()) + "; " + horizonMonths + "-month point projection "
                + round(projected) + ". " + intervalText
                + " This is a statistical extrapolation, not a probability, diagnosis or guaranteed future CKD stage.";
        return new Forecast("AVAILABLE", horizonMonths, round(latest.value()), round(projected), low, high,
                round(slope), direction, severity, reliability, points.size(), windowDays, METHOD, MODEL_VERSION,
                VALIDATION_STATUS, LOCAL_VALIDATION_STATUS, origin, target, intervalMethod, explanation);
    }

    private Forecast unavailable(String status, int horizon, Trend trend, List<Observation> points,
                                 Instant origin, Instant target, String reason) {
        Double current = trend == null || trend.latest() == null ? null : round(trend.latest().value());
        long window = points.size() < 2 ? 0
                : Math.max(0, Duration.between(points.getFirst().observedAt(), points.getLast().observedAt()).toDays());
        return new Forecast(status, horizon, current, null, null, null,
                trend == null ? null : trend.slopePerYear(), "UNAVAILABLE", "UNAVAILABLE", "LOW",
                points.size(), window, METHOD, MODEL_VERSION, VALIDATION_STATUS, LOCAL_VALIDATION_STATUS,
                origin, target, "NOT_ESTIMATED", reason);
    }

    private static String reliability(int n, long days, Integer completeness, String intervalMethod) {
        if (n == 2) return "LOW";
        int score = n >= 5 ? 2 : 1;
        if (days >= 365) score += 2; else if (days >= 180) score += 1;
        if (completeness != null && completeness >= 80) score += 1;
        if (!intervalMethod.startsWith("OLS_")) score = Math.min(score, 2);
        return score >= 4 ? "HIGH" : score >= 2 ? "MODERATE" : "LOW";
    }

    private static double studentTCritical95(int df) {
        double[] values = {12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,
                2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,
                2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042};
        if (df <= values.length) return values[Math.max(1, df) - 1];
        if (df <= 40) return 2.021;
        if (df <= 60) return 2.000;
        if (df <= 120) return 1.980;
        return 1.960;
    }

    private static double yearsBetween(Instant start, Instant end) {
        return Duration.between(start, end).toSeconds() / 31557600.0;
    }
    private static double mean(double[] values) {
        double sum = 0; for (double value : values) sum += value; return sum / values.length;
    }
    private static double round(double value) { return Math.round(value * 100.0) / 100.0; }
}
