package lk.gov.health.govcare.ai;

import ca.uhn.fhir.context.FhirContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import lk.gov.health.govcare.ai.predictive.*;
import org.hl7.fhir.r4.model.ClinicalImpression;
import org.hl7.fhir.r4.model.Identifier;
import org.hl7.fhir.r4.model.Patient;
import org.hl7.fhir.r4.model.Provenance;
import org.hl7.fhir.r4.model.Reference;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

import static lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.*;

/** Patient/tenant authorization precedes every clinical read and every write. */
@Service
public class PredictiveIntelligenceService {
    private final SqlSupport sql;
    private final JsonSupport json;
    private final ObjectMapper mapper;
    private final ClinicalPatientAccess access;
    private final CkdProgressionForecastService ckdForecast;
    private final KidneyFailureRiskCalculator kidneyFailureRisk;
    private final HyperkalemiaRiskService hyperkalemiaRisk;
    private final AnemiaRiskService anemiaRisk;
    private final CardiovascularRiskCalculator cardiovascularRisk;
    private final FhirContext fhir = FhirContext.forR4Cached();
    private final LongitudinalClinicalFeatureService longitudinal;

    @Autowired
    public PredictiveIntelligenceService(SqlSupport sql, JsonSupport json, ObjectMapper mapper, ClinicalPatientAccess access,
                                         CkdProgressionForecastService ckdForecast, KidneyFailureRiskCalculator kidneyFailureRisk,
                                         LongitudinalClinicalFeatureService longitudinal, HyperkalemiaRiskService hyperkalemiaRisk,
                                         AnemiaRiskService anemiaRisk, CardiovascularRiskCalculator cardiovascularRisk) {
        this.sql = sql; this.json = json; this.mapper = mapper; this.access = access;
        this.ckdForecast = ckdForecast; this.kidneyFailureRisk = kidneyFailureRisk;
        this.longitudinal = longitudinal; this.hyperkalemiaRisk = hyperkalemiaRisk;
        this.anemiaRisk = anemiaRisk; this.cardiovascularRisk = cardiovascularRisk;
    }

    /** Compatibility constructor retained for isolated security tests and non-Spring integrations. */
    public PredictiveIntelligenceService(SqlSupport sql, JsonSupport json, ObjectMapper mapper, ClinicalPatientAccess access,
                                         CkdProgressionForecastService ckdForecast, KidneyFailureRiskCalculator kidneyFailureRisk) {
        this(sql, json, mapper, access, ckdForecast, kidneyFailureRisk,
                new LongitudinalClinicalFeatureService(sql, mapper, access), new HyperkalemiaRiskService(),
                new AnemiaRiskService(), new CardiovascularRiskCalculator());
    }

    public record ReviewedFinding(UUID id, Finding finding, String reviewState, int version, String reason,
                                  String reasonCode, String clinicalNote, String modifiedRecommendation, Instant reviewedAt) {}
    public record RiskCapability(String key, String label, String status, String reason, Double probability,
                                 String modelVersion, String purpose, String method, String validationStatus,
                                 String horizon, String category, String confidence, String modelName,
                                 String localValidationStatus, String runtimeStatus, List<String> requiredInputs,
                                 List<String> missingInputs, List<String> applicableCkdStages, String reference,
                                 Instant lastCalculated, MonitoringSignal signal) {}
    public record TimelineEvent(String id, String type, String title, String detail, Instant occurredAt, String source) {}
    public record Overview(Map<String,Object> patient, Analysis analysis, List<ReviewedFinding> recommendations,
                           List<RiskCapability> risks, List<TimelineEvent> timeline, boolean canReview,
                           boolean historyTruncated, String medicationContext,
                           LongitudinalClinicalFeatureService.MedicationContext medications) {}
    public record ReviewRequest(UUID patientId, UUID requestId, int expectedVersion, String evidenceFingerprint,
                                String action, String reason, String modifiedRecommendation,
                                String reasonCode, String clinicalNote) {
        public ReviewRequest(UUID patientId, UUID requestId, int expectedVersion, String evidenceFingerprint,
                             String action, String reason, String modifiedRecommendation) {
            this(patientId, requestId, expectedVersion, evidenceFingerprint, action, reason, modifiedRecommendation, null, null);
        }
    }
    public record ForecastRequest(UUID requestId, int horizonMonths) {}
    public record MeasurementRequest(UUID requestId, String metric, Double value, String unit, Instant observedAt,
                                     Double referenceLow, Double referenceHigh, String sourceNote, boolean sourceVerified) {}
    private record Context(GovCarePrincipal scoped, Map<String,Object> patient, Analysis analysis, boolean truncated,
                           LongitudinalClinicalFeatureService.MedicationContext medications, LocalDate birthDate) {}

    @Transactional
    public Overview overview(GovCarePrincipal actor, UUID patient) {
        Context context = load(actor, patient, false);
        Map<String,Object> params = params(context, patient);
        List<ReviewedFinding> recommendations = recommendations(context, patient);
        List<RiskCapability> risks = riskCapabilities(context);
        List<TimelineEvent> events = sql.list("""
                select * from (
                  select id::text as id,'CONSULTATION' as type,'Consultation' as title,
                    coalesce(diagnosis,chief_complaint,'Recorded clinical encounter') as detail,created_at as occurred_at,'EHR encounter' as source
                    from consultations where hospital_id=:h and patient_id=:p and status<>'deleted'
                  union all select id::text,'PRESCRIPTION','Prescription',
                    'Recorded prescription; reconcile current use with the patient',created_at,'EHR prescription'
                    from prescriptions where hospital_id=:h and patient_id=:p and status<>'deleted'
                  union all select id::text,'ADMISSION','Admission',status::text,admitted_at,'EHR admission'
                    from admissions where hospital_id=:h and patient_id=:p and status<>'deleted'
                  union all select id::text,'AI_REVIEW','Clinical intelligence review',action,created_at,'Clinician feedback'
                    from predictive_clinician_feedback where hospital_id=:h and patient_id=:p
                ) events order by occurred_at desc limit 50
                """, params).stream().map(row -> new TimelineEvent(text(row.get("id")), text(row.get("type")), text(row.get("title")),
                        text(row.get("detail")), instant(row.get("occurred_at")), text(row.get("source")))).toList();
        List<String> unavailable = risks.stream().filter(r -> Set.of("NOT_INSTALLED", "INSUFFICIENT_DATA", "BLOCKED_BY_SAFETY_GATE").contains(r.status()))
                .map(RiskCapability::key).toList();
        audit(actor, context, patient, "PREDICTION_VIEWED", null, Map.of(
                "ruleVersion", RULE_VERSION, "safetyStatus", context.analysis().safety().status(), "unavailableModules", unavailable));
        if (context.analysis().safety().forecastSuppressed()) audit(actor, context, patient, "SAFETY_GATE_TRIGGERED", null,
                Map.of("ruleVersion", RULE_VERSION, "status", context.analysis().safety().status(), "reasons", context.analysis().safety().reasons()));
        if (!unavailable.isEmpty()) audit(actor, context, patient, "MODEL_UNAVAILABLE", null,
                Map.of("modules", unavailable, "ruleVersion", RULE_VERSION));
        boolean write = actor.permissions().contains("*") || actor.permissions().contains("CONSULTATION_CREATE") || actor.permissions().contains("CONSULTATION_UPDATE");
        return new Overview(context.patient(), context.analysis(), recommendations, risks, events, write, context.truncated(),
                context.medications().limitation(), context.medications());
    }

