package lk.gov.health.govcare.ai;

import ca.uhn.fhir.context.FhirContext;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.cfg.JsonNodeFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.JsonSupport;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.ClinicalPatientAccess;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.hl7.fhir.r4.model.ClinicalImpression;
import org.hl7.fhir.r4.model.Identifier;
import org.hl7.fhir.r4.model.Patient;
import org.hl7.fhir.r4.model.Provenance;
import org.hl7.fhir.r4.model.Reference;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.Objects;

/** Verified renal histories and immutable research outputs. Every patient boundary uses stored tenant scope. */
@Service
public class SriLankanRenalIntelligenceService {
    private static final int MAX_HISTORY = 200;
    private static final FhirContext FHIR = FhirContext.forR4Cached();
    private static final Map<String,String> CANONICAL_UNITS = Map.ofEntries(
            Map.entry("hb", "g/dL"), Map.entry("albumin", "g/L"), Map.entry("calcium", "mmol/L"),
            Map.entry("sodium", "mmol/L"), Map.entry("potassium_pre", "mmol/L"), Map.entry("potassium_post", "mmol/L"),
            Map.entry("creatinine_pre", "umol/L"), Map.entry("creatinine_post", "umol/L"),
            Map.entry("urea_pre", "mmol/L"), Map.entry("urea_post", "mmol/L"), Map.entry("dry_weight", "kg"));
    private final SqlSupport sql;
    private final JsonSupport json;
    private final ObjectMapper mapper;
    private final ObjectMapper renalOutputMapper;
    private final ClinicalPatientAccess access;
    private final SriLankanRenalMlClient ml;
    private final LongitudinalClinicalFeatureService longitudinal;
    private final RenalDialysisContextService dialysisContext;
    private final ClinicalPredictionFeatureService clinicalFeatures;

    public SriLankanRenalIntelligenceService(SqlSupport sql, JsonSupport json, ObjectMapper mapper,
            ClinicalPatientAccess access, SriLankanRenalMlClient ml, LongitudinalClinicalFeatureService longitudinal) {
        this(sql,json,mapper,access,ml,longitudinal,new RenalDialysisContextService(sql,access,mapper));
    }
    public SriLankanRenalIntelligenceService(SqlSupport sql, JsonSupport json, ObjectMapper mapper,
            ClinicalPatientAccess access, SriLankanRenalMlClient ml, LongitudinalClinicalFeatureService longitudinal,RenalDialysisContextService dialysisContext) {
        this(sql,json,mapper,access,ml,longitudinal,dialysisContext,new ClinicalPredictionFeatureService(sql,access,mapper));
    }
    @org.springframework.beans.factory.annotation.Autowired
    public SriLankanRenalIntelligenceService(SqlSupport sql, JsonSupport json, ObjectMapper mapper,
            ClinicalPatientAccess access, SriLankanRenalMlClient ml, LongitudinalClinicalFeatureService longitudinal,RenalDialysisContextService dialysisContext,ClinicalPredictionFeatureService clinicalFeatures) {
        this.clinicalFeatures=clinicalFeatures;
        this.dialysisContext=dialysisContext;
        this.sql = sql; this.json = json; this.mapper = mapper; this.access = access; this.ml = ml;
        this.longitudinal = longitudinal;
        // JSONB is normalized into Maps by SqlSupport. Global NON_NULL would erase contractual
        // null map entries during valueToTree, before the response serializer can preserve them.
        this.renalOutputMapper = mapper.copy().setSerializationInclusion(JsonInclude.Include.ALWAYS)
                .configure(JsonNodeFeature.WRITE_NULL_PROPERTIES, true);
    }

    public record ObservationRequest(UUID requestId, Instant observedAt, boolean maintenanceHemodialysisVerified,
            Map<String,Double> measurements, Map<String,String> units, String sourceNote, boolean sourceVerified, Map<String,String> samplingContext) {
        public ObservationRequest(UUID requestId,Instant observedAt,boolean verified,Map<String,Double> measurements,Map<String,String> units,String note,boolean sourceVerified){this(requestId,observedAt,verified,measurements,units,note,sourceVerified,Map.of());}
    }
    public record PredictRequest(UUID requestId, String modelKey) {}
    public record ReviewRequest(UUID patientId, UUID requestId, int expectedVersion, String action,
            String reason, String note, String modifiedInterpretation) {}
    public record RenalStatus(String stage, String label, String basis, Double latestEgfr, Instant egfrAt, String chronicity,
            String dialysisStatus,Instant dialysisVerifiedAt,String dialysisEvidence,UUID dialysisEvidenceId) {
        public RenalStatus(String stage,String label,String basis){this(stage,label,basis,null,null,null);}
        public RenalStatus(String stage,String label,String basis,Double latestEgfr,Instant egfrAt,String chronicity){this(stage,label,basis,latestEgfr,egfrAt,chronicity,null,null,null,null);}
    }
    public record ObservationView(UUID id, @JsonProperty("observed_at") Instant observedAt,
            @JsonProperty("maintenance_hemodialysis_verified") boolean maintenanceHemodialysisVerified,
            Map<String,Double> measurements, Map<String,String> units,
            @JsonProperty("source_note") String sourceNote, @JsonProperty("data_quality_flags") List<String> dataQualityFlags, @JsonProperty("sampling_context") Map<String,Object> samplingContext) {
        public ObservationView(UUID id,Instant at,boolean hd,Map<String,Double> measurements,Map<String,String> units,String note,List<String> flags){this(id,at,hd,measurements,units,note,flags,Map.of());}
    }
    public record PredictionView(UUID id, @JsonProperty("model_key") String modelKey, String status,
            @JsonSerialize(using = RenalPredictionJsonSerializer.class) JsonNode outputs,
            @JsonProperty("created_at") Instant createdAt, @JsonProperty("review_state") String reviewState,
            @JsonProperty("review_version") int reviewVersion, String reason, String note,
            @JsonProperty("modified_interpretation") String modifiedInterpretation,
            @JsonProperty("reviewed_by") String reviewedBy, @JsonProperty("reviewed_at") Instant reviewedAt) {
        public PredictionView(UUID id, String modelKey, String status, JsonNode outputs, Instant createdAt,
                String reviewState, int reviewVersion) {
            this(id, modelKey, status, outputs, createdAt, reviewState, reviewVersion, null, null, null, null, null);
        }
    }
    public record CompositeComponent(String metric, String label, String adverseDirection, String trendDirection,
            Double current, Double previous, String unit, boolean evaluable, boolean worsening) {}
    public record RenalDeteriorationComposite(String status, Integer scorePercent, int evaluatedComponents,
            int worseningComponents, String method, String validationStatus, List<String> limitations,
            List<CompositeComponent> components) {}
    public record Overview(UUID patientId, UUID hospitalId, RenalStatus currentRenalStatus,
            List<ObservationView> observations, List<PredictionView> predictions,
            RenalDeteriorationComposite deteriorationComposite, boolean canReview, boolean historyTruncated) {}
    private record Normalized(Map<String,Double> measurements, Map<String,String> units) {}

