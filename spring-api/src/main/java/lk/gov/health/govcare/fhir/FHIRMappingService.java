package lk.gov.health.govcare.fhir;
import ca.uhn.fhir.context.FhirContext; import org.hl7.fhir.r4.model.*; import org.springframework.stereotype.Service;
@Service public class FHIRMappingService {
 private final FhirContext ctx=FhirContext.forR4Cached();
 public String json(Resource r){return ctx.newJsonParser().setPrettyPrint(true).encodeResourceToString(r);}
 public Resource parse(String json){return (Resource)ctx.newJsonParser().parseResource(json);}
 public Condition condition(String id,String patientRef,String system,String code,String display){
  Condition c=new Condition(); c.setId(id); c.setSubject(new Reference(patientRef)); c.setCode(new CodeableConcept().addCoding(new Coding(system,code,display)));
  c.setClinicalStatus(new CodeableConcept().addCoding(new Coding("http://terminology.hl7.org/CodeSystem/condition-clinical","active","Active"))); return c;
 }
 public Observation quantityObservation(String id,String patientRef,String loinc,String display,double value,String unit){
  Observation o=new Observation(); o.setId(id); o.setStatus(Observation.ObservationStatus.FINAL); o.setSubject(new Reference(patientRef));
  o.setCode(new CodeableConcept().addCoding(new Coding("http://loinc.org",loinc,display))); o.setValue(new Quantity(value).setUnit(unit)); return o;
 }
}
