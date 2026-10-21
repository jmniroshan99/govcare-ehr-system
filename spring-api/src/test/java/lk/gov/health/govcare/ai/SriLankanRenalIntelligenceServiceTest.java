package lk.gov.health.govcare.ai;

import ca.uhn.fhir.context.FhirContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.JsonSupport;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.ClinicalPatientAccess;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.hl7.fhir.r4.model.Observation;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SriLankanRenalIntelligenceServiceTest {
    private final UUID hospital = UUID.randomUUID(), patient = UUID.randomUUID(), user = UUID.randomUUID();
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private final SqlSupport sql = mock(SqlSupport.class);
    private final ClinicalPatientAccess access = mock(ClinicalPatientAccess.class);
    private final SriLankanRenalMlClient ml = mock(SriLankanRenalMlClient.class);
    private final LongitudinalClinicalFeatureService longitudinal = mock(LongitudinalClinicalFeatureService.class);
    private final GovCarePrincipal actor = new GovCarePrincipal(user, hospital, null, null, "test@govcare.test", "Doctor", "doctor",
            Set.of("PATIENT_VIEW_CLINICAL", "CONSULTATION_UPDATE"), true, false, 1);
    private SriLankanRenalIntelligenceService service() {
        return new SriLankanRenalIntelligenceService(sql, new JsonSupport(mapper), mapper, access, ml, longitudinal);
    }
    private void allow(boolean write) {
        when(access.clinicalScope(actor, patient, write)).thenReturn(actor);
        when(sql.required(contains("pg_advisory_xact_lock"), anyMap(), anyString())).thenReturn(Map.of("held", true));
    }
    private SriLankanRenalIntelligenceService.ObservationRequest observation(UUID request, boolean verified) {
        return new SriLankanRenalIntelligenceService.ObservationRequest(request, Instant.parse("2026-01-01T10:00:00Z"), true,
                Map.of("hb", 105.0, "urea_pre", 120.0, "urea_post", 30.0),
                Map.of("hb", "g/L", "urea_pre", "mg/dL", "urea_post", "mg/dL"), "Verified source laboratory report", verified, Map.of("sessionId","SYNTHETIC-HD-1","preCollectedAt","2026-01-01T06:00:00Z","postCollectedAt","2026-01-01T10:00:00Z"));
    }
    private Map<String,Object> snapshot(UUID id, String model) {
        var out = new SriLankanRenalMlClient(mapper, HttpClient.newHttpClient(), "http://127.0.0.1", "", 1)
                .unavailable(model, "NOT_AVAILABLE", "TEST", List.of());
        return new HashMap<>(Map.of("id", id, "model_key", model, "status", "NOT_AVAILABLE", "outputs", out,
                "created_at", Instant.parse("2026-01-01T11:00:00Z"), "review_state", "AWAITING_REVIEW", "review_version", 0));
    }

    @Test void deniedAuthorizationPrecedesClinicalQueriesAndMlInvocation() {
        when(access.clinicalScope(actor, patient, false)).thenThrow(ApiException.forbidden("Not assigned"));
        assertThrows(ApiException.class, () -> service().overview(actor, patient));
        when(access.clinicalScope(actor, patient, true)).thenThrow(ApiException.forbidden("Write denied"));
        assertThrows(ApiException.class, () -> service().recordObservation(actor, patient, observation(UUID.randomUUID(), true)));
        assertThrows(ApiException.class, () -> service().predict(actor, patient, new SriLankanRenalIntelligenceService.PredictRequest(UUID.randomUUID(), "hb")));
        assertThrows(ApiException.class, () -> service().review(actor, UUID.randomUUID(),
                new SriLankanRenalIntelligenceService.ReviewRequest(patient, UUID.randomUUID(), 0, "ACCEPT", "Reviewed", null, null)));
        verifyNoInteractions(sql, ml, longitudinal);
    }

    @Test void sourceVerificationAndUnitsAreBindingBeforePersistence() {
        allow(true);
        assertThrows(ApiException.class, () -> service().recordObservation(actor, patient, observation(UUID.randomUUID(), false)));
        assertThrows(ApiException.class, () -> SriLankanRenalIntelligenceService.validateMeasurements(Map.of("hb", 10.0), Map.of()));
        assertThrows(ApiException.class, () -> SriLankanRenalIntelligenceService.validateMeasurements(Map.of("hb", Double.NaN), Map.of("hb", "g/dL")));
        assertThrows(ApiException.class, () -> SriLankanRenalIntelligenceService.validateMeasurements(Map.of("urea_pre", 50.0), Map.of("urea_pre", "BUN mg/dL")));
        assertDoesNotThrow(() -> SriLankanRenalIntelligenceService.validateMeasurements(Map.of("urea_pre", 50.0, "urea_post", 12.0), Map.of("urea_pre", "mg/dL", "urea_post", "mmol/L"))); // Compatibility is normalized; pair ordering is checked by the authoritative calculator.
        assertThrows(ApiException.class, () -> SriLankanRenalIntelligenceService.validateMeasurements(Map.of("hb", 10.0), java.util.Collections.singletonMap("hb", null)));
        verifyNoInteractions(sql, ml);
    }

    @Test void physicalUnitConversionsHaveIndependentClinicalConstants() {
        assertEquals(10.5, SriLankanRenalIntelligenceService.convert("hb", 105, "g/L"), 1e-12);
        assertEquals(40, SriLankanRenalIntelligenceService.convert("albumin", 4, "g/dL"), 1e-12);
        assertEquals(884, SriLankanRenalIntelligenceService.convert("creatinine_pre", 10, "mg/dL"), 1e-12);
        assertEquals(10, SriLankanRenalIntelligenceService.convert("urea_pre", 60.06, "mg/dL"), 1e-12);
        // Whole urea 60.06 mg/dL is 10 mmol/L, not the BUN conversion.
        assertNotEquals(60.06 / 2.8, SriLankanRenalIntelligenceService.convert("urea_pre", 60.06, "mg/dL"));
    }

    @Test void verifiedMeasuredSessionWritesParseableObservationsAndSourceProvenance() {
        allow(true);
        when(sql.one(anyString(), anyMap())).thenReturn(Optional.empty());
        when(sql.required(contains("patient_no,full_name"), anyMap(), anyString())).thenReturn(Map.of("patient_no", "P-1", "full_name", "Patient"));
        List<Map<String,Object>> storedFhir = new ArrayList<>();
        when(sql.update(anyString(), anyMap())).thenAnswer(invocation -> {
            Map<String,Object> params = invocation.getArgument(1);
            if (invocation.getArgument(0, String.class).contains("insert into fhir_resource") && params.containsKey("type")) storedFhir.add(new HashMap<>(params));
            return 1;
        });
        var result = service().recordObservation(actor, patient, observation(UUID.randomUUID(), true));
        assertEquals(true, result.get("saved"));
        var measured = storedFhir.stream().filter(row -> "Observation".equals(row.get("type"))).toList();
        assertEquals(3, measured.size());
        for (var row : storedFhir) assertNotNull(FhirContext.forR4Cached().newJsonParser().parseResource(row.get("body").toString()));
        for (var row : measured) {
            Observation resource = (Observation) FhirContext.forR4Cached().newJsonParser().parseResource(row.get("body").toString());
            assertEquals(Observation.ObservationStatus.FINAL, resource.getStatus());
            assertEquals("Patient/patient-" + patient, resource.getSubject().getReference());
            assertEquals(user.toString(), resource.getPerformerFirstRep().getIdentifier().getValue());
            assertTrue(Set.of(Instant.parse("2026-01-01T06:00:00Z"),Instant.parse("2026-01-01T10:00:00Z")).contains(resource.getEffectiveDateTimeType().getValue().toInstant()));
            assertTrue(resource.getValue() instanceof org.hl7.fhir.r4.model.Quantity);
        }
        assertTrue(storedFhir.stream().anyMatch(row -> "Condition".equals(row.get("type"))));
        assertFalse(storedFhir.stream().anyMatch(row -> "Procedure".equals(row.get("type"))));
        assertTrue(storedFhir.stream().anyMatch(row -> "Provenance".equals(row.get("type"))));
        assertFalse(storedFhir.stream().anyMatch(row -> "RiskAssessment".equals(row.get("type"))));
    }

    @Test void predictionIdempotencyChecksRegisteredModelIdentityBeforeNewInference() {
        allow(true); UUID id = UUID.randomUUID();
        when(sql.one(anyString(), anyMap())).thenReturn(Optional.of(snapshot(id, "hb")));
        var request = new SriLankanRenalIntelligenceService.PredictRequest(UUID.randomUUID(), "hb");
        assertEquals(id, service().predict(actor, patient, request).id());
        assertThrows(ApiException.class, () -> service().predict(actor, patient, new SriLankanRenalIntelligenceService.PredictRequest(request.requestId(), "urr")));
        verify(sql, never()).update(anyString(), anyMap()); verifyNoInteractions(ml, longitudinal);
    }

    @Test void explicitMaintenanceContextDisplaysG5dAndValidUrrWithoutUsingMlForStage() {
        allow(false);
        Map<String,Object> row = Map.of("id", UUID.randomUUID(), "observed_at", Instant.parse("2026-01-01T10:00:00Z"),
                "maintenance_hemodialysis_verified", true, "measurements", Map.of("urea_pre", 120.0, "urea_post", 30.0),
                "units", Map.of("urea_pre", "mg/dL", "urea_post", "mg/dL"), "source_note", "Verified chronic dialysis","patient_id",patient,"sampling_context",Map.of("patientId",patient.toString(),"sessionId","SYNTH-1","sourceVerified",true,"preCollectedAt","2026-01-01T06:00:00Z","postCollectedAt","2026-01-01T10:00:00Z"));
        when(sql.list(contains("from sri_lankan_renal_observations"), anyMap())).thenReturn(List.of(row));
        when(sql.list(contains("from predictive_prediction_snapshots"), anyMap())).thenReturn(List.of());
        var overview = service().overview(actor, patient);
        assertEquals("G5D", overview.currentRenalStatus().stage());
        assertEquals(75, overview.observations().get(0).measurements().get("urr"), 1e-12);
        assertEquals("%", overview.observations().get(0).units().get("urr"));
        verifyNoInteractions(ml);
        verify(longitudinal).load(actor,patient,false); // optional eGFR/chronicity context; not the source of G5D

    }
    @Test void generalLabDoesNotRevokePreviouslyVerifiedClinicalDialysisContext(){
        allow(false);var contexts=mock(RenalDialysisContextService.class);
        when(contexts.latest(any(),eq(patient))).thenReturn(new RenalDialysisContextService.Context(UUID.randomUUID(),"MAINTENANCE_HD",Instant.parse("2026-01-01T00:00:00Z"),"Operational recorded maintenance dialysis"));
        when(sql.list(contains("from sri_lankan_renal_observations"),anyMap())).thenReturn(List.of(Map.of("id",UUID.randomUUID(),"observed_at",Instant.parse("2026-10-11T10:00:00Z"),"maintenance_hemodialysis_verified",false,"measurements",Map.of("hb",10.5),"units",Map.of("hb","g/dL"),"source_note","General lab; dialysis sampling context not verified")));
        when(sql.list(contains("from predictive_prediction_snapshots"),anyMap())).thenReturn(List.of());
        var svc=new SriLankanRenalIntelligenceService(sql,new JsonSupport(mapper),mapper,access,ml,longitudinal,contexts);
        var result=svc.overview(actor,patient);assertEquals("G5D",result.currentRenalStatus().stage());assertFalse(result.observations().getFirst().maintenanceHemodialysisVerified());verifyNoInteractions(ml);
    }

    @Test void reversedPairedUreaIsFlaggedAndNeverClampedIntoAdequacyChart() {
        allow(false);
        Map<String,Object> row = Map.of("id", UUID.randomUUID(), "observed_at", Instant.parse("2026-01-01T10:00:00Z"),
                "maintenance_hemodialysis_verified", true, "measurements", Map.of("urea_pre", 30.0, "urea_post", 120.0),
                "units", Map.of("urea_pre", "mg/dL", "urea_post", "mg/dL"), "source_note", "Verify anomalous source");
        when(sql.list(contains("from sri_lankan_renal_observations"), anyMap())).thenReturn(List.of(row));
        when(sql.list(contains("from predictive_prediction_snapshots"), anyMap())).thenReturn(List.of());
        var observation = service().overview(actor, patient).observations().get(0);
        assertFalse(observation.measurements().containsKey("urr"));
        assertEquals(List.of("PAIRED_UREA_SOURCE_OR_TIMING_UNVERIFIED"), observation.dataQualityFlags());
    }

    @Test void staleReviewVersionCannotAppendFeedbackOrChangePrediction() {
        allow(true); UUID prediction = UUID.randomUUID();
        Map<String,Object> snapshot = Map.of("id", prediction, "model_key", "hb", "model_version", "1.0.0", "status", "AVAILABLE", "outputs", Map.of("prediction", 10.5));
        when(sql.required(contains("for update"), anyMap(), anyString())).thenReturn(snapshot);
        when(sql.one(contains("select coalesce(max(review_version)"), anyMap())).thenReturn(Optional.of(Map.of("version", 2)));
        when(sql.one(contains("input_fingerprint,action"), anyMap())).thenReturn(Optional.empty());
        assertThrows(ApiException.class, () -> service().review(actor, prediction,
                new SriLankanRenalIntelligenceService.ReviewRequest(patient, UUID.randomUUID(), 1, "ACCEPT", "Reviewed", null, null)));
        verify(sql, never()).update(anyString(), anyMap());
    }

    @Test void reviewAppendsFeedbackAndParseableClinicalImpressionWithoutMutatingSnapshot() {
        allow(true); UUID prediction = UUID.randomUUID();
        when(sql.required(contains("for update"), anyMap(), anyString())).thenReturn(Map.of("id", prediction, "model_key", "hb", "model_version", "1.0.0", "status", "AVAILABLE", "outputs", Map.of("prediction", 10.5)));
        when(sql.one(contains("select coalesce(max(review_version)"), anyMap())).thenReturn(Optional.of(Map.of("version", 0)));
        when(sql.one(contains("resource_type='Patient'"), anyMap())).thenReturn(Optional.of(Map.of("resource_id", "patient-" + patient)));
        List<String> statements = new ArrayList<>(); List<Map<String,Object>> resources = new ArrayList<>();
        when(sql.update(anyString(), anyMap())).thenAnswer(invocation -> {
            statements.add(invocation.getArgument(0)); Map<String,Object> params = invocation.getArgument(1);
            if (params.containsKey("type")) resources.add(new HashMap<>(params)); return 1;
        });
        var saved = service().review(actor, prediction, new SriLankanRenalIntelligenceService.ReviewRequest(patient, UUID.randomUUID(), 0,
                "MODIFY", "Reviewed against recent dialysis treatment", "Source reconciled", "Repeat Hb and review clinical context"));
        assertEquals(1, saved.get("reviewVersion")); assertEquals("MODIFY", saved.get("reviewState"));
        assertTrue(statements.stream().allMatch(statement -> statement.startsWith("insert into")));
        assertTrue(resources.stream().anyMatch(row -> "ClinicalImpression".equals(row.get("type"))));
        assertTrue(resources.stream().anyMatch(row -> "Provenance".equals(row.get("type"))));
        for (var resource : resources) assertNotNull(FhirContext.forR4Cached().newJsonParser().parseResource(resource.get("body").toString()));
        assertFalse(resources.stream().anyMatch(row -> "Observation".equals(row.get("type"))));
    }

    @Test void inferenceUsesOnlyStoredNormalizedHistoryAndPersistsContinuousForecastAsClinicalImpression() throws Exception {
        allow(true);allow(false);
        UUID model = UUID.randomUUID();
        when(sql.required(contains("from predictive_model_registry"), anyMap(), anyString()))
                .thenReturn(Map.of("id", model, "model_key", "hb", "version", "1.0.0", "runtime_status", "ACTIVE"));
        var rows = List.<Map<String,Object>>of(
                Map.of("id", UUID.randomUUID(), "observed_at", Instant.now().minusSeconds(864000), "maintenance_hemodialysis_verified", true,
                        "measurements", Map.of("hb", 105.0, "albumin", 4.0), "units", Map.of("hb", "g/L", "albumin", "g/dL"), "source_note", "Verified latest"),
                Map.of("id", UUID.randomUUID(), "observed_at", Instant.now().minusSeconds(1728000), "maintenance_hemodialysis_verified", true,
                        "measurements", Map.of("hb", 100.0), "units", Map.of("hb", "g/L"), "source_note", "Verified prior"));
        when(sql.list(contains("from sri_lankan_renal_observations"), anyMap())).thenReturn(rows);
        AtomicReference<Map<String,Object>> saved = new AtomicReference<>();
        when(sql.one(anyString(), anyMap())).thenAnswer(invocation -> {
            String statement = invocation.getArgument(0);
            if (statement.contains("from predictive_prediction_snapshots s")) return Optional.ofNullable(saved.get());
            if (statement.contains("resource_type='Patient'")) return Optional.of(Map.of("resource_id", "patient-" + patient));
            return Optional.empty();
        });
        var out = mapper.createObjectNode();
        out.put("status", "AVAILABLE").put("model", "LK-RENAL-HB-1.0").put("model_key", "hb").put("model_version", "1.0.0")
                .put("method", "PERSISTENCE_BASELINE").put("prediction", 10.5).put("unit", "g/dL")
                .put("validation_status", "INTERNAL_RESEARCH_EVALUATION").put("clinical_validation", "NOT_COMPLETED").put("dataset_permission_status", "UNVERIFIED");
        out.putNull("probability"); out.putNull("interval"); out.set("data_quality", mapper.valueToTree(Map.of("flags", List.of(), "missing_fields", List.of())));
        out.set("explanation", mapper.valueToTree(Map.of("method", "BASELINE", "top_factors", List.of(), "trends", List.of(), "limitations", List.of("Research only"))));
        when(ml.predict(eq(actor), eq(patient), eq("hb"), anyList())).thenAnswer(invocation -> {
            List<Map<String,Object>> history = invocation.getArgument(3);
            assertEquals(2, history.size());
            assertTrue(Instant.parse(history.get(0).get("observed_at").toString()).isBefore(Instant.parse(history.get(1).get("observed_at").toString())));
            assertEquals(Map.of("hb", 10.0), history.get(0).get("measurements"));
            assertEquals(Map.of("hb", 10.5, "albumin", 40.0), history.get(1).get("measurements"));
            assertEquals(Map.of("hb", "g/dL", "albumin", "g/L"), history.get(1).get("units"));
            assertFalse(history.toString().contains("source_note")); assertFalse(history.toString().contains(user.toString()));
            return out;
        });
        List<Map<String,Object>> resources = new ArrayList<>();
        when(sql.update(anyString(), anyMap())).thenAnswer(invocation -> {
            String statement = invocation.getArgument(0); Map<String,Object> params = invocation.getArgument(1);
            assertEquals(hospital, params.get("h")); assertEquals(patient, params.get("p"));
            if (statement.contains("insert into predictive_prediction_snapshots")) saved.set(Map.of("id", params.get("id"), "model_key", "hb", "status", "AVAILABLE",
                    "outputs", mapper.readTree(params.get("outputs").toString()), "created_at", Instant.now(), "review_state", "AWAITING_REVIEW", "review_version", 0));
            if (params.containsKey("type")) resources.add(new HashMap<>(params)); return 1;
        });
        var prediction = service().predict(actor, patient, new SriLankanRenalIntelligenceService.PredictRequest(UUID.randomUUID(), "hb"));
        assertEquals(10.5, prediction.outputs().path("prediction").doubleValue());
        assertTrue(resources.stream().anyMatch(row -> "ClinicalImpression".equals(row.get("type"))));
        assertTrue(resources.stream().anyMatch(row -> "Provenance".equals(row.get("type"))));
        assertFalse(resources.stream().anyMatch(row -> "Observation".equals(row.get("type"))));
        for (var resource : resources) {
            assertNotNull(FhirContext.forR4Cached().newJsonParser().parseResource(resource.get("body").toString()));
            if ("ClinicalImpression".equals(resource.get("type"))) {
                var fhir = mapper.readTree(resource.get("body").toString());
                assertFalse(fhir.toString().contains("probabilityDecimal"));
                assertFalse(fhir.toString().contains("probabilityRange"));
                assertTrue(fhir.path("extension").toString().contains("renal-predicted-value"));
            }
        }
    }
}