    @Transactional
    public Overview overview(GovCarePrincipal actor, UUID patient) {
        GovCarePrincipal scoped = access.clinicalScope(actor, patient, false);
        List<Map<String,Object>> stored = observationRows(scoped, patient);
        boolean truncated = stored.size() > MAX_HISTORY;
        List<ObservationView> observations = stored.stream().limit(MAX_HISTORY).map(this::observationView)
                .sorted(java.util.Comparator.comparing(ObservationView::observedAt)).toList();
        List<PredictionView> predictions = predictionRows(scoped, patient, false);
        RenalStatus status = currentStatus(actor, patient, observations);
        audit(scoped, patient, "RENAL_INTELLIGENCE_VIEWED", null, Map.of("source", "VERIFIED_RENAL_HISTORY", "historyTruncated", truncated));
        return new Overview(patient, scoped.hospitalId(), status, observations, predictions,
                deteriorationComposite(observations), canWrite(actor), truncated);
    }

    /** PDF/report reads persisted outputs and verified observations only; it never triggers inference. */
    @Transactional
    public Overview reportOverview(GovCarePrincipal actor, UUID patient) {
        GovCarePrincipal scoped = access.clinicalScope(actor, patient, false);
        List<Map<String,Object>> stored = observationRows(scoped, patient);
        boolean truncated = stored.size() > MAX_HISTORY;
        List<ObservationView> observations = stored.stream().limit(MAX_HISTORY).map(this::observationView)
                .sorted(java.util.Comparator.comparing(ObservationView::observedAt)).toList();
        List<PredictionView> predictions = predictionRows(scoped, patient, true);
        RenalStatus status = currentStatus(actor, patient, observations);
        RenalDeteriorationComposite composite = deteriorationComposite(observations);
        audit(scoped, patient, "RENAL_REPORT_OVERVIEW_VIEWED", null,
                Map.of("source", "STORED_RENAL_OBSERVATIONS_AND_PREDICTIONS", "historyTruncated", truncated,
                        "snapshotIds", predictions.stream().map(p -> p.id().toString()).toList()));
        return new Overview(patient, scoped.hospitalId(), status, observations, predictions, composite, canWrite(actor), truncated);
    }

    /** PDF reads persisted outputs only; exporting does not trigger inference or create new numeric laboratory results. */
    @Transactional
    public List<PredictionView> reportPredictions(GovCarePrincipal actor, UUID patient) {
        GovCarePrincipal scoped = access.clinicalScope(actor, patient, false);
        List<PredictionView> predictions = predictionRows(scoped, patient, true);
        audit(scoped, patient, "RENAL_REPORT_PREDICTIONS_VIEWED", null,
                Map.of("source", "STORED_RENAL_PREDICTION_SNAPSHOTS", "snapshotIds", predictions.stream().map(p -> p.id().toString()).toList()));
        return predictions;
    }

    @Transactional
    public Map<String,Object> recordObservation(GovCarePrincipal actor, UUID patient, ObservationRequest request) {
        GovCarePrincipal scoped = access.clinicalScope(actor, patient, true);
        if (request == null || request.requestId() == null || request.observedAt() == null || !request.sourceVerified())
            throw ApiException.badRequest("A request UUID, source verification and actual observation date are required.");
        if (request.observedAt().isAfter(Instant.now()) || request.observedAt().isBefore(Instant.parse("1900-01-01T00:00:00Z")))
            throw ApiException.badRequest("The observation date must be a valid past clinical date.");
        String note = requiredText(request.sourceNote(), 2000, "Document the verified source in 1–2000 characters.");
        validateMeasurements(request.measurements(), request.units());
        var sampling=renalOutputMapper.valueToTree(request.samplingContext()==null?Map.of():request.samplingContext());
        ObjectNode samplingObject=(ObjectNode)sampling;
        if(samplingObject.hasNonNull("patientId")&&!patient.toString().equals(samplingObject.path("patientId").asText()))throw ApiException.badRequest("Sampling patient does not match the authorized patient.");
        samplingObject.put("patientId",patient.toString()).put("sourceVerified",true);
        if(request.measurements().containsKey("urea_pre")||request.measurements().containsKey("urea_post")){
            var pair=renalOutputMapper.createObjectNode();pair.set("measurements",renalOutputMapper.valueToTree(request.measurements()));pair.set("units",renalOutputMapper.valueToTree(request.units()));pair.set("sampling_context",samplingObject);pair.put("source_note",note);
            var calculated=UreaReductionRatio.evaluate(patient.toString(),pair);if(!calculated.path("value").isNumber())throw ApiException.badRequest("URR source verification: "+calculated.path("reasons").toString());
        }
        Map<String,Object> payload = new LinkedHashMap<>();
        payload.put("observedAt", request.observedAt().toString());
        payload.put("maintenanceHemodialysisVerified", request.maintenanceHemodialysisVerified());
        payload.put("measurements", new TreeMap<>(request.measurements())); payload.put("units", new TreeMap<>(request.units()));
        payload.put("sourceNote", note); payload.put("sourceVerified", true);payload.put("samplingContext",samplingObject);
        String fingerprint = fingerprint(json.write(payload));
        Map<String,Object> params = params(scoped, patient);
        params.put("request", request.requestId()); params.put("fingerprint", fingerprint);
        requestLock(params, "observation");
        Optional<Map<String,Object>> prior = sql.one("""
                select id,input_fingerprint from sri_lankan_renal_observations
                where hospital_id=:h and patient_id=:p and actor_id=:actor and request_id=:request
                """, params);
        if (prior.isPresent()) {
            if (!fingerprint.equals(prior.get().get("input_fingerprint")))
                throw ApiException.conflict("This request UUID was already used for a different renal observation.");
            return Map.of("id", prior.get().get("id"), "saved", true);
        }
        // A patient-level date lock prevents concurrent transcription of the same measured session.
        dateLock(scoped, patient, request.observedAt());
        params.put("time", Timestamp.from(request.observedAt()));
        if (sql.one("select id from sri_lankan_renal_observations where hospital_id=:h and patient_id=:p and observed_at=:time", params).isPresent())
            throw ApiException.conflict("A verified renal observation is already recorded for this patient and date/time.");
        UUID id = UUID.randomUUID(); params.put("id", id); params.put("dialysis", request.maintenanceHemodialysisVerified());
        params.put("values", json.write(new TreeMap<>(request.measurements()))); params.put("units", json.write(new TreeMap<>(request.units())));
        params.put("note", note); params.put("department", scoped.departmentId());params.put("sampling",samplingObject.toString());
        sql.update("""
                insert into sri_lankan_renal_observations(id,hospital_id,patient_id,observed_at,maintenance_hemodialysis_verified,
                  measurements,units,source_note,source_verified,actor_id,department_id,request_id,input_fingerprint,sampling_context)
                values(:id,:h,:p,:time,:dialysis,cast(:values as jsonb),cast(:units as jsonb),:note,true,:actor,:department,:request,:fingerprint,cast(:sampling as jsonb))
                """, params);
        List<String> resources = persistMeasuredFhir(scoped, patient, id, request, note);
        audit(scoped, patient, "VERIFIED_RENAL_OBSERVATION_RECORDED", id,
                Map.of("sourceVerified", true, "inputFingerprint", fingerprint, "fhirResources", resources,
                        "maintenanceHemodialysisVerified", request.maintenanceHemodialysisVerified()));
        return Map.of("id", id, "saved", true);
    }

