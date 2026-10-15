package lk.gov.health.govcare.ai.predictive;

import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.Analysis;
import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.Observation;
import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.Trend;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Adult anemia review signal. Categories are prioritization aids and never establish CKD anemia. */
@Service
public class AnemiaRiskService {
    public static final String VERSION = "govcare-anemia-review-1.0.0";
    public static final String REFERENCE = "KDIGO 2026 Anemia in CKD Guideline; source laboratory reference interval preferred";

    public MonitoringSignal calculate(Analysis analysis, String recordedSex, LocalDate dateOfBirth) {
        Trend hemoglobin = trend(analysis, "hemoglobin");
        Observation latest = hemoglobin == null ? null : hemoglobin.latest();
        boolean unresolved = ClinicalDataQualityService.hasUnresolved(analysis, "hemoglobin");
        String freshness = ClinicalDataQualityService.freshness(latest, analysis.generatedAt(), 90, unresolved);
        if (!"FRESH".equals(freshness)) return unavailable(freshness, latest,
                "A usable hemoglobin result from the previous 90 days is required for an anemia review signal.");

        LocalDate on = analysis.generatedAt().atZone(ZoneOffset.UTC).toLocalDate();
        if (dateOfBirth == null || dateOfBirth.isAfter(on) || Period.between(dateOfBirth, on).getYears() < 18)
            return unavailable(freshness, latest, "This adult anemia review policy cannot run without verified adult eligibility.");

        Double lower = latest.referenceLow();
        String thresholdSource = "source laboratory lower reference limit";
        if (lower == null) {
            String sex = recordedSex == null ? "" : recordedSex.trim().toLowerCase(Locale.ROOT);
            if (SetLike.male(sex)) lower = 13.0;
            else if (SetLike.female(sex)) lower = 12.0;
            else return unavailable(freshness, latest,
                        "The source lower reference limit is missing and recorded sex cannot support the configured adult fallback threshold.");
            thresholdSource = "sex-specific adult screening fallback threshold; verify against the source laboratory range";
        }

        double deficit = lower - latest.value();
        Observation previous = hemoglobin.previous();
        boolean declining = previous != null && latest.value() <= previous.value() - 1.0;
        String category = deficit <= 0 ? declining ? "MONITOR" : "NORMAL"
                : deficit < 1.0 ? "MONITOR" : deficit < 2.0 ? "MODERATE_CONCERN" : "HIGH_CONCERN";
        String status = "NORMAL".equals(category) ? "NO_CURRENT_TRIGGER" : "REVIEW_REQUIRED";
        List<String> reasoning = new ArrayList<>();
        reasoning.add("Latest recorded hemoglobin is " + round(latest.value()) + " g/dL; comparison threshold is " + round(lower) + " g/dL (" + thresholdSource + ").");
        if (previous == null) reasoning.add("No prior usable hemoglobin result is available for trend comparison.");
        else reasoning.add("Previous hemoglobin was " + round(previous.value()) + " g/dL; trend is " + hemoglobin.trendDirection().toLowerCase() + ".");
        Trend egfr = trend(analysis, "egfr");
        if (egfr == null || egfr.latest() == null) reasoning.add("Current eGFR context is unavailable.");
        else reasoning.add("Recorded kidney context: eGFR " + round(egfr.latest().value()) + " mL/min/1.73m2, category "
                    + (analysis.classification().gCategory() == null ? "unavailable" : analysis.classification().gCategory()) + ". Association is not treated as causation.");
        reasoning.add("Concern bands are a transparent GovCare review-prioritization policy based on distance below the comparison threshold, not a validated outcome model.");
        String recommendation = "NORMAL".equals(category)
                ? "No current threshold trigger was generated. Continue interpretation in the complete clinical context."
                : "Confirm the result and source interval, review trend and alternative causes, and determine investigation or follow-up clinically.";
        String reason = "Anemia review signal only; it does not confirm CKD-related anemia or estimate a future probability.";
        return new MonitoringSignal(status, category, reason, round(latest.value()), previous == null ? null : round(previous.value()),
                latest.unit(), hemoglobin.trendDirection(), freshness, List.copyOf(reasoning), recommendation,
                hemoglobin.observations().stream().map(Observation::id).toList());
    }

    private MonitoringSignal unavailable(String freshness, Observation latest, String reason) {
        return new MonitoringSignal("INSUFFICIENT_DATA", null, reason, latest == null ? null : round(latest.value()), null,
                latest == null ? "g/dL" : latest.unit(), "UNAVAILABLE", freshness, List.of(reason),
                "Confirm a dated hemoglobin result, patient eligibility and source reference interval before review.",
                latest == null ? List.of() : List.of(latest.id()));
    }
    private static Trend trend(Analysis analysis, String key) { return analysis.trends().stream().filter(t -> key.equals(t.metric())).findFirst().orElse(null); }
    private static double round(double value) { return Math.round(value * 100.0) / 100.0; }
    private static final class SetLike {
        private static boolean male(String value) { return value.equals("male") || value.equals("m"); }
        private static boolean female(String value) { return value.equals("female") || value.equals("f"); }
    }
}
