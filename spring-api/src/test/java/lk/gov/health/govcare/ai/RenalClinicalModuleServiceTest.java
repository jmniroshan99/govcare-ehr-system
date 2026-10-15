package lk.gov.health.govcare.ai;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.ClinicalPatientAccess;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
class RenalClinicalModuleServiceTest {
    private final UUID patient=UUID.randomUUID();private final GovCarePrincipal actor=mock(GovCarePrincipal.class);
    private final ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);private final SqlSupport sql=mock(SqlSupport.class);
    private final SriLankanRenalIntelligenceService renal=mock(SriLankanRenalIntelligenceService.class);
    private RenalClinicalModuleService service(){return new RenalClinicalModuleService(sql,access,renal,new ObjectMapper());}
    @Test void authorizationPrecedesAnyClinicalQueriesForReadReviewAndExport() {
        when(access.clinicalScope(actor,patient,false)).thenThrow(ApiException.forbidden("Denied"));when(access.clinicalScope(actor,patient,true)).thenThrow(ApiException.forbidden("Denied"));
        assertThrows(ApiException.class,()->service().overview(actor,patient));assertThrows(ApiException.class,()->service().reportSnapshot(actor,patient));assertThrows(ApiException.class,()->service().review(actor,patient,null));verifyNoInteractions(sql,renal);
    }
    @Test void reportReadsPersistedSnapshotWithoutCallingModelOrClinicalOverview() {
        UUID hospital=UUID.randomUUID();when(access.clinicalScope(actor,patient,false)).thenReturn(actor);when(actor.hospitalId()).thenReturn(hospital);
        var out=new ObjectMapper().createObjectNode();out.put("snapshotId",UUID.randomUUID().toString());for(String key:RenalClinicalModules.ORDER)out.putObject(key);
        when(sql.one(contains("renal_clinical_module_snapshots"),anyMap())).thenReturn(Optional.of(Map.of("id",UUID.randomUUID(),"outputs",out)));
        when(sql.list(contains("renal_clinical_module_reviews"),anyMap())).thenReturn(List.of());
        assertNotNull(service().reportSnapshot(actor,patient));verifyNoInteractions(renal);verify(sql).one(contains("hospital_id=:h and patient_id=:p"),argThat(p->hospital.equals(p.get("h"))&&patient.equals(p.get("p"))));
    }
    @Test void unavailableSnapshotCannotBeReviewedAsAnotherPatient() {
        when(access.clinicalScope(actor,patient,true)).thenReturn(actor);when(sql.required(contains("for update"),anyMap(),anyString())).thenThrow(ApiException.notFound("Not found"));
        var request=new RenalClinicalModuleService.ReviewRequest(UUID.randomUUID(),UUID.randomUUID(),"anemia",0,"ACCEPT","Verified",null,null);
        assertThrows(ApiException.class,()->service().review(actor,patient,request));verify(sql,never()).update(anyString(),anyMap());verifyNoInteractions(renal);
    }
    @Test void repeatedAuthorizedReadReusesImmutableSnapshotAndWritesParseableFhirOnlyOnce() throws Exception {
        var mapper=new ObjectMapper().findAndRegisterModules().setSerializationInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
        UUID hospital=UUID.randomUUID(),user=UUID.randomUUID();
        var scoped=new GovCarePrincipal(user,hospital,null,null,"operational@govcare.test","Operational doctor","doctor",Set.of("CONSULTATION_UPDATE"),true,false,1);
        when(access.clinicalScope(actor,patient,false)).thenReturn(scoped);
        when(renal.overview(actor,patient)).thenReturn(new SriLankanRenalIntelligenceService.Overview(patient,hospital,new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","No verified renal stage"),List.of(),List.of(),null,true,false));
        when(renal.ensurePatientReference(scoped,patient)).thenReturn("Patient/patient-"+patient);
        when(sql.list(anyString(),anyMap())).thenReturn(List.of());
        var saved=new java.util.concurrent.atomic.AtomicReference<Map<String,Object>>();var fhir=new ArrayList<Map<String,Object>>();
        when(sql.one(contains("source_fingerprint"),anyMap())).thenAnswer(i->Optional.ofNullable(saved.get()));
        when(sql.update(anyString(),anyMap())).thenAnswer(i->{String query=i.getArgument(0);Map<String,Object> args=i.getArgument(1);
            if(query.contains("insert into renal_clinical_module_snapshots"))saved.set(Map.of("id",args.get("id"),"outputs",mapper.readValue(args.get("outputs").toString(),Map.class)));
            if(query.contains("insert into fhir_resource"))fhir.add(new HashMap<>(args));return 1;});
        var service=new RenalClinicalModuleService(sql,access,renal,mapper);
        var first=service.overview(actor,patient);var second=service.overview(actor,patient);
        assertEquals(first.path("snapshotId"),second.path("snapshotId"));assertTrue(second.path("anemia").has("forecast"));assertTrue(second.path("anemia").path("forecast").isNull());
        verify(sql,times(1)).update(contains("insert into renal_clinical_module_snapshots"),anyMap());assertEquals(2,fhir.size());
        var parser=ca.uhn.fhir.context.FhirContext.forR4Cached().newJsonParser();
        for(var resource:fhir)assertDoesNotThrow(()->parser.parseResource(resource.get("body").toString()));
        assertEquals(Set.of("ClinicalImpression","Provenance"),fhir.stream().map(r->r.get("type").toString()).collect(java.util.stream.Collectors.toSet()));
        verify(renal,never()).predict(any(),any(),any());
    }
    @Test void actualReviewPersistsVersionActorMethodAndFhirWithOptimisticConcurrency() throws Exception {
        UUID hospital=UUID.randomUUID(),user=UUID.randomUUID(),snapshot=UUID.randomUUID();
        var scoped=new GovCarePrincipal(user,hospital,null,null,"review@govcare.test","Doctor","doctor",Set.of("CONSULTATION_UPDATE"),true,false,1);
        when(access.clinicalScope(actor,patient,true)).thenReturn(scoped);
        var output=new ObjectMapper().createObjectNode().put("snapshotId",snapshot.toString());
        for(String key:RenalClinicalModules.ORDER)output.putObject(key).put("key",key).put("status","AVAILABLE").put("method","Longitudinal Trend").put("modelVersion",RenalClinicalModules.VERSION);
        when(sql.required(contains("for update"),anyMap(),anyString())).thenReturn(Map.of("id",snapshot,"outputs",output));
        when(sql.one(anyString(),anyMap())).thenReturn(Optional.empty());when(renal.ensurePatientReference(scoped,patient)).thenReturn("Patient/patient-"+patient);
        var captures=new ArrayList<Map<String,Object>>();when(sql.update(contains("renal_clinical_module_reviews"),anyMap())).thenAnswer(i->{captures.add(new HashMap<>(i.getArgument(1)));return 1;});
        var r=new RenalClinicalModuleService.ReviewRequest(snapshot,UUID.randomUUID(),"renalTrajectory",0,"MODIFY","Reviewed source",null,"Clinician interpretation");
        assertEquals(1,service().review(actor,patient,r).get("reviewVersion"));assertEquals(user,captures.get(0).get("actor"));assertEquals("Longitudinal Trend",captures.get(0).get("method"));assertEquals(snapshot,captures.get(0).get("id"));
        when(sql.one(contains("max(review_version)"),anyMap())).thenReturn(Optional.of(Map.of("version",1)));
        assertThrows(ApiException.class,()->service().review(actor,patient,new RenalClinicalModuleService.ReviewRequest(snapshot,UUID.randomUUID(),"renalTrajectory",0,"DEFER","Reviewed",null,null)));
        assertEquals(1,captures.size());verify(renal,never()).predict(any(),any(),any());
    }

}
