package lk.gov.health.govcare.ai.predictive;

import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.Analysis;
import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.Observation;
import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.Trend;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Current potassium review categories based on UK Kidney Association thresholds; no future probability. */
@Service
public class HyperkalemiaRiskService {
    public static final String VERSION = "govcare-potassium-1.0.0";
    public static final String REFERENCE = "UK Kidney Association Hyperkalaemia Guideline (https://guidelines.ukkidney.org/hyperkalaemia/)";

    public MonitoringSignal calculate(Analysis analysis, List<String> medicationClasses, boolean medicationContextAvailable) {
        Trend potassium = trend(analysis, "potassium");
        Observation latest = potassium == null ? null : potassium.latest();
        boolean unresolved = ClinicalDataQualityService.hasUnresolved(analysis, "potassium");
        String freshness = ClinicalDataQualityService.freshness(latest, analysis.generatedAt(), 90, unresolved);
        if (!"FRESH".equals(freshness)) {
            return unavailable(freshness, latest,
                    "A usable potassium result from the previous 90 days is required before assigning a monitoring category.");
        }

        double value = latest.value();
        String category = value >= 6.5 ? "CRITICAL" : value >= 6.0 ? "HIGH" : value >= 5.5 ? "MODERATE" : "LOW";
        String status = "LOW".equals(category) ? "NO_CURRENT_TRIGGER" : "REVIEW_REQUIRED";
        Observation previous = potassium.previous();
        List<String> reasoning = new ArrayList<>();
        reasoning.add("Latest recorded potassium is " + round(value) + " mmol/L (" + category + " current-value review category).");
        if (previous != null) reasoning.add("Previous recorded potassium was " + round(previous.value()) + " mmol/L; trend is " + potassium.trendDirection().toLowerCase() + ".");
        else reasoning.add("No prior usable potassium value is available for a longitudinal comparison.");
        List<String> classes = medicationClasses == null ? List.of() : medicationClasses.stream().distinct().toList();
        if (medicationContextAvailable) {
            Set<String> relevant = Set.of("ACEi", "ARB", "MRA", "NSAID", "OTHER_POTASSIUM_AFFECTING");
            List<String> matched = classes.stream().filter(relevant::contains).toList();
            reasoning.add(matched.isEmpty()
                    ? "No potassium-affecting class was recognized in recent active prescription records; actual use still requires reconciliation."
                    : "Recent prescription context includes " + String.join(", ", matched) + "; indication, dose, actual use and stop dates are not inferred.");
        } else reasoning.add("Medication context is unavailable; reconcile prescribed, over-the-counter and recently stopped medicines.");
        String recommendation = switch (category) {
            case "CRITICAL" -> "Urgently verify the result and arrange immediate clinical assessment under the local hyperkalaemia pathway; do not act on this signal alone.";
            case "HIGH" -> "Promptly verify the result, symptoms, ECG/acute context and medication list under the local hyperkalaemia pathway.";
            case "MODERATE" -> "Review result validity, renal function, trend and medication context; determine repeat testing urgency clinically.";
            default -> "No current threshold trigger was generated. Continue interpretation and monitoring in the patient's full clinical context.";
        };
        String reason = "Rule-based current potassium monitoring; this does not estimate future hyperkalemia probability or confirm a diagnosis.";
        List<String> evidence = potassium.observations().stream().map(Observation::id).toList();
        return new MonitoringSignal(status, category, reason, round(value), previous == null ? null : round(previous.value()),
                latest.unit(), potassium.trendDirection(), freshness, List.copyOf(reasoning), recommendation, evidence);
    }

    private MonitoringSignal unavailable(String freshness, Observation latest, String reason) {
        return new MonitoringSignal("INSUFFICIENT_DATA", null, reason, latest == null ? null : round(latest.value()), null,
                latest == null ? "mmol/L" : latest.unit(), "UNAVAILABLE", freshness, List.of(reason),
                "Confirm a dated potassium result and reconcile medication context before review.", latest == null ? List.of() : List.of(latest.id()));
    }
    private static Trend trend(Analysis analysis, String key) { return analysis.trends().stream().filter(t -> key.equals(t.metric())).findFirst().orElse(null); }
    private static double round(double value) { return Math.round(value * 100.0) / 100.0; }
}
