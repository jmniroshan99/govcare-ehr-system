package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai-cdss/ckd/patients/{patientId}/outlook")
public class CkdOutlookController {
    private final CkdOutlookService service; private final CurrentUser current;
    public CkdOutlookController(CkdOutlookService service,CurrentUser current){this.service=service;this.current=current;}
    @GetMapping public ResponseEntity<String> overview(@PathVariable UUID patientId){return response(service.overview(current.get(),patientId).toString());}
    @PostMapping("/assessments") public ResponseEntity<String> calculate(@PathVariable UUID patientId,@RequestBody CkdOutlookService.AssessmentRequest request){return response(service.calculate(current.get(),patientId,request).toString());}
    @PostMapping("/reviews") public ResponseEntity<String> review(@PathVariable UUID patientId,@RequestBody CkdOutlookService.ReviewRequest request){return response(service.review(current.get(),patientId,request).toString());}
    @PostMapping("/scenarios") public ResponseEntity<String> scenario(@PathVariable UUID patientId,@RequestBody CkdOutlookService.ScenarioRequest request){return response(service.scenario(current.get(),patientId,request).toString());}
    private ResponseEntity<String> response(String body){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_JSON).body(body);}
}
