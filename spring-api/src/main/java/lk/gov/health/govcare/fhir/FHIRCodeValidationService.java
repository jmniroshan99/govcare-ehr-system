package lk.gov.health.govcare.fhir;
import org.springframework.stereotype.Service; import java.util.Map;
@Service public class FHIRCodeValidationService {
 private final TerminologyService terminology; public FHIRCodeValidationService(TerminologyService t){terminology=t;}
 public Map<String,Object> validate(String system,String code){return terminology.validate(system,code);}
 public void requireValid(String system,String code){if(!Boolean.TRUE.equals(validate(system,code).get("valid"))) throw new IllegalArgumentException("Invalid or unsupported terminology code: "+system+" | "+code);}
}
