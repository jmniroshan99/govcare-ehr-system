package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Server-to-server boundary. No browser token, patient identifiers or unverified feature payload is forwarded. */
@Component
public class SriLankanRenalMlClient {
    public static final String MODEL_VERSION = "1.0.0";
    public static final Set<String> MODEL_KEYS = Set.of("hb", "urr", "hyperkalemia", "dry-weight");
    private static final Set<String> CLINICAL_ROLES = Set.of("doctor", "surgeon", "anesthetist", "super_admin");
    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String baseUrl;
    private final String secret;
    private final Duration timeout;

    @Autowired
    public SriLankanRenalMlClient(ObjectMapper mapper,
            @Value("${govcare.renal-ml.base-url:http://127.0.0.1:8001}") String baseUrl,
            @Value("${govcare.renal-ml.jwt-secret:}") String secret,
            @Value("${govcare.renal-ml.timeout-seconds:15}") int timeoutSeconds) {
        this(mapper, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NEVER).build(), baseUrl, secret, timeoutSeconds);
    }

    SriLankanRenalMlClient(ObjectMapper mapper, HttpClient http, String baseUrl, String secret, int timeoutSeconds) {
        this.mapper = mapper; this.http = http; this.baseUrl = baseUrl; this.secret = secret;
        this.timeout = Duration.ofSeconds(Math.max(1, Math.min(timeoutSeconds, 30)));
    }

    public ObjectNode predict(GovCarePrincipal scoped, UUID patientId, String modelKey, List<Map<String,Object>> history) {
        if (modelKey == null || !MODEL_KEYS.contains(modelKey)) throw ApiException.badRequest("Unsupported Sri Lankan renal model.");
        if (scoped == null || !scoped.active() || scoped.mustChangePassword() || scoped.id() == null
                || scoped.hospitalId() == null || patientId == null || scoped.role() == null || !CLINICAL_ROLES.contains(scoped.role()))
            throw ApiException.forbidden("Authorized clinical service identity is required.");
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32)
            return unavailable(modelKey, "NOT_AVAILABLE", "DEDICATED_SERVICE_SECRET_NOT_CONFIGURED", List.of());
        try {
            URI base = URI.create(baseUrl == null ? "" : baseUrl);
            if (base.getScheme() == null || !Set.of("http", "https").contains(base.getScheme()) || base.getHost() == null
                    || base.getUserInfo() != null || base.getQuery() != null || base.getFragment() != null
                    || (base.getPath() != null && !Set.of("", "/").contains(base.getPath())))
                return unavailable(modelKey, "NOT_AVAILABLE", "ML_SERVICE_URL_INVALID", List.of());
            Instant now = Instant.now();
            String token = Jwts.builder().issuer("govcare-spring").subject(scoped.id().toString())
                    .audience().add("govcare-renal-ml").and()
                    .issuedAt(Date.from(now)).notBefore(Date.from(now.minusSeconds(1)))
                    .expiration(Date.from(now.plusSeconds(55))).id(UUID.randomUUID().toString())
                    .claim("role", scoped.role()).claim("hospital_id", scoped.hospitalId().toString())
                    .claim("patient_id", patientId.toString()).claim("scopes", List.of("renal:predict"))
                    .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
            String body = mapper.writeValueAsString(Map.of("history", history,
                    "maintenance_hemodialysis_verified", true));
            URI target = base.resolve("/api/ml/predict/" + modelKey + "/");
            HttpRequest request = HttpRequest.newBuilder(target).timeout(timeout)
                    .header("Content-Type", "application/json").header("Accept", "application/json")
                    .header("Authorization", "Bearer " + token).POST(HttpRequest.BodyPublishers.ofString(body)).build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 401 || response.statusCode() == 403)
                return unavailable(modelKey, "NOT_AVAILABLE", "ML_SERVICE_AUTHENTICATION_FAILED", List.of());
            if (response.statusCode() != 200 || response.body() == null || response.body().length() > 1_000_000)
                return unavailable(modelKey, "NOT_AVAILABLE", "ML_SERVICE_RESPONSE_UNAVAILABLE", List.of());
            JsonNode parsed = mapper.readTree(response.body());
            if (!validResponse(parsed, modelKey))
                return unavailable(modelKey, "NOT_AVAILABLE", "ML_RESPONSE_CONTRACT_INVALID", List.of());
            return (ObjectNode) parsed;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return unavailable(modelKey, "NOT_AVAILABLE", "ML_REQUEST_INTERRUPTED", List.of());
        } catch (java.net.http.HttpTimeoutException timeoutFailure) {
            return unavailable(modelKey, "NOT_AVAILABLE", "ML_SERVICE_TIMEOUT", List.of());
        } catch (Exception failure) {
            // Exception messages may include service configuration or payloads. Do not expose/log them.
            return unavailable(modelKey, "NOT_AVAILABLE", "ML_SERVICE_CONNECTION_OR_RESPONSE_FAILED", List.of());
        }
    }

    private static boolean validResponse(JsonNode response, String key) {
        if (response == null || !response.isObject() || !key.equals(response.path("model_key").asText())
                || !modelId(key).equals(response.path("model").asText())
                || !MODEL_VERSION.equals(response.path("model_version").asText())
                || !Set.of("AVAILABLE", "INSUFFICIENT_DATA", "NOT_AVAILABLE").contains(response.path("status").asText())
                || !Set.of("RESEARCH_MODEL", "PERSISTENCE_BASELINE").contains(response.path("method").asText())
                || !response.path("algorithm").isTextual() || !unit(key).equals(response.path("unit").asText())
                || !response.has("probability")
                || !"INTERNAL_RESEARCH_EVALUATION".equals(response.path("validation_status").asText())
                || !"NOT_COMPLETED".equals(response.path("clinical_validation").asText())
                || !"UNVERIFIED".equals(response.path("dataset_permission_status").asText())
                || !response.path("requires_clinician_review").asBoolean(false)
                || !response.path("data_quality").path("flags").isArray()
                || !response.path("data_quality").path("missing_fields").isArray()
                || !Set.of("SHAP", "BASELINE").contains(response.path("explanation").path("method").asText())
                || !response.path("explanation").path("top_factors").isArray()
                || !response.path("explanation").path("trends").isArray()
                || !response.path("explanation").path("limitations").isArray()) return false;
        boolean available = "AVAILABLE".equals(response.path("status").asText());
        JsonNode prediction = response.get("prediction"), probability = response.get("probability");
        boolean classifier = "hyperkalemia".equals(key);
        if (classifier) {
            if (available && (prediction == null || !prediction.isNull() || probability == null || !probability.isNumber()
                    || !Double.isFinite(probability.doubleValue()) || probability.doubleValue() < 0 || probability.doubleValue() > 1
                    || !"RESEARCH_RISK_SCORE".equals(response.path("risk_category").asText())
                    || !response.path("interval").isNull())) return false;
            if (!available && ((prediction != null && !prediction.isNull()) || (probability != null && !probability.isNull())
                    || !"UNAVAILABLE".equals(response.path("risk_category").asText()))) return false;
            return true;
        }
        if (probability == null || !probability.isNull()) return false;
        if (available && (prediction == null || !prediction.isNumber() || !Double.isFinite(prediction.doubleValue())
                || prediction.doubleValue() < (key.equals("hb") ? 1 : key.equals("dry-weight") ? 10 : 0)
                || prediction.doubleValue() > (key.equals("hb") ? 25 : key.equals("urr") ? 100 : 300)
                || !"RESEARCH_FORECAST".equals(response.path("risk_category").asText()))) return false;
        if (!available && ((prediction != null && !prediction.isNull()) || !"UNAVAILABLE".equals(response.path("risk_category").asText()))) return false;
        JsonNode interval = response.path("interval");
        if (!interval.isNull()) {
            if (!available || !interval.isObject() || !interval.path("low").isNumber() || !interval.path("high").isNumber()
                    || !Double.isFinite(interval.path("low").doubleValue()) || !Double.isFinite(interval.path("high").doubleValue())
                    || interval.path("low").doubleValue() > prediction.doubleValue()
                    || interval.path("high").doubleValue() < prediction.doubleValue()
                    || !interval.path("level").isNumber() || interval.path("level").doubleValue() <= 0
                    || interval.path("level").doubleValue() >= 1 || !interval.path("method").isTextual()) return false;
        }
        return true;
    }

    public ObjectNode unavailable(String key, String status, String flag, List<String> missing) {
        ObjectNode out = mapper.createObjectNode();
        out.put("status", status).put("model_key", key).put("model", modelId(key)).put("model_version", MODEL_VERSION)
                .put("method", "RESEARCH_MODEL").put("algorithm", "NOT_EXECUTED").put("unit", unit(key))
                .put("risk_category", "UNAVAILABLE").put("validation_status", "INTERNAL_RESEARCH_EVALUATION")
                .put("clinical_validation", "NOT_COMPLETED").put("dataset_permission_status", "UNVERIFIED")
                .put("requires_clinician_review", true);
        out.putNull("prediction"); out.putNull("probability"); out.putNull("interval");
        out.set("data_quality", mapper.valueToTree(Map.of("flags", List.of(flag), "missing_fields", missing)));
        out.set("explanation", mapper.valueToTree(Map.of("method", "BASELINE", "top_factors", List.of(),
                "trends", List.of(), "limitations", List.of(
                        "No prediction was calculated: " + flag,
                        "Research cohort preprocessing is not independently verified; dataset permission is UNVERIFIED.",
                        "The model is not clinically validated and requires clinician review."))));
        return out;
    }

    public static String modelId(String key) {
        return switch (key) { case "hb" -> "LK-RENAL-HB-1.0"; case "urr" -> "LK-RENAL-URR-1.0";
            case "hyperkalemia" -> "LK-RENAL-HYPERK-1.0"; case "dry-weight" -> "LK-RENAL-DRYWEIGHT-1.0"; default -> throw ApiException.badRequest("Unsupported renal model."); };
    }
    public static String unit(String key) { return switch (key) { case "hb" -> "g/dL"; case "urr" -> "%"; case "hyperkalemia" -> "probability"; case "dry-weight" -> "kg";
        default -> throw ApiException.badRequest("Unsupported renal model."); }; }
}
