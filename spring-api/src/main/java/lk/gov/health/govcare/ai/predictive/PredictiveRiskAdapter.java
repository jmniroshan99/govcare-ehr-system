package lk.gov.health.govcare.ai.predictive;

import java.util.List;
import java.util.Map;

/** Extension point for reviewed outcome-specific equations or ML models. */
public interface PredictiveRiskAdapter {
    String getModelKey();
    String getModelName();
    String getModelVersion();
    String getTargetOutcome();
    String getForecastHorizon();
    List<String> getRequiredInputs();
    String getValidationStatus();
    default String getLocalValidationStatus() { return "NOT_LOCALLY_VALIDATED"; }
    default String getRuntimeStatus() { return "NOT_INSTALLED"; }
    default List<String> getApplicableCkdStages() { return List.of(); }
    default String getReference() { return null; }
    boolean canRun(Map<String, Object> patientData);
    Map<String, Object> calculate(Map<String, Object> patientData);
}
