package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.ai.predictive.*;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RenalChemistryEntryTest {
    @Test void chemistryUsesExistingVerifiedEntryFhirAndAuditWorkflow(){
        for(String metric:List.of("urea","albumin","sodium","calcium")){
            var sql=mock(SqlSupport.class);var access=mock(ClinicalPatientAccess.class);var mapper=new ObjectMapper();
            var patient=UUID.randomUUID();var actor=new GovCarePrincipal(UUID.randomUUID(),UUID.randomUUID(),null,null,"qa@govcare.test","QA","doctor",Set.of("PATIENT_VIEW_CLINICAL"),true,false,1);
            when(access.clinicalScope(actor,patient,true)).thenReturn(actor);
            when(sql.one(contains("resource_type='Patient'"),anyMap())).thenReturn(Optional.of(Map.of("resource_id","patient-"+patient)));
            var service=new PredictiveIntelligenceService(sql,new JsonSupport(mapper),mapper,access,mock(CkdProgressionForecastService.class),mock(KidneyFailureRiskCalculator.class));
            double value=metric.equals("sodium")?140:metric.equals("calcium")?2.2:metric.equals("albumin")?40:12;
            String unit=metric.equals("albumin")?"g/L":"mmol/L";
            var result=service.recordMeasurement(actor,patient,new PredictiveIntelligenceService.MeasurementRequest(UUID.randomUUID(),metric,value,unit,Instant.now().minusSeconds(60),null,null,"Operational verified source",true));
            assertEquals(true,result.get("saved"));
            verify(sql).update(contains("insert into clinical_observations"),argThat(p->metric.equals(p.get("metric"))&&unit.equals(p.get("normalizedUnit"))&&Math.abs(((Number)p.get("normalized")).doubleValue()-value)<1e-9));
            verify(sql).update(contains("insert into predictive_observation_entries"),anyMap());
            verify(sql).update(contains("insert into predictive_audit_events"),argThat(p->p.get("event").equals("VERIFIED_MEASUREMENT_RECORDED")));
            verify(sql).update(contains("insert into fhir_resource("),argThat(p->p.get("type").equals("Observation")));
            verify(sql).update(contains("insert into fhir_resource("),argThat(p->p.get("type").equals("Provenance")));
        }
    }
    @Test void ureaCannotUseBunUnitsOrAnUnverifiedSource(){
        var sql=mock(SqlSupport.class);var access=mock(ClinicalPatientAccess.class);var mapper=new ObjectMapper();var patient=UUID.randomUUID();var actor=mock(GovCarePrincipal.class);
        when(access.clinicalScope(actor,patient,true)).thenReturn(actor);
        var service=new PredictiveIntelligenceService(sql,new JsonSupport(mapper),mapper,access,mock(CkdProgressionForecastService.class),mock(KidneyFailureRiskCalculator.class));
        for(String unit:List.of("mg/dL BUN","","unknown"))assertThrows(ApiException.class,()->service.recordMeasurement(actor,patient,new PredictiveIntelligenceService.MeasurementRequest(UUID.randomUUID(),"urea",12.0,unit,Instant.now().minusSeconds(60),null,null,"Verified source",true)));
        assertThrows(ApiException.class,()->service.recordMeasurement(actor,patient,new PredictiveIntelligenceService.MeasurementRequest(UUID.randomUUID(),"urea",12.0,"mmol/L",Instant.now().minusSeconds(60),null,null,"Unverified",false)));
        verifyNoInteractions(sql);
    }
}