    @Transactional
    public PredictionView predict(GovCarePrincipal actor, UUID patient, PredictRequest request) {
        GovCarePrincipal scoped = access.clinicalScope(actor, patient, true);
        if (request == null || request.requestId() == null || request.modelKey() == null || !SriLankanRenalMlClient.MODEL_KEYS.contains(request.modelKey()))
            throw ApiException.badRequest("A request UUID and a supported renal model key are required.");
        Map<String,Object> params = params(scoped, patient); params.put("request", request.requestId()); params.put("key", request.modelKey());
        requestLock(params, "prediction");
        Optional<Map<String,Object>> existing = findRequestedPrediction(params);
        if (existing.isPresent()) return sameRequestPrediction(existing.get(), request.modelKey());
        long started = System.nanoTime();
        Map<String,Object> registry = sql.required("""
                select id,model_key,version,runtime_status from predictive_model_registry where model_key=:key and version=:version
                """, Map.of("key", request.modelKey(), "version", SriLankanRenalMlClient.MODEL_VERSION), "Renal research model is not registered.");
        List<Map<String,Object>> rows = observationRows(scoped, patient);
        boolean truncated = rows.size() > MAX_HISTORY;
        List<Map<String,Object>> history = new ArrayList<>();
        for (Map<String,Object> row : rows.stream().limit(MAX_HISTORY).sorted(java.util.Comparator.comparing(r -> instant(r.get("observed_at")))).toList()) {
            if (!Boolean.TRUE.equals(row.get("maintenance_hemodialysis_verified"))) continue;
            ObservationView observation = observationView(row);
            if("urr".equals(request.modelKey())&&!observation.measurements().containsKey("urr"))continue;
            Normalized normalized = normalizeMeasurements(observation.measurements(), observation.units());
            history.add(Map.of("observed_at", observation.observedAt().toString(),
                    "measurements", normalized.measurements(), "units", normalized.units()));
        }
        var clinicalContext=dialysisContext.latest(scoped,patient);
        boolean eventCurrent=clinicalContext!=null&&(rows.isEmpty()||!Boolean.TRUE.equals(rows.get(0).get("maintenance_hemodialysis_verified"))||!clinicalContext.verifiedAt().isBefore(instant(rows.get(0).get("observed_at"))));
        boolean maintenanceCurrent = eventCurrent?"MAINTENANCE_HD".equals(clinicalContext.status()):!rows.isEmpty() && Boolean.TRUE.equals(rows.get(0).get("maintenance_hemodialysis_verified"));
        var unifiedSafety=ClinicalFeatureMappingEngine.forecastSafety(clinicalFeatures.load(actor,patient),rows.stream().limit(MAX_HISTORY).map(this::observationView).toList(),Instant.now());
        ObjectNode result;
        if (!"ACTIVE".equals(registry.get("runtime_status")))
            result = ml.unavailable(request.modelKey(), request.modelKey().equals("dry-weight") ? "INSUFFICIENT_DATA" : "NOT_AVAILABLE",
                    request.modelKey().equals("dry-weight") ? "COHORT_MODEL_NOT_INSTALLED_INSUFFICIENT_TRAINING_DATA" : "RESEARCH_MODEL_RUNTIME_INACTIVE", List.of());
        else if (truncated) result = ml.unavailable(request.modelKey(), "INSUFFICIENT_DATA", "VERIFIED_HISTORY_EXCEEDS_RETRIEVAL_LIMIT", List.of());
        else if (!maintenanceCurrent) result = ml.unavailable(request.modelKey(), "INSUFFICIENT_DATA", "MAINTENANCE_HEMODIALYSIS_NOT_CURRENTLY_VERIFIED", List.of("maintenance_hemodialysis_verified"));
        else if(!rows.isEmpty()&&!Boolean.TRUE.equals(rows.get(0).get("maintenance_hemodialysis_verified")))result=ml.unavailable(request.modelKey(),"INSUFFICIENT_DATA","LATEST_DIALYSIS_SOURCE_LABS_NOT_VERIFIED",List.of("latest_verified_hd_source"));
        else if (history.size() < 2) result = ml.unavailable(request.modelKey(), "INSUFFICIENT_DATA", "AT_LEAST_TWO_VERIFIED_DATED_OBSERVATIONS_REQUIRED", List.of("dated_history"));
        else if ("hyperkalemia".equals(request.modelKey()) && !history.isEmpty()
                && ((Map<?,?>)history.get(history.size()-1).get("measurements")).get("potassium_pre") instanceof Number potassium
                && potassium.doubleValue() >= 8)
            result = ml.unavailable(request.modelKey(), "INSUFFICIENT_DATA", "EXTREME_CURRENT_POTASSIUM_REQUIRES_CLINICAL_REVIEW", List.of());
        else if(!unifiedSafety.isEmpty())result=ml.unavailable(request.modelKey(),"INSUFFICIENT_DATA","UNIFIED_CLINICAL_FEATURE_SOURCE_REVIEW_REQUIRED",unifiedSafety);
        else result = ml.predict(scoped, patient, request.modelKey(), history);
        if(!result.has("forecast_origin_date")&&!history.isEmpty())result.put("forecast_origin_date",history.getLast().get("observed_at").toString());
        UUID id = UUID.randomUUID();
        params.put("id", id); params.put("model", registry.get("id")); params.put("status", result.path("status").asText());
        params.put("inputs", json.write(Map.of("source_type", "SERVER_STORED_VERIFIED_RENAL_HISTORY", "history", history,
                "observation_ids", rows.stream().limit(MAX_HISTORY).map(r -> r.get("id").toString()).toList(),
                "maintenance_hemodialysis_verified", maintenanceCurrent, "history_truncated", truncated)));
        params.put("quality", result.path("data_quality").toString());
        params.put("safety", json.write(Map.of("maintenanceHemodialysisVerified", maintenanceCurrent, "requiresClinicianReview", true,"unifiedClinicalFeatureReasons",unifiedSafety)));
        params.put("outputs", result.toString()); params.put("explanation", json.write(result.path("explanation")));
        params.put("method", result.path("method").asText()); params.put("version", SriLankanRenalMlClient.MODEL_VERSION);
        params.put("validation", "INTERNAL_RESEARCH_EVALUATION"); params.put("local", "NOT_CLINICALLY_VALIDATED");
        params.put("elapsed", Math.max(0, (System.nanoTime() - started) / 1_000_000));
        int inserted = sql.update("""
                insert into predictive_prediction_snapshots(id,hospital_id,patient_id,requested_by,request_id,horizon_months,
                  model_id,model_key,status,input_snapshot,quality_snapshot,safety_snapshot,outputs,explanation,
                  method_type,model_version,validation_status,local_validation_status,elapsed_ms)
                values(:id,:h,:p,:actor,:request,1,:model,:key,:status,cast(:inputs as jsonb),cast(:quality as jsonb),
                  cast(:safety as jsonb),cast(:outputs as jsonb),:explanation,:method,:version,:validation,:local,:elapsed)
                on conflict(hospital_id,patient_id,requested_by,request_id) do nothing
                """, params);
        if (inserted == 1) {
            List<String> resources = persistPredictionFhir(scoped, patient, id, result, rows);
            audit(scoped, patient, "RENAL_RESEARCH_PREDICTION_GENERATED", id,
                    Map.of("modelKey", request.modelKey(), "modelVersion", SriLankanRenalMlClient.MODEL_VERSION,
                            "status", result.path("status").asText(), "method", result.path("method").asText(),
                            "datasetPermissionStatus", "UNVERIFIED", "clinicalValidation", "NOT_COMPLETED", "fhirResources", resources));
        }
        return sameRequestPrediction(findRequestedPrediction(params).orElseThrow(() -> ApiException.conflict("Renal prediction could not be recorded.")), request.modelKey());
    }

