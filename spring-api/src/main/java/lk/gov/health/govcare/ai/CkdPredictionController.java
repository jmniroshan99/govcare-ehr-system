package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.patient.NetworkPatientDirectory;
import lk.gov.health.govcare.security.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import static lk.gov.health.govcare.ai.CkdDtos.*;

@RestController
@RequestMapping("/api/ai-cdss/ckd")
public class CkdPredictionController {
    private final CkdPredictionService service;
    private final CurrentUser current;
    private final NetworkPatientDirectory network;

    public CkdPredictionController(CkdPredictionService service, CurrentUser current, NetworkPatientDirectory network) {
        this.service=service; this.current=current; this.network=network;
    }

    @PostMapping("/predict")
    public Map<String,Object> predict(@RequestBody PredictionRequest request) { return service.predict(current.get(),request); }

    @PostMapping("/validate")
    public Map<String,Object> validate(@RequestBody PredictionRequest request) { return service.validate(current.get(),request); }

    @GetMapping("/patients")
    public Map<String,Object> patients(@RequestParam(required=false) String search,
                                      @RequestParam(required=false) UUID hospitalId,
                                      @RequestParam(defaultValue="0") int page,
                                      @RequestParam(defaultValue="50") int pageSize) {
        var actor=current.get();
        if ("super_admin".equals(actor.role())) return network.browse(actor,search,hospitalId,null,page,pageSize,true);
        if (hospitalId!=null && !hospitalId.equals(actor.hospitalId())) throw ApiException.forbidden("You cannot view another hospital's patients.");
        return Map.of("items",service.patients(actor,search));
    }

    @GetMapping("/patients/{patientId}")
    public Map<String,Object> patient(@PathVariable UUID patientId) { return Map.of("patient",service.patient(current.get(),patientId)); }

    @GetMapping("/patients/{patientId}/predictions")
    public Map<String,Object> history(@PathVariable String patientId) { return Map.of("items",service.history(current.get(),patientId)); }
}
