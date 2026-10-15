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

class CkdResearchDemoServiceTest {
    final SqlSupport sql=mock(SqlSupport.class);
    final ObjectMapper json=new ObjectMapper();
    final CkdPredictionService ckd=mock(CkdPredictionService.class);
    final SriLankanRenalIntelligenceService renal=mock(SriLankanRenalIntelligenceService.class);
    final RenalDialysisContextService dialysis=mock(RenalDialysisContextService.class);
    final CkdClinicalEvidenceService evidence=mock(CkdClinicalEvidenceService.class);
    final GovCarePrincipal admin=new GovCarePrincipal(UUID.randomUUID(),UUID.randomUUID(),null,null,"demo@example.invalid","Synthetic operator","super_admin",Set.of("*"),true,false,1);
    final CkdResearchDemoService service=new CkdResearchDemoService(sql,json,ckd,renal,dialysis,evidence);
    @Test void roleAndExplicitSyntheticAcknowledgementAreRequiredBeforeAnyQuery() {
        var doctor=new GovCarePrincipal(admin.id(),admin.hospitalId(),null,null,admin.email(),admin.fullName(),"doctor",Set.of("*"),true,false,1);
        assertThrows(ApiException.class,()->service.create(doctor,new CkdResearchDemoService.Request(UUID.randomUUID(),true)));
        assertThrows(ApiException.class,()->service.create(admin,new CkdResearchDemoService.Request(UUID.randomUUID(),false)));
        verifyNoInteractions(sql,ckd,renal,dialysis,evidence);
    }
    @Test void creationUsesNewLabeledPatientsActualPipelinesAndIdempotentScopedRetry() {
        var stored=new AtomicReference<Map<String,Object>>();var ids=new HashSet<UUID>();var requests=new ArrayList<CkdDtos.PredictionRequest>();
        when(sql.one(contains("ckd_research_demo_runs"),anyMap())).thenAnswer(i->{Map<String,Object> p=i.getArgument(1);assertEquals(admin.hospitalId(),p.get("h"));assertEquals(admin.id(),p.get("actor"));return Optional.ofNullable(stored.get());});
        when(sql.update(anyString(),anyMap())).thenAnswer(i->{String q=i.getArgument(0);Map<String,Object> p=i.getArgument(1);if(q.contains("insert into patients")){assertTrue(ids.add((UUID)p.get("patient")));assertTrue(p.get("number").toString().startsWith("SYNTH-CKD-"));assertTrue(p.get("name").toString().startsWith("SYNTHETIC"));assertEquals(admin.hospitalId(),p.get("h"));}if(q.contains("insert into ckd_research_demo_runs"))stored.set(Map.of("outputs",p.get("outputs")));assertFalse(q.toLowerCase().startsWith("update patients"));return 1;});
        when(ckd.predict(eq(admin),any())).thenAnswer(i->{requests.add(i.getArgument(1));return Map.of();});
        when(ckd.patient(eq(admin),any())).thenAnswer(i->Map.of("id",i.getArgument(1,UUID.class).toString(),"patient_no","SYNTH-CKD-FIXTURE","full_name","SYNTHETIC SOFTWARE FIXTURE"));
        var r=new CkdResearchDemoService.Request(UUID.randomUUID(),true);var first=service.create(admin,r);
        assertEquals(first,service.create(admin,r));assertTrue(first.path("synthetic").asBoolean());assertEquals(2,ids.size());assertEquals(2,first.path("patients").size());assertEquals(10,requests.size());
        for(var request:requests){assertTrue(ids.contains(UUID.fromString(request.patientId())));assertEquals(17,request.features().size());assertEquals(17,request.sources().size());request.sources().values().forEach(s->{assertTrue(Instant.parse(s.get("clinicalDate").toString()).isBefore(Instant.now()));assertTrue(s.get("sourceNote").toString().startsWith("SYNTHETIC"));});}
        verify(renal,times(3)).recordObservation(eq(admin),argThat(ids::contains),argThat(s->s.maintenanceHemodialysisVerified()&&s.sourceVerified()&&s.measurements().containsKey("urea_pre")&&s.measurements().containsKey("urea_post")));
        verify(dialysis,times(2)).verify(eq(admin),argThat(ids::contains),any());verify(evidence,times(2)).verifyDiabetes(eq(admin),argThat(ids::contains),any());
        verify(sql,times(1)).update(contains("CKD_SYNTHETIC_DEMO_CREATED"),anyMap());
    }
}
