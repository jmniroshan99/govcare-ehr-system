package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class CkdOutlookServiceTest {
    final SqlSupport sql=mock(SqlSupport.class);final ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);
    final RenalClinicalModuleService modules=mock(RenalClinicalModuleService.class);final ObjectMapper mapper=new ObjectMapper();
    final UUID patient=UUID.randomUUID();
    final GovCarePrincipal actor=new GovCarePrincipal(UUID.randomUUID(),UUID.randomUUID(),null,null,"outlook@example.invalid","Synthetic operational verifier","doctor",Set.of("PATIENT_VIEW_CLINICAL","CONSULTATION_UPDATE"),true,false,1);
    final CkdOutlookService service=new CkdOutlookService(sql,access,modules,mapper);
    final Map<String,Object> identity=new HashMap<>(Map.of("id",patient,"hospital_id",actor.hospitalId(),"full_name","SYNTHETIC SOFTWARE DEMONSTRATION","patient_no","OUTLOOK-QA","date_of_birth","1961-02-01","gender","Male"));
    ObjectNode source;
    @BeforeEach void setup() {
        source=CkdOutlookEngineTest.source().put("patientId",patient.toString()).put("hospitalId",actor.hospitalId().toString());
        when(access.clinicalScope(eq(actor),eq(patient),anyBoolean())).thenReturn(actor);
        when(sql.required(anyString(),anyMap(),anyString())).thenAnswer(i->{String q=i.getArgument(0);return q.contains("from patients")?identity:q.contains("from ckd_outlook_snapshots")?Map.of("id",UUID.randomUUID()):Map.of("held",true);});
        when(sql.one(anyString(),anyMap())).thenReturn(Optional.empty());when(sql.list(anyString(),anyMap())).thenReturn(List.of());
        when(sql.update(anyString(),anyMap())).thenReturn(1);when(modules.overview(actor,patient)).thenReturn(source);
    }
    ObjectNode evidence(){return CkdOutlookEngine.evidence(source,identity,false,Instant.now());}
    CkdOutlookService.AssessmentRequest request(UUID id,String note){return new CkdOutlookService.AssessmentRequest(id,evidence().path("fingerprint").asText(),"MALE",true,true,true,note);}
    ObjectNode stored() {
        return CkdOutlookEngine.assess(evidence(),CkdOutlookEngineTest.CONFIRMED,Instant.now()).put("id",UUID.randomUUID().toString()).put("patientId",patient.toString()).put("hospitalId",actor.hospitalId().toString()).put("evidenceFingerprint",evidence().path("fingerprint").asText());
    }
    @Test void everyPublicOperationAuthorizesBeforeAnyClinicalQueryOrWrite() {
        when(access.clinicalScope(eq(actor),eq(patient),anyBoolean())).thenThrow(ApiException.forbidden("Denied"));
        assertThrows(ApiException.class,()->service.overview(actor,patient));assertThrows(ApiException.class,()->service.calculate(actor,patient,null));
        assertThrows(ApiException.class,()->service.review(actor,patient,null));assertThrows(ApiException.class,()->service.scenario(actor,patient,null));assertThrows(ApiException.class,()->service.storedForReport(actor,patient));
        verifyNoInteractions(sql,modules);
    }
    @Test void overviewRejectsAMismatchedPatientOrHospitalSource() {
        source.put("patientId",UUID.randomUUID().toString());assertThrows(ApiException.class,()->service.overview(actor,patient));
        verify(sql,never()).update(anyString(),anyMap());
    }
    @Test void calculationIsIdempotentBoundToEvidenceAndNeverCreatesMeasurements() throws Exception {
        AtomicReference<Map<String,Object>> saved=new AtomicReference<>();
        when(sql.one(anyString(),anyMap())).thenAnswer(i->{String q=i.getArgument(0);return q.contains("requested_by=:actor")?Optional.ofNullable(saved.get()):Optional.empty();});
        when(sql.update(anyString(),anyMap())).thenAnswer(i->{String q=i.getArgument(0);Map<String,Object> p=i.getArgument(1);if(q.startsWith("insert into ckd_outlook_snapshots"))saved.set(Map.of("outputs",p.get("outputs"),"request_fingerprint",p.get("fingerprint")));return 1;});
        var r=request(UUID.randomUUID(),"Synthetic verified context");var first=service.calculate(actor,patient,r);var second=service.calculate(actor,patient,r);
        assertEquals(first.path("id"),second.path("id"));assertEquals(.30627437347101205,first.path("fiveYearRisk").asDouble(),1e-12);
        verify(sql,times(1)).update(startsWith("insert into ckd_outlook_snapshots"),argThat(p->patient.equals(p.get("p"))&&actor.hospitalId().equals(p.get("h"))&&actor.id().equals(p.get("actor"))));
        verify(sql,never()).update(contains("clinical_observations"),anyMap());verify(sql,never()).update(contains("ai_ckd_predictions"),anyMap());
        assertThrows(ApiException.class,()->service.calculate(actor,patient,request(r.requestId(),"Different content")));
    }
    @Test void evidenceChangingBetweenPreviewAndCalculateConflictsWithoutSavingAnOutlook() {
        var before=request(UUID.randomUUID(),"Context verified");((ObjectNode)source.path("clinicalFeatureData").path("current").path("acr")).put("value",400);
        assertThrows(ApiException.class,()->service.calculate(actor,patient,before));verify(sql,never()).update(startsWith("insert into ckd_outlook_snapshots"),anyMap());
    }
    @Test void scenarioUsesPatientScopedRecordedInputsAndPersistsNothing() {
        ObjectNode saved=stored();UUID id=UUID.fromString(saved.path("id").asText());
        when(sql.required(contains("select outputs from ckd_outlook_snapshots"),anyMap(),anyString())).thenReturn(Map.of("outputs",saved.toString()));
        var result=service.scenario(actor,patient,new CkdOutlookService.ScenarioRequest(id,25,300/8.84,"mg/mmol"));
        assertTrue(result.path("hypothetical").asBoolean());assertFalse(result.path("persisted").asBoolean());assertEquals(saved.path("fiveYearRisk").asDouble(),result.path("fiveYearRisk").asDouble(),1e-12);
        verify(sql).required(contains("id=:snapshot and hospital_id=:h and patient_id=:p"),argThat(p->id.equals(p.get("snapshot"))&&patient.equals(p.get("p"))&&actor.hospitalId().equals(p.get("h"))),anyString());
        verifyNoInteractions(modules);verify(sql,never()).update(anyString(),anyMap());
    }
    @Test void scenarioRejectsCurrentDialysisAndInvalidInputsWithoutWrites() {
        ObjectNode saved=stored();var id=UUID.fromString(saved.path("id").asText());
        when(sql.required(contains("select outputs from ckd_outlook_snapshots"),anyMap(),anyString())).thenReturn(Map.of("outputs",saved.toString()));
        assertThrows(ApiException.class,()->service.scenario(actor,patient,new CkdOutlookService.ScenarioRequest(id,25,0,"mg/g")));
        when(sql.one(contains("renal_dialysis_context_events"),anyMap())).thenReturn(Optional.of(Map.of("context_status","MAINTENANCE_HD")));
        assertThrows(ApiException.class,()->service.scenario(actor,patient,new CkdOutlookService.ScenarioRequest(id,25,300,"mg/g")));
        verifyNoInteractions(modules);verify(sql,never()).update(anyString(),anyMap());
    }
    @Test void reportReadsExactStoredRisksAndReviewWithoutClinicalAssemblyOrRecalculation() {
        ObjectNode saved=stored().put("fiveYearRisk",.42);
        when(sql.one(contains("select outputs from ckd_outlook_snapshots"),anyMap())).thenReturn(Optional.of(Map.of("outputs",saved.toString())));
        var report=service.storedForReport(actor,patient);assertEquals(.42,report.path("fiveYearRisk").asDouble());
        verifyNoInteractions(modules);verify(sql,never()).update(anyString(),anyMap());
    }
    @Test void reportReloadAcceptsNativePostgresNormalizedJsonbMaps() {
        ObjectNode saved=stored().put("fiveYearRisk",.42);
        var normalized=mapper.convertValue(saved,Map.class);
        when(sql.one(contains("select outputs from ckd_outlook_snapshots"),anyMap())).thenReturn(Optional.of(Map.of("outputs",normalized)));
        var report=service.storedForReport(actor,patient);
        assertEquals(.42,report.path("fiveYearRisk").asDouble());
        verifyNoInteractions(modules);
    }
    @Test void normalizedJsonbUnavailableProbabilitiesRemainExplicitNullWithApplicationNonNullDefaults() {
        var appMapper=new ObjectMapper().setSerializationInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
        var actual=new CkdOutlookService(sql,access,modules,appMapper);
        var output=stored();output.putNull("fiveYearRisk");output.putNull("twoYearRisk");
        Map<?,?> normalized=mapper.convertValue(output,Map.class);
        when(sql.one(contains("select outputs from ckd_outlook_snapshots"),anyMap())).thenReturn(Optional.of(Map.of("outputs",normalized)));
        var report=actual.storedForReport(actor,patient);
        assertTrue(report.has("fiveYearRisk"));assertTrue(report.path("fiveYearRisk").isNull());
        assertTrue(report.path("learnedModel").has("probability"));assertTrue(report.path("learnedModel").path("probability").isNull());
    }
    @Test void staleReviewVersionCannotOverwriteAnotherClinicianAndNoSnapshotIsUpdated() {
        when(sql.one(startsWith("select review_version"),anyMap())).thenReturn(Optional.of(Map.of("review_version",2)));
        var r=new CkdOutlookService.ReviewRequest(UUID.randomUUID(),UUID.randomUUID(),0,"ACCEPT","Clinical review","Notes","",List.of());
        assertThrows(ApiException.class,()->service.review(actor,patient,r));verify(sql,never()).update(anyString(),anyMap());
    }
    @Test void reviewAppendsAPlanAndInterpretationWithoutChangingEquationOutputs() {
        var r=new CkdOutlookService.ReviewRequest(UUID.randomUUID(),UUID.randomUUID(),0,"MODIFY","Clinical reason","Clinician notes","Revised clinical interpretation",List.of(new CkdOutlookService.Milestone(1,"Review recorded kidney history")));
        var result=service.review(actor,patient,r);assertEquals(1,result.path("reviewVersion").asInt());
        verify(sql).update(startsWith("insert into ckd_outlook_reviews"),argThat(p->p.get("plans").toString().contains("Review recorded kidney history")&&p.get("modified").equals("Revised clinical interpretation")));
        verify(sql,never()).update(contains("update ckd_outlook_snapshots"),anyMap());verify(sql,never()).update(contains("clinical_observations"),anyMap());
    }
    @Test void unsupportedMilestonesOrMissingModificationReasonAreRejected() {
        var missingInterpretation=new CkdOutlookService.ReviewRequest(UUID.randomUUID(),UUID.randomUUID(),0,"MODIFY","Reason","","",List.of());
        var invalidMilestone=new CkdOutlookService.ReviewRequest(UUID.randomUUID(),UUID.randomUUID(),0,"ACCEPT","Reason","","",List.of(new CkdOutlookService.Milestone(6,"Outside planning horizon")));
        for(var r:List.of(missingInterpretation,invalidMilestone))assertThrows(ApiException.class,()->service.review(actor,patient,r));
        verify(sql,never()).update(anyString(),anyMap());
    }
}