    @Transactional
    public Map<String,Object> forecast(GovCarePrincipal actor, UUID patient, ForecastRequest request) {
        if (request == null || request.requestId() == null || !Set.of(3,6,12).contains(request.horizonMonths()))
            throw ApiException.badRequest("A request UUID and a 3, 6 or 12 month horizon are required.");
        long started = System.nanoTime();
        Context context = load(actor, patient, false);
        Map<String,Object> params = new HashMap<>(params(context, patient));
        params.put("actor", actor.id()); params.put("request", request.requestId());

        Optional<Map<String,Object>> previous = sql.one("""
                select id,horizon_months,status,explanation,outputs::text as outputs_json,created_at
                from predictive_prediction_snapshots
                where hospital_id=:h and patient_id=:p and requested_by=:actor and request_id=:request
                """, params);
        if (previous.isPresent()) {
            if (((Number) previous.get().get("horizon_months")).intValue() != request.horizonMonths())
                throw ApiException.conflict("This request UUID was already used for another horizon.");
            return forecastRow(previous.get());
        }

        Optional<Map<String,Object>> registered = sql.one("""
                select id,model_key,version,status,runtime_status,model_type,validation_status,local_validation_status
                from predictive_model_registry
                where model_key='egfr_trajectory' and version=:version and runtime_status='ACTIVE'
                """, Map.of("version", CkdProgressionForecastService.MODEL_VERSION));
        if (registered.isEmpty()) {
            audit(actor, context, patient, "MODEL_UNAVAILABLE", null, Map.of(
                    "modelKey", CkdProgressionForecastService.MODEL_KEY,
                    "modelVersion", CkdProgressionForecastService.MODEL_VERSION,
                    "reason", "No active registry entry"));
            return Map.of("id", "", "horizon_months", request.horizonMonths(), "status", "NOT_INSTALLED",
                    "outputs", List.of(), "created_at", Instant.now(),
                    "explanation", "The governed eGFR trajectory runtime is not active; no forecast was calculated.");
        }
        Map<String,Object> model = registered.get();

        CkdProgressionForecastService.Forecast result = ckdForecast.calculate(context.analysis(), request.horizonMonths(), context.truncated());
        long elapsedMs = Math.max(0, (System.nanoTime() - started) / 1_000_000);
        UUID id = UUID.randomUUID();
        params.put("id", id); params.put("horizon", request.horizonMonths()); params.put("model", model.get("id"));
        params.put("status", result.status()); params.put("explanation", result.explanation());
        params.put("inputs", json.write(context.analysis().trends()));
        params.put("quality", json.write(context.analysis().quality()));
        params.put("safety", json.write(context.analysis().safety()));
        params.put("outputs", "AVAILABLE".equals(result.status()) ? json.write(result) : "[]");
        params.put("method", result.method()); params.put("modelVersion", result.modelVersion());
        params.put("validation", result.validationStatus()); params.put("localValidation", result.localValidationStatus());
        params.put("completeness", context.analysis().quality().completenessPercent()); params.put("elapsed", elapsedMs);

        int inserted = sql.update("""
                insert into predictive_prediction_snapshots(
                  id,hospital_id,patient_id,requested_by,request_id,horizon_months,model_id,status,
                  input_snapshot,quality_snapshot,safety_snapshot,outputs,explanation,method_type,model_version,
                  validation_status,local_validation_status,data_completeness_percent,elapsed_ms)
                values(:id,:h,:p,:actor,:request,:horizon,:model,:status,
                  cast(:inputs as jsonb),cast(:quality as jsonb),cast(:safety as jsonb),cast(:outputs as jsonb),:explanation,
                  :method,:modelVersion,:validation,:localValidation,:completeness,:elapsed)
                on conflict(hospital_id,patient_id,requested_by,request_id) do nothing
                """, params);

        if (inserted == 1) {
            audit(actor, context, patient, "FORECAST_GENERATED", id, Map.of(
                    "status", result.status(), "horizonMonths", request.horizonMonths(),
                    "modelVersion", CkdProgressionForecastService.MODEL_VERSION,
                    "method", CkdProgressionForecastService.METHOD,
                    "validationStatus", CkdProgressionForecastService.VALIDATION_STATUS,
                    "localValidationStatus", CkdProgressionForecastService.LOCAL_VALIDATION_STATUS,
                    "elapsedMs", elapsedMs));
            if ("BLOCKED_BY_SAFETY_GATE".equals(result.status())) audit(actor, context, patient, "SAFETY_GATE_TRIGGERED", id,
                    Map.of("status", context.analysis().safety().status(), "reasons", context.analysis().safety().reasons(),
                            "modelVersion", result.modelVersion()));
            if ("AVAILABLE".equals(result.status())) persistForecastFhir(actor, context, patient, id, result);
            updateMonitoring(context, model, result, elapsedMs);
        }
        Map<String,Object> saved = sql.required("""
                select id,horizon_months,status,explanation,outputs::text as outputs_json,created_at
                from predictive_prediction_snapshots
                where hospital_id=:h and patient_id=:p and requested_by=:actor and request_id=:request
                """, params, "Forecast snapshot could not be recorded.");
        if (((Number) saved.get("horizon_months")).intValue() != request.horizonMonths())
            throw ApiException.conflict("This request UUID was already used for another horizon.");
        return forecastRow(saved);
    }