    @Transactional
    public Map<String,Object> review(GovCarePrincipal actor, UUID prediction, ReviewRequest request) {
        if (request == null || request.patientId() == null) throw ApiException.badRequest("The stored patient's UUID is required.");
        GovCarePrincipal scoped = access.clinicalScope(actor, request.patientId(), true);
        if (request.requestId() == null || request.expectedVersion() < 0 || request.action() == null
                || !Set.of("ACCEPT", "MODIFY", "DEFER", "DISMISS").contains(request.action()))
            throw ApiException.badRequest("A request UUID, expected review version and supported review action are required.");
        String reason = requiredText(request.reason(), 2000, "A clinical review reason in 1–2000 characters is required.");
        String note = optionalText(request.note(), 4000, "The review note exceeds 4000 characters.");
        String modified = optionalText(request.modifiedInterpretation(), 4000, "The modified interpretation exceeds 4000 characters.");
        if ("MODIFY".equals(request.action()) && modified == null)
            throw ApiException.badRequest("MODIFY requires the clinician's revised interpretation.");
        if (!"MODIFY".equals(request.action()) && modified != null)
            throw ApiException.badRequest("A modified interpretation is only valid for MODIFY.");
        String fp = fingerprint(json.write(List.of(prediction.toString(), request.action(), reason,
                note == null ? "" : note, modified == null ? "" : modified, request.expectedVersion())));
        Map<String,Object> params = params(scoped, request.patientId()); params.put("request", request.requestId()); params.put("prediction", prediction);
        requestLock(params, "review");
        // Snapshot is immutable; the row lock serializes append-only review events without changing the prediction.
        Map<String,Object> snapshot = sql.required("""
                select id,model_key,model_version,outputs,status from predictive_prediction_snapshots
                where id=:prediction and hospital_id=:h and patient_id=:p and model_key in ('hb','urr','hyperkalemia','dry-weight') for update
                """, params, "Renal prediction not found.");
        Optional<Map<String,Object>> prior = sql.one("""
                select id,prediction_id,input_fingerprint,action,review_version from sri_lankan_renal_review_events
                where hospital_id=:h and patient_id=:p and actor_id=:actor and request_id=:request
                """, params);
        if (prior.isPresent()) {
            if (!prediction.toString().equals(String.valueOf(prior.get().get("prediction_id"))) || !fp.equals(prior.get().get("input_fingerprint")))
                throw ApiException.conflict("This review request UUID was already used for different content.");
            return reviewResult(prior.get());
        }
        if (!"AVAILABLE".equals(snapshot.get("status"))) throw ApiException.conflict("An unavailable prediction cannot receive a clinical interpretation review.");
        int latest = sql.one("select coalesce(max(review_version),0) as version from sri_lankan_renal_review_events where hospital_id=:h and patient_id=:p and prediction_id=:prediction", params)
                .map(r -> ((Number) r.get("version")).intValue()).orElse(0);
        if (latest != request.expectedVersion()) throw ApiException.conflict("The prediction has a newer clinical review. Refresh before reviewing.");
        UUID reviewId = UUID.randomUUID(); int version = latest + 1;
        params.put("id", reviewId); params.put("action", request.action()); params.put("reason", reason); params.put("note", note);
        params.put("modified", modified); params.put("version", version); params.put("fingerprint", fp);
        params.put("department", scoped.departmentId()); params.put("modelKey", snapshot.get("model_key")); params.put("modelVersion", snapshot.get("model_version"));
        params.put("snapshot", json.write(snapshot.get("outputs")));
        sql.update("""
                insert into sri_lankan_renal_review_events(id,hospital_id,patient_id,prediction_id,actor_id,department_id,request_id,
                  action,reason,clinical_note,modified_interpretation,review_version,input_fingerprint,model_key,model_version,prediction_snapshot)
                values(:id,:h,:p,:prediction,:actor,:department,:request,:action,:reason,:note,:modified,:version,:fingerprint,
                  :modelKey,:modelVersion,cast(:snapshot as jsonb))
                """, params);
        List<String> resources = persistReviewFhir(scoped, request.patientId(), prediction, reviewId, request.action(), reason, note, modified, snapshot);
        audit(scoped, request.patientId(), "RENAL_PREDICTION_REVIEWED", reviewId,
                Map.of("predictionId", prediction.toString(), "modelKey", snapshot.get("model_key"), "modelVersion", snapshot.get("model_version"),
                        "action", request.action(), "reviewVersion", version, "fhirResources", resources));
        return Map.of("id", reviewId, "predictionId", prediction, "reviewState", request.action(), "reviewVersion", version, "saved", true);
    }

