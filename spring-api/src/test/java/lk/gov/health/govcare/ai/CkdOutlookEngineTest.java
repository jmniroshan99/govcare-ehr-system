package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class CkdOutlookEngineTest {
    static final ObjectMapper JSON=new ObjectMapper();
    static final Instant NOW=Instant.parse("2026-10-15T00:00:00Z");
    static final CkdOutlookEngine.Confirmation CONFIRMED=new CkdOutlookEngine.Confirmation("MALE",true,true,true,"Synthetic verified clinical context");
    static ObjectNode source() {
        var root=JSON.createObjectNode().put("snapshotId",UUID.randomUUID().toString());
        root.putObject("kidneyFailureStatus").put("dialysisStatus","NOT_ON_MAINTENANCE_HD");
        var data=root.putObject("clinicalFeatureData");var current=data.putObject("current");
        current.putObject("egfr").put("value",25).put("unit","mL/min/1.73m2").put("observedAt",NOW.minusSeconds(86400).toString()).put("state","AVAILABLE").put("source","VERIFIED_CLINICAL_OBSERVATION").put("sourceId","synthetic-egfr");
        current.putObject("acr").put("value",300).put("unit","mg/g").put("observedAt",NOW.minusSeconds(86400).toString()).put("state","AVAILABLE").put("source","VERIFIED_CLINICAL_OBSERVATION").put("sourceId","synthetic-acr");
        data.putObject("history").putArray("egfr").add(current.path("egfr").deepCopy());data.putArray("excludedData");return root;
    }
    static ObjectNode evidence(){return CkdOutlookEngine.evidence(source(),Map.of("date_of_birth","1961-02-01","gender","Male"),false,NOW);}
    @Test void completeInputsDoNotImplyEligibilityOrLocalValidation() {
        var result=CkdOutlookEngine.assess(evidence(),null,NOW);
        assertEquals(100,result.path("completeness").path("percent").asInt());
        assertEquals("CLINICAL_CONTEXT_REQUIRED",result.path("status").asText());assertTrue(result.path("twoYearRisk").isNull());assertTrue(result.path("fiveYearRisk").isNull());
        assertEquals("NOT_COMPLETED",result.path("model").path("localValidation").asText());
        assertTrue(result.path("model").path("confidenceInterval").isNull());
    }
    @Test void confirmedContextProducesSeparatePublishedHorizonRisks() {
        var r=CkdOutlookEngine.assess(evidence(),CONFIRMED,NOW);
        assertEquals("AVAILABLE",r.path("status").asText());assertEquals(.30627437347101205,r.path("fiveYearRisk").asDouble(),1e-12);
        assertEquals(.09011469495037816,r.path("twoYearRisk").asDouble(),1e-12);
        assertFalse(r.has("projectedEgfr"));assertEquals("MALE",r.path("evidence").path("inputs").path("sex").path("value").asText());
    }
    @Test void dialysisAndEarlyStageAndChildAreExplicitlyInapplicable() {
        for(String kind:List.of("dialysis","early","child")) {
            var e=evidence();if(kind.equals("dialysis"))e.put("maintenanceDialysis",true);
            if(kind.equals("early"))((ObjectNode)e.path("inputs").path("egfr")).put("value",65);
            if(kind.equals("child"))((ObjectNode)e.path("inputs").path("age")).put("value",16);
            var r=CkdOutlookEngine.assess(e,CONFIRMED,NOW);assertEquals("NOT_APPLICABLE",r.path("status").asText());assertTrue(r.path("fiveYearRisk").isNull());assertFalse(r.path("canCalculateAfterConfirmation").asBoolean());
        }
    }
    @Test void absentAcrDoesNotUseSerumAlbuminOrBecomeZeroRisk() {
        var e=evidence();((ObjectNode)e.path("inputs")).putObject("acr").putNull("value").put("state","MISSING");
        ((ObjectNode)e.path("inputs")).putObject("albumin").put("value",40).put("unit","g/L");
        var r=CkdOutlookEngine.assess(e,CONFIRMED,NOW);assertEquals("INSUFFICIENT_DATA",r.path("status").asText());assertTrue(r.path("fiveYearRisk").isNull());assertEquals(75,r.path("completeness").path("percent").asInt());
    }
    @Test void invalidStaleFutureUndatedAndUnalignedSourcesBlockTheEquation() {
        for(String kind:List.of("invalid","stale","future","undated","unaligned","zero","units")) {
            var e=evidence();var a=(ObjectNode)e.path("inputs").path("acr");
            switch(kind) {case "invalid"->a.put("state","INVALID");case "stale"->a.put("observedAt",NOW.minusSeconds(91*86400).toString());case "future"->a.put("observedAt",NOW.plusSeconds(10).toString());case "undated"->a.putNull("observedAt");case "unaligned"->a.put("observedAt",NOW.minusSeconds(35*86400).toString());case "zero"->a.put("value",0);case "units"->a.put("unit","g/L");}
            var r=CkdOutlookEngine.assess(e,CONFIRMED,NOW);assertEquals("SOURCE_REVIEW_REQUIRED",r.path("status").asText(),kind);assertTrue(r.path("fiveYearRisk").isNull(),kind);
        }
    }
    @Test void acuteHospitalTruncatedAndConflictingContextCannotBeOverriddenByACheckbox() {
        for(String flag:List.of("acuteReviewSignal","recentAdmission","historyTruncated","creatinineSourceInvalid")) {
            var e=evidence();e.put(flag,true);assertEquals("SOURCE_REVIEW_REQUIRED",CkdOutlookEngine.assess(e,CONFIRMED,NOW).path("status").asText(),flag);
        }
    }
    @Test void sourceFingerprintIgnoresAssemblyTimestampButTracksRelevantClinicalChanges() {
        var source=source();var patient=Map.<String,Object>of("date_of_birth","1961-02-01","gender","Male");
        var one=CkdOutlookEngine.evidence(source,patient,false,NOW);source.put("generatedAt",NOW.plusSeconds(100).toString());source.put("snapshotId",UUID.randomUUID().toString());
        assertEquals(one.path("fingerprint"),CkdOutlookEngine.evidence(source,patient,false,NOW).path("fingerprint"));
        ((ObjectNode)source.path("clinicalFeatureData").path("current").path("acr")).put("value",400);
        assertNotEquals(one.path("fingerprint"),CkdOutlookEngine.evidence(source,patient,false,NOW).path("fingerprint"));
    }
}