    @Transactional
    public List<Trend> trends(GovCarePrincipal actor, UUID patient) {
        Context context = load(actor, patient, false);
        audit(actor, context, patient, "PREDICTION_VIEWED", null, Map.of("view", "TRENDS", "ruleVersion", RULE_VERSION));
        return context.analysis().trends();
    }
    @Transactional
    public Quality dataQuality(GovCarePrincipal actor, UUID patient) {
        Context context = load(actor, patient, false);
        audit(actor, context, patient, "PREDICTION_VIEWED", null, Map.of("view", "DATA_QUALITY", "ruleVersion", RULE_VERSION));
        return context.analysis().quality();
    }
    public List<TimelineEvent> timeline(GovCarePrincipal actor, UUID patient) { return overview(actor, patient).timeline(); }
    @Transactional
    public Object previewForecast(GovCarePrincipal actor, UUID patient, int horizonMonths) {
        if (!Set.of(3, 6, 12).contains(horizonMonths)) throw ApiException.badRequest("Forecast horizon must be 3, 6 or 12 months.");
        Context context = load(actor, patient, false);
        boolean active = sql.one("""
                select id from predictive_model_registry
                where model_key='egfr_trajectory' and version=:version and runtime_status='ACTIVE'
                """, Map.of("version", CkdProgressionForecastService.MODEL_VERSION)).isPresent();
        if (!active) {
            audit(actor, context, patient, "MODEL_UNAVAILABLE", null, Map.of(
                    "modelKey", CkdProgressionForecastService.MODEL_KEY, "modelVersion", CkdProgressionForecastService.MODEL_VERSION));
            return Map.of("status", "NOT_INSTALLED", "method", "TREND_PROJECTION", "projected", false,
                    "reason", "The governed eGFR trajectory runtime is not active; no forecast was calculated.");
        }
        CkdProgressionForecastService.Forecast result = ckdForecast.calculate(context.analysis(), horizonMonths, context.truncated());
        audit(actor, context, patient, "PREDICTION_VIEWED", null, Map.of(
                "view", "CKD_PROGRESSION_FORECAST", "status", result.status(), "horizonMonths", horizonMonths,
                "modelVersion", result.modelVersion(), "method", result.method()));
        if ("BLOCKED_BY_SAFETY_GATE".equals(result.status())) audit(actor, context, patient, "SAFETY_GATE_TRIGGERED", null,
                Map.of("status", context.analysis().safety().status(), "reasons", context.analysis().safety().reasons()));
        return result;
    }
    @Transactional
    public Map<Integer,CkdProgressionForecastService.Forecast> reportForecasts(GovCarePrincipal actor, UUID patient) {
        Context context = load(actor, patient, false);
        boolean active = sql.one("""
                select id from predictive_model_registry
                where model_key='egfr_trajectory' and version=:version and runtime_status='ACTIVE'
                """, Map.of("version", CkdProgressionForecastService.MODEL_VERSION)).isPresent();
        if (!active) {
            audit(actor, context, patient, "MODEL_UNAVAILABLE", null, Map.of(
                    "view", "PDF_REPORT", "modelKey", CkdProgressionForecastService.MODEL_KEY,
                    "modelVersion", CkdProgressionForecastService.MODEL_VERSION));
            return Map.of();
        }
        Map<Integer,CkdProgressionForecastService.Forecast> forecasts = new LinkedHashMap<>();
        for (int horizon : List.of(3, 6, 12)) forecasts.put(horizon,
                ckdForecast.calculate(context.analysis(), horizon, context.truncated()));
        audit(actor, context, patient, "PREDICTION_VIEWED", null, Map.of(
                "view", "PDF_REPORT_FORECASTS", "modelVersion", CkdProgressionForecastService.MODEL_VERSION,
                "statuses", forecasts.values().stream().map(CkdProgressionForecastService.Forecast::status).distinct().toList()));
        return Collections.unmodifiableMap(forecasts);
    }
    @Transactional
    public RiskCapability risk(GovCarePrincipal actor, UUID patient, String key) {
        String normalizedKey = "kidney-failure".equals(key) ? "kfre" : key;
        Context context = load(actor, patient, false);
        RiskCapability result = riskCapabilities(context).stream().filter(r -> r.key().equals(normalizedKey)).findFirst()
                .orElseThrow(() -> ApiException.badRequest("Unsupported predictive risk key."));
        audit(actor, context, patient, "PREDICTION_VIEWED", null, Map.of(
                "view", "RISK", "riskKey", result.key(), "status", result.status(), "modelVersion", result.modelVersion()));
        if ("NOT_INSTALLED".equals(result.status())) audit(actor, context, patient, "MODEL_UNAVAILABLE", null,
                Map.of("riskKey", result.key(), "modelVersion", result.modelVersion(), "status", result.status()));
        return result;
    }

