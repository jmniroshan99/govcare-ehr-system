package lk.gov.health.govcare.ai.predictive;

import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.*;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/** Shared evidence-quality policy; completeness is coverage, never model confidence. */
public final class ClinicalDataQualityService {
    public static final List<String> REQUIRED = List.of("egfr", "creatinine", "acr", "systolic", "hba1c", "potassium", "hemoglobin");
    private static final Set<String> EXCLUSIONS = Set.of("MISSING_CLINICAL_DATE", "FUTURE_CLINICAL_DATE", "NON_NUMERIC_VALUE",
            "UNSUPPORTED_UNIT", "IMPLAUSIBLE_VALUE", "CONFLICTING_RESULT", "MISSING_PROVENANCE", "WRONG_PATIENT",
            "PATIENT_MISMATCH", "METRIC_CODE_CONFLICT", "FHIR_PATIENT_MISMATCH", "FHIR_MISSING_PROVENANCE",
            "FHIR_INVALID_UNIT", "FHIR_COMPARATOR_UNSUPPORTED", "WRONG_PATIENT_OR_MISSING_SUBJECT",
            "INVALID_FHIR_RESOURCE");

    public Quality summarize(List<Observation> included, List<Trend> trends, List<QualityFlag> inputFlags, Instant now) {
        List<QualityFlag> flags = new ArrayList<>(inputFlags);
        Map<String, Trend> byMetric = new HashMap<>();
        for (Trend trend : trends) {
            byMetric.put(trend.metric(), trend);
            if (trend.latest() != null && !fresh(trend.latest(), now, 90)) {
                flags.add(new QualityFlag("STALE_MEASUREMENT", trend.label() + " has no usable result within the 90-day review freshness policy.",
                        trend.latest().id(), trend.metric()));
            }
        }
        List<String> missing = REQUIRED.stream().filter(key -> {
            Trend trend = byMetric.get(key);
            return trend == null || !fresh(trend.latest(), now, 90) || hasUnresolved(flags, key);
        }).toList();
        for (String key : missing) if (byMetric.get(key) == null || byMetric.get(key).latest() == null)
            flags.add(new QualityFlag("MISSING_REQUIRED_METRIC", "No usable " + key + " measurement is available.", null, key));
        Trend egfr = byMetric.get("egfr");
        if (egfr == null || egfr.observations().size() < 2 || egfr.baseline() == null || egfr.latest() == null
                || Duration.between(egfr.baseline().observedAt(), egfr.latest().observedAt()).toDays() < 90) {
            flags.add(new QualityFlag("INSUFFICIENT_LONGITUDINAL_HISTORY", "At least two dated eGFR measurements spanning 90 days are required for projection.", null, "egfr"));
        } else if (egfr.observations().size() == 2) {
            flags.add(new QualityFlag("TWO_POINT_HISTORY", "Only two eGFR observations are available: any permitted projection is a low-reliability point estimate without an interval.", null, "egfr"));
        }
        int excluded = (int) inputFlags.stream().filter(f -> EXCLUSIONS.contains(f.code()))
                .map(f -> f.observationId() == null ? f.code() + "|" + f.metric() : f.observationId()).distinct().count();
        int available = REQUIRED.size() - missing.size();
        Integer completeness = included.isEmpty() ? null : (int) Math.round(100.0 * available / REQUIRED.size());
        return new Quality(included.size(), excluded, available, REQUIRED.size(), completeness,
                "Seven core review metrics with usable, unconflicted results in the previous 90 days. Extended history is shown separately. Completeness is not model confidence.",
                missing, List.copyOf(flags), qualityLevel(included.size(), completeness, flags));
    }

    public static boolean fresh(Observation observation, Instant now, int days) {
        return observation != null && observation.observedAt() != null && !observation.observedAt().isAfter(now)
                && !observation.observedAt().isBefore(now.minus(Duration.ofDays(days)));
    }

    public static String freshness(Observation observation, Instant now, int days, boolean unresolved) {
        if (unresolved) return "UNRESOLVED";
        if (observation == null) return "MISSING";
        return fresh(observation, now, days) ? "FRESH" : "STALE";
    }

    public static boolean hasUnresolved(List<QualityFlag> flags, String metric) {
        return flags.stream().anyMatch(f -> Objects.equals(metric, f.metric()) && EXCLUSIONS.contains(f.code()));
    }

    public static boolean hasUnresolved(Analysis analysis, String metric) {
        if (hasUnresolved(analysis.quality().flags(), metric)) return true;
        // Older producers carry only observation IDs. Resolve their metric from retained evidence where possible.
        Set<String> ids = new HashSet<>();
        analysis.trends().stream().filter(t -> metric.equals(t.metric())).forEach(t -> t.observations().forEach(o -> ids.add(o.id())));
        return analysis.quality().flags().stream().anyMatch(f -> f.metric() == null && ids.contains(f.observationId()) && EXCLUSIONS.contains(f.code()));
    }

    public static String qualityLevel(int included, Integer completeness, List<QualityFlag> flags) {
        if (included == 0 || completeness == null) return "UNUSABLE";
        if (flags.stream().anyMatch(f -> EXCLUSIONS.contains(f.code())) || completeness < 60) return "LIMITED";
        return completeness >= 85 ? "HIGH" : "MODERATE";
    }
}
