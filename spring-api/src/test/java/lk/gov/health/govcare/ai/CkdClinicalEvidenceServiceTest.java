package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CkdClinicalEvidenceServiceTest {
    final SqlSupport sql=mock(SqlSupport.class);
    final ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);
    final PredictiveIntelligenceService observations=mock(PredictiveIntelligenceService.class);
    final ObjectMapper json=new ObjectMapper();
    final UUID patient=UUID.randomUUID();
    final GovCarePrincipal actor=new GovCarePrincipal(UUID.randomUUID(),UUID.randomUUID(),null,null,"evidence@example.invalid","Synthetic verifier","doctor",Set.of("CONSULTATION_UPDATE"),true,false,1);
    final CkdClinicalEvidenceService service=new CkdClinicalEvidenceService(sql,access,observations,json);
    CkdClinicalEvidenceService.TrendRequest pair(Double later,Instant at,String unit) {
        return new CkdClinicalEvidenceService.TrendRequest(UUID.randomUUID(),"creatinine",unit,176.8,Instant.now().minusSeconds(86400*31L),"Synthetic baseline lab reference",later,at,"Synthetic later lab reference",true);
    }
    @Test void authorizationPrecedesValidationAndAnyPersistence() {
        when(access.clinicalScope(actor,patient,true)).thenThrow(ApiException.forbidden("Denied"));
        assertThrows(ApiException.class,()->service.establishTrend(actor,patient,null));
        assertThrows(ApiException.class,()->service.verifyDiabetes(actor,patient,null));
        verifyNoInteractions(sql,observations);
    }
    @Test void bothActualResultsUseTheExistingObservationPipelineWithDistinctStableRetryIds() {
        when(access.clinicalScope(actor,patient,true)).thenReturn(actor);
        var requests=new ArrayList<PredictiveIntelligenceService.MeasurementRequest>();
        when(observations.recordMeasurement(eq(actor),eq(patient),any())).thenAnswer(i->{var r=i.getArgument(2,PredictiveIntelligenceService.MeasurementRequest.class);requests.add(r);return Map.of("id",r.requestId());});
        var request=pair(265.2,Instant.now().minusSeconds(60),"µmol/L");
        var first=service.establishTrend(actor,patient,request);var retry=service.establishTrend(actor,patient,request);
        assertEquals(first,retry);assertEquals(4,requests.size());
        assertNotEquals(requests.get(0).requestId(),requests.get(1).requestId());assertEquals(requests.get(0),requests.get(2));
        assertEquals(176.8,requests.get(0).value());assertEquals("µmol/L",requests.get(0).unit());
        assertEquals(request.baselineAt(),requests.get(0).observedAt());assertEquals(request.currentAt(),requests.get(1).observedAt());
        assertEquals(request.currentSource(),requests.get(1).sourceNote());assertTrue(requests.stream().allMatch(PredictiveIntelligenceService.MeasurementRequest::sourceVerified));
    }
    @Test void invalidLaterValueOrDatesCannotPartiallySaveABaseline() {
        when(access.clinicalScope(actor,patient,true)).thenReturn(actor);
        for(var r:List.of(pair(Double.NaN,Instant.now().minusSeconds(60),"mg/dL"),pair(2.0,Instant.now().plusSeconds(60),"mg/dL"),pair(2.0,Instant.now().minusSeconds(86400*40L),"mg/dL"),pair(2.0,Instant.now().minusSeconds(60),"unknown")))
            assertThrows(ApiException.class,()->service.establishTrend(actor,patient,r));
        verifyNoInteractions(sql,observations);
    }
    @Test void diabetesEventsAreScopedAuditedIdempotentAndRejectChangedRetryContent() {
        when(access.clinicalScope(actor,patient,true)).thenReturn(actor);
        var saved=new AtomicReference<Map<String,Object>>();
        when(sql.one(anyString(),anyMap())).thenAnswer(i->Optional.ofNullable(saved.get()));
        when(sql.update(contains("insert into ckd_diabetes_context_events"),anyMap())).thenAnswer(i->{Map<String,Object> p=i.getArgument(1);assertEquals(actor.hospitalId(),p.get("h"));assertEquals(patient,p.get("p"));saved.set(Map.of("id",p.get("id"),"input_fingerprint",p.get("fingerprint")));return 1;});
        var r=new CkdClinicalEvidenceService.DiabetesRequest(UUID.randomUUID(),"NO_KNOWN_DIABETES",Instant.now().minusSeconds(60),"Synthetic reviewed clinical history",true);
        assertEquals(service.verifyDiabetes(actor,patient,r),service.verifyDiabetes(actor,patient,r));
        verify(sql,times(1)).update(contains("insert into ckd_diabetes_context_events"),anyMap());
        verify(sql,times(1)).update(contains("CKD_DIABETES_CONTEXT_VERIFIED"),anyMap());
        assertThrows(ApiException.class,()->service.verifyDiabetes(actor,patient,new CkdClinicalEvidenceService.DiabetesRequest(r.requestId(),"CONFIRMED_DIABETES",r.verifiedAt(),r.sourceNote(),true)));
        verifyNoInteractions(observations);
    }
    @Test void contextReadRetainsPatientTenantAndReportCutoffAndKeepsUnknownWhenAbsent() {
        var p=new HashMap<String,Object>(Map.of("h",actor.hospitalId(),"p",patient));p.put("cutoff",java.sql.Timestamp.from(Instant.now().minusSeconds(100)));
        assertEquals("UNCONFIRMED",CkdClinicalEvidenceService.diabetesContext(sql,p,json).path("status").asText());
        Instant at=Instant.now().minusSeconds(200);UUID id=UUID.randomUUID();
        when(sql.one(anyString(),anyMap())).thenReturn(Optional.of(Map.of("id",id,"context_status","CONFIRMED_DIABETES","verified_at",java.sql.Timestamp.from(at),"source_note","Synthetic clinical record")));
        var out=CkdClinicalEvidenceService.diabetesContext(sql,p,json);assertEquals(at.toString(),out.path("verifiedAt").asText());assertEquals(id.toString(),out.path("sourceId").asText());
        verify(sql,times(2)).one(contains("hospital_id=:h and patient_id=:p and (cast(:cutoff as timestamptz) is null or created_at<=:cutoff)"),eq(p));
    }
    @Test void unconfirmedMayBeRecordedButUnknownStatusesAndFutureOrUnverifiedContextAreRejected() {
        when(access.clinicalScope(actor,patient,true)).thenReturn(actor);
        for(var r:List.of(new CkdClinicalEvidenceService.DiabetesRequest(UUID.randomUUID(),"INFERRED_FROM_HBA1C",Instant.now().minusSeconds(1),"Source",true),new CkdClinicalEvidenceService.DiabetesRequest(UUID.randomUUID(),"CONFIRMED_DIABETES",Instant.now().plusSeconds(60),"Source",true),new CkdClinicalEvidenceService.DiabetesRequest(UUID.randomUUID(),"NO_KNOWN_DIABETES",Instant.now().minusSeconds(1),"Source",false)))
            assertThrows(ApiException.class,()->service.verifyDiabetes(actor,patient,r));
        verifyNoInteractions(sql,observations);
    }
}