    @Transactional
    public Map<String,Object> recordMeasurement(GovCarePrincipal actor, UUID patient, MeasurementRequest request) {
        if (request==null || request.requestId()==null || request.observedAt()==null || request.value()==null || !request.sourceVerified())
            throw ApiException.badRequest("A request UUID, verified source, measurement time and numeric result are required.");
        GovCarePrincipal scoped=access.clinicalScope(actor,patient,true);
        String key=metric(request.metric(),null);
        if (key==null) throw ApiException.badRequest("Select a supported clinical measurement.");
        String note=request.sourceNote()==null?"":request.sourceNote().trim();
        if (note.isBlank()||note.length()>2000) throw ApiException.badRequest("Document the verified source in 1–2000 characters.");
        if (request.referenceLow()!=null&&!Double.isFinite(request.referenceLow()) || request.referenceHigh()!=null&&!Double.isFinite(request.referenceHigh())
                || request.referenceLow()!=null&&request.referenceHigh()!=null&&request.referenceLow()>request.referenceHigh())
            throw ApiException.badRequest("Enter a valid reference range in the same units as the recorded result.");
        RawObservation input=new RawObservation("new",key,request.value(),request.unit(),request.observedAt().toString(),"CLINICIAN_ENTERED",null,request.referenceLow(),request.referenceHigh(),null);
        Analysis checked=analyze(List.of(input),Instant.now(),null);
        ClinicalIntelligenceEngine.Observation normalized=checked.trends().stream().filter(t->t.metric().equals(key)).findFirst().orElseThrow().latest();
        if (normalized==null) throw ApiException.badRequest(checked.quality().flags().getFirst().message());
        Map<String,Object> payload=new LinkedHashMap<>();payload.put("metric",key);payload.put("value",request.value());payload.put("unit",request.unit());payload.put("observedAt",request.observedAt().toString());payload.put("referenceLow",request.referenceLow());payload.put("referenceHigh",request.referenceHigh());payload.put("sourceNote",note);
        String fingerprint=sha256(json.write(payload));
        Map<String,Object> params=new HashMap<>();params.put("h",scoped.hospitalId());params.put("p",patient);params.put("actor",actor.id());params.put("request",request.requestId());
        Optional<Map<String,Object>> prior=sql.one("select observation_id,input_fingerprint from predictive_observation_entries where hospital_id=:h and patient_id=:p and actor_id=:actor and request_id=:request",params);
        if (prior.isPresent()) {
            if (!fingerprint.equals(prior.get().get("input_fingerprint"))) throw ApiException.conflict("This request UUID was used for a different measurement.");
            return Map.of("id",prior.get().get("observation_id"),"saved",true);
        }
        UUID observation=UUID.randomUUID();params.put("id",observation);params.put("metric",key);params.put("label",label(key));params.put("value",request.value());params.put("unit",request.unit());
        params.put("normalized",normalized.value());params.put("normalizedUnit",normalized.unit());params.put("time",java.sql.Timestamp.from(request.observedAt()));params.put("low",request.referenceLow());params.put("high",request.referenceHigh());params.put("fingerprint",fingerprint);params.put("note",note);
        sql.update("""
                insert into clinical_observations(id,hospital_id,patient_id,feature_key,display_name,value_numeric,unit,normalized_value,normalized_unit,reference_range_low,reference_range_high,effective_at,source_type,created_by)
                values(:id,:h,:p,:metric,:label,:value,:unit,:normalized,:normalizedUnit,:low,:high,:time,'CLINICIAN_ENTERED',:actor)
                """,params);
        sql.update("""
                insert into predictive_observation_entries(hospital_id,patient_id,observation_id,actor_id,request_id,input_fingerprint,source_note)
                values(:h,:p,:id,:actor,:request,:fingerprint,:note)
                """,params);
        Context context=new Context(scoped,Map.of(),checked,false,new LongitudinalClinicalFeatureService.MedicationContext(List.of(),List.of(),false,false,"Medication context not loaded"),null);
        Map<String,Object> body=new LinkedHashMap<>();body.put("resourceType","Observation");body.put("id",observation.toString());body.put("status","final");body.put("code",Map.of("text",label(key)));
        // No assay/method-specific LOINC code is invented for a transcribed source result.
        body.put("subject",Map.of("reference",ensurePatientReference(context,patient)));body.put("effectiveDateTime",request.observedAt().toString());
        body.put("valueQuantity",Map.of("value",request.value(),"unit",request.unit()));body.put("note",List.of(Map.of("text","Clinician verified source: "+note)));
        storeFhir(context,patient,"Observation",observation.toString(),json.write(body));
        Provenance provenance=new Provenance();String provenanceId=UUID.randomUUID().toString();provenance.setId(provenanceId);
        provenance.addTarget(new Reference("Observation/"+observation));provenance.setRecorded(java.util.Date.from(Instant.now()));
        provenance.addAgent().setWho(new Reference().setIdentifier(new Identifier().setSystem("urn:govcare:user").setValue(actor.id().toString())));
        storeFhir(context,patient,"Provenance",provenanceId,fhir.newJsonParser().encodeResourceToString(provenance));
        audit(actor,context,patient,"VERIFIED_MEASUREMENT_RECORDED",observation,Map.of("metric",key,"inputFingerprint",fingerprint,"sourceVerified",true));
        return Map.of("id",observation,"saved",true);
    }

