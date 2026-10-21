package lk.gov.health.govcare.ai;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class CkdLearnedReadinessTest {
    @Test void sourcePropertyOrderAfterJsonbReloadDoesNotChangeEvidenceIdentity() {
        var source=CkdOutlookEngineTest.source();var now=Instant.now();var patient=java.util.Map.<String,Object>of("date_of_birth","1961-02-01","gender","Male");
        var first=CkdOutlookEngine.evidence(source,patient,false,now);
        var reloaded=CkdOutlookEngine.evidence(CkdOutlookEngine.canonical(source),patient,false,now);
        assertEquals(first.path("fingerprint"),reloaded.path("fingerprint"));
        var json=new com.fasterxml.jackson.databind.ObjectMapper();
        assertEquals(CkdOutlookEngine.canonical(json.createObjectNode().put("value",25)).toString(),
            CkdOutlookEngine.canonical(json.createObjectNode().put("value",25.0)).toString());
    }
    @Test void absentLongTermEndpointsCannotBecomeZeroRiskOrAContinuousCurve() {
        var value=CkdOutlookEngine.learnedModelReadiness();
        assertEquals("INSUFFICIENT_LONG_TERM_OUTCOME_DATA",value.path("status").asText());
        assertTrue(value.path("probability").isNull());assertTrue(value.path("curve").isNull());
        assertTrue(value.path("missing_fields").size()>5);assertEquals(7,value.path("candidates").size());
    }
    @Test void publishedEquationStillWorksAndStoresItsSeparateLearnedReadiness() {
        var now=Instant.now();var source=CkdOutlookEngineTest.source();
        var evidence=CkdOutlookEngine.evidence(source,java.util.Map.of("date_of_birth","1961-02-01","gender","Male"),false,now);
        var result=CkdOutlookEngine.assess(evidence,CkdOutlookEngineTest.CONFIRMED,now);
        assertEquals("PUBLISHED_EQUATION_ESTIMATE",result.path("resultType").asText());
        assertTrue(result.path("fiveYearRisk").asDouble()>0);
        assertEquals("INSUFFICIENT_LONG_TERM_OUTCOME_DATA",result.path("learnedModel").path("status").asText());
        assertTrue(result.path("learnedModel").path("probability").isNull());
    }
}
