package lk.gov.health.govcare.fhir;
import lk.gov.health.govcare.security.GovCarePrincipal; import org.springframework.security.core.annotation.AuthenticationPrincipal; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.web.bind.annotation.*; import java.util.*;
@RestController @RequestMapping("/api/clinical-coding") public class ClinicalCodingController {
 private final ClinicalCodingService service; public ClinicalCodingController(ClinicalCodingService s){service=s;}
 public record ConditionRequest(UUID patientId,String system,String code){}
 @PostMapping("/conditions") @PreAuthorize("hasAnyAuthority('CONSULTATION_CREATE','CONSULTATION_UPDATE')") public Map<String,Object> condition(@AuthenticationPrincipal GovCarePrincipal actor,@RequestBody ConditionRequest r){if(r.patientId()==null) throw new IllegalArgumentException("patientId is required"); return service.saveCondition(actor,r.patientId(),r.system(),r.code());}
}
