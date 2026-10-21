package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RenalDialysisContextServiceTest {
    final SqlSupport sql=mock(SqlSupport.class);final ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);
    final UUID patient=UUID.randomUUID();final GovCarePrincipal actor=new GovCarePrincipal(UUID.randomUUID(),UUID.randomUUID(),null,null,"context@example.invalid","Operational context verifier","doctor",Set.of("CONSULTATION_UPDATE"),true,false,1);
    final RenalDialysisContextService service=new RenalDialysisContextService(sql,access,new ObjectMapper());
    @Test void authorizationPrecedesContextWriteAndQueries(){when(access.clinicalScope(actor,patient,true)).thenThrow(ApiException.forbidden("Denied"));assertThrows(ApiException.class,()->service.verify(actor,patient,null));verifyNoInteractions(sql);}
    @Test void actualContextWriteIsIdempotentAuditedAndFhirCompatibleWithoutLabValues() throws Exception {
        when(access.clinicalScope(actor,patient,true)).thenReturn(actor);var saved=new java.util.concurrent.atomic.AtomicReference<Map<String,Object>>();var writes=new ArrayList<Map<String,Object>>();
        when(sql.one(anyString(),anyMap())).thenAnswer(i->Optional.ofNullable(saved.get()));
        when(sql.update(anyString(),anyMap())).thenAnswer(i->{String q=i.getArgument(0);Map<String,Object> p=i.getArgument(1);writes.add(new HashMap<>(p));if(q.contains("insert into renal_dialysis_context_events"))saved.set(Map.of("id",p.get("id"),"input_fingerprint",p.get("fingerprint")));return 1;});
        var request=new RenalDialysisContextService.Request(UUID.randomUUID(),"MAINTENANCE_HD",Instant.now().minusSeconds(60),"Operational verified dialysis context source",true);
        var first=service.verify(actor,patient,request);var second=service.verify(actor,patient,request);assertEquals(first.get("id"),second.get("id"));assertEquals(4,writes.size());
        assertInstanceOf(java.sql.Timestamp.class,writes.getFirst().get("verified"));
        assertEquals(request.verifiedAt(),((java.sql.Timestamp)writes.getFirst().get("verified")).toInstant());
        verify(sql,never()).update(contains("sri_lankan_renal_observations"),anyMap());
        var parser=ca.uhn.fhir.context.FhirContext.forR4Cached().newJsonParser();for(var row:writes)if(row.containsKey("body"))assertDoesNotThrow(()->parser.parseResource(row.get("body").toString()));
        assertThrows(ApiException.class,()->service.verify(actor,patient,new RenalDialysisContextService.Request(request.requestId(),"NOT_ON_MAINTENANCE_HD",request.verifiedAt(),request.sourceNote(),true)));
    }
    @Test void futureUnverifiedAndUnknownStatusesAreRejectedBeforeSql(){when(access.clinicalScope(actor,patient,true)).thenReturn(actor);
        for(var r:List.of(new RenalDialysisContextService.Request(UUID.randomUUID(),"MAINTENANCE_HD",Instant.now().plusSeconds(100),"Source",true),new RenalDialysisContextService.Request(UUID.randomUUID(),"MAINTENANCE_HD",Instant.now().minusSeconds(1),"Source",false),new RenalDialysisContextService.Request(UUID.randomUUID(),"UNKNOWN_VALUE",Instant.now().minusSeconds(1),"Source",true)))assertThrows(ApiException.class,()->service.verify(actor,patient,r));verifyNoInteractions(sql);
    }
    @Test void latestContextUsesTenantPatientScopeAndAcceptsJdbcTimestamp(){Instant when=Instant.now().minusSeconds(60);UUID id=UUID.randomUUID();
        when(sql.one(anyString(),anyMap())).thenReturn(Optional.of(Map.of("id",id,"context_status","MAINTENANCE_HD","verified_at",java.sql.Timestamp.from(when),"source_note","Operational source")));
        assertEquals(when,service.latest(actor,patient).verifiedAt());verify(sql).one(contains("hospital_id=:h and patient_id=:p"),argThat(p->actor.hospitalId().equals(p.get("h"))&&patient.equals(p.get("p"))));
    }
}
