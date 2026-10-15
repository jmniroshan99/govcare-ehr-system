package lk.gov.health.govcare.ckd;

import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import lk.gov.health.govcare.security.CurrentUser;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients")
public class CkdPatientProfileController {
 private final CkdPatientProfileService service;
 private final CurrentUser current;
 public CkdPatientProfileController(CkdPatientProfileService service, CurrentUser current){this.service=service;this.current=current;}

 @GetMapping("/{patientId}/profile")
 @PreAuthorize("hasAnyAuthority('PATIENT_VIEW','PATIENT_VIEW_SELF')")
 public CkdPatientProfileDTO profile(@PathVariable UUID patientId){
   return service.getPatientProfile(current.get(), patientId);
 }
}
