package lk.gov.health.govcare.ai.predictive;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/** Explicitly unavailable until a reviewed, licensed and population-appropriate equation is integrated. */
@Component
public class CardiovascularRiskCalculator implements PredictiveRiskAdapter {
    @Override public String getModelKey() { return "cardiovascular"; }
    @Override public String getModelName() { return "Cardiovascular Risk Equation Adapter"; }
    @Override public String getModelVersion() { return "not-installed"; }
    @Override public String getTargetOutcome() { return "CARDIOVASCULAR"; }
    @Override public String getForecastHorizon() { return "Model-specific"; }
    @Override public List<String> getRequiredInputs() { return List.of("age", "sex", "systolic", "total_cholesterol", "hdl", "smoking_status", "diabetes_status", "treatment_context"); }
    @Override public String getValidationStatus() { return "NOT_INSTALLED"; }
    @Override public boolean canRun(Map<String, Object> patientData) { return false; }
    @Override public Map<String, Object> calculate(Map<String, Object> patientData) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("status", "NOT_INSTALLED");
        result.put("method", "VALIDATED_EQUATION");
        result.put("modelName", getModelName());
        result.put("modelVersion", getModelVersion());
        result.put("requiredInputs", getRequiredInputs());
        result.put("probability", null);
        result.put("validationStatus", getValidationStatus());
        result.put("localValidationStatus", getLocalValidationStatus());
        result.put("reason", "No reviewed cardiovascular equation adapter is installed. No probability is calculated.");
        return Collections.unmodifiableMap(result);
    }
}
