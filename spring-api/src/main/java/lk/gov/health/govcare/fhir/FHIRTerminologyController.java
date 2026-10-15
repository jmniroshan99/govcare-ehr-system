package lk.gov.health.govcare.fhir;
import org.springframework.web.bind.annotation.*; import java.util.*;
@RestController @RequestMapping("/fhir") public class FHIRTerminologyController {
 private final TerminologyService terms; private final FHIRCodeValidationService validator;
 public FHIRTerminologyController(TerminologyService t,FHIRCodeValidationService v){terms=t;validator=v;}
 @GetMapping("/CodeSystem/search") public List<Map<String,Object>> codeSearch(@RequestParam(defaultValue="") String query,@RequestParam(required=false) String system){return terms.search(query,system);}
 @GetMapping("/ValueSet/search") public List<Map<String,Object>> valueSet(@RequestParam(defaultValue="") String query,@RequestParam(required=false) String system){return terms.search(query,system);}
 public record ValidateCodeRequest(String system,String code){}
 @PostMapping("/$validate-code") public Map<String,Object> validate(@RequestBody ValidateCodeRequest r){return validator.validate(r.system(),r.code());}
}
