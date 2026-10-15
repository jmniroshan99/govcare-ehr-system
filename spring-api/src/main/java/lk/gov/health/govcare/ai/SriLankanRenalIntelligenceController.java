package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai-cdss/ckd")
public class SriLankanRenalIntelligenceController {
    private final SriLankanRenalIntelligenceService service;
    private final CurrentUser current;
    private final RenalDialysisContextService context;
    public SriLankanRenalIntelligenceController(SriLankanRenalIntelligenceService service, CurrentUser current) {
        this(service,current,null);
    }
    @org.springframework.beans.factory.annotation.Autowired
    public SriLankanRenalIntelligenceController(SriLankanRenalIntelligenceService service, CurrentUser current,RenalDialysisContextService context) {
        this.context=context;
        this.service = service; this.current = current;
    }
    @PostMapping("/patients/{patientId}/renal-intelligence/dialysis-status")
    public ResponseEntity<?> dialysisStatus(@PathVariable UUID patientId,@RequestBody RenalDialysisContextService.Request request){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(context.verify(current.get(),patientId,request));}
    @GetMapping("/patients/{patientId}/renal-intelligence")
    public ResponseEntity<?> overview(@PathVariable UUID patientId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.overview(current.get(), patientId));
    }
    @PostMapping("/patients/{patientId}/renal-intelligence/observations")
    public ResponseEntity<?> record(@PathVariable UUID patientId, @RequestBody SriLankanRenalIntelligenceService.ObservationRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.recordObservation(current.get(), patientId, request));
    }
    @PostMapping("/patients/{patientId}/renal-intelligence/predict")
    public ResponseEntity<?> predict(@PathVariable UUID patientId, @RequestBody SriLankanRenalIntelligenceService.PredictRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.predict(current.get(), patientId, request));
    }
    @PostMapping("/renal-intelligence/predictions/{predictionId}/review")
    public ResponseEntity<?> review(@PathVariable UUID predictionId, @RequestBody SriLankanRenalIntelligenceService.ReviewRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.review(current.get(), predictionId, request));
    }
}
