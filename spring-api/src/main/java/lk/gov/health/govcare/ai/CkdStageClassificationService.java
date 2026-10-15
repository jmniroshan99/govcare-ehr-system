package lk.gov.health.govcare.ai;

import org.springframework.stereotype.Service;

/**
 * Single source of truth for eGFR-based CKD G-category coding assistance.
 * This is decision support only: a single eGFR does not establish chronicity/CKD diagnosis.
 */
@Service
public class CkdStageClassificationService {
    public static final String ICD_SYSTEM = "http://hl7.org/fhir/sid/icd-10-cm";
    public static final String CODING_STATUS = "AI_ASSISTED_SUGGESTION";

    public StageAssessment classify(Double egfr) {
        if (egfr == null || !Double.isFinite(egfr) || egfr < 0) {
            return new StageAssessment(null, null, null, null,
                    "Unable to classify from available reviewed data", CODING_STATUS,
                    "Clinician review required");
        }
        if (egfr >= 90) return stage("G1", "Stage 1", "N18.1", "Chronic kidney disease, stage 1", egfr);
        if (egfr >= 60) return stage("G2", "Stage 2", "N18.2", "Chronic kidney disease, stage 2", egfr);
        if (egfr >= 45) return stage("G3a", "Stage 3a", "N18.31", "Chronic kidney disease, stage 3a", egfr);
        if (egfr >= 30) return stage("G3b", "Stage 3b", "N18.32", "Chronic kidney disease, stage 3b", egfr);
        if (egfr >= 15) return stage("G4", "Stage 4", "N18.4", "Chronic kidney disease, stage 4 (severe)", egfr);
        // eGFR <15 supports G5. N18.6 ESRD is never inferred from eGFR alone.
        return stage("G5", "Stage 5", "N18.5", "Chronic kidney disease, stage 5", egfr);
    }

    private StageAssessment stage(String gCategory, String stage, String code, String display, double egfr) {
        return new StageAssessment(gCategory, stage, code, display,
                "Reviewed eGFR " + format(egfr) + " mL/min/1.73m²; chronicity and diagnosis require clinician confirmation",
                CODING_STATUS, "Clinician confirmation required");
    }

    private static String format(double value) {
        return value == Math.rint(value) ? String.format(java.util.Locale.ROOT, "%.0f", value)
                : String.format(java.util.Locale.ROOT, "%.1f", value);
    }

    public record StageAssessment(String gCategory, String suggestedStage, String suggestedIcdCode,
                                  String clinicalDescription, String basis, String codingStatus,
                                  String confirmationStatus) {}
}
