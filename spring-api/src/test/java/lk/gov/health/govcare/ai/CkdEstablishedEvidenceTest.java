package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Exercises the production normalization, module assembly, evidence mapping and outlook equation. */
class CkdEstablishedEvidenceTest {
    static final ObjectMapper JSON=new ObjectMapper().findAndRegisterModules();
    static final Instant NOW=Instant.parse("2026-10-15T08:00:00Z");
    static final UUID PATIENT=UUID.randomUUID(),HOSPITAL=UUID.randomUUID();
    static ObjectNode snapshot(Map<String,? extends Number> values,Instant at,Instant recorded) {
        var metadata=JSON.createObjectNode();values.keySet().forEach(k->{if(at!=null)metadata.putObject(k).put("observedAt",at.toString());});
        return ClinicalFeatureNormalizer.assessment(Map.of("id",UUID.randomUUID(),"source_assessment_id",UUID.randomUUID(),"raw_inputs",values,"feature_metadata",metadata,"recorded_at",recorded),NOW);
    }
    static ObjectNode mapped(List<ObjectNode> snapshots,String diabetes,boolean hd,List<SriLankanRenalIntelligenceService.ObservationView> rows) {
        var context=JSON.createObjectNode();if(diabetes!=null)context.putObject("diabetes").put("status",diabetes).put("verifiedAt",NOW.minusSeconds(86400).toString()).put("sourceId",UUID.randomUUID().toString()).put("sourceNote",CkdResearchDemoService.SOURCE);
        var status=new SriLankanRenalIntelligenceService.RenalStatus(hd?"G5D":null,"Synthetic verified context",CkdResearchDemoService.SOURCE,null,null,null,hd?"MAINTENANCE_HD":"NOT_ON_MAINTENANCE_HD",NOW.minusSeconds(86400),CkdResearchDemoService.SOURCE,UUID.randomUUID());
        var overview=new SriLankanRenalIntelligenceService.Overview(PATIENT,HOSPITAL,status,rows,List.of(),null,true,false);
        return ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(overview,RenalReadinessTest.registry(),NOW),new ClinicalPredictionFeatureService.FeatureData(PATIENT,HOSPITAL,snapshots,List.of(),false,context),NOW);
    }
    static List<ObjectNode> demoSnapshots(boolean hd) {
        var snapshots=new ArrayList<ObjectNode>();for(int day:List.of(366,276,186,96,1)) {Instant at=NOW.minusSeconds(day*86400L);Map<String,BigDecimal> values=CkdResearchDemoService.features(hd,(366.0-day)/365.0,LocalDate.parse("1961-07-15"),at);snapshots.add(snapshot(values,at,NOW.minusSeconds(day)));}return snapshots;
    }
    @Test void verifiedDiabetesCompletesSurveillanceWhileHighHba1cAloneRemainsUnknown() {
        var snapshots=demoSnapshots(true);
        var unknown=mapped(snapshots,null,false,List.of());assertEquals(4,unknown.path("cardiovascularMonitoring").path("dataReadiness").path("availableCount").asInt());
        for(String context:List.of("CONFIRMED_DIABETES","NO_KNOWN_DIABETES")) {
            var cv=mapped(snapshots,context,false,List.of()).path("cardiovascularMonitoring");assertEquals(5,cv.path("dataReadiness").path("availableCount").asInt());assertEquals(context,cv.path("diabetesContext").path("status").asText());assertEquals("Not estimated",cv.path("riskLevel").asText());
        }
        assertEquals(4,mapped(snapshots,"UNCONFIRMED",false,List.of()).path("cardiovascularMonitoring").path("dataReadiness").path("availableCount").asInt());
    }
    @Test void actualDatedHistoryEstablishesTrendWithoutDatingAnUndatedSnapshotOrMakingAnAcuteClaim() {
        var snapshots=List.of(snapshot(Map.of("SerumCreatinine",1.0),NOW.minusSeconds(3*86400),NOW.minusSeconds(300)),snapshot(Map.of("SerumCreatinine",1.5),NOW.minusSeconds(86400),NOW.minusSeconds(200)),snapshot(Map.of("SerumCreatinine",3.0),null,NOW.minusSeconds(100)));
        var out=mapped(snapshots,null,false,List.of());var current=out.path("clinicalFeatureData").path("current").path("creatinine");var aki=out.path("akiRisk");
        assertEquals(3,current.path("value").asDouble());assertTrue(current.path("observedAt").isNull());
        assertEquals(50,aki.path("creatinineChangePercent").asDouble(),1e-9);assertTrue(aki.path("trend").path("snapshotUndated").asBoolean());assertFalse(aki.path("acuteReviewSignal").asBoolean());assertEquals("Historical creatinine change calculated",aki.path("resultTitle").asText());
    }
    @Test void aSingleDatedResultCountsItsDateButCannotEstablishATrend() {
        var out=mapped(List.of(snapshot(Map.of("SerumCreatinine",2.0),NOW.minusSeconds(86400),NOW)),null,false,List.of());
        var aki=out.path("akiRisk");assertTrue(aki.path("creatinineChangePercent").isNull());
        var date=java.util.stream.StreamSupport.stream(aki.path("requirements").spliterator(),false).filter(r->r.path("key").asText().equals("current_creatinine_date")).findFirst().orElseThrow();assertTrue(date.path("satisfied").asBoolean());
    }
    @Test void invalidCurrentSourceCannotBeBypassedByAnOlderValidPair() {
        var snapshots=new ArrayList<>(demoSnapshots(false));snapshots.add(snapshot(Map.of("SerumCreatinine",0.0),null,NOW));
        var out=mapped(snapshots,null,false,List.of());assertFalse(out.path("clinicalFeatureData").path("current").path("creatinine").path("available").asBoolean());assertTrue(out.path("akiRisk").path("creatinineChangePercent").isNull());
    }
    @Test void syntheticNonDialysisCaseUsesTheExistingFiveYearEquationAfterExplicitConfirmation() {
        var source=mapped(demoSnapshots(false),"NO_KNOWN_DIABETES",false,List.of());
        var evidence=CkdOutlookEngine.evidence(source,Map.of("date_of_birth","1961-07-15","gender","male"),false,NOW);
        assertEquals("CLINICAL_CONTEXT_REQUIRED",CkdOutlookEngine.assess(evidence,null,NOW).path("status").asText());
        var result=CkdOutlookEngine.assess(evidence,CkdOutlookEngineTest.CONFIRMED,NOW);assertEquals("AVAILABLE",result.path("status").asText());assertTrue(result.path("fiveYearRisk").asDouble()>result.path("twoYearRisk").asDouble());assertFalse(result.has("projectedEgfr"));
    }
    @Test void syntheticHdSeriesEstablishesMeasuredUrrAndExistingResearchInputReadiness() {
        var rows=new ArrayList<SriLankanRenalIntelligenceService.ObservationView>();
        for(int day:List.of(61,31,1)) {double t=(61.0-day)/30;var v=new HashMap<>(RenalReadinessTest.labs());v.put("hb",10.2+.3*t);v.put("potassium_pre",4.7+.2*t);v.put("urea_pre",20+.5*t);v.put("urea_post",7-.35*t);v.put("urr",100*(v.get("urea_pre")-v.get("urea_post"))/v.get("urea_pre"));var units=new HashMap<String,String>();v.keySet().forEach(k->units.put(k,k.equals("hb")?"g/dL":k.equals("albumin")?"g/L":k.startsWith("creatinine")?"umol/L":k.equals("urr")?"%":"mmol/L"));rows.add(new SriLankanRenalIntelligenceService.ObservationView(UUID.randomUUID(),NOW.minusSeconds(day*86400L),true,v,units,CkdResearchDemoService.SOURCE,List.of(),Map.of("patientId",PATIENT.toString(),"sessionId","SYNTH-"+day,"sourceVerified",true,"preCollectedAt",NOW.minusSeconds(day*86400L+14400).toString(),"postCollectedAt",NOW.minusSeconds(day*86400L).toString())));}
        var out=mapped(demoSnapshots(true),"CONFIRMED_DIABETES",true,rows);assertEquals(70,out.path("dialysisAdequacy").path("clinicalAssessment").path("currentValue").asDouble(),1e-9);
        for(String key:List.of("anemia","hyperkalemia","dialysisAdequacy")){assertTrue(out.path(key).path("canRun").asBoolean(),key+": "+out.path(key).path("researchReadiness"));assertTrue(out.path(key).path("forecast").isNull());}
        var e=CkdOutlookEngine.evidence(out,Map.of("date_of_birth","1961-07-15","gender","male"),false,NOW);assertEquals("NOT_APPLICABLE",CkdOutlookEngine.assess(e,CkdOutlookEngineTest.CONFIRMED,NOW).path("status").asText());
    }
}
