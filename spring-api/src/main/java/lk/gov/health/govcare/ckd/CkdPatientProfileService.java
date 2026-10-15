package lk.gov.health.govcare.ckd;

import org.springframework.stereotype.Service;
import lk.gov.health.govcare.patient.*;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.security.ClinicalPatientAccess;
import lk.gov.health.govcare.security.GovCarePrincipal;
import java.util.UUID;

@Service
public class CkdPatientProfileService {
 private final PatientRepository repository;
 private final ClinicalPatientAccess access;
 public CkdPatientProfileService(PatientRepository repository, ClinicalPatientAccess access){this.repository=repository;this.access=access;}

 public CkdPatientProfileDTO getPatientProfile(GovCarePrincipal actor, UUID id){
   access.requireDemographics(actor, id);
   PatientEntity p=repository.findById(id)
      .orElseThrow(() -> ApiException.notFound("Patient not found."));
   return new CkdPatientProfileDTO(
    id.toString(), p.getFullName(), p.getProfilePhotoUrl(),
    p.getNic(), p.getDateOfBirth()==null?null:p.getDateOfBirth().toString(),
    p.getAgeYears(), p.getGender()==null?null:p.getGender().name(),
    p.getBloodGroup(), p.getPhone(), p.getAddress()
   );
 }
}