    @Transactional
    public Map<String,Object> review(GovCarePrincipal actor, UUID recommendation, ReviewRequest request) {
        if (request == null || request.patientId() == null || request.requestId() == null || request.expectedVersion() < 0
                || request.action() == null || !Set.of("ACCEPT","MODIFY","DISMISS","DEFER").contains(request.action()))
            throw ApiException.badRequest("Patient, request UUID, version and a valid review action are required.");
        String reason = request.reason() == null ? "" : request.reason().trim();
        String modified = request.modifiedRecommendation() == null ? "" : request.modifiedRecommendation().trim();
        String reasonCode = request.reasonCode() == null || request.reasonCode().isBlank() ? "OTHER" : request.reasonCode().trim().toUpperCase(Locale.ROOT);
        String clinicalNote = request.clinicalNote() == null ? "" : request.clinicalNote().trim();
        Set<String> reasonCodes = Set.of("CLINICAL_JUDGMENT","INCORRECT_DATA","ALREADY_MANAGED","CONTRAINDICATED","PATIENT_PREFERENCE","NOT_RELEVANT","OTHER");
        if (reason.isBlank() || reason.length() > 2000) throw ApiException.badRequest("Document a review reason of 1–2000 characters.");
        if (!reasonCodes.contains(reasonCode)) throw ApiException.badRequest("Select a valid clinical review reason code.");
        if (clinicalNote.length() > 4000) throw ApiException.badRequest("Clinical note must not exceed 4000 characters.");
        if (modified.length() > 4000 || request.action().equals("MODIFY") && modified.isBlank()) throw ApiException.badRequest("A modified recommendation of 1–4000 characters is required for Modify.");
        if (!request.action().equals("MODIFY") && !modified.isBlank()) throw ApiException.badRequest("Choose Modify to record a revised recommendation.");
        Context context = load(actor, request.patientId(), true);
        Map<String,Object> params = new HashMap<>(params(context, request.patientId()));
        params.put("actor", actor.id()); params.put("request", request.requestId()); params.put("id", recommendation);
        Optional<Map<String,Object>> already = sql.one("select recommendation_id,action,reason,reason_code,clinical_note,modified_recommendation,review_version,evidence_fingerprint from predictive_clinician_feedback where hospital_id=:h and patient_id=:p and actor_id=:actor and request_id=:request", params);
        if (already.isPresent()) {
            Map<String,Object> saved = already.get();
            if (!recommendation.equals(saved.get("recommendation_id")) || !request.action().equals(saved.get("action")) || !reason.equals(saved.get("reason"))
                    || !reasonCode.equals(Objects.toString(saved.get("reason_code"), ""))
                    || !clinicalNote.equals(Objects.toString(saved.get("clinical_note"), ""))
                    || !modified.equals(Objects.toString(saved.get("modified_recommendation"), "")) || !Objects.equals(request.evidenceFingerprint(), saved.get("evidence_fingerprint")))
                throw ApiException.conflict("This request UUID was already used for a different review.");
            return Map.of("id", recommendation, "reviewState", saved.get("action"), "version", saved.get("review_version"), "saved", true);
        }
        Finding finding = context.analysis().findings().stream().filter(f -> findingId(context, request.patientId(), f).equals(recommendation)).findFirst()
                .orElseThrow(() -> ApiException.conflict("Evidence has changed. Refresh the workspace before reviewing this finding."));
        if (!Objects.equals(finding.evidenceFingerprint(), request.evidenceFingerprint())) throw ApiException.conflict("Evidence has changed. Refresh the workspace before reviewing this finding.");
        params.put("key", finding.key()); params.put("rule", RULE_VERSION); params.put("fingerprint", finding.evidenceFingerprint()); params.put("snapshot", json.write(finding));
        sql.update("""
                insert into predictive_recommendations(id,hospital_id,patient_id,rule_key,rule_version,evidence_fingerprint,finding_snapshot)
                values(:id,:h,:p,:key,:rule,:fingerprint,cast(:snapshot as jsonb)) on conflict do nothing
                """, params);
        params.put("version", request.expectedVersion()); params.put("action", request.action()); params.put("reason", reason);
        params.put("reasonCode", reasonCode); params.put("clinicalNote", clinicalNote); params.put("modified", modified);
        int updated = sql.update("""
                update predictive_recommendations set review_state=:action,reviewed_by=:actor,reviewed_at=now(),updated_at=now(),version=version+1
                where id=:id and hospital_id=:h and patient_id=:p and version=:version and evidence_fingerprint=:fingerprint
                """, params);
        if (updated != 1) throw ApiException.conflict("Another clinician has reviewed this finding. Refresh before saving.");
        sql.update("""
                insert into predictive_clinician_feedback(hospital_id,patient_id,recommendation_id,actor_id,request_id,action,reason,reason_code,clinical_note,modified_recommendation,evidence_fingerprint,review_version)
                values(:h,:p,:id,:actor,:request,:action,:reason,:reasonCode,:clinicalNote,:modified,:fingerprint,:version+1)
                """, params);
        List<String> resources = persistReviewFhir(actor, context, request.patientId(), recommendation, request.action(), reason, reasonCode, clinicalNote, modified, finding);
        audit(actor, context, request.patientId(), "RECOMMENDATION_REVIEW", recommendation,
                Map.of("action", request.action(), "reasonCode", reasonCode, "ruleVersion", RULE_VERSION,
                        "evidenceFingerprint", finding.evidenceFingerprint(), "fhirResources", resources));
        return Map.of("id", recommendation, "reviewState", request.action(), "version", request.expectedVersion()+1, "saved", true);
    }

    private Context load(GovCarePrincipal actor, UUID patient, boolean write) {
        var loaded=longitudinal.load(actor,patient,write);
        return new Context(loaded.scoped(),loaded.patient(),loaded.analysis(),loaded.truncated(),loaded.medications(),loaded.birthDate());
    }

    private Map<String,Object> forecastRow(Map<String,Object> row) {
        Map<String,Object> response = new LinkedHashMap<>();
        response.put("id", row.get("id"));
        response.put("horizon_months", row.get("horizon_months"));
        response.put("status", row.get("status"));
        response.put("explanation", row.get("explanation"));
        response.put("created_at", row.get("created_at"));
        String raw = text(row.get("outputs_json"));
        try { response.put("outputs", raw == null ? List.of() : mapper.readValue(raw, Object.class)); }
        catch (Exception ex) { response.put("outputs", List.of()); }
        return response;
    }

