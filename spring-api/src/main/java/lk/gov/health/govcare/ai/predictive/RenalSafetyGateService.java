package lk.gov.health.govcare.ai.predictive;

import lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.*;

import java.time.*;
import java.util.*;

/** Authoritative pre-projection gate. Laboratory triggers are review signals, not AKI/CKD diagnoses. */
public final class RenalSafetyGateService {
    public Safety evaluate(Map<String, Trend> data, Instant now, LocalDate dob, List<QualityFlag> flags) {
        List<String> reasons = new ArrayList<>();
        Trend creatinine = data.get("creatinine"), egfr = data.get("egfr");
        Observation latestCreatinine = creatinine == null ? null : creatinine.latest();
        boolean aki = false;
        if (ClinicalDataQualityService.fresh(latestCreatinine, now, 7)) for (Observation prior : creatinine.observations()) {
            if (!prior.observedAt().isBefore(latestCreatinine.observedAt())) continue;
            long seconds = Duration.between(prior.observedAt(), latestCreatinine.observedAt()).getSeconds();
            if ((seconds <= 172800 && latestCreatinine.value() - prior.value() >= 0.3 - 1e-9)
                    || (seconds <= 604800 && latestCreatinine.value() >= 1.5 * prior.value())) { aki = true; break; }
        }
        if (aki) reasons.add("A recent creatinine rise meets a laboratory AKI review criterion (≥0.3 mg/dL within 48 hours or ≥1.5× within 7 days). This is not an AKI diagnosis; chronic forecasts are suppressed pending clinical review.");
        boolean abrupt = egfr != null && egfr.previous() != null && egfr.previous().value() > 0
                && ClinicalDataQualityService.fresh(egfr.latest(), now, 30)
                && Duration.between(egfr.previous().observedAt(), egfr.latest().observedAt()).compareTo(Duration.ofDays(30)) <= 0
                && (egfr.latest().value() - egfr.previous().value()) / egfr.previous().value() < -0.20 - 1e-12;
        if (abrupt) reasons.add("eGFR fell by more than 20% between recent results no more than 30 days apart. GovCare review policy blocks long-term projection until abrupt deterioration is reviewed; this does not establish a diagnosis.");
        if (ClinicalDataQualityService.hasUnresolved(flags, "egfr") || ClinicalDataQualityService.hasUnresolved(flags, "creatinine"))
            reasons.add("Renal observations have unresolved date, unit, provenance, plausibility or conflicting-result issues. Reconcile the source records before forecasting.");
        if (egfr == null || !ClinicalDataQualityService.fresh(egfr.latest(), now, 90)) reasons.add("A usable eGFR result from the previous 90 days is unavailable.");
        if (!ClinicalDataQualityService.fresh(latestCreatinine, now, 90)) reasons.add("A usable creatinine result from the previous 90 days is unavailable.");
        if (egfr == null || egfr.observations().size() < 2 || egfr.baseline() == null || egfr.latest() == null
                || Duration.between(egfr.baseline().observedAt(), egfr.latest().observedAt()).compareTo(Duration.ofDays(90)) < 0)
            reasons.add("At least two dated eGFR measurements spanning 90 days are required by the longitudinal sufficiency policy.");
        LocalDate assessmentDate = now.atZone(ZoneOffset.UTC).toLocalDate();
        if (dob == null) reasons.add("Verified date of birth is unavailable for adult model eligibility checks.");
        else if (dob.isAfter(assessmentDate) || Period.between(dob, assessmentDate).getYears() > 120)
            reasons.add("The recorded date of birth is implausible; adult eligibility must be verified.");
        else if (Period.between(dob, assessmentDate).getYears() < 18) reasons.add("Adult kidney models are not enabled for patients under 18.");
        return new Safety(aki ? "POSSIBLE_AKI" : abrupt ? "RAPID_RENAL_CHANGE" : reasons.isEmpty() ? "REVIEW_CONTEXT" : "INSUFFICIENT_DATA",
                !reasons.isEmpty(), List.copyOf(reasons),
                "KDIGO 2012 AKI 2.1.1; KDIGO 2024 CKD practice point 2.1.3; GovCare longitudinal review policy v2 (90-day freshness/history and 30-day abrupt-change window)");
    }
}
