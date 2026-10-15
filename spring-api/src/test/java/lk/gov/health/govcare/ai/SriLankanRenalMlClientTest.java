package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class SriLankanRenalMlClientTest {
    private static final String SECRET = "dedicated-renal-service-secret-for-tests-1234";
    private final ObjectMapper mapper = new ObjectMapper();
    private final UUID hospital = UUID.randomUUID(), patient = UUID.randomUUID(), user = UUID.randomUUID();
    private GovCarePrincipal actor(String role) {
        return new GovCarePrincipal(user, hospital, null, null, "test@govcare.test", "Clinician", role,
                Set.of("PATIENT_VIEW_CLINICAL", "CONSULTATION_UPDATE"), true, false, 1);
    }
    private ObjectNode available(String key) {
        var result = new SriLankanRenalMlClient(mapper, HttpClient.newHttpClient(), "http://127.0.0.1", SECRET, 2)
                .unavailable(key, "AVAILABLE", "TEST_RESPONSE", List.of());
        if ("hyperkalemia".equals(key)) {
            result.put("method", "RESEARCH_MODEL").put("algorithm", "LogisticRegression").put("risk_category", "RESEARCH_RISK_SCORE");
            result.putNull("prediction"); result.put("probability", .42); result.putNull("interval");
        } else {
            result.put("method", "PERSISTENCE_BASELINE").put("algorithm", "Persistence baseline").put("risk_category", "RESEARCH_FORECAST").put("prediction", key.equals("hb") ? 10.5 : 60.0);
            result.set("interval", mapper.valueToTree(Map.of("low", key.equals("hb") ? 9.0 : 55.0, "high", key.equals("hb") ? 12.0 : 70.0, "level", .95, "method", "EMPIRICAL_HOLDOUT_RESIDUAL")));
        }
        return result;
    }

    @Test void realHttpBoundarySerializesOnlyStoredHistoryAndDedicatedScopedJwt() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicReference<String> auth = new AtomicReference<>(), request = new AtomicReference<>();
        server.createContext("/api/ml/predict/hb/", exchange -> {
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            request.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = available("hb").toString().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json"); exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes); exchange.close();
        });
        server.start();
        try {
            var client = new SriLankanRenalMlClient(mapper, HttpClient.newHttpClient(), "http://127.0.0.1:" + server.getAddress().getPort(), SECRET, 2);
            var history = List.<Map<String,Object>>of(Map.of("observed_at", "2026-01-01T12:00:00Z",
                    "measurements", Map.of("hb", 10.5), "units", Map.of("hb", "g/dL")));
            var result = client.predict(actor("doctor"), patient, "hb", history);
            assertEquals("AVAILABLE", result.path("status").asText()); assertTrue(result.get("probability").isNull());
            var payload = mapper.readTree(request.get());
            assertEquals(2, payload.size()); assertTrue(payload.path("maintenance_hemodialysis_verified").asBoolean());
            assertEquals(10.5, payload.path("history").get(0).path("measurements").path("hb").doubleValue());
            assertFalse(request.get().contains(patient.toString())); assertFalse(request.get().contains(hospital.toString()));
            var token = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                    .requireIssuer("govcare-spring").requireAudience("govcare-renal-ml").build().parseSignedClaims(auth.get().substring(7));
            assertEquals("HS256", token.getHeader().getAlgorithm());
            var claims = token.getPayload(); assertEquals(user.toString(), claims.getSubject());
            assertEquals(hospital.toString(), claims.get("hospital_id")); assertEquals(patient.toString(), claims.get("patient_id"));
            assertEquals("doctor", claims.get("role")); assertEquals(List.of("renal:predict"), claims.get("scopes"));
            assertNotNull(claims.getId()); assertTrue(claims.getExpiration().toInstant().isAfter(Instant.now()));
            assertTrue(claims.getExpiration().toInstant().minusSeconds(60).isBefore(claims.getIssuedAt().toInstant()));
        } finally { server.stop(0); }
    }

    @Test void serviceAuthenticationFailuresBecomeAuditableUnavailableResult() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/ml/predict/urr/", exchange -> { exchange.sendResponseHeaders(403, -1); exchange.close(); });
        server.start();
        try {
            var client = new SriLankanRenalMlClient(mapper, HttpClient.newHttpClient(), "http://127.0.0.1:" + server.getAddress().getPort(), SECRET, 1);
            var result = client.predict(actor("doctor"), patient, "urr", List.of());
            assertEquals("NOT_AVAILABLE", result.path("status").asText());
            assertEquals("ML_SERVICE_AUTHENTICATION_FAILED", result.path("data_quality").path("flags").get(0).asText());
            assertTrue(result.path("prediction").isNull()); assertTrue(result.path("probability").isNull());
        } finally { server.stop(0); }
    }

    @Test void reviewedHyperkalemiaClassifierContractAcceptsProbabilityWithoutNumericForecast() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/ml/predict/hyperkalemia/", exchange -> {
            byte[] bytes = available("hyperkalemia").toString().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json"); exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes); exchange.close();
        }); server.start();
        try {
            var client = new SriLankanRenalMlClient(mapper, HttpClient.newHttpClient(), "http://127.0.0.1:" + server.getAddress().getPort(), SECRET, 1);
            var result = client.predict(actor("doctor"), patient, "hyperkalemia", List.of());
            assertEquals("AVAILABLE", result.path("status").asText()); assertTrue(result.path("prediction").isNull());
            assertEquals(.42, result.path("probability").doubleValue(), 1e-12); assertEquals("RESEARCH_RISK_SCORE", result.path("risk_category").asText());
        } finally { server.stop(0); }
    }

    @Test void classifierProbabilityCannotEnterRegressionSnapshot() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/ml/predict/hb/", exchange -> {
            var unsafe = available("hb"); unsafe.put("probability", .8);
            byte[] bytes = unsafe.toString().getBytes(StandardCharsets.UTF_8); exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes); exchange.close();
        }); server.start();
        try {
            var client = new SriLankanRenalMlClient(mapper, HttpClient.newHttpClient(), "http://127.0.0.1:" + server.getAddress().getPort(), SECRET, 1);
            var result = client.predict(actor("doctor"), patient, "hb", List.of());
            assertEquals("NOT_AVAILABLE", result.path("status").asText());
            assertEquals("ML_RESPONSE_CONTRACT_INVALID", result.path("data_quality").path("flags").get(0).asText());
        } finally { server.stop(0); }
    }

    @Test void secretMisconfigurationDoesNotUseEhrJwtOrMakeAnonymousRequest() {
        var client = new SriLankanRenalMlClient(mapper, HttpClient.newHttpClient(), "http://127.0.0.1:1", "short", 1);
        assertEquals("DEDICATED_SERVICE_SECRET_NOT_CONFIGURED", client.predict(actor("doctor"), patient, "hb", List.of())
                .path("data_quality").path("flags").get(0).asText());
    }
    @Test void unsafeEndpointAndRolesAreRejectedAtServiceBoundary() {
        var client = new SriLankanRenalMlClient(mapper, HttpClient.newHttpClient(), "http://user:pass@127.0.0.1", SECRET, 1);
        assertEquals("ML_SERVICE_URL_INVALID", client.predict(actor("doctor"), patient, "hb", List.of()).path("data_quality").path("flags").get(0).asText());
        for (String role : List.of("nurse", "patient", "hospital_admin"))
            assertThrows(ApiException.class, () -> client.predict(actor(role), patient, "hb", List.of()));
        assertThrows(ApiException.class, () -> client.predict(actor("doctor"), patient, null, List.of()));
    }
}