    private List<RiskCapability> riskCapabilities(Context context) {
        Analysis analysis = context.analysis();
        Map<String, Trend> trends = new HashMap<>();
        for (Trend t : analysis.trends()) trends.put(t.metric(), t);
        List<RiskCapability> risks = new ArrayList<>();

        List<String> progressionInputs = List.of("dated_egfr_series", "creatinine", "date_of_birth");
        boolean progressionActive = sql.one("""
                select id from predictive_model_registry
                where model_key='egfr_trajectory' and version=:version and runtime_status='ACTIVE'
                """, Map.of("version", CkdProgressionForecastService.MODEL_VERSION)).isPresent();
        if (progressionActive) {
            CkdProgressionForecastService.Forecast progression = ckdForecast.calculate(analysis, 12, context.truncated());
            risks.add(new RiskCapability("ckd_progression", "CKD progression trajectory", progression.status(), progression.explanation(),
                    null, progression.modelVersion(), "Patient-specific eGFR trajectory; not a population disease probability.",
                    progression.method(), progression.validationStatus(), "3 / 6 / 12 months", progression.trendSeverity(),
                    progression.reliability(), "Patient-specific eGFR projection", progression.localValidationStatus(), "ACTIVE",
                    progressionInputs, missingInputs(context, List.of("egfr", "creatinine", "date_of_birth")),
                    List.of("Adult eligibility only"), "Ordinary least squares with Student-t prediction intervals; GovCare renal safety policy v2",
                    analysis.generatedAt(), null));
        } else {
            risks.add(new RiskCapability("ckd_progression", "CKD progression trajectory", "NOT_INSTALLED",
                    "The governed eGFR trajectory runtime is not active; no projection was calculated.", null,
                    CkdProgressionForecastService.MODEL_VERSION,
                    "Patient-specific eGFR trajectory; not a population disease probability.",
                    CkdProgressionForecastService.METHOD, CkdProgressionForecastService.VALIDATION_STATUS,
                    "3 / 6 / 12 months", null, null, "Patient-specific eGFR projection",
                    CkdProgressionForecastService.LOCAL_VALIDATION_STATUS, "NOT_INSTALLED", progressionInputs,
                    missingInputs(context, List.of("egfr", "creatinine", "date_of_birth")), List.of("Adult eligibility only"),
                    "Ordinary least squares with Student-t prediction intervals; GovCare renal safety policy v2",
                    analysis.generatedAt(), null));
        }

        Map<String,Object> kfre = kidneyFailureRisk.calculate(Map.of());
        risks.add(new RiskCapability("kfre", "Kidney failure", String.valueOf(kfre.get("status")),
                String.valueOf(kfre.get("reason")), null, kidneyFailureRisk.getModelVersion(),
                "2-year / 5-year kidney failure risk when a reviewed validated equation adapter is installed.",
                "VALIDATED_EQUATION", kidneyFailureRisk.getValidationStatus(), kidneyFailureRisk.getForecastHorizon(), null, null,
                kidneyFailureRisk.getModelName(), kidneyFailureRisk.getLocalValidationStatus(), kidneyFailureRisk.getRuntimeStatus(),
                kidneyFailureRisk.getRequiredInputs(), missingInputs(context, kidneyFailureRisk.getRequiredInputs()),
                kidneyFailureRisk.getApplicableCkdStages(), kidneyFailureRisk.getReference(), analysis.generatedAt(), null));

        String akiStatus = Set.of("POSSIBLE_AKI", "RAPID_RENAL_CHANGE").contains(analysis.safety().status()) ? "REVIEW_REQUIRED"
                : analysis.safety().forecastSuppressed() ? "INSUFFICIENT_DATA" : "NO_CURRENT_TRIGGER";
        Trend creatinine = trends.get("creatinine");
        Observation currentCreatinine = creatinine == null ? null : creatinine.latest();
        Observation previousCreatinine = creatinine == null ? null : creatinine.previous();
        String akiReason = analysis.safety().reasons().isEmpty()
                ? "No current laboratory AKI trigger was generated by the renal safety gate. This is not a future AKI probability."
                : String.join(" ", analysis.safety().reasons());
        MonitoringSignal akiSignal = new MonitoringSignal(akiStatus, analysis.safety().status(), akiReason,
                currentCreatinine == null ? null : currentCreatinine.value(), previousCreatinine == null ? null : previousCreatinine.value(),
                currentCreatinine == null ? "mg/dL" : currentCreatinine.unit(), creatinine == null ? "UNAVAILABLE" : creatinine.trendDirection(),
                creatinine == null ? "MISSING" : creatinine.dataFreshness(), analysis.safety().reasons(),
                Set.of("POSSIBLE_AKI", "RAPID_RENAL_CHANGE").contains(analysis.safety().status())
                        ? "Review acute illness, volume status, renal function and medication context before long-term forecasting."
                        : "Continue clinical surveillance appropriate to the patient's context.",
                creatinine == null ? List.of() : creatinine.observations().stream().map(Observation::id).toList());
        risks.add(new RiskCapability("aki", "AKI safety", akiStatus,
                akiReason,
                null, RULE_VERSION, "Current renal safety review signal, distinct from future AKI prediction.",
                "RULE_BASED", "CLINICAL_RULE_NOT_PROBABILITY", "Current data", analysis.safety().status(), null,
                "GovCare renal safety gate", "NOT_LOCALLY_VALIDATED", "ACTIVE", List.of("creatinine", "egfr", "clinical_context"),
                missingInputs(context, List.of("creatinine", "egfr")), List.of("Adults"), analysis.safety().source(), analysis.generatedAt(), akiSignal));

        MonitoringSignal potassium = hyperkalemiaRisk.calculate(analysis, context.medications().classes(), context.medications().recorded());
        risks.add(new RiskCapability("hyperkalemia", "Hyperkalemia monitoring", potassium.status(), potassium.reason(), null,
                HyperkalemiaRiskService.VERSION, "Current potassium trend and medication-context review; no future probability.",
                "RULE_BASED", "CLINICAL_RULE_NOT_PROBABILITY", "Current data", potassium.category(), null,
                "GovCare potassium monitoring rules", "NOT_LOCALLY_VALIDATED", "ACTIVE", List.of("potassium", "medication_context"),
                missingInputs(context, List.of("potassium", "medication_context")), List.of("Adults"), HyperkalemiaRiskService.REFERENCE,
                analysis.generatedAt(), potassium));

        MonitoringSignal hemoglobin = anemiaRisk.calculate(analysis, text(context.patient().get("gender")), context.birthDate());
        risks.add(new RiskCapability("anemia", "Anemia review signal", hemoglobin.status(), hemoglobin.reason(), null,
                AnemiaRiskService.VERSION, "Hemoglobin and kidney-context review; not a confirmed CKD-anemia diagnosis.",
                "RULE_BASED", "CLINICAL_RULE_NOT_PROBABILITY", "Current data", hemoglobin.category(), null,
                "GovCare adult anemia review rules", "NOT_LOCALLY_VALIDATED", "ACTIVE", List.of("hemoglobin", "egfr", "date_of_birth"),
                missingInputs(context, List.of("hemoglobin", "egfr", "date_of_birth")), List.of("Adults"), AnemiaRiskService.REFERENCE,
                analysis.generatedAt(), hemoglobin));

        Map<String,Object> cardiovascular = cardiovascularRisk.calculate(Map.of());
        risks.add(new RiskCapability("cardiovascular", "Cardiovascular risk", String.valueOf(cardiovascular.get("status")),
                String.valueOf(cardiovascular.get("reason")), null, cardiovascularRisk.getModelVersion(),
                "Future reviewed cardiovascular risk equation adapter; no probability is currently calculated.",
                "VALIDATED_EQUATION", cardiovascularRisk.getValidationStatus(), cardiovascularRisk.getForecastHorizon(), null, null,
                cardiovascularRisk.getModelName(), cardiovascularRisk.getLocalValidationStatus(), cardiovascularRisk.getRuntimeStatus(),
                cardiovascularRisk.getRequiredInputs(), missingInputs(context, cardiovascularRisk.getRequiredInputs()),
                cardiovascularRisk.getApplicableCkdStages(), cardiovascularRisk.getReference(), analysis.generatedAt(), null));
        return List.copyOf(risks);
    }

    private static List<String> missingInputs(Context context, List<String> required) {
        Set<String> missingMetrics = new HashSet<>(context.analysis().quality().missingMetrics());
        List<String> missing = new ArrayList<>();
        for (String input : required) {
            String normalized = switch (input) {
                case "dated_egfr_series" -> "egfr";
                case "age" -> "date_of_birth";
                default -> input;
            };
            boolean absent = switch (normalized) {
                case "date_of_birth" -> context.birthDate() == null;
                case "sex" -> text(context.patient().get("gender")) == null;
                case "medication_context" -> !context.medications().recorded();
                case "smoking_status", "diabetes_status", "treatment_context" -> true;
                default -> missingMetrics.contains(normalized);
            };
            if (absent) missing.add(input);
        }
        return List.copyOf(missing);
    }

