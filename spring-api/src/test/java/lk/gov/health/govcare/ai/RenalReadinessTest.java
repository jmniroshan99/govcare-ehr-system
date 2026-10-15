package lk.gov.health.govcare.ai;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class RenalReadinessTest {
    static List<Map<String,Object>> registry(){return new RenalModelMetadata("").enrich(List.of(
            Map.of("model_key","hb","runtime_status","ACTIVE","version","1.0.0"),
            Map.of("model_key","urr","runtime_status","ACTIVE","version","1.0.0"),
            Map.of("model_key","hyperkalemia","runtime_status","ACTIVE","version","1.0.0")));}
    static Map<String,Double> labs(){return Map.of("hb",10.5,"albumin",38.0,"calcium",2.2,"sodium",138.0,"potassium_pre",4.8,"creatinine_pre",700.0,"urea_pre",20.0,"urea_post",7.0);}
    static com.fasterxml.jackson.databind.JsonNode check(com.fasterxml.jackson.databind.JsonNode module,String key){for(var c:module.path("readiness").path("requirements"))if(c.path("key").asText().equals(key))return c;throw new AssertionError(key);}
    static final Instant NOW = Instant.parse("2026-10-12T02:00:00Z");
    static SriLankanRenalIntelligenceService.ObservationView row(int days, boolean hd, Map<String,Double> values) {
        Map<String,String> units = new HashMap<>();
        values.keySet().forEach(key -> units.put(key, switch(key) {
            case "hb" -> "g/dL"; case "albumin" -> "g/L"; case "creatinine_pre", "creatinine_post" -> "umol/L";
            default -> "mmol/L";
        }));
        return new SriLankanRenalIntelligenceService.ObservationView(UUID.randomUUID(), NOW.minus(days,ChronoUnit.DAYS),
                hd, values, units, "OPERATIONAL QA ONLY; not a clinical subject", List.of());
    }
    static SriLankanRenalIntelligenceService.Overview data(List<SriLankanRenalIntelligenceService.ObservationView> rows) {
        return new SriLankanRenalIntelligenceService.Overview(UUID.randomUUID(), UUID.randomUUID(),
                new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","No verified renal stage"),
                rows,List.of(),null,true,false);
    }
    @Test void emptyCompositeHasExplicitMissingRequirementsAndNoZeroPercentage() {
        var out = RenalClinicalModules.assemble(data(List.of()), List.of(), NOW);
        var module=out.path("renalDeterioration");
        assertTrue(module.path("readiness").isObject(),"The patient API must explain data readiness");
        assertEquals("Not enough longitudinal data",module.path("readiness").path("resultTitle").asText());
        assertFalse(module.path("readiness").path("ready").asBoolean());
        assertEquals(6,module.path("readiness").path("requirements").size());
        assertTrue(module.path("directionalPercent").isNull());
    }
    @Test void oneResultReportsOneOfTwoAndNamesTheNextAction() {
        var out=RenalClinicalModules.assemble(data(List.of(row(1,false,Map.of("hb",10.0)))),List.of(),NOW);
        var checks=out.path("renalTrajectory").path("readiness").path("requirements");
        var hb=new ArrayList<com.fasterxml.jackson.databind.JsonNode>();checks.forEach(r->{if("hb_history".equals(r.path("key").asText()))hb.add(r);});
        assertEquals(1,hb.size());assertEquals(1,hb.getFirst().path("availableCount").asInt());
        assertEquals(2,hb.getFirst().path("minimumCount").asInt());
        assertEquals("ADD_LAB_RESULT",hb.getFirst().path("action").asText());
    }
    @Test void partialTrajectoryRetainsAnEvaluableDomainWithoutRequiringAllBiomarkers() {
        var out=RenalClinicalModules.assemble(data(List.of(row(31,false,Map.of("hb",10.8)),row(1,false,Map.of("hb",10.2)))),List.of(),NOW);
        assertTrue(out.path("renalTrajectory").path("readiness").path("ready").asBoolean());
        assertEquals("Result partially available",out.path("renalTrajectory").path("readiness").path("resultTitle").asText());
        assertEquals("FALLING",out.path("renalTrajectory").path("domains").get(3).path("trendDirection").asText());
    }
    @Test void secondDatedResultChangesReadinessAutomatically() {
        var first=row(31,false,Map.of("hb",10.8));var second=row(1,false,Map.of("hb",10.2));
        assertFalse(RenalClinicalModules.assemble(data(List.of(first)),List.of(),NOW).path("renalTrajectory").path("readiness").path("ready").asBoolean());
        assertTrue(RenalClinicalModules.assemble(data(List.of(first,second)),List.of(),NOW).path("renalTrajectory").path("readiness").path("ready").asBoolean());
    }
    @Test void missingCurrentPotassiumHasExactTargetAndAction() {
        var values=new HashMap<>(labs());values.remove("potassium_pre");
        var out=RenalClinicalModules.assemble(data(List.of(row(31,true,labs()),row(1,true,values))),registry(),NOW).path("hyperkalemia");
        assertEquals("INSUFFICIENT_DATA",out.path("status").asText());assertEquals("MISSING",check(out,"potassium_pre_current").path("state").asText());
        assertEquals("potassium_pre",out.path("readiness").path("nextAction").path("focusKey").asText());assertFalse(out.path("canRun").asBoolean());
    }
    @Test void eligibilityFailureExplainsVerificationAndNeverInfersG5dFromCreatinine() {
        var out=RenalClinicalModules.assemble(data(List.of(row(1,false,Map.of("creatinine_pre",2200.0)))),registry(),NOW);
        assertEquals("NOT_APPLICABLE",out.path("hyperkalemia").path("status").asText());
        assertTrue(out.path("hyperkalemia").path("readiness").path("message").asText().contains("eligibility is not established"));
        assertEquals("VERIFY_DIALYSIS_STATUS",out.path("hyperkalemia").path("readiness").path("nextAction").path("type").asText());
        assertTrue(out.path("kidneyFailureStatus").path("lastVerifiedDate").isNull());assertEquals("UNCONFIRMED",out.path("kidneyFailureStatus").path("renalStatus").asText());
    }
    @Test void absentModelAsksForModelStatusInsteadOfMorePatientMeasurements() {
        var out=RenalClinicalModules.assemble(data(List.of(row(31,true,labs()),row(1,true,labs()))),List.of(),NOW).path("hyperkalemia");
        assertEquals("NOT_INSTALLED",out.path("status").asText());assertEquals("VIEW_MODEL_STATUS",out.path("readiness").path("nextAction").path("type").asText());
        assertFalse(out.path("readiness").path("ready").asBoolean());
    }
    @Test void serviceFailureHasItsOwnErrorStatusAndStoredReference() {
        var latest=row(1,true,labs());var original=data(List.of(row(31,true,labs()),latest));
        var json=new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode().put("forecast_origin_date",latest.observedAt().toString()).put("method","RESEARCH_MODEL");
        json.putObject("data_quality").putArray("flags").add("ML_SERVICE_TIMEOUT");json.putObject("explanation").putArray("limitations");
        UUID reference=UUID.randomUUID();var prediction=new SriLankanRenalIntelligenceService.PredictionView(reference,"hyperkalemia","NOT_AVAILABLE",json,NOW,"AWAITING_REVIEW",0);
        var context=new SriLankanRenalIntelligenceService.Overview(original.patientId(),original.hospitalId(),original.currentRenalStatus(),original.observations(),List.of(prediction),null,true,false);
        var out=RenalClinicalModules.assemble(context,registry(),NOW).path("hyperkalemia");
        assertEquals("ERROR",out.path("status").asText());assertEquals(reference.toString(),out.path("readiness").path("technicalReference").asText());
        assertEquals("RETRY_MODEL",out.path("readiness").path("nextAction").path("type").asText());
    }
    @Test void hbForecastCanBeReadyWithOneHbWhileItsTrendIsNotReady() {
        var before=new HashMap<>(labs());before.remove("hb");
        var out=RenalClinicalModules.assemble(data(List.of(row(31,true,before),row(1,true,labs()))),registry(),NOW).path("anemia");
        assertTrue(out.path("readiness").path("forecast").path("ready").asBoolean());assertFalse(out.path("readiness").path("trend").path("ready").asBoolean());
        assertEquals(1,out.path("readiness").path("trend").path("availableCount").asInt());assertEquals("Persistence Baseline",out.path("method").asText());
    }
    @Test void trendCanBeReadyWhileMonthlyForecastGapIsNotSupported() {
        var out=RenalClinicalModules.assemble(data(List.of(row(2,true,labs()),row(1,true,labs()))),registry(),NOW).path("anemia");
        assertTrue(out.path("readiness").path("trend").path("ready").asBoolean());assertFalse(out.path("readiness").path("forecast").path("ready").asBoolean());
        assertEquals("INVALID",check(out,"monthly_interval").path("state").asText());assertEquals("VIEW_HISTORY",out.path("readiness").path("nextAction").path("type").asText());
    }
    @Test void currentMeasuredUrrIsAvailableBeforeForecastHistory() {
        var out=RenalClinicalModules.assemble(data(List.of(row(1,true,labs()))),registry(),NOW).path("dialysisAdequacy");
        assertEquals(65,out.path("currentValue").asDouble(),1e-9);assertTrue(out.path("readiness").path("measured").path("ready").asBoolean());
        assertFalse(out.path("readiness").path("forecast").path("ready").asBoolean());assertTrue(out.path("forecast").isNull());
    }
    @Test void zeroUreaDenominatorIsExcludedAndExplained() {
        var values=new HashMap<>(labs());values.put("urea_pre",0.0);
        var out=RenalClinicalModules.assemble(data(List.of(row(1,true,values))),registry(),NOW).path("dialysisAdequacy");
        assertTrue(out.path("currentValue").isNull());assertFalse(out.path("readiness").path("measured").path("ready").asBoolean());
        assertEquals("INVALID",check(out,"paired_urea_session").path("state").asText());assertFalse(out.path("readiness").path("excludedData").isEmpty());
    }
    @Test void verifiedDialysisMakesClinicalStatusAvailableWithoutProbability() {
        var out=RenalClinicalModules.assemble(data(List.of(row(1,true,labs()))),registry(),NOW).path("kidneyFailureStatus");
        assertEquals("G5D",out.path("renalStatus").asText());assertTrue(out.path("readiness").path("ready").asBoolean());assertTrue(out.path("researchRiskScore").isNull());
    }
    @Test void staleMeasurementsAreVisibleAndCannotRunTheResearchModel() {
        var out=RenalClinicalModules.assemble(data(List.of(row(122,true,labs()),row(92,true,labs()))),registry(),NOW);
        assertEquals("STALE",check(out.path("hyperkalemia"),"latest_hd_freshness").path("state").asText());
        assertTrue(check(out.path("hyperkalemia"),"latest_hd_freshness").path("detail").asText().contains("92 days"));assertFalse(out.path("hyperkalemia").path("canRun").asBoolean());
    }
    @Test void safetyGateSuppressesBothForecastReadinessAndScores() {
        var values=new HashMap<>(labs());values.put("potassium_pre",8.2);
        var out=RenalClinicalModules.assemble(data(List.of(row(31,true,labs()),row(1,true,values))),registry(),NOW).path("hyperkalemia");
        assertEquals("BLOCKED_BY_SAFETY_GATE",out.path("status").asText());assertFalse(out.path("canRun").asBoolean());assertFalse(out.path("readiness").path("forecast").path("ready").asBoolean());assertTrue(out.path("researchRiskScore").isNull());
    }
    @Test void artifactFeatureContractAndConsolidatedChecklistAreRealAndDeduplicated() {
        var out=RenalClinicalModules.assemble(data(List.of()),registry(),NOW);
        assertEquals(84,out.path("hyperkalemia").path("readiness").path("modelFeatureContract").size());
        int count=0;for(var group:out.path("readinessSummary").path("missingDataGroups"))if(group.path("groupKey").asText().equals("dialysis"))count++;
        assertEquals(1,count);for(String key:RenalClinicalModules.ORDER)assertTrue(out.path(key).path("researchRiskScore").isNull());
    }
    @Test void observationDatesRemainIsoStringsForTheRealHistoryWorkflow() {
        var first=row(1,false,Map.of("hb",10.2));var out=RenalClinicalModules.assemble(data(List.of(first)),List.of(),NOW);
        assertTrue(out.path("observations").get(0).path("observed_at").isTextual());
        assertEquals(first.observedAt(),Instant.parse(out.path("observations").get(0).path("observed_at").asText()));
    }
    @Test void standaloneDialysisVerificationMakesG5dAvailableWithoutCreatingLabData() {
        var context=new SriLankanRenalIntelligenceService.RenalStatus("G5D","Verified dialysis","Clinician source",null,null,null,"MAINTENANCE_HD",NOW,"Operational clinician source",UUID.randomUUID());
        var d=data(List.of());var verified=new SriLankanRenalIntelligenceService.Overview(d.patientId(),d.hospitalId(),context,List.of(),List.of(),null,true,false);
        var out=RenalClinicalModules.assemble(verified,registry(),NOW);
        assertEquals("G5D",out.path("kidneyFailureStatus").path("renalStatus").asText());assertTrue(out.path("kidneyFailureStatus").path("readiness").path("ready").asBoolean());
        assertTrue(out.path("observations").isEmpty());assertEquals("INSUFFICIENT_DATA",out.path("hyperkalemia").path("status").asText());assertFalse(out.path("hyperkalemia").path("canRun").asBoolean());
    }
    @Test void verifiedNonDialysisContextIsIneligibleRatherThanMissingVerification() {
        var context=new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed kidney status","Clinician source",null,null,null,"NOT_ON_MAINTENANCE_HD",NOW,"Not on maintenance HD",UUID.randomUUID());
        var d=data(List.of(row(31,true,labs()),row(1,true,labs())));var notHd=new SriLankanRenalIntelligenceService.Overview(d.patientId(),d.hospitalId(),context,d.observations(),List.of(),null,true,false);
        var out=RenalClinicalModules.assemble(notHd,registry(),NOW).path("hyperkalemia");assertEquals("NOT_APPLICABLE",out.path("status").asText());assertEquals("VIEW_HISTORY",out.path("readiness").path("nextAction").path("type").asText());assertFalse(out.path("canRun").asBoolean());
    }
}
