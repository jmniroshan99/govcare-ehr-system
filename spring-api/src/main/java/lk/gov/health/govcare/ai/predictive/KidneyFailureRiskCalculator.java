package lk.gov.health.govcare.ai.predictive;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Collections;
import java.util.Map;

/**
 * The automatic predictive adapter stays inactive. The separate 5-Year CKD Outlook
 * workflow requires explicit clinical confirmation before using the published equation.
 */
@Component
public class KidneyFailureRiskCalculator implements PredictiveRiskAdapter {
    @Override public String getModelKey() { return "kfre"; }
    @Override public String getModelName() { return "Kidney Failure Risk Equation Adapter"; }
    @Override public String getModelVersion() { return "not-installed"; }
    @Override public String getTargetOutcome() { return "KIDNEY_FAILURE"; }
    @Override public String getForecastHorizon() { return "2-year / 5-year"; }
    @Override public List<String> getRequiredInputs() { return List.of("age", "sex", "egfr", "acr"); }
    @Override public String getValidationStatus() { return "NOT_INSTALLED"; }
    @Override public List<String> getApplicableCkdStages() { return List.of("G3a", "G3b", "G4", "G5"); }
    @Override public String getReference() { return "https://kidneyfailurerisk.com/"; }
    @Override public boolean canRun(Map<String, Object> patientData) { return false; }
    @Override public Map<String, Object> calculate(Map<String, Object> patientData) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("status", "NOT_INSTALLED");
        result.put("method", "VALIDATED_EQUATION");
        result.put("modelName", getModelName());
        result.put("modelVersion", getModelVersion());
        result.put("reference", getReference());
        result.put("applicableCKDStages", getApplicableCkdStages());
        result.put("requiredInputs", getRequiredInputs());
        result.put("2YearRisk", null);
        result.put("5YearRisk", null);
        result.put("validationStatus", getValidationStatus());
        result.put("localValidationStatus", getLocalValidationStatus());
        result.put("reason", "Automatic kidney-failure calculation is not enabled in this adapter. Use the 5-Year CKD Outlook tab to review source evidence, confirm clinical eligibility and record a published-equation assessment. No probability is calculated by this automatic route.");
        return Collections.unmodifiableMap(result);
    }
}