    private void persistForecastFhir(GovCarePrincipal actor, Context context, UUID patient, UUID snapshotId,
                                     CkdProgressionForecastService.Forecast forecast) {
        String id = UUID.randomUUID().toString();
        Map<String,Object> body = new LinkedHashMap<>();
        body.put("resourceType", "RiskAssessment");
        body.put("id", id);
        body.put("status", "final");
        body.put("subject", Map.of("reference", ensurePatientReference(context, patient)));
        body.put("occurrenceDateTime", forecast.forecastOriginDate().toString());
        body.put("method", Map.of("text", "GovCare patient-specific eGFR trend projection " + forecast.modelVersion()));
        body.put("prediction", List.of(Map.of(
                "outcome", Map.of("text", "Projected eGFR at " + forecast.horizonMonths() + " months; not an observed laboratory result"),
                "whenPeriod", Map.of("start", forecast.forecastOriginDate().toString(), "end", forecast.forecastDate().toString()))));
        body.put("note", List.of(Map.of("text", forecast.explanation())));
        List<Map<String,Object>> extensions = new ArrayList<>();
        extensions.add(Map.of("url","urn:govcare:forecast-method","valueCode",forecast.method()));
        extensions.add(Map.of("url","urn:govcare:forecast-horizon-months","valueInteger",forecast.horizonMonths()));
        extensions.add(Map.of("url","urn:govcare:model-version","valueString",forecast.modelVersion()));
        extensions.add(Map.of("url","urn:govcare:validation-status","valueString",forecast.validationStatus()));
        extensions.add(Map.of("url","urn:govcare:local-validation-status","valueString",forecast.localValidationStatus()));
        extensions.add(Map.of("url","urn:govcare:forecast-reliability","valueCode",forecast.reliability()));
        extensions.add(Map.of("url","urn:govcare:interval-method","valueString",forecast.intervalMethod()));
        extensions.add(quantityExtension("urn:govcare:current-egfr", forecast.currentEgfr()));
        if (forecast.projectedEgfr() != null) extensions.add(quantityExtension("urn:govcare:projected-egfr", forecast.projectedEgfr()));
        if (forecast.projectedEgfrLow() != null) extensions.add(quantityExtension("urn:govcare:projected-egfr-low", forecast.projectedEgfrLow()));
        if (forecast.projectedEgfrHigh() != null) extensions.add(quantityExtension("urn:govcare:projected-egfr-high", forecast.projectedEgfrHigh()));
        body.put("extension", extensions);
        storeFhir(context, patient, "RiskAssessment", id, json.write(body));

        Provenance provenance = new Provenance();
        String provenanceId = UUID.randomUUID().toString();
        provenance.setId(provenanceId);
        provenance.addTarget(new Reference("RiskAssessment/"+id));
        provenance.setRecorded(java.util.Date.from(Instant.now()));
        provenance.addAgent().setWho(new Reference().setIdentifier(new Identifier().setSystem("urn:govcare:user").setValue(actor.id().toString())));
        provenance.addEntity().setRole(Provenance.ProvenanceEntityRole.SOURCE)
                .setWhat(new Reference().setIdentifier(new Identifier().setSystem("urn:govcare:predictive-snapshot").setValue(snapshotId.toString())));
        storeFhir(context, patient, "Provenance", provenanceId, fhir.newJsonParser().encodeResourceToString(provenance));
    }

    private List<ReviewedFinding> recommendations(Context context, UUID patient) {
        List<Finding> findings = context.analysis().findings(); if (findings.isEmpty()) return List.of();
        Map<String,Object> params = new HashMap<>(params(context,patient)); params.put("ids",findings.stream().map(f -> findingId(context,patient,f)).toList());
        Map<UUID,Map<String,Object>> saved = new HashMap<>();
        for (Map<String,Object> row : sql.list("""
                select r.id,r.review_state,r.version,r.reviewed_at,f.reason,f.reason_code,f.clinical_note,f.modified_recommendation
                from predictive_recommendations r left join predictive_clinician_feedback f on f.recommendation_id=r.id
                  and f.hospital_id=:h and f.patient_id=:p and f.review_version=r.version
                where r.hospital_id=:h and r.patient_id=:p and r.id in (:ids)
                """,params)) saved.put((UUID)row.get("id"),row);
        return findings.stream().map(f -> { UUID id=findingId(context,patient,f); Map<String,Object> row=saved.get(id);
            return new ReviewedFinding(id,f,row==null?"AWAITING_REVIEW":text(row.get("review_state")),row==null?0:((Number)row.get("version")).intValue(),
                    row==null?null:text(row.get("reason")), row==null?null:text(row.get("reason_code")),
                    row==null?null:text(row.get("clinical_note")), row==null?null:text(row.get("modified_recommendation")),
                    row==null?null:instant(row.get("reviewed_at"))); }).toList();
    }

    private List<String> persistReviewFhir(GovCarePrincipal actor, Context context, UUID patient, UUID recommendation,
                                          String action, String reason, String reasonCode, String clinicalNote,
                                          String modified, Finding finding) {
        String patientReference = ensurePatientReference(context,patient);
        String id=UUID.randomUUID().toString(); ClinicalImpression impression=new ClinicalImpression(); impression.setId(id);
        impression.setStatus(ClinicalImpression.ClinicalImpressionStatus.COMPLETED); impression.setSubject(new Reference(patientReference));
        impression.setDate(java.util.Date.from(Instant.now())); impression.setDescription("Clinician review of GovCare longitudinal rule "+finding.key()+" ("+RULE_VERSION+")");
        impression.setSummary("Action: "+action+". Reason code: "+reasonCode+". Reason: "+reason
                +(clinicalNote.isBlank()?"":". Clinical note: "+clinicalNote)
                +(modified.isBlank()?"":". Modified recommendation: "+modified));
        impression.addNote().setText("Decision support finding; no diagnosis, medication order or referral is created. Evidence fingerprint: "+finding.evidenceFingerprint());
        storeFhir(context,patient,"ClinicalImpression",id,fhir.newJsonParser().encodeResourceToString(impression));
        Provenance provenance=new Provenance(); String provenanceId=UUID.randomUUID().toString(); provenance.setId(provenanceId);
        provenance.addTarget(new Reference("ClinicalImpression/"+id)); provenance.setRecorded(java.util.Date.from(Instant.now()));
        provenance.addAgent().setWho(new Reference().setIdentifier(new Identifier().setSystem("urn:govcare:user").setValue(actor.id().toString())));
        provenance.addEntity().setRole(Provenance.ProvenanceEntityRole.SOURCE).setWhat(new Reference().setIdentifier(new Identifier().setSystem("urn:govcare:recommendation").setValue(recommendation.toString())));
        storeFhir(context,patient,"Provenance",provenanceId,fhir.newJsonParser().encodeResourceToString(provenance));
        return List.of("ClinicalImpression/"+id,"Provenance/"+provenanceId);
    }

