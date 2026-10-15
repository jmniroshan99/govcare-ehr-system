package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.cfg.JsonNodeFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lk.gov.health.govcare.common.JsonSupport;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.ClinicalPatientAccess;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SriLankanRenalSerializationTest {
    private ObjectMapper springLikeMapper() {
        ObjectMapper mapper = Jackson2ObjectMapperBuilder.json().findModulesViaServiceLoader(true)
                .serializationInclusion(JsonInclude.Include.NON_NULL).build();
        // Jackson 2.19 ObjectNode's own filtering is independent of record/property inclusion.
        mapper.configure(JsonNodeFeature.WRITE_NULL_PROPERTIES, false);
        return mapper;
    }
    private SriLankanRenalIntelligenceService.PredictionView view(JsonNode outputs) {
        return new SriLankanRenalIntelligenceService.PredictionView(UUID.randomUUID(), "hb",
                outputs.path("status").asText(), outputs, Instant.parse("2026-10-01T10:00:00Z"), "AWAITING_REVIEW", 0);
    }

    @Test void unavailableHttpOutputsRetainExplicitNullPredictionProbabilityAndInterval() throws Exception {
        ObjectMapper mapper = springLikeMapper();
        ObjectNode output = mapper.createObjectNode();
        output.put("status", "INSUFFICIENT_DATA"); output.putNull("prediction"); output.putNull("probability"); output.putNull("interval");
        output.putObject("data_quality").putArray("flags").add("AT_LEAST_TWO_VERIFIED_DATED_OBSERVATIONS_REQUIRED");
        JsonNode encoded = mapper.readTree(mapper.writeValueAsBytes(view(output)));
        for (String key : new String[]{"prediction", "probability", "interval"}) {
            assertTrue(encoded.path("outputs").has(key), "Contract field must be present: " + key);
            assertTrue(encoded.path("outputs").get(key).isNull());
        }
        assertEquals("INSUFFICIENT_DATA", encoded.path("status").asText());
        assertEquals("AT_LEAST_TWO_VERIFIED_DATED_OBSERVATIONS_REQUIRED", encoded.path("outputs").path("data_quality").path("flags").get(0).asText());
        assertFalse(encoded.has("reason")); // The record's unrelated optional fields retain existing NON_NULL behavior.
    }

    @Test void availableRegressionAndNestedBaselineContributionsRetainNullsWithoutChangingNumbers() throws Exception {
        ObjectMapper mapper = springLikeMapper();
        JsonNode output = mapper.readTree("""
                {"status":"AVAILABLE","method":"PERSISTENCE_BASELINE","prediction":10.5,"probability":null,"interval":null,
                 "explanation":{"method":"BASELINE","top_factors":[{"feature":"hb","value":10.5,"contribution":null,
                 "direction":"LAST_OBSERVATION_CARRIED_FORWARD"},{"feature":"albumin","value":null,"contribution":null}],
                 "trends":[],"limitations":["Research only"]}}
                """);
        JsonNode encoded = mapper.readTree(mapper.writeValueAsBytes(view(output))).path("outputs");
        assertEquals(output, encoded); // Complete structural fidelity, including nested arrays, nulls and numeric values.
        assertEquals(10.5, encoded.path("prediction").doubleValue());
        assertTrue(encoded.has("probability")); assertTrue(encoded.get("probability").isNull());
        JsonNode factor = encoded.path("explanation").path("top_factors").get(0);
        assertTrue(factor.has("contribution")); assertTrue(factor.get("contribution").isNull());
        assertTrue(encoded.path("explanation").path("top_factors").get(1).has("value"));
    }

    @Test void legacyTreesKeepTheGlobalNullOmissionPolicy() throws Exception {
        ObjectMapper mapper = springLikeMapper();
        ObjectNode legacy = mapper.createObjectNode(); legacy.put("existing", 7); legacy.putNull("optional");
        JsonNode encoded = mapper.readTree(mapper.writeValueAsBytes(legacy));
        assertEquals(7, encoded.path("existing").intValue()); assertFalse(encoded.has("optional"));
        assertFalse(mapper.getSerializationConfig().isEnabled(JsonNodeFeature.WRITE_NULL_PROPERTIES));
    }

    @Test void persistedJsonbMapRetainsNullsThroughAuthorizedSnapshotReadAndHttpSerialization() throws Exception {
        ObjectMapper mapper = springLikeMapper();
        UUID hospital = UUID.randomUUID(), patient = UUID.randomUUID(), user = UUID.randomUUID(), snapshot = UUID.randomUUID();
        var actor = new GovCarePrincipal(user, hospital, null, null, "test@govcare.test", "Clinician", "doctor",
                Set.of("PATIENT_VIEW_CLINICAL", "CONSULTATION_UPDATE"), true, false, 1);
        SqlSupport sql = mock(SqlSupport.class); ClinicalPatientAccess access = mock(ClinicalPatientAccess.class);
        SriLankanRenalMlClient ml = mock(SriLankanRenalMlClient.class);
        when(access.clinicalScope(actor, patient, true)).thenReturn(actor);
        when(sql.required(contains("pg_advisory_xact_lock"), anyMap(), anyString())).thenReturn(Map.of("held", true));
        // Match SqlSupport's actual JSONB normalization: nested Java Maps containing null entries.
        Map<?,?> savedOutputs = mapper.readValue("""
                {"status":"INSUFFICIENT_DATA","prediction":null,"probability":null,"interval":null,
                 "explanation":{"method":"BASELINE","top_factors":[{"feature":"hb","value":10.5,"contribution":null}]}}
                """, Map.class);
        assertFalse(mapper.valueToTree(savedOutputs).has("probability")); // Reproduces the producer-side omission.
        when(sql.one(anyString(), anyMap())).thenReturn(Optional.of(Map.of("id", snapshot, "model_key", "hb", "status", "INSUFFICIENT_DATA",
                "outputs", savedOutputs, "created_at", Instant.parse("2026-10-01T10:00:00Z"), "review_state", "AWAITING_REVIEW", "review_version", 0)));
        var service = new SriLankanRenalIntelligenceService(sql, new JsonSupport(mapper), mapper, access, ml,
                mock(LongitudinalClinicalFeatureService.class));
        var result = service.predict(actor, patient, new SriLankanRenalIntelligenceService.PredictRequest(UUID.randomUUID(), "hb"));
        for (String field : new String[]{"prediction", "probability", "interval"}) {
            assertTrue(result.outputs().has(field)); assertTrue(result.outputs().get(field).isNull());
        }
        JsonNode encoded = mapper.readTree(mapper.writeValueAsBytes(result)).path("outputs");
        for (String field : new String[]{"prediction", "probability", "interval"}) {
            assertTrue(encoded.has(field)); assertTrue(encoded.get(field).isNull());
        }
        var factor = encoded.path("explanation").path("top_factors").get(0);
        assertTrue(factor.has("contribution")); assertTrue(factor.get("contribution").isNull());
        assertEquals(10.5, factor.path("value").doubleValue());
        assertFalse(mapper.getSerializationConfig().isEnabled(JsonNodeFeature.WRITE_NULL_PROPERTIES));
        verifyNoInteractions(ml); verify(sql, never()).update(anyString(), anyMap());
    }
}
