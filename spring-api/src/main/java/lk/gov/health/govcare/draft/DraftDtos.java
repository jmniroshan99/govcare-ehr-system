package lk.gov.health.govcare.draft;
import java.util.Map;
public final class DraftDtos { private DraftDtos(){} public record SaveRequest(String draftId,String patientId,String workflowType,String formType,Map<String,Object> data,String status,Integer version,String requestId){} public record ActionRequest(String reason,Integer version){} }