    private void updateMonitoring(Context context, Map<String,Object> model,
                                  CkdProgressionForecastService.Forecast forecast, long elapsedMs) {
        Map<String,Object> values = new HashMap<>();
        values.put("h", context.scoped().hospitalId()); values.put("model", model.get("id"));
        values.put("elapsed", elapsedMs); values.put("missing",
                context.analysis().quality().expectedMetricCount() == 0 ? 1.0
                        : (double) context.analysis().quality().missingMetrics().size() / context.analysis().quality().expectedMetricCount());
        values.put("status", forecast.status()); values.put("version", forecast.modelVersion());
        sql.update("""
                insert into predictive_model_monitoring(hospital_id,model_id,prediction_count,failure_count,latency_total_ms,
                  input_missing_rate,risk_distribution,model_version,data_drift_status)
                values(:h,:model,1,0,:elapsed,:missing,jsonb_build_object(cast(:status as text),1),:version,'NOT_EVALUATED')
                on conflict(hospital_id,model_id,monitoring_date) do update set
                  prediction_count=predictive_model_monitoring.prediction_count+1,
                  latency_total_ms=predictive_model_monitoring.latency_total_ms+excluded.latency_total_ms,
                  input_missing_rate=((predictive_model_monitoring.input_missing_rate*predictive_model_monitoring.prediction_count)+excluded.input_missing_rate)
                    /(predictive_model_monitoring.prediction_count+1),
                  risk_distribution=jsonb_set(
                    predictive_model_monitoring.risk_distribution,
                    array[cast(:status as text)],
                    to_jsonb(coalesce((predictive_model_monitoring.risk_distribution ->> cast(:status as text))::bigint,0)+1),
                    true),
                  model_version=excluded.model_version,updated_at=now()
                """, values);
    }

    private static Map<String,Object> quantityExtension(String url, Double value) {
        return Map.of("url", url, "valueQuantity", Map.of(
                "value", value, "unit", "mL/min/1.73m2", "system", "http://unitsofmeasure.org", "code", "mL/min/{1.73_m2}"));
    }

    private String ensurePatientReference(Context context,UUID patient) {
        String patientReference=sql.one("select resource_id from fhir_resource where hospital_id=:h and patient_id=:p and resource_type='Patient' order by updated_date desc limit 1",params(context,patient))
                .map(row -> "Patient/"+row.get("resource_id")).orElse(null);
        if (patientReference == null) {
            String patientResourceId="patient-"+patient;
            Map<String,Object> identity=context.patient().isEmpty()?sql.required("select patient_no,full_name from patients where id=:p and hospital_id=:h and status<>'deleted'",params(context,patient),"Patient not found."):context.patient();
            Patient resource=new Patient(); resource.setId(patientResourceId);
            resource.addIdentifier().setSystem("urn:govcare:patient-number").setValue(text(identity.get("patient_no")));
            resource.addName().setText(text(identity.get("full_name")));
            Map<String,Object> patientParams=new HashMap<>(params(context,patient)); patientParams.put("rid",patientResourceId); patientParams.put("body",fhir.newJsonParser().encodeResourceToString(resource));
            sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values('Patient',:rid,:p,:h,cast(:body as jsonb)) on conflict(hospital_id,resource_type,resource_id) do nothing",patientParams);
            patientReference="Patient/"+patientResourceId;
        }
        return patientReference;
    }

    private void storeFhir(Context context,UUID patient,String type,String id,String content) {
        Map<String,Object> params=new HashMap<>(params(context,patient)); params.put("type",type); params.put("id",id); params.put("content",content);
        sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values(:type,:id,:p,:h,cast(:content as jsonb))",params);
    }
    private void audit(GovCarePrincipal actor, Context context, UUID patient, String event, UUID resource, Map<String,Object> metadata) {
        Map<String,Object> params=new HashMap<>(params(context,patient)); params.put("actor",actor.id()); params.put("event",event); params.put("resource",resource); params.put("metadata",json.write(metadata));
        // Deliberately fail closed: audit storage errors roll back clinical review and FHIR write-back.
        sql.update("insert into predictive_audit_events(hospital_id,patient_id,actor_id,event_type,resource_id,metadata) values(:h,:p,:actor,:event,:resource,cast(:metadata as jsonb))",params);
    }
    private static UUID findingId(Context context,UUID patient,Finding finding) { return UUID.nameUUIDFromBytes((context.scoped().hospitalId()+"|"+patient+"|"+finding.key()+"|"+finding.evidenceFingerprint()).getBytes(StandardCharsets.UTF_8)); }
    private static Map<String,Object> params(Context context,UUID patient) { return Map.of("h",context.scoped().hospitalId(),"p",patient); }
    private static String text(Object o) { return o==null?null:String.valueOf(o); }
    private static Double number(Object o) { return o instanceof Number n?n.doubleValue():null; }
    private static Instant instant(Object o) { if(o==null)return null; if(o instanceof java.sql.Timestamp t)return t.toInstant(); if(o instanceof OffsetDateTime t)return t.toInstant(); if(o instanceof Instant t)return t; try{return Instant.parse(String.valueOf(o));}catch(RuntimeException e){return null;} }
    private static String iso(Object o) { Instant t=instant(o);return t==null?null:t.toString(); }
    private static Double referenceLimit(JsonNode q,String unit) { return !q.has("comparator") && q.path("value").isNumber() && Objects.equals(unit,q.path("code").asText(q.path("unit").asText(null)))?q.path("value").doubleValue():null; }
}