    private RenalStatus currentStatus(GovCarePrincipal actor, UUID patient, List<ObservationView> observations) {
        var scoped=access.clinicalScope(actor,patient,false);
        var context=dialysisContext.latest(scoped,patient);
        if(context!=null&&!observations.isEmpty()&&observations.getLast().maintenanceHemodialysisVerified()&&context.verifiedAt().isBefore(observations.getLast().observedAt()))context=null;
        var features=longitudinal.load(actor,patient,false);
        var analysis=features==null?null:features.analysis();
        ClinicalIntelligenceEngine.Observation egfr=analysis==null?null:analysis.trends().stream().filter(t->"egfr".equals(t.metric())).map(ClinicalIntelligenceEngine.Trend::latest).filter(Objects::nonNull).findFirst().orElse(null);
        if (context!=null?"MAINTENANCE_HD".equals(context.status()):!observations.isEmpty() && observations.get(observations.size() - 1).maintenanceHemodialysisVerified())
            return new RenalStatus("G5D", "Kidney Failure on Dialysis", "Explicit clinician-verified maintenance hemodialysis source; never inferred from creatinine or a forecast.",egfr==null?null:egfr.value(),egfr==null?null:egfr.observedAt(),analysis==null?null:analysis.classification().chronicity(),context==null?null:context.status(),context==null?null:context.verifiedAt(),context==null?null:context.sourceNote(),context==null?null:context.id());
        var classification = analysis.classification();
        return new RenalStatus(classification.gCategory(), classification.gCategory() == null ? "Renal stage unavailable" : "CKD " + classification.gCategory(),
                "Chronicity: " + classification.chronicity() + "; " + classification.explanation() + "; current eGFR-based clinical assistance, chronicity and diagnosis require clinician confirmation.",egfr==null?null:egfr.value(),egfr==null?null:egfr.observedAt(),classification.chronicity(),context==null?null:context.status(),context==null?null:context.verifiedAt(),context==null?null:context.sourceNote(),context==null?null:context.id());
    }

    private List<Map<String,Object>> observationRows(GovCarePrincipal scoped, UUID patient) {
        return sql.list("""
                select id,observed_at,maintenance_hemodialysis_verified,measurements,units,source_note,sampling_context,patient_id,created_at,actor_id,department_id
                from sri_lankan_renal_observations where hospital_id=:h and patient_id=:p and source_verified=true
                order by observed_at desc,id limit 201
                """, params(scoped, patient));
    }

    private List<PredictionView> predictionRows(GovCarePrincipal scoped, UUID patient, boolean latestPerModel) {
        String selection = latestPerModel ? "select distinct on (s.model_key) " : "select ";
        String order = latestPerModel ? " order by s.model_key,s.created_at desc,s.id desc" : " order by s.created_at desc,s.id desc limit 100";
        return sql.list(selection + """
                s.id,s.model_key,s.status,s.outputs,s.created_at,coalesce(r.action,'AWAITING_REVIEW') as review_state,
                  coalesce(r.review_version,0) as review_version,r.reason,r.clinical_note as note,r.modified_interpretation,
                  r.actor_id::text as reviewed_by,r.created_at as reviewed_at
                from predictive_prediction_snapshots s
                left join lateral (select action,review_version,reason,clinical_note,modified_interpretation,actor_id,created_at from sri_lankan_renal_review_events
                  where hospital_id=s.hospital_id and patient_id=s.patient_id and prediction_id=s.id order by review_version desc limit 1) r on true
                where s.hospital_id=:h and s.patient_id=:p and s.model_key in ('hb','urr','hyperkalemia','dry-weight')
                """ + order, params(scoped, patient)).stream().map(this::predictionView).toList();
    }

    private RenalDeteriorationComposite deteriorationComposite(List<ObservationView> observations) {
        observations = RenalClinicalModules.canonical(observations, Instant.now(), new ArrayList<>());
        record Definition(String key, String label, String adverse) {}
        List<Definition> definitions = List.of(
                new Definition("creatinine_pre", "Pre-dialysis creatinine", "RISING"),
                new Definition("urea_pre", "Pre-dialysis urea", "RISING"),
                new Definition("potassium_pre", "Pre-dialysis potassium", "RISING"),
                new Definition("hb", "Hemoglobin", "FALLING"),
                new Definition("albumin", "Albumin", "FALLING"),
                new Definition("urr", "URR", "FALLING"));
        List<CompositeComponent> components = new ArrayList<>();
        int evaluated = 0, worsening = 0;
        for (Definition definition : definitions) {
            List<ObservationView> withValue = observations.stream()
                    .filter(o -> o.measurements().get(definition.key()) != null
                            && Double.isFinite(o.measurements().get(definition.key())))
                    .sorted(java.util.Comparator.comparing(ObservationView::observedAt)).toList();
            if (withValue.size() < 2) {
                Double current = withValue.isEmpty() ? null : withValue.get(withValue.size()-1).measurements().get(definition.key());
                String unit = withValue.isEmpty() ? "" : withValue.get(withValue.size()-1).units().getOrDefault(definition.key(), "");
                components.add(new CompositeComponent(definition.key(), definition.label(), definition.adverse(),
                        "INSUFFICIENT_DATA", current, null, unit, false, false));
                continue;
            }
            ObservationView previousRow = withValue.get(withValue.size()-2), currentRow = withValue.get(withValue.size()-1);
            double previous = previousRow.measurements().get(definition.key());
            double current = currentRow.measurements().get(definition.key());
            double scale = Math.max(Math.abs(previous), 1e-9);
            double relative = (current - previous) / scale;
            String direction = Math.abs(relative) <= .01 ? "STABLE" : current > previous ? "RISING" : "FALLING";
            boolean adverse = definition.adverse().equals(direction);
            evaluated++; if (adverse) worsening++;
            components.add(new CompositeComponent(definition.key(), definition.label(), definition.adverse(), direction,
                    current, previous, currentRow.units().getOrDefault(definition.key(), ""), true, adverse));
        }
        List<String> limitations = List.of(
                "Heuristic directional composite only; it is not a disease probability, validated prognostic score or treatment recommendation.",
                "Components are equally weighted and compare only the two latest valid observations; magnitude, reference ranges and clinical context are not scored.",
                "A 1% relative-change band is used as a neutral stability heuristic, not a clinical significance threshold.",
                "Dialysis timing, medications, acute illness and measurement uncertainty require clinician review.");
        if (evaluated < 3) return new RenalDeteriorationComposite("INSUFFICIENT_DATA", null, evaluated, worsening,
                "HEURISTIC_DIRECTIONAL_COMPOSITE", "NOT_CLINICALLY_VALIDATED", limitations, List.copyOf(components));
        int score = (int)Math.round(100.0 * worsening / evaluated);
        String status = worsening == 0 ? "NO_ADVERSE_DIRECTION_DETECTED" : score >= 50
                ? "MULTIDOMAIN_WORSENING_SIGNAL" : "MIXED_TRAJECTORY";
        return new RenalDeteriorationComposite(status, null, evaluated, worsening,
                "HEURISTIC_DIRECTIONAL_COMPOSITE", "NOT_CLINICALLY_VALIDATED", limitations, List.copyOf(components));
    }

