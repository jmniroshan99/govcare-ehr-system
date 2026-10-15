package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DiseaseProbabilitySnapshotSerializationTest {
    @Test
    void unavailableProbabilitiesRemainExplicitlyNullWithGlobalNonNullMapper() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);

        var snapshot = DiseaseProbabilitySnapshot.capture(
                0.73,
                "GOVCARE-CKD-LOGISTIC-1.0",
                Instant.parse("2026-10-07T00:00:00Z"),
                List.of()
        );

        JsonNode root = mapper.readTree(mapper.writeValueAsString(snapshot));
        assertEquals(7, root.path("entries").size());
        JsonNode progression = root.path("entries").get(1);
        assertEquals("NOT_AVAILABLE", progression.path("status").asText());
        assertTrue(progression.has("probability"), "Unavailable probability must be represented in the snapshot shape");
        assertTrue(progression.get("probability").isNull());

        JsonNode currentCkd = root.path("entries").get(0);
        assertEquals("AVAILABLE", currentCkd.path("status").asText());
        assertEquals(0.73, currentCkd.path("probability").asDouble(), 0.000001);
    }
}
