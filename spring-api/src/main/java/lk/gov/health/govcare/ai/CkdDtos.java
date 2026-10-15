package lk.gov.health.govcare.ai;
import java.math.BigDecimal;
import java.util.Map;
public final class CkdDtos { private CkdDtos(){} public record PredictionRequest(String patientId,String requestId,Map<String,BigDecimal> features,Map<String,Map<String,Object>> sources){} }
