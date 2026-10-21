package lk.gov.health.govcare.ai;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class RenalClinicalModulesTest {
    private final Instant now=Instant.parse("2026-10-11T10:00:00Z");
    private final List<Map<String,Object>> registry=new RenalModelMetadata("").enrich(List.of(Map.of("model_key","hb","version","1.0.0","display_name","LK-RENAL-HB-1.0","runtime_status","ACTIVE"),Map.of("model_key","urr","version","1.0.0","display_name","LK-RENAL-URR-1.0","runtime_status","ACTIVE"),Map.of("model_key","hyperkalemia","version","1.0.0","display_name","LK-RENAL-HYPERK-1.0","runtime_status","ACTIVE")));
    private SriLankanRenalIntelligenceService.ObservationView row(int days,boolean hd,Map<String,Double> overrides) {
        Map<String,Double> values=new HashMap<>(Map.of("hb",10.5,"albumin",38.0,"calcium",2.2,"sodium",138.0,"creatinine_pre",700.0,"potassium_pre",4.8,"urea_pre",20.0,"urea_post",7.0));values.putAll(overrides);
        Map<String,String> units=new HashMap<>(Map.of("hb","g/dL","albumin","g/L","calcium","mmol/L","sodium","mmol/L","creatinine_pre","umol/L","potassium_pre","mmol/L","urea_pre","mmol/L","urea_post","mmol/L"));
        return new SriLankanRenalIntelligenceService.ObservationView(UUID.randomUUID(),now.minus(days,ChronoUnit.DAYS),hd,values,units,"OPERATIONAL FIXTURE ONLY",List.of(),Map.of("patientId","SYNTHETIC-PATIENT","sessionId","SYNTH-"+days,"sourceVerified",true,"preCollectedAt",now.minus(days,ChronoUnit.DAYS).minusSeconds(14400).toString(),"postCollectedAt",now.minus(days,ChronoUnit.DAYS).toString()));
    }
    private SriLankanRenalIntelligenceService.Overview data(List<SriLankanRenalIntelligenceService.ObservationView> rows,List<SriLankanRenalIntelligenceService.PredictionView> predictions,boolean truncated) {
        return new SriLankanRenalIntelligenceService.Overview(UUID.randomUUID(),UUID.randomUUID(),new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","No verified renal stage"),rows,predictions,null,true,truncated);
    }
    @Test void pairedSessionUreaDerivesExactUrrAndShowsActualPreviousValue() {
        var out=RenalClinicalModules.assemble(data(List.of(row(31,true,Map.of()),row(1,true,Map.of("urea_post",5.0))),List.of(),false),registry,now);
        assertEquals(75,out.path("dialysisAdequacy").path("currentValue").asDouble(),1e-9);assertEquals(65,out.path("dialysisAdequacy").path("previousValue").asDouble(),1e-9);
        assertEquals("RISING",out.path("dialysisAdequacy").path("trendDirection").asText());assertTrue(out.path("dialysisAdequacy").path("forecast").isNull());
    }
    @Test void invalidDenominatorsNegativeUreaAndPostGreaterThanPreNeverBecomeZeroRisk() {
        for(Map<String,Double> values:List.of(Map.of("urea_pre",0.0),Map.of("urea_post",-1.0),Map.of("urea_post",30.0))) {
            var out=RenalClinicalModules.assemble(data(List.of(row(1,true,values)),List.of(),false),registry,now);
            assertTrue(out.path("dialysisAdequacy").path("currentValue").isNull());assertTrue(out.path("dialysisAdequacy").path("forecast").isNull());assertFalse(out.path("dataQuality").path("flags").isEmpty());
        }
    }
    @Test void g5dRequiresExplicitCurrentMaintenanceDialysisNotCreatinine() {
        var out=RenalClinicalModules.assemble(data(List.of(row(1,false,Map.of("creatinine_pre",2200.0))),List.of(),false),registry,now);
        assertEquals("UNCONFIRMED",out.path("kidneyFailureStatus").path("renalStatus").asText());assertEquals("NOT_APPLICABLE",out.path("dialysisAdequacy").path("status").asText());
        out=RenalClinicalModules.assemble(data(List.of(row(1,true,Map.of())),List.of(),false),registry,now);
        assertEquals("G5D",out.path("kidneyFailureStatus").path("renalStatus").asText());
        assertTrue(out.path("kidneyFailureStatus").path("researchRiskScore").isNull());
    }
    @Test void sparseInstalledHistoryIsInsufficientAndMissingArtifactIsNotInstalled() {
        var sparse=data(List.of(row(1,true,Map.of())),List.of(),false);
        var out=RenalClinicalModules.assemble(sparse,registry,now);assertEquals("INSUFFICIENT_DATA",out.path("hyperkalemia").path("status").asText());
        out=RenalClinicalModules.assemble(sparse,List.of(),now);assertEquals("NOT_INSTALLED",out.path("hyperkalemia").path("status").asText());
    }
    @Test void sixModuleOrderAndAnemiaMethodAreHonestWithoutInventedProbabilities() {
        var out=RenalClinicalModules.assemble(data(List.of(row(31,true,Map.of()),row(1,true,Map.of("hb",9.5))),List.of(),false),registry,now);
        assertEquals("Persistence Baseline",out.path("anemia").path("method").asText());assertEquals("DECLINING_HB_SIGNAL",out.path("anemia").path("signal").asText());
        assertEquals(RenalClinicalModules.ORDER,new ObjectMapper().convertValue(out.path("moduleOrder"),List.class));
        for(String key:RenalClinicalModules.ORDER)assertTrue(out.path(key).path("researchRiskScore").isNull());
    }
    @Test void compositeCountsValidDomainsAndKeepsPercentageDistinctFromProbability() {
        var out=RenalClinicalModules.assemble(data(List.of(row(31,true,Map.of()),row(1,true,Map.of("hb",9.0,"albumin",34.0,"creatinine_pre",800.0,"urea_pre",25.0,"urea_post",10.0,"potassium_pre",5.6))),List.of(),false),registry,now);
        assertEquals("DECLINING",out.path("renalTrajectory").path("signal").asText());
        var c=out.path("renalDeterioration");assertEquals(6,c.path("evaluatedComponents").asInt());assertEquals(6,c.path("worseningComponents").asInt());assertTrue(c.path("directionalPercent").isNull());assertTrue(c.path("researchRiskScore").isNull());
    }
    @Test void clinicalTrendUnitConversionDoesNotCreateFalseDirectionalChange() {
        var first=row(31,true,Map.of());var second=row(1,true,Map.of("hb",105.0));Map<String,String> units=new HashMap<>(second.units());units.put("hb","g/L");
        second=new SriLankanRenalIntelligenceService.ObservationView(second.id(),second.observedAt(),true,second.measurements(),units,second.sourceNote(),List.of());
        var out=RenalClinicalModules.assemble(data(List.of(first,second),List.of(),false),registry,now);assertEquals("STABLE",out.path("anemia").path("trendDirection").asText());assertEquals(10.5,out.path("anemia").path("currentValue").asDouble());
    }
    @Test void actualStoredHyperkalemiaScoreIsShownOnlyForMatchingFreshSource() throws Exception {
        var first=row(31,true,Map.of());var last=row(1,true,Map.of());var mapper=new ObjectMapper();
        ObjectNode output=mapper.createObjectNode().put("model_key","hyperkalemia").put("model","LK-RENAL-HYPERK-1.0").put("model_version","1.0.0").put("status","AVAILABLE").put("probability",.37).put("method","RESEARCH_MODEL").put("forecast_origin_date",last.observedAt().toString());
        output.putObject("explanation").putArray("limitations");
        var p=new SriLankanRenalIntelligenceService.PredictionView(UUID.randomUUID(),"hyperkalemia","AVAILABLE",output,now,"AWAITING_REVIEW",0);
        var out=RenalClinicalModules.assemble(data(List.of(first,last),List.of(p),false),registry,now);assertEquals(.37,out.path("hyperkalemia").path("researchRiskScore").asDouble());assertTrue(out.path("anemia").path("researchRiskScore").isNull());
        out=RenalClinicalModules.assemble(data(List.of(first,last,row(0,true,Map.of())),List.of(p),false),registry,now);assertTrue(out.path("hyperkalemia").path("researchRiskScore").isNull());
    }
    @Test void truncatedHistoryBlocksForecastAndDirectionalScores() {
        var out=RenalClinicalModules.assemble(data(List.of(row(31,true,Map.of()),row(1,true,Map.of())),List.of(),true),registry,now);
        assertEquals("BLOCKED_BY_SAFETY_GATE",out.path("renalDeterioration").path("status").asText());assertTrue(out.path("renalDeterioration").path("directionalPercent").isNull());assertTrue(out.path("hyperkalemia").path("researchRiskScore").isNull());
    }
}