    private Optional<Map<String,Object>> findRequestedPrediction(Map<String,Object> params) {
        return sql.one("""
                select s.id,s.model_key,s.status,s.outputs,s.created_at,coalesce(r.action,'AWAITING_REVIEW') as review_state,
                  coalesce(r.review_version,0) as review_version,r.reason,r.clinical_note as note,r.modified_interpretation,
                  r.actor_id::text as reviewed_by,r.created_at as reviewed_at
                from predictive_prediction_snapshots s
                left join lateral (select action,review_version,reason,clinical_note,modified_interpretation,actor_id,created_at from sri_lankan_renal_review_events
                  where hospital_id=s.hospital_id and patient_id=s.patient_id and prediction_id=s.id order by review_version desc limit 1) r on true
                where s.hospital_id=:h and s.patient_id=:p and s.requested_by=:actor and s.request_id=:request
                """, params);
    }

    private PredictionView sameRequestPrediction(Map<String,Object> row, String key) {
        if (!key.equals(row.get("model_key"))) throw ApiException.conflict("This request UUID was already used for another predictive model.");
        return predictionView(row);
    }
    private PredictionView predictionView(Map<String,Object> row) {
        Object storedOutputs = row.get("outputs");
        JsonNode outputs = storedOutputs instanceof String ? tree(storedOutputs) : renalOutputMapper.valueToTree(storedOutputs);
        return new PredictionView(UUID.fromString(row.get("id").toString()), text(row.get("model_key")), text(row.get("status")), outputs,
                instant(row.get("created_at")), text(row.getOrDefault("review_state", "AWAITING_REVIEW")),
                ((Number) row.getOrDefault("review_version", 0)).intValue(), text(row.get("reason")), text(row.get("note")),
                text(row.get("modified_interpretation")), text(row.get("reviewed_by")), row.get("reviewed_at") == null ? null : instant(row.get("reviewed_at")));
    }
    private ObservationView observationView(Map<String,Object> row) {
        Map<String,Double> values = new LinkedHashMap<>(); Map<String,String> units = new LinkedHashMap<>();
        List<String> flags = new ArrayList<>();
        tree(row.get("measurements")).fields().forEachRemaining(e -> { if (e.getValue().isNumber() && Double.isFinite(e.getValue().doubleValue())) values.put(e.getKey(), e.getValue().doubleValue()); else flags.add("INVALID_STORED_NUMERIC_" + e.getKey().toUpperCase()); });
        tree(row.get("units")).fields().forEachRemaining(e -> units.put(e.getKey(), e.getValue().asText()));
        ObjectNode sampling=renalOutputMapper.createObjectNode(); JsonNode savedSampling=tree(row.get("sampling_context")); if(savedSampling.isObject())sampling.setAll((ObjectNode)savedSampling);
        if(row.get("created_at")!=null)sampling.put("recordedAt",instant(row.get("created_at")).toString());
        var source=renalOutputMapper.createObjectNode().put("id",row.get("id").toString()).put("source_note",text(row.get("source_note")));
        source.set("measurements",renalOutputMapper.valueToTree(values));source.set("units",renalOutputMapper.valueToTree(units));source.set("sampling_context",sampling);
        if(values.containsKey("urea_pre")||values.containsKey("urea_post")){
            var result=UreaReductionRatio.evaluate(Objects.toString(row.get("patient_id"),null),source);
            if(result.path("value").isNumber()){values.put("urr",result.path("value").asDouble());units.put("urr","%");}
            else flags.add("PAIRED_UREA_SOURCE_OR_TIMING_UNVERIFIED");
        }
        return new ObservationView(UUID.fromString(row.get("id").toString()), instant(row.get("observed_at")),
                Boolean.TRUE.equals(row.get("maintenance_hemodialysis_verified")), Collections.unmodifiableMap(values),
                Collections.unmodifiableMap(units), text(row.get("source_note")), List.copyOf(flags),renalOutputMapper.convertValue(sampling,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){}));
    }

    static void validateMeasurements(Map<String,Double> measurements, Map<String,String> units) {
        if (measurements == null || measurements.isEmpty() || units == null || !units.keySet().equals(measurements.keySet())
                || !CANONICAL_UNITS.keySet().containsAll(measurements.keySet()))
            throw ApiException.badRequest("Provide supported measured renal variables and one explicit unit for each result.");
        for (var entry : measurements.entrySet()) {
            String key = entry.getKey(); Double raw = entry.getValue();
            if (raw == null || !Double.isFinite(raw)) throw ApiException.badRequest("Renal measurements must be finite numeric values.");
            double value = convert(key, raw, units.get(key));
            double min = switch (key) { case "hb", "albumin", "creatinine_pre", "creatinine_post" -> 1;
                case "calcium" -> .1; case "sodium" -> 80; case "potassium_pre", "potassium_post" -> .5; case "dry_weight" -> 10;
                case "urea_pre" -> Double.MIN_VALUE; case "urea_post" -> 0; default -> Double.POSITIVE_INFINITY; };
            double max = switch (key) { case "hb" -> 25; case "albumin" -> 100; case "calcium" -> 6; case "sodium" -> 200;
                case "potassium_pre", "potassium_post" -> 15; case "creatinine_pre", "creatinine_post" -> 3000;
                case "urea_pre", "urea_post" -> 250; case "dry_weight" -> 300; default -> 0; };
            if (value < min || value > max)
                throw ApiException.badRequest("The recorded " + key + " value is outside the supported plausibility range; verify the source and units.");
        }
    }
    private static Normalized normalizeMeasurements(Map<String,Double> raw, Map<String,String> units) {
        Map<String,Double> values = new TreeMap<>(); Map<String,String> targetUnits = new TreeMap<>();
        for (var entry : raw.entrySet()) {
            // URR is derived at the display boundary only; ML derives it independently from paired measured urea.
            if (entry.getKey().equals("urr")) continue;
            values.put(entry.getKey(), convert(entry.getKey(), entry.getValue(), units.get(entry.getKey())));
            targetUnits.put(entry.getKey(), CANONICAL_UNITS.get(entry.getKey()));
        }
        return new Normalized(Collections.unmodifiableMap(values), Collections.unmodifiableMap(targetUnits));
    }
    static double convert(String key, double value, String unit) {
        if (key == null || unit == null || !CANONICAL_UNITS.containsKey(key))
            throw ApiException.badRequest("A supported measured variable and explicit unit are required.");
        if (CANONICAL_UNITS.get(key).equals(unit)) return value;
        if (key.equals("hb") && "g/L".equals(unit)) return value / 10;
        if (key.equals("albumin") && "g/dL".equals(unit)) return value * 10;
        if (Set.of("creatinine_pre", "creatinine_post").contains(key)) {
            if ("mg/dL".equals(unit)) return value * 88.4;
            if (Set.of("µmol/L", "μmol/L").contains(unit)) return value;
        }
        if (Set.of("urea_pre", "urea_post").contains(key) && "mg/dL".equals(unit)) return value / 6.006;
        throw ApiException.badRequest("Unsupported or ambiguous unit for " + key + "; verify the analyte and use its explicit clinical unit.");
    }

    private List<String> persistMeasuredFhir(GovCarePrincipal scoped, UUID patient, UUID session, ObservationRequest request, String sourceNote) {
        String reference = ensurePatientReference(scoped, patient);
        List<String> resources = new ArrayList<>();
        for (var entry : new TreeMap<>(request.measurements()).entrySet()) {
            String id = UUID.nameUUIDFromBytes((session + "|" + entry.getKey()).getBytes(StandardCharsets.UTF_8)).toString();
            Map<String,Object> body = new LinkedHashMap<>();
            body.put("resourceType", "Observation"); body.put("id", id); body.put("status", "final");
            body.put("code", Map.of("text", "Verified hemodialysis " + entry.getKey().replace('_', ' ')));
            body.put("subject", Map.of("reference", reference));
            String samplingAt=request.samplingContext()==null?null:request.samplingContext().get(entry.getKey().equals("urea_pre")?"preCollectedAt":entry.getKey().equals("urea_post")?"postCollectedAt":"");
            body.put("effectiveDateTime",samplingAt==null?request.observedAt().toString():samplingAt);
            body.put("valueQuantity", Map.of("value", entry.getValue(), "unit", request.units().get(entry.getKey())));
            body.put("performer", List.of(Map.of("identifier", Map.of("system", "urn:govcare:user", "value", scoped.id().toString()))));
            body.put("note", List.of(Map.of("text", "Clinician verified source: " + sourceNote)));
            body.put("extension", List.of(Map.of("url", "urn:govcare:renal-session", "valueString", session.toString()),
                    Map.of("url", "urn:govcare:maintenance-hemodialysis-verified", "valueBoolean", request.maintenanceHemodialysisVerified())));
            storeFhir(scoped, patient, "Observation", id, json.write(body));
            resources.add("Observation/" + id);
        }
        if (request.maintenanceHemodialysisVerified()) {
            String id = UUID.randomUUID().toString();
            Map<String,Object> condition = new LinkedHashMap<>();
            condition.put("resourceType", "Condition"); condition.put("id", id);
            condition.put("clinicalStatus", Map.of("coding", List.of(Map.of("system", "http://terminology.hl7.org/CodeSystem/condition-clinical", "code", "active"))));
            condition.put("verificationStatus", Map.of("coding", List.of(Map.of("system", "http://terminology.hl7.org/CodeSystem/condition-ver-status", "code", "confirmed"))));
            condition.put("code", Map.of("text", "Verified kidney failure on maintenance dialysis (G5D)"));
            condition.put("subject", Map.of("reference", reference)); condition.put("recordedDate", Instant.now().toString());
            condition.put("recorder", Map.of("identifier", Map.of("system", "urn:govcare:user", "value", scoped.id().toString())));
            condition.put("note", List.of(Map.of("text", "Explicit maintenance hemodialysis context verified from source: " + sourceNote
                    + "; source observation date " + request.observedAt() + ". This source verification does not assert a dialysis procedure was performed at the laboratory collection time.")));
            storeFhir(scoped, patient, "Condition", id, json.write(condition)); resources.add("Condition/" + id);
        }
        resources.add(persistProvenance(scoped, patient, resources, "urn:govcare:renal-session", session));
        return List.copyOf(resources);
    }

    private List<String> persistPredictionFhir(GovCarePrincipal scoped, UUID patient, UUID snapshot, ObjectNode output, List<Map<String,Object>> rows) {
        var body=RenalPredictionFhir.resource(ensurePatientReference(scoped,patient),snapshot.toString(),output,rows);
        String type=body.path("resourceType").asText(),reference=type+"/"+snapshot;
        storeFhir(scoped,patient,type,snapshot.toString(),body.toString());
        String provenance=persistProvenance(scoped,patient,List.of(reference),"urn:govcare:predictive-snapshot",snapshot);
        return List.of(reference,provenance);
    }

    private List<String> persistReviewFhir(GovCarePrincipal scoped, UUID patient, UUID prediction, UUID review, String action,
            String reason, String note, String modified, Map<String,Object> snapshot) {
        ClinicalImpression impression = new ClinicalImpression(); String id = review.toString(); impression.setId(id);
        impression.setStatus(ClinicalImpression.ClinicalImpressionStatus.COMPLETED);
        impression.setSubject(new Reference(ensurePatientReference(scoped, patient)));
        impression.setAssessor(new Reference().setIdentifier(new Identifier().setSystem("urn:govcare:user").setValue(scoped.id().toString())));
        impression.setDate(Date.from(Instant.now()));
        impression.setSummary("Research prediction " + snapshot.get("model_key") + " v" + snapshot.get("model_version")
                + ": " + action + ". " + reason + (modified == null ? "" : ". Clinician interpretation: " + modified)
                + (note == null ? "" : ". Note: " + note));
        String resourceType=sql.one("select resource_type from fhir_resource where resource_id=:rid and hospital_id=:h and patient_id=:p and resource_type in ('RiskAssessment','ClinicalImpression') limit 1",Map.of("rid",prediction.toString(),"h",scoped.hospitalId(),"p",patient)).map(row->Objects.toString(row.get("resource_type"),"RiskAssessment")).orElse("RiskAssessment");
        impression.addSupportingInfo(new Reference(resourceType+"/"+prediction));
        storeFhir(scoped, patient, "ClinicalImpression", id, FHIR.newJsonParser().encodeResourceToString(impression));
        String provenance = persistProvenance(scoped, patient, List.of("ClinicalImpression/" + id), "urn:govcare:renal-review", review);
        return List.of("ClinicalImpression/" + id, provenance);
    }

    private String persistProvenance(GovCarePrincipal scoped, UUID patient, List<String> targets, String sourceSystem, UUID source) {
        Provenance provenance = new Provenance(); String id = UUID.randomUUID().toString(); provenance.setId(id);
        targets.forEach(target -> provenance.addTarget(new Reference(target)));
        provenance.setRecorded(Date.from(Instant.now()));
        provenance.addAgent().setWho(new Reference().setIdentifier(new Identifier().setSystem("urn:govcare:user").setValue(scoped.id().toString())));
        provenance.addEntity().setRole(Provenance.ProvenanceEntityRole.SOURCE)
                .setWhat(new Reference().setIdentifier(new Identifier().setSystem(sourceSystem).setValue(source.toString())));
        storeFhir(scoped, patient, "Provenance", id, FHIR.newJsonParser().encodeResourceToString(provenance));
        return "Provenance/" + id;
    }
    String ensurePatientReference(GovCarePrincipal scoped, UUID patient) {
        Map<String,Object> params = params(scoped, patient);
        String existing = sql.one("select resource_id from fhir_resource where hospital_id=:h and patient_id=:p and resource_type='Patient' order by updated_date desc limit 1", params)
                .map(r -> "Patient/" + r.get("resource_id")).orElse(null);
        if (existing != null) return existing;
        Map<String,Object> identity = sql.required("select patient_no,full_name from patients where id=:p and hospital_id=:h and status<>'deleted'", params, "Patient not found.");
        Patient resource = new Patient(); String id = "patient-" + patient; resource.setId(id);
        resource.addIdentifier().setSystem("urn:govcare:patient-number").setValue(text(identity.get("patient_no")));
        resource.addName().setText(text(identity.get("full_name")));
        params.put("rid", id); params.put("body", FHIR.newJsonParser().encodeResourceToString(resource));
        sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values('Patient',:rid,:p,:h,cast(:body as jsonb)) on conflict(hospital_id,resource_type,resource_id) do nothing", params);
        return "Patient/" + id;
    }
    private void storeFhir(GovCarePrincipal scoped, UUID patient, String type, String id, String content) {
        // Parse before insertion, so invalid FHIR projections roll back the clinical transaction.
        FHIR.newJsonParser().parseResource(content);
        Map<String,Object> params = params(scoped, patient); params.put("type", type); params.put("id", id); params.put("body", content);
        sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values(:type,:id,:p,:h,cast(:body as jsonb))", params);
    }
    private void audit(GovCarePrincipal scoped, UUID patient, String event, UUID resource, Map<String,Object> metadata) {
        Map<String,Object> params = params(scoped, patient); params.put("event", event); params.put("resource", resource); params.put("metadata", json.write(metadata));
        sql.update("insert into predictive_audit_events(hospital_id,patient_id,actor_id,event_type,resource_id,metadata) values(:h,:p,:actor,:event,:resource,cast(:metadata as jsonb))", params);
    }
    private void requestLock(Map<String,Object> params, String purpose) {
        sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",
                Map.of("lock", "renal-" + purpose + "|" + params.get("h") + "|" + params.get("p") + "|" + params.get("actor") + "|" + params.get("request")), "Unable to serialize the renal clinical request.");
    }
    private void dateLock(GovCarePrincipal scoped, UUID patient, Instant time) {
        sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",
                Map.of("lock", "renal-observation-date|" + scoped.hospitalId() + "|" + patient + "|" + time), "Unable to serialize the renal observation date.");
    }
    private static Map<String,Object> params(GovCarePrincipal scoped, UUID patient) {
        Map<String,Object> params = new HashMap<>(); params.put("h", scoped.hospitalId()); params.put("p", patient); params.put("actor", scoped.id()); return params;
    }
    private JsonNode tree(Object data) {
        if (data instanceof String value) { try { return mapper.readTree(value); } catch (Exception ignored) { throw ApiException.conflict("Stored renal data cannot be decoded safely."); } }
        return mapper.valueToTree(data);
    }
    private static String fingerprint(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception failure) { throw new IllegalStateException("SHA-256 unavailable", failure); }
    }
    private static Map<String,Object> reviewResult(Map<String,Object> row) {
        return Map.of("id", row.get("id"), "predictionId", row.get("prediction_id"), "reviewState", row.get("action"), "reviewVersion", row.get("review_version"), "saved", true);
    }
    private static boolean canWrite(GovCarePrincipal actor) {
        return actor.permissions().contains("*") || actor.permissions().contains("CONSULTATION_CREATE") || actor.permissions().contains("CONSULTATION_UPDATE");
    }
    private static String requiredText(String text, int max, String error) {
        String value = text == null ? "" : text.trim(); if (value.isEmpty() || value.length() > max) throw ApiException.badRequest(error); return value;
    }
    private static String optionalText(String text, int max, String error) {
        if (text == null || text.isBlank()) return null; String value = text.trim(); if (value.length() > max) throw ApiException.badRequest(error); return value;
    }
    private static String text(Object value) { return value == null ? null : value.toString(); }
    private static Instant instant(Object value) {
        if (value instanceof Instant time) return time; if (value instanceof Timestamp time) return time.toInstant();
        if (value instanceof OffsetDateTime time) return time.toInstant(); return Instant.parse(String.valueOf(value));
    }
}
