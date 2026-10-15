package lk.gov.health.govcare.fhir;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate; import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional; import lk.gov.health.govcare.security.ClinicalPatientAccess; import lk.gov.health.govcare.security.GovCarePrincipal; import java.util.*;
@Service public class ClinicalCodingService {
 private final NamedParameterJdbcTemplate jdbc; private final FHIRCodeValidationService validator; private final FHIRMappingService mapper; private final ClinicalPatientAccess access;
 public ClinicalCodingService(NamedParameterJdbcTemplate j,FHIRCodeValidationService v,FHIRMappingService m,ClinicalPatientAccess a){jdbc=j;validator=v;mapper=m;access=a;}
 @Transactional public Map<String,Object> saveCondition(GovCarePrincipal actor,UUID patient,String system,String code){
  access.requireClinicalWrite(actor,patient);
  UUID hospital=actor.hospitalId();
  var valid=validator.validate(system,code); if(!Boolean.TRUE.equals(valid.get("valid"))) throw new IllegalArgumentException(String.valueOf(valid.get("message")));
  UUID id=UUID.randomUUID(); String display=String.valueOf(valid.get("display")); String json=mapper.json(mapper.condition(id.toString(),"Patient/"+patient,system,code,display));
  jdbc.update("insert into fhir_condition(resource_id,hospital_id,patient_id,coding_system,code,display,status) values(:id,:h,:p,:s,:c,:d,'active')",Map.of("id",id,"h",hospital,"p",patient,"s",system,"c",code,"d",display));
  jdbc.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values('Condition',:rid,:p,:h,cast(:j as jsonb))",Map.of("rid",id.toString(),"p",patient,"h",hospital,"j",json));
  return Map.of("resourceType","Condition","id",id.toString(),"code",code,"display",display);
 }
}
