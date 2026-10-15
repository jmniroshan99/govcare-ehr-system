package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.security.*;import org.springframework.web.bind.annotation.*;import java.util.*;
@RestController @RequestMapping("/api/clinical-reports") public class ClinicalPersistenceController{
 private final ClinicalPersistenceService service;private final CurrentUser current;public ClinicalPersistenceController(ClinicalPersistenceService s,CurrentUser c){service=s;current=c;}
 @GetMapping("/patients/{patientId}") public Map<String,Object> reports(@PathVariable UUID patientId){return Map.of("items",service.reports(current.get(),patientId));}
 @GetMapping("/patients/{patientId}/{reportId}/observations") public Map<String,Object> observations(@PathVariable UUID patientId,@PathVariable UUID reportId){return Map.of("items",service.observations(current.get(),patientId,reportId));}
}
