package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.util.UUID;
@RestController @RequestMapping("/api/ai-cdss/ckd")
public class CkdClinicalEvidenceController {
 private final CkdClinicalEvidenceService evidence;private final CkdResearchDemoService demo;private final CurrentUser user;
 public CkdClinicalEvidenceController(CkdClinicalEvidenceService evidence,CkdResearchDemoService demo,CurrentUser user){this.evidence=evidence;this.demo=demo;this.user=user;}
 @PostMapping("/patients/{patientId}/clinical-evidence/trends") public ResponseEntity<?> trend(@PathVariable UUID patientId,@RequestBody CkdClinicalEvidenceService.TrendRequest request){return response(evidence.establishTrend(user.get(),patientId,request));}
 @PostMapping("/patients/{patientId}/clinical-evidence/diabetes-context") public ResponseEntity<?> diabetes(@PathVariable UUID patientId,@RequestBody CkdClinicalEvidenceService.DiabetesRequest request){return response(evidence.verifyDiabetes(user.get(),patientId,request));}
 @PostMapping("/research-demonstrations") public ResponseEntity<?> create(@RequestBody CkdResearchDemoService.Request request){return response(demo.create(user.get(),request));}
 private ResponseEntity<?> response(Object value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
}
