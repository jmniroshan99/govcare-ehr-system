package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai-cdss/ckd")
public class PredictiveIntelligenceController {
    private final PredictiveIntelligenceService service;
    private final CurrentUser current;
    public PredictiveIntelligenceController(PredictiveIntelligenceService service, CurrentUser current) { this.service=service;this.current=current; }
    // ClinicalOverview retains its established route. The predictive-intelligence
    // route belongs exclusively to RenalClinicalModuleController's six-module contract.
    @GetMapping("/patients/{patientId}/intelligence")
    public ResponseEntity<PredictiveIntelligenceService.Overview> overview(@PathVariable UUID patientId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.overview(current.get(),patientId));
    }
    @GetMapping("/patients/{patientId}/trends")
    public ResponseEntity<?> trends(@PathVariable UUID patientId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.trends(current.get(),patientId));
    }
    @GetMapping("/patients/{patientId}/data-quality")
    public ResponseEntity<?> dataQuality(@PathVariable UUID patientId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.dataQuality(current.get(),patientId));
    }
    @GetMapping("/patients/{patientId}/timeline")
    public ResponseEntity<?> timeline(@PathVariable UUID patientId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.timeline(current.get(),patientId));
    }
    @GetMapping("/patients/{patientId}/risk/{riskKey}")
    public ResponseEntity<?> risk(@PathVariable UUID patientId, @PathVariable String riskKey) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.risk(current.get(),patientId,riskKey));
    }
    @PostMapping("/patients/{patientId}/forecast")
    public ResponseEntity<Map<String,Object>> forecast(@PathVariable UUID patientId,@RequestBody PredictiveIntelligenceService.ForecastRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.forecast(current.get(),patientId,request));
    }
    @PostMapping("/patients/{patientId}/forecast/ckd-progression")
    public ResponseEntity<Map<String,Object>> ckdForecast(@PathVariable UUID patientId,@RequestBody PredictiveIntelligenceService.ForecastRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.forecast(current.get(),patientId,request));
    }
    @GetMapping("/patients/{patientId}/forecast/ckd-progression")
    public ResponseEntity<?> ckdForecastPreview(@PathVariable UUID patientId,
                                                @RequestParam(defaultValue = "12") int horizonMonths) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.previewForecast(current.get(),patientId,horizonMonths));
    }
    @PostMapping({"/recommendations/{recommendationId}/review","/predictive-recommendations/{recommendationId}/review"})
    public ResponseEntity<Map<String,Object>> review(@PathVariable UUID recommendationId,@RequestBody PredictiveIntelligenceService.ReviewRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.review(current.get(),recommendationId,request));
    }
    @PostMapping("/patients/{patientId}/observations")
    public ResponseEntity<Map<String,Object>> measurement(@PathVariable UUID patientId,@RequestBody PredictiveIntelligenceService.MeasurementRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.recordMeasurement(current.get(),patientId,request));
    }
}
