package lk.gov.health.govcare.ai;
import java.util.Map;
public final class AIIntelligenceDtos { private AIIntelligenceDtos(){} public record PredictionRequest(String patientId, Map<String,Object> features){} }
