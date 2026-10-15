package lk.gov.health.govcare.ckd;

import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/ckd")
public class CkdSummaryController {
 private final CkdSummaryService service;
 public CkdSummaryController(CkdSummaryService service){this.service=service;}

 @GetMapping("/patient/{patientId}/summary")
 public CkdSummaryDTO summary(@PathVariable UUID patientId){
   return service.getPatientCkdSummary(patientId);
 }
}
