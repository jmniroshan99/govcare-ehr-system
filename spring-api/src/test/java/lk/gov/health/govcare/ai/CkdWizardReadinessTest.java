package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class CkdWizardReadinessTest {
 private final UUID patient=UUID.randomUUID();
 private final GovCarePrincipal actor=new GovCarePrincipal(UUID.randomUUID(),UUID.randomUUID(),null,null,"qa@govcare.test","Synthetic QA","doctor",Set.of("*"),true,false,1);
 private final SqlSupport sql=mock(SqlSupport.class);
 private final ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);
 private CkdPredictionService service(){return new CkdPredictionService(sql,mock(JsonSupport.class),mock(CkdStageClassificationService.class),access,mock(ClinicalPredictionFeatureService.class));}
 private CkdDtos.PredictionRequest request(Map<String,BigDecimal> features,Map<String,Map<String,Object>> sources){return new CkdDtos.PredictionRequest(patient.toString(),null,features,sources);}
 private Map<String,BigDecimal> complete(){
  var values=new LinkedHashMap<String,BigDecimal>();
  for(String key:List.of("Age","BMI","SystolicBP","DiastolicBP","FastingBloodSugar","HbA1c","SerumCreatinine","BUNLevels","GFR","ProteinInUrine","ACR","SerumElectrolytesPotassium","HemoglobinLevels"))values.put(key,BigDecimal.ONE);
  for(String key:List.of("Edema","FamilyHistoryKidneyDisease","PreviousAcuteKidneyInjury","NSAIDsUse"))values.put(key,BigDecimal.ZERO);
  return values;
 }
 @Test void unknownHistoryStaysMissingAndNoDefaultsAreIntroduced(){
  var values=complete();values.remove("NSAIDsUse");var result=CkdPredictionService.readiness(request(values,Map.of()));
  assertEquals(false,result.get("ready"));assertEquals(List.of("NSAIDsUse"),result.get("missing"));assertEquals(16,result.get("readyCount"));assertFalse(values.containsKey("NSAIDsUse"));
 }
 @Test void serverDefinitionRejectsInvalidAndRequiresImportedReview(){
  var values=complete();values.put("SerumCreatinine",BigDecimal.valueOf(-1));
  var result=CkdPredictionService.readiness(request(values,Map.of("GFR",Map.of("source","PDF","importReviewed",false))));
  assertEquals(false,result.get("ready"));assertEquals(15,result.get("readyCount"));assertTrue(((Map<?,?>)result.get("invalid")).containsKey("SerumCreatinine"));assertEquals(List.of("GFR"),result.get("requiresReview"));
 }
 @Test void reviewedUnverifiedInputsCanBeReadyWithoutBecomingVerifiedObservations(){
  var result=CkdPredictionService.readiness(request(complete(),Map.of("GFR",Map.of("source","PDF","importReviewed",true,"sourceVerified",false))));
  assertEquals(true,result.get("ready"));assertEquals(17,result.get("readyCount"));verifyNoInteractions(sql);
 }
 @Test void validationAuthorizesBeforeAnySourceReadAndNeverWrites(){
  when(sql.uuid(patient.toString(),"patientId")).thenReturn(patient);when(access.clinicalScope(actor,patient,true)).thenReturn(actor);
  assertEquals(true,service().validate(actor,request(complete(),Map.of())).get("ready"));verify(sql).uuid(patient.toString(),"patientId");verifyNoMoreInteractions(sql);
 }
 @Test void deniedPatientCannotValidateOrReadSourceReferences(){
  when(sql.uuid(patient.toString(),"patientId")).thenReturn(patient);when(access.clinicalScope(actor,patient,true)).thenThrow(ApiException.forbidden("Denied"));
  assertThrows(ApiException.class,()->service().validate(actor,request(complete(),Map.of("GFR",Map.of("reportId",UUID.randomUUID().toString())))));
  verify(sql,never()).required(anyString(),anyMap(),anyString());verify(sql,never()).update(anyString(),anyMap());
 }
 @Test void sourceReferenceMustBelongToSelectedPatient(){
  when(sql.uuid(patient.toString(),"patientId")).thenReturn(patient);when(access.clinicalScope(actor,patient,true)).thenReturn(actor);
  UUID report=UUID.randomUUID();when(sql.uuid(report.toString(),"reportId")).thenReturn(report);
  when(sql.required(contains("from clinical_reports"),anyMap(),anyString())).thenThrow(ApiException.forbidden("Unavailable"));
  assertThrows(ApiException.class,()->service().validate(actor,request(complete(),Map.of("GFR",Map.of("reportId",report.toString())))));
  verify(sql).required(contains("patient_id=:p"),argThat(params->patient.equals(params.get("p"))),anyString());verify(sql,never()).update(anyString(),anyMap());
 }
}
