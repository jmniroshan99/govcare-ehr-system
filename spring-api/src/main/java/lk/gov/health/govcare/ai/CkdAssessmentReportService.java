package lk.gov.health.govcare.ai;

import ca.uhn.fhir.context.FhirContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.Image;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfWriter;
import com.lowagie.text.pdf.PdfTemplate;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.ai.predictive.CkdProgressionForecastService;
import lk.gov.health.govcare.documents.DocumentStorageService;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.hl7.fhir.r4.model.Attachment;
import org.hl7.fhir.r4.model.CodeType;
import org.hl7.fhir.r4.model.DocumentReference;
import org.hl7.fhir.r4.model.Enumerations;
import org.hl7.fhir.r4.model.Identifier;
import org.hl7.fhir.r4.model.Provenance;
import org.hl7.fhir.r4.model.Reference;
import org.hl7.fhir.r4.model.StringType;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class CkdAssessmentReportService {
    private static final FhirContext FHIR = FhirContext.forR4Cached();
    private static final Color TEAL = new Color(10, 92, 88);
    private static final Color LIGHT_TEAL = new Color(230, 246, 244);
    private static final Color LIGHT_GRAY = new Color(244, 246, 248);
    private static final Color RED = new Color(176, 43, 55);
    private static final Color ORANGE = new Color(204, 103, 27);
    private static final Color AMBER = new Color(179, 126, 12);
    private static final Color GREEN = new Color(36, 125, 82);

    private final SqlSupport sql;
    private final DocumentStorageService storage;
    private final lk.gov.health.govcare.security.ClinicalPatientAccess access;
    private final CkdPredictionService predictions;
    private final PredictiveIntelligenceService intelligence;
    private final SriLankanRenalIntelligenceService renalIntelligence;
    private final RenalClinicalModuleService renalModules;
    private final CkdOutlookService outlook;

    @Autowired
    public CkdAssessmentReportService(SqlSupport sql, DocumentStorageService storage,
                                      lk.gov.health.govcare.security.ClinicalPatientAccess access,
                                      CkdPredictionService predictions, PredictiveIntelligenceService intelligence,
                                      SriLankanRenalIntelligenceService renalIntelligence, RenalClinicalModuleService renalModules,
                                      CkdOutlookService outlook) {
        this.outlook = outlook;
        this.renalModules = renalModules;
        this.sql = sql; this.storage = storage; this.access = access; this.predictions = predictions;
        this.intelligence = intelligence;
        this.renalIntelligence = renalIntelligence;
    }

    public CkdAssessmentReportService(SqlSupport sql, DocumentStorageService storage,
            lk.gov.health.govcare.security.ClinicalPatientAccess access, CkdPredictionService predictions,
            PredictiveIntelligenceService intelligence, SriLankanRenalIntelligenceService renalIntelligence,
            RenalClinicalModuleService renalModules) {
        this(sql, storage, access, predictions, intelligence, renalIntelligence, renalModules, null);
    }

    public CkdAssessmentReportService(SqlSupport sql, DocumentStorageService storage,
            lk.gov.health.govcare.security.ClinicalPatientAccess access, CkdPredictionService predictions,
            PredictiveIntelligenceService intelligence, SriLankanRenalIntelligenceService renalIntelligence) {
        this(sql, storage, access, predictions, intelligence, renalIntelligence, null);
    }

    /** Existing report integrations retain their constructor contract. */
    public CkdAssessmentReportService(SqlSupport sql, DocumentStorageService storage,
                                      lk.gov.health.govcare.security.ClinicalPatientAccess access,
                                      CkdPredictionService predictions, PredictiveIntelligenceService intelligence) {
        this(sql, storage, access, predictions, intelligence, null);
    }

    /** Compatibility constructor for isolated PDF and authorization tests. */
    public CkdAssessmentReportService(SqlSupport sql, DocumentStorageService storage, lk.gov.health.govcare.security.ClinicalPatientAccess access, CkdPredictionService predictions) {
        this.sql = sql; this.storage = storage; this.access = access; this.predictions = predictions;
        this.intelligence = null;
        this.renalIntelligence = null;
        this.renalModules = null;
        this.outlook = null;
    }

    @Transactional
    public Map<String, Object> generate(GovCarePrincipal actor, UUID assessmentId) throws IOException {
        return generate(actor,assessmentId,null,null);
    }
    @Transactional
    public Map<String,Object> generate(GovCarePrincipal actor,UUID assessmentId,UUID clinicalSnapshotId,UUID outlookSnapshotId)throws IOException{
        return generate(actor,assessmentId,clinicalSnapshotId,outlookSnapshotId,false);
    }
    @Transactional
    public Map<String,Object> generate(GovCarePrincipal actor,UUID assessmentId,UUID clinicalSnapshotId,UUID outlookSnapshotId,boolean technicalAppendix)throws IOException{
        actor = predictions.assessmentScope(actor, assessmentId, true);
        Map<String, Object> m = sql.required("""
            select p.id::text,p.patient_id::text patient_id,p.probability,p.risk_category,p.confidence,
                   p.model_version,p.created_at,p.disease_probability_snapshot,pt.patient_no,pt.full_name,pt.date_of_birth,pt.gender::text,
                   a.suggested_ckd_g_category,a.suggested_ckd_stage,a.suggested_icd_code,a.suggested_icd_system,
                   a.suggested_icd_display,a.coding_status,a.coding_basis,a.review_status,
                   h.name hospital_name,d.name department_name,u.full_name clinician_name
              from ai_ckd_predictions p
              join patients pt on pt.id=p.patient_id
              left join ai_assessments a on a.id=p.id
              left join hospitals h on h.id=p.hospital_id
              left join app_users u on u.id=p.created_by
              left join departments d on d.id=u.department_id and d.hospital_id=p.hospital_id
             where p.id=:id and p.hospital_id=:h
            """, Map.of("id", assessmentId, "h", actor.hospitalId()), "CKD assessment not found.");

        UUID patient = UUID.fromString(String.valueOf(m.get("patient_id")));
        access.requireClinicalWrite(actor, patient);
        m=new LinkedHashMap<>(m);boolean synthetic=ClinicalTestPatientPolicy.synthetic(sql,actor,patient);m.put("synthetic",synthetic);
        List<Map<String, Object>> inputs = sql.list("""
            select i.feature_key,i.value_numeric,i.value_text,i.unit,i.source_type,i.manual_override,i.source_metadata,
                   o.coding_system,o.code,o.extraction_confidence,r.original_filename source_report
              from ai_assessment_inputs i
              left join clinical_observations o on o.id=i.observation_id
              left join clinical_reports r on r.id=i.source_report_id
             where i.assessment_id=:a order by i.created_at,i.feature_key
            """, Map.of("a", assessmentId));
        List<Map<String, Object>> factors = sql.list("""
            select feature_key,display_name,input_value,unit,contribution_direction,contribution_value,explanation
              from ai_assessment_factors where assessment_id=:a order by abs(coalesce(contribution_value,0)) desc
            """, Map.of("a", assessmentId));
        List<Map<String, Object>> recommendations = sql.list("""
            select sequence_no,recommendation_text from ai_assessment_recommendations
             where assessment_id=:a order by sequence_no
            """, Map.of("a", assessmentId));

        PredictiveIntelligenceService.Overview predictive = intelligence == null ? null : intelligence.overview(actor, patient);
        Map<Integer,CkdProgressionForecastService.Forecast> forecasts = intelligence == null ? Map.of() : intelligence.reportForecasts(actor, patient);
        SriLankanRenalIntelligenceService.Overview renalOverview = renalIntelligence == null ? null : renalIntelligence.reportOverview(actor, patient);
        List<SriLankanRenalIntelligenceService.PredictionView> renalPredictions = renalOverview == null ? List.of() : renalOverview.predictions();
        JsonNode moduleSnapshot = renalModules == null ? null : clinicalSnapshotId==null?renalModules.assessmentReportSnapshot(actor, patient, assessmentId):renalModules.selectedReportSnapshot(actor,patient,assessmentId,clinicalSnapshotId);
        JsonNode outlookSnapshot = outlook == null ? null : outlookSnapshotId==null?outlook.storedForReport(actor, patient):outlook.selectedForReport(actor,patient,outlookSnapshotId);
        byte[] bytes = CkdConciseReportPdf.render(m,inputs,factors,recommendations,assessmentId,moduleSnapshot,technicalAppendix);
        String filename = "govcare-ckd-" + m.get("patient_no") + "-" + assessmentId + ".pdf";
        DocumentStorageService.StoredFile f = storage.storeBytes(actor.hospitalId(), patient, "OTHER_CLINICAL_DOCUMENT", bytes, filename, "application/pdf");

        UUID document = UUID.randomUUID();
        Map<String, Object> dp = new HashMap<>();
        dp.put("id", document); dp.put("h", actor.hospitalId()); dp.put("p", patient); dp.put("dep", actor.departmentId());
        dp.put("title", "CKD AI Clinical Decision Support Report"); dp.put("file", f.fileName()); dp.put("original", f.originalFileName());
        dp.put("size", f.size()); dp.put("key", f.storageKey()); dp.put("sha", f.checksum()); dp.put("actor", actor.id());
        sql.update("insert into patient_documents(id,hospital_id,patient_id,source_department_id,document_type,title,description,file_name,original_file_name,mime_type,file_size_bytes,storage_key,sha256_checksum,document_status,patient_release_status,visibility_level,created_by) values(:id,:h,:p,:dep,'OTHER_CLINICAL_DOCUMENT',:title,'Structured CKD AI assessment with coding assistance; clinician review required',:file,:original,'application/pdf',:size,:key,:sha,'SUBMITTED','NOT_RELEASED','CARE_TEAM',:actor)", dp);
        if(synthetic)sql.update("update patient_documents set document_classification='TEST_DOCUMENT' where id=:id and hospital_id=:h and patient_id=:p",dp);

        Map<String, Object> gp = new HashMap<>();
        gp.put("h", actor.hospitalId()); gp.put("p", patient); gp.put("a", assessmentId); gp.put("d", document); gp.put("file", filename);
        gp.put("key", f.storageKey()); gp.put("sha", f.checksum()); gp.put("actor", actor.id());
        Map<String, Object> saved = sql.required("insert into generated_reports(hospital_id,patient_id,assessment_id,patient_document_id,report_type,file_name,storage_key,sha256_hash,generated_by) values(:h,:p,:a,:d,'CKD_AI_PDF',:file,:key,:sha,:actor) returning id::text,report_uuid::text \"reportUuid\",generated_at \"generatedAt\"", gp, "Unable to save generated CKD report.");

        String fhirId = "ckd-document-" + saved.get("id");
        DocumentReference documentReference = new DocumentReference();
        documentReference.setId(fhirId);
        documentReference.setStatus(Enumerations.DocumentReferenceStatus.CURRENT);
        documentReference.setSubject(new Reference("Patient/patient-" + patient));
        documentReference.setDescription("GovCare structured CKD AI clinical decision support report");
        documentReference.getMeta().addTag().setSystem("urn:govcare:document-classification").setCode(synthetic?"TEST_DOCUMENT":"CLINICAL_DOCUMENT");
        documentReference.addContent().setAttachment(new Attachment().setContentType("application/pdf").setTitle(filename));
        documentReference.addExtension().setUrl("urn:govcare:forecast-method").setValue(new CodeType("TREND_PROJECTION"));
        documentReference.addExtension().setUrl("urn:govcare:model-version").setValue(new StringType(CkdProgressionForecastService.MODEL_VERSION));
        documentReference.addExtension().setUrl("urn:govcare:validation-status").setValue(new StringType(CkdProgressionForecastService.VALIDATION_STATUS));
        documentReference.addExtension().setUrl("urn:govcare:local-validation-status").setValue(new StringType(CkdProgressionForecastService.LOCAL_VALIDATION_STATUS));
        String fhirJson = FHIR.newJsonParser().encodeResourceToString(documentReference);
        sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values('DocumentReference',:id,:p,:h,cast(:j as jsonb)) on conflict(hospital_id,resource_type,resource_id) do update set json_data=excluded.json_data,updated_date=now()", Map.of("id", fhirId, "p", patient, "h", actor.hospitalId(), "j", fhirJson));
        String provenanceId = "ckd-document-provenance-" + saved.get("id");
        Provenance provenance = new Provenance();
        provenance.setId(provenanceId);
        provenance.addTarget(new Reference("DocumentReference/" + fhirId));
        provenance.setRecorded(java.util.Date.from(Instant.now()));
        provenance.addAgent().setWho(new Reference().setIdentifier(
                new Identifier().setSystem("urn:govcare:user").setValue(actor.id().toString())));
        provenance.addEntity().setRole(Provenance.ProvenanceEntityRole.SOURCE).setWhat(new Reference().setIdentifier(
                new Identifier().setSystem("urn:govcare:predictive-method")
                        .setValue("TREND_PROJECTION|" + CkdProgressionForecastService.MODEL_VERSION)));
        for (var renal : renalPredictions) provenance.addEntity().setRole(Provenance.ProvenanceEntityRole.SOURCE)
                .setWhat(new Reference("RiskAssessment/" + renal.id()));
        if (moduleSnapshot != null) provenance.addEntity().setRole(Provenance.ProvenanceEntityRole.SOURCE)
                .setWhat(new Reference("ClinicalImpression/" + moduleSnapshot.path("snapshotId").asText()));
        String provenanceJson = FHIR.newJsonParser().encodeResourceToString(provenance);
        sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values('Provenance',:id,:p,:h,cast(:j as jsonb))", Map.of(
                "id", provenanceId, "p", patient, "h", actor.hospitalId(), "j", provenanceJson));
        sql.update("insert into predictive_audit_events(hospital_id,patient_id,actor_id,event_type,resource_id,metadata) values(:h,:p,:actor,'PDF_GENERATED',:resource,cast(:metadata as jsonb))", Map.of(
                "h", actor.hospitalId(), "p", patient, "actor", actor.id(), "resource", document,
                "metadata", "{\"assessmentId\":\"" + assessmentId + "\",\"method\":\"TREND_PROJECTION\",\"modelVersion\":\""
                        + CkdProgressionForecastService.MODEL_VERSION + "\"}"));

        Map<String, Object> out = new LinkedHashMap<>(saved);
        out.put("patientId", patient.toString()); out.put("assessmentId", assessmentId.toString()); out.put("documentId", document.toString()); out.put("fileName", filename);
        return out;
    }

    public StoredReport content(GovCarePrincipal a, UUID reportId) throws IOException {
        Map<String,Object> lookup = new HashMap<>();
        lookup.put("id", reportId); lookup.put("h", a.hospitalId()); lookup.put("network", access.canAccessNetwork(a));
        var identity = sql.required("select patient_id from generated_reports where id=:id and (:network or hospital_id=:h) and status='ACTIVE'", lookup, "Generated report not found.");
        a = access.clinicalScope(a, (UUID) identity.get("patient_id"), false);
        Map<String, Object> r = sql.required("select id::text,patient_id::text \"patientId\",file_name \"fileName\",storage_key \"storageKey\" from generated_reports where id=:id and hospital_id=:h and status='ACTIVE'", Map.of("id", reportId, "h", a.hospitalId()), "Generated report not found.");
        UUID patient = UUID.fromString(String.valueOf(r.get("patientId")));
        access.requireClinical(a, patient);
        return new StoredReport(storage.resource(String.valueOf(r.get("storageKey"))), String.valueOf(r.get("fileName")));
    }

    public List<Map<String, Object>> list(GovCarePrincipal a, UUID assessment) {
        a = predictions.assessmentScope(a, assessment, false);
        Map<String,Object> row = sql.required("select patient_id from ai_ckd_predictions where id=:a and hospital_id=:h", Map.of("a", assessment, "h", a.hospitalId()), "CKD assessment not found.");
        access.requireClinical(a, (UUID) row.get("patient_id"));
        return sql.list("select id::text,report_uuid::text \"reportUuid\",patient_document_id::text \"documentId\",file_name \"fileName\",generated_at \"generatedAt\",status from generated_reports where hospital_id=:h and assessment_id=:a order by generated_at desc", Map.of("h", a.hospitalId(), "a", assessment));
    }

    static byte[] pdf(Map<String, Object> m, List<Map<String, Object>> inputs, List<Map<String, Object>> factors,
                       List<Map<String, Object>> recommendations, UUID assessmentId) {
        return pdf(m, inputs, factors, recommendations, assessmentId, null, Map.of());
    }

    static byte[] pdf(Map<String, Object> m, List<Map<String, Object>> inputs, List<Map<String, Object>> factors,
                      List<Map<String, Object>> recommendations, UUID assessmentId,
                      PredictiveIntelligenceService.Overview predictive,
                      Map<Integer,CkdProgressionForecastService.Forecast> forecasts) {
        return pdf(m, inputs, factors, recommendations, assessmentId, predictive, forecasts, List.of());
    }

    static byte[] pdf(Map<String, Object> m, List<Map<String, Object>> inputs, List<Map<String, Object>> factors,
                      List<Map<String, Object>> recommendations, UUID assessmentId,
                      PredictiveIntelligenceService.Overview predictive,
                      Map<Integer,CkdProgressionForecastService.Forecast> forecasts,
                      List<SriLankanRenalIntelligenceService.PredictionView> renalPredictions) {
        return pdf(m, inputs, factors, recommendations, assessmentId, predictive, forecasts, renalPredictions, null);
    }

    static byte[] pdf(Map<String, Object> m, List<Map<String, Object>> inputs, List<Map<String, Object>> factors,
                      List<Map<String, Object>> recommendations, UUID assessmentId,
                      PredictiveIntelligenceService.Overview predictive,
                      Map<Integer,CkdProgressionForecastService.Forecast> forecasts,
                      List<SriLankanRenalIntelligenceService.PredictionView> renalPredictions,
                      SriLankanRenalIntelligenceService.Overview renalOverview) {
        return pdf(m, inputs, factors, recommendations, assessmentId, predictive, forecasts, renalPredictions, renalOverview, null);
    }
    static byte[] pdf(Map<String,Object> m, List<Map<String,Object>> inputs, List<Map<String,Object>> factors,
            List<Map<String,Object>> recommendations, UUID assessmentId, PredictiveIntelligenceService.Overview predictive,
            Map<Integer,CkdProgressionForecastService.Forecast> forecasts,
            List<SriLankanRenalIntelligenceService.PredictionView> renalPredictions,
            SriLankanRenalIntelligenceService.Overview renalOverview, JsonNode moduleSnapshot) {
        return pdf(m,inputs,factors,recommendations,assessmentId,predictive,forecasts,renalPredictions,renalOverview,moduleSnapshot,null);
    }

    static byte[] pdf(Map<String,Object> m, List<Map<String,Object>> inputs, List<Map<String,Object>> factors,
            List<Map<String,Object>> recommendations, UUID assessmentId, PredictiveIntelligenceService.Overview predictive,
            Map<Integer,CkdProgressionForecastService.Forecast> forecasts,
            List<SriLankanRenalIntelligenceService.PredictionView> renalPredictions,
            SriLankanRenalIntelligenceService.Overview renalOverview, JsonNode moduleSnapshot, JsonNode outlookSnapshot) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Document d = new Document(PageSize.A4, 38, 38, 56, 48);
            PdfWriter writer = PdfWriter.getInstance(d, out);
            writer.setPageEvent(new FooterEvent(Objects.toString(m.get("patient_no"), "N/A"), assessmentId.toString()));
            d.open();

            title(d, "GOVCARE EHR", 19, TEAL);
            title(d, "CKD AI CLINICAL DECISION SUPPORT REPORT", 14, Color.DARK_GRAY);
            d.add(new Paragraph("Clinical decision support only - clinician review required", font(9, Font.ITALIC, RED)));
            spacer(d, 8);

            section(d, "PATIENT & REPORT DETAILS");
            PdfPTable patient = table(2, new float[]{1.25f, 2.75f});
            row(patient, "Patient", m.get("full_name")); row(patient, "Patient number", m.get("patient_no"));
            row(patient, "DOB", m.get("date_of_birth")); row(patient, "Sex", m.get("gender"));
            row(patient, "Assessment ID", assessmentId); row(patient, "Assessment time", m.get("created_at"));
            row(patient, "Hospital", m.get("hospital_name")); row(patient, "Department", m.get("department_name"));
            row(patient, "Clinician / operator", m.get("clinician_name")); row(patient, "Model", m.get("model_version"));
            d.add(patient); spacer(d, 10);

            section(d, "CKD RISK SUMMARY");
            PdfPTable risk = table(3, new float[]{1,1,1});
            summaryCell(risk, "CKD screening model score", modelScore(m.get("probability")), riskColor(m.get("risk_category")));
            summaryCell(risk, "Risk category", pretty(m.get("risk_category")), riskColor(m.get("risk_category")));
            summaryCell(risk, "Selected-class model score", modelScore(m.get("confidence")), TEAL);
            d.add(risk); spacer(d, 10);


            section(d, "CKD CLASSIFICATION & CLINICAL CODING");
            PdfPTable coding = table(2, new float[]{1.35f, 2.65f});
            row(coding, "Suggested CKD classification", valueOr(m.get("suggested_ckd_stage"), "Unable to classify"));
            row(coding, "G category", valueOr(m.get("suggested_ckd_g_category"), "Not assigned"));
            row(coding, "Suggested ICD code", valueOr(m.get("suggested_icd_code"), "Not assigned"));
            row(coding, "Clinical description", valueOr(m.get("suggested_icd_display"), "Not assigned"));
            row(coding, "Terminology system", valueOr(m.get("suggested_icd_system"), "Not assigned"));
            row(coding, "Basis", valueOr(m.get("coding_basis"), "Reviewed eGFR unavailable"));
            row(coding, "Coding status", valueOr(m.get("coding_status"), "AI-assisted suggestion"));
            row(coding, "Confirmation", "Clinician confirmation required");
            d.add(coding); spacer(d, 6);
            d.add(new Paragraph("A single eGFR result does not independently establish chronic kidney disease or chronicity. N18.6 (ESRD) is not inferred from eGFR alone.", font(8, Font.ITALIC, Color.DARK_GRAY)));
            spacer(d, 10);

            addStageIndicator(d, Objects.toString(m.get("suggested_ckd_g_category"), ""));
            spacer(d, 10);
            section(d, "RENAL & ASSOCIATED FINDINGS");
            PdfPTable findings = table(4, new float[]{1.5f,1f,1f,1.4f});
            headerRow(findings, "Parameter", "Result", "Unit", "Source");
            for (String feature : List.of("GFR","SerumCreatinine","ACR","ProteinInUrine","SystolicBP","DiastolicBP","HbA1c","BMI","SerumElectrolytesPotassium","HemoglobinLevels")) {
                Map<String,Object> in = findInput(inputs, feature); if (in != null) inputRow(findings, in);
            }
            d.add(findings);

            d.newPage();
            addSixRenalModules(d, writer, moduleSnapshot, renalOverview);
            if (predictive != null) {
                d.newPage();
                addPredictiveIntelligence(d, writer, predictive, forecasts);
            }
            if (!renalPredictions.isEmpty()) {
                d.newPage();
                addRenalIntelligence(d, renalPredictions);
            }
            spacer(d, 12);
            section(d, "CLINICAL DATA USED FOR ASSESSMENT");
            PdfPTable all = table(5, new float[]{1.55f,.8f,.75f,1.05f,1.15f});
            headerRow(all, "Parameter", "Result", "Unit", "Source", "Coding");
            for (Map<String,Object> in : inputs) inputRowWithCode(all, in);
            d.add(all); spacer(d, 12);

            section(d, "KEY FACTORS IN THIS MODEL OUTPUT");
            d.add(new Paragraph("Contribution direction describes this model's prediction, not whether a clinical value is healthy, safe or protective.", font(8, Font.ITALIC, Color.DARK_GRAY)));
            spacer(d, 5);
            PdfPTable ft = table(5, new float[]{1.5f,.8f,.75f,1.15f,.9f});
            headerRow(ft, "Factor", "Value", "Unit", "Direction", "Contribution");
            for (Map<String,Object> f : factors) factorRow(ft, f);
            d.add(ft); spacer(d, 12);

            section(d, "RECOMMENDED CLINICAL REVIEW");
            if (recommendations.isEmpty()) d.add(new Paragraph("No recommendation was returned by the prediction service.", font(9, Font.NORMAL, Color.DARK_GRAY)));
            for (Map<String,Object> r : recommendations) {
                d.add(new Paragraph(Objects.toString(r.get("sequence_no"), "") + ".  " + Objects.toString(r.get("recommendation_text"), ""), font(9, Font.NORMAL, Color.DARK_GRAY)));
                spacer(d, 3);
            }

            spacer(d, 10); section(d, "CLINICIAN REVIEW");
            PdfPTable review = table(2, new float[]{1.35f,2.65f});
            row(review, "Suggested classification", valueOr(m.get("suggested_ckd_stage"), "Not assigned"));
            row(review, "Suggested code", valueOr(m.get("suggested_icd_code"), "Not assigned"));
            row(review, "Coding decision", "[ ] Confirm     [ ] Modify     [ ] Reject");
            row(review, "Final clinician-selected code", "________________________________________");
            row(review, "Clinical notes", "________________________________________\n________________________________________");
            row(review, "Reviewed by / date", "________________________________________");
            d.add(review); spacer(d, 8);
            d.add(new Paragraph("This output does not diagnose disease or replace professional medical judgement. AI-assisted coding must be reviewed before a confirmed FHIR Condition is created.", font(8, Font.ITALIC, RED)));
            if (outlookSnapshot != null) CkdOutlookReport.add(d, writer, outlookSnapshot);
            d.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to generate structured CKD PDF", e);
        }
    }

    private static void addSixRenalModules(Document d, PdfWriter writer, JsonNode snapshot,
            SriLankanRenalIntelligenceService.Overview overview) throws Exception {
        if(snapshot!=null&&snapshot.path("schemaVersion").asInt()>=4){ClinicalIntelligencePdfSummary.add(d,writer,snapshot);RenalTrendPdf.add(d,writer,snapshot);return;}
        addClinicalRiskDashboard(d,writer,snapshot);
        boolean mapped=snapshot!=null&&snapshot.path("clinicalFeatureData").isObject();
        d.newPage();
        section(d, "CKD-RELATED CLINICAL RISKS & PREDICTIVE INTELLIGENCE");
        d.add(new Paragraph("Sri Lankan Longitudinal Renal & Hemodialysis Data", font(9, Font.NORMAL, TEAL)));
        d.add(new Paragraph(snapshot == null ? "No six-module snapshot has been stored. Open the authorized renal workspace to capture current evidence. No inference was performed for this export."
                : (snapshot.path("snapshotId").isTextual()?"Saved snapshot: " + snapshot.path("snapshotId").asText():"Mapped saved CKD assessment: "+snapshot.path("reportAssessmentId").asText()) + " | Evaluated " + snapshot.path("generatedAt").asText() + ". Export reads saved clinical evidence; no inference is performed.", font(7, Font.ITALIC, Color.DARK_GRAY)));
        if(snapshot == null && overview != null) snapshot=RenalClinicalModules.assemble(overview,List.of(),Instant.now());
        List<String> labels=List.of("Renal Clinical Trajectory","Kidney Failure / G5D","Hyperkalemia Monitoring","Anemia / Hb Deterioration","Dialysis Adequacy / URR","Renal Clinical Deterioration");
        PdfPTable cards=table(3,new float[]{1,1,1});cards.setSplitLate(false);cards.setSpacingBefore(9);
        for(int i=0;i<RenalClinicalModules.ORDER.size();i++) {
            String key=RenalClinicalModules.ORDER.get(i);JsonNode module=snapshot==null?null:snapshot.path(key);
            if(module!=null&&module.path("clinicalAssessment").isObject()){cards.addCell(clinicalFeaturePdfCard(writer,module));continue;}
            PdfPCell card=new PdfPCell();card.setPadding(8);card.setBorderColor(new Color(207,219,222));card.setBackgroundColor(new Color(249,252,252));
            card.addElement(new Paragraph(module!=null&&module.path("clinicalAssessment").isObject()?module.path("label").asText():labels.get(i),font(9,Font.BOLD,TEAL)));
            card.addElement(new Paragraph(module==null?"Result not calculated - insufficient longitudinal data.":renalPdfResult(module),font(8,Font.BOLD,Color.DARK_GRAY)));
            if(module!=null) {
                card.addElement(new Paragraph("Method: "+(module.path("clinicalAssessment").isObject()?module.path("clinicalAssessment").path("method").asText():module.path("method").asText()),font(7,Font.NORMAL,TEAL)));
                JsonNode clinical=module.path("clinicalAssessment");
                if(clinical.isObject()){
                    JsonNode completeness=clinical.path("dataReadiness");card.addElement(new Paragraph("Monitoring inputs: "+completeness.path("percent").asInt()+"% available | "+completeness.path("availableCount").asInt()+"/"+completeness.path("requiredCount").asInt()+" parameters | Missing: "+completeness.path("missingCount").asInt(),font(7,Font.BOLD,TEAL)));
                    if(clinical.path("riskLevel").isTextual())card.addElement(new Paragraph("Monitoring level: "+clinical.path("riskLevel").asText()+" (not disease probability)",font(7,Font.BOLD,Color.DARK_GRAY)));
                    if(clinical.path("currentValue").isNumber())card.addElement(new Paragraph("Assessment measurement: "+pdfNodeNumber(clinical.path("currentValue"))+" "+clinical.path("unit").asText()+" | "+clinical.path("currentAt").asText("Undated snapshot; time not verified"),font(7,Font.NORMAL,Color.DARK_GRAY)));
                    for(JsonNode why:clinical.path("explanations"))card.addElement(new Paragraph("Why: "+why.asText(),font(6,Font.NORMAL,Color.DARK_GRAY)));
                    if(clinical.path("longitudinalMessage").isTextual())card.addElement(new Paragraph(clinical.path("longitudinalMessage").asText(),font(6,Font.ITALIC,ORANGE)));
                    if(clinical.path("dialysisMessage").isTextual())card.addElement(new Paragraph(clinical.path("dialysisMessage").asText(),font(6,Font.NORMAL,ORANGE)));
                    if(clinical.path("creatinineChangePercent").isNumber())card.addElement(new Paragraph("Measured creatinine change: "+pdfNodeNumber(clinical.path("creatinineChangePercent"))+"% (not probability)",font(7,Font.BOLD,TEAL)));
                    if(clinical.path("trend").path("declineRatePerDay").isNumber())card.addElement(new Paragraph("Hb decline rate: "+pdfNodeNumber(clinical.path("trend").path("declineRatePerDay"))+" g/dL/day",font(7,Font.NORMAL,TEAL)));
                    if(module.path("researchReadiness").isObject())card.addElement(new Paragraph("Separate research forecast: "+module.path("researchReadiness").path("resultTitle").asText(),font(6,Font.ITALIC,Color.GRAY)));
                }
                if(module.path("readiness").isObject()) {
                    card.addElement(new Paragraph(module.path("readiness").path("resultTitle").asText(),font(8,Font.BOLD,TEAL)));
                    card.addElement(new Paragraph(module.path("readiness").path("message").asText(),font(7,Font.NORMAL,Color.DARK_GRAY)));
                    int count=0;for(JsonNode requirement:module.path("readiness").path("requirements"))if(requirement.path("required").asBoolean()&&!requirement.path("satisfied").asBoolean()&&count++<3)
                        card.addElement(new Paragraph("Needs: "+requirement.path("label").asText()+" ("+requirement.path("availableCount").asInt()+"/"+requirement.path("minimumCount").asInt()+")",font(7,Font.NORMAL,ORANGE)));
                    if(module.path("readiness").path("technicalReference").isTextual())card.addElement(new Paragraph("Request reference: "+module.path("readiness").path("technicalReference").asText(),font(6,Font.NORMAL,Color.DARK_GRAY)));
                }
                if(module.path("currentValue").isNumber())card.addElement(new Paragraph("Latest measured: "+pdfNodeNumber(module.path("currentValue"))+" "+module.path("unit").asText()+" | "+module.path("currentAt").asText("Date not recorded")+(module.path("previousValue").isNumber()?" | Previous: "+pdfNodeNumber(module.path("previousValue")):""),font(7,Font.NORMAL,Color.DARK_GRAY)));
                if(module.path("researchRiskScore").isNumber())card.addElement(new Paragraph("Research score: "+String.format(java.util.Locale.ROOT,"%.4f",module.path("researchRiskScore").asDouble())+" (0-1; not clinically calibrated)",font(8,Font.BOLD,ORANGE)));
                if(module.path("forecast").isNumber())card.addElement(new Paragraph("Next-period research forecast: "+pdfNodeNumber(module.path("forecast"))+" "+module.path("unit").asText(),font(8,Font.BOLD,TEAL)));
                if(module.path("directionalPercent").isNumber()&&module.path("evaluatedComponents").asInt()>0)card.addElement(new Paragraph("Directional composite: "+module.path("directionalPercent").asInt()+"% | "+module.path("worseningComponents").asInt()+"/"+module.path("evaluatedComponents").asInt()+" domains. NOT A DISEASE PROBABILITY.",font(7,Font.BOLD,ORANGE)));
                if(key.equals("dialysisAdequacy"))card.addElement(new Paragraph("Current measured URR: "+pdfNodeNumber(module.path("currentValue"))+"% | Next-period forecast: "+(module.path("forecast").isNumber()?pdfNodeNumber(module.path("forecast"))+"%":"Not ready / not run"),font(7,Font.NORMAL,TEAL)));
                Image line=moduleSparkline(writer,module.path("trendPoints"));if(line!=null){line.scaleToFit(145,35);card.addElement(line);}
                for(JsonNode domain:module.path("domains"))card.addElement(new Paragraph(domain.path("label").asText()+": "+(domain.path("usablePoints").asInt()>=2?pdfNodeNumber(domain.path("previousValue"))+" to "+pdfNodeNumber(domain.path("currentValue"))+" "+domain.path("unit").asText()+"; "+pretty(domain.path("trendDirection").asText()):domain.path("usablePoints").asInt()+"/2 valid dated results; more source data required"),font(6,Font.NORMAL,Color.DARK_GRAY)));
                if(module.has("evidenceSource"))card.addElement(new Paragraph("Clinical evidence: "+module.path("evidenceSource").asText()+" | Verified: "+module.path("lastVerifiedDate").asText("Not recorded"),font(6,Font.NORMAL,Color.DARK_GRAY)));
                if(module.has("formula"))card.addElement(new Paragraph("URR = ((Pre-HD Urea - Post-HD Urea) / Pre-HD Urea) x 100",font(6,Font.NORMAL,TEAL)));
                card.addElement(new Paragraph(module.path("model").asText("Clinical rule")+" | "+module.path("modelVersion").asText(RenalClinicalModules.VERSION)+" | "+pretty(module.path("validationStatus").asText()),font(6,Font.NORMAL,Color.GRAY)));
                card.addElement(new Paragraph("Review: "+pretty(module.path("moduleReviewState").asText("AWAITING_REVIEW"))+" | version "+module.path("moduleReviewVersion").asInt(),font(6,Font.NORMAL,Color.DARK_GRAY)));
                card.addElement(new Paragraph("Monitoring / research support; clinician interpretation required. Full readiness and limitations follow.",font(6,Font.ITALIC,Color.DARK_GRAY)));
            }
            cards.addCell(card);
        }
        if(!mapped)d.add(cards);spacer(d,8);
        d.add(new Paragraph("Clinical Decision Support / Research Use. Outputs require clinician interpretation. Research-model outputs are not independently validated diagnoses.",font(8,Font.BOLD,TEAL)));
        if(snapshot!=null&&snapshot.path("clinicalFeatureData").isObject())d.add(new Paragraph("Prediction generated from available clinical measurements. Longitudinal forecasting requires repeated dated observations. Clinical data readiness is input completeness, not diagnostic certainty or disease probability.",font(8,Font.NORMAL,Color.DARK_GRAY)));
        if(snapshot!=null) {
            if(!mapped)d.newPage();section(d,"SIX-MODULE EVIDENCE & CLINICIAN REVIEW");
            for(String key:RenalClinicalModules.ORDER) {
                JsonNode module=snapshot.path(key);section(d,module.path("label").asText());
                d.add(new Paragraph(renalPdfResult(module),font(8,Font.BOLD,TEAL)));
                JsonNode readiness=module.path("readiness");
                JsonNode clinical=module.path("clinicalAssessment");if(clinical.isObject()){
                    d.add(new Paragraph("Mapping rule: "+clinical.path("ruleVersion").asText()+" | "+clinical.path("method").asText(),font(7,Font.BOLD,TEAL)));
                    for(String field:List.of("message","longitudinalMessage","dialysisMessage"))if(clinical.path(field).isTextual())d.add(new Paragraph(clinicalPdfText(clinical.path(field).asText()),font(7,Font.NORMAL,Color.DARK_GRAY)));
                    JsonNode complete=clinical.path("dataReadiness");d.add(new Paragraph("Monitoring inputs: "+complete.path("percent").asInt()+"% available | "+complete.path("availableCount").asInt()+"/"+complete.path("requiredCount").asInt()+" parameters | Missing: "+complete.path("missingCount").asInt(),font(7,Font.BOLD,TEAL)));
                    if(clinical.path("thresholdPolicy").isTextual())d.add(new Paragraph(clinical.path("thresholdPolicy").asText(),font(7,Font.NORMAL,Color.DARK_GRAY)));
                    if(clinical.path("formula").isTextual())d.add(new Paragraph(clinical.path("formula").asText(),font(7,Font.NORMAL,TEAL)));
                    for(JsonNode value:clinical.path("featuresUsed"))d.add(new Paragraph(value.path("label").asText()+": "+pdfNodeNumber(value.path("value"))+" "+value.path("unit").asText()+" | "+value.path("observedAt").asText("Undated assessment snapshot")+" | Source: "+value.path("source").asText()+" / "+value.path("sourceId").asText(),font(7,Font.NORMAL,Color.DARK_GRAY)));
                    d.add(new Paragraph("Clinical recommendations",font(8,Font.BOLD,TEAL)));for(JsonNode rec:clinical.path("recommendations"))d.add(new Paragraph(rec.asText(),font(7,Font.NORMAL,Color.DARK_GRAY)));
                    for(JsonNode why:clinical.path("explanations"))d.add(new Paragraph("Why: "+clinicalPdfText(why.asText()),font(7,Font.NORMAL,Color.DARK_GRAY)));
                }
                for(JsonNode requirement:readiness.path("requirements"))d.add(new Paragraph((requirement.path("satisfied").asBoolean()?"Available: ":"Needs review / data: ")+requirement.path("label").asText()+" | "+requirement.path("availableCount").asInt()+"/"+requirement.path("minimumCount").asInt()+" | "+requirement.path("detail").asText(),font(7,Font.NORMAL,Color.DARK_GRAY)));
                for(JsonNode excluded:readiness.path("excludedData"))d.add(new Paragraph("Excluded source: "+excluded.path("observedAt").asText()+" | "+pretty(excluded.path("reason").asText()),font(7,Font.NORMAL,ORANGE)));
                if(readiness.path("nextAction").isObject())d.add(new Paragraph("Next action: "+readiness.path("nextAction").path("label").asText(),font(7,Font.BOLD,TEAL)));
                for(JsonNode limit:module.path("limitations"))d.add(new Paragraph(limit.asText(),font(7,Font.ITALIC,Color.DARK_GRAY)));
                d.add(new Paragraph((clinical.isObject()?"Clinical feature sources: "+readiness.path("dataPointsUsed").asInt()+" | Separately stored renal / HD observations: ":"Source measurements: ")+module.path("usablePoints").asInt()+" | Reliability: "+module.path("dataReliability").asText()+" | Horizon: "+module.path("horizon").asText("No probability horizon")+" | Last run: "+module.path("lastRun").asText("Not recorded"),font(7,Font.NORMAL,Color.DARK_GRAY)));
                if(module.path("clinicianReview").isObject())d.add(new Paragraph("Clinician: "+module.path("clinicianReview").path("actor_id").asText()+" | Reviewed: "+module.path("clinicianReview").path("created_at").asText()+" | Reason: "+module.path("clinicianReview").path("reason").asText()+" | Interpretation: "+module.path("clinicianReview").path("modified_interpretation").asText("Not modified"),font(7,Font.NORMAL,Color.DARK_GRAY)));
                for(JsonNode source:module.path("sources"))d.add(new Paragraph(source.path("observedAt").asText()+" | "+source.path("sourceNote").asText(),font(6,Font.NORMAL,Color.GRAY)));
                for(JsonNode f:module.path("topFactors"))d.add(new Paragraph("SHAP association (not causation): "+f.path("feature").asText()+" | value "+pdfNodeNumber(f.path("value"))+" | contribution "+pdfNodeNumber(f.path("contribution")),font(7,Font.NORMAL,Color.DARK_GRAY)));
                spacer(d,5);
            }
        }
    }
    /** Uses the exact saved assessment snapshot. Export never runs a prediction. */
    private static void addClinicalRiskDashboard(Document d,PdfWriter writer,JsonNode snapshot)throws Exception{
        Color navy=new Color(11,37,69);
        section(d,"CKD Related Clinical Intelligence Summary");
        d.add(new Paragraph("Source evidence, monitoring status and next clinical actions",font(9,Font.NORMAL,navy)));
        d.add(dashboardLine(snapshot==null?"No related-risk snapshot available. No values or risk results have been inferred.":"Assessment-linked snapshot: "+snapshot.path("snapshotId").asText("Not recorded"),8,Font.NORMAL,Color.DARK_GRAY));
        if(snapshot!=null)d.add(dashboardLine("Evaluated: "+dashboardEvaluationDate(snapshot.path("generatedAt")),8,Font.NORMAL,Color.DARK_GRAY));
        spacer(d,8);
        var keys=List.of("anemia","hyperkalemia","dialysisAdequacy","renalDeterioration","cardiovascular");
        var labels=List.of("Anemia Monitoring","Hyperkalemia Risk Monitoring","Dialysis Effectiveness Monitoring","Renal Function Progression","CKD Cardiovascular Monitoring");
        var colors=List.of(new Color(229,57,53),new Color(126,87,194),new Color(2,136,209),new Color(0,105,92),new Color(216,27,96));
        PdfPTable cards=table(2,new float[]{1,1});cards.setSplitRows(true);cards.setSplitLate(true);
        PdfPCell continued=new PdfPCell(new Phrase("CKD Related Clinical Intelligence Summary - continued",font(9,Font.BOLD,TEAL)));
        continued.setColspan(2);continued.setBorder(Rectangle.NO_BORDER);continued.setPaddingBottom(8);cards.addCell(continued);
        cards.setHeaderRows(1);cards.setSkipFirstHeader(true);
        for(int i=0;i<keys.size();i++){
            String key=keys.get(i);boolean cv=key.equals("cardiovascular");JsonNode m=snapshot==null?null:snapshot.path(cv?"cardiovascularMonitoring":key);
            JsonNode c=m==null?null:cv?m:m.path("clinicalAssessment"),r=c==null?null:c.path("dataReadiness");Color disease=colors.get(i);
            PdfPCell card=new PdfPCell();card.setPadding(11);card.setBorderColor(new Color(222,231,238));card.setBackgroundColor(new Color(249,251,253));
            card.addElement(dashboardLine(labels.get(i),11,Font.BOLD,disease));
            String status=cv?(c!=null&&c.isObject()?"Surveillance recommended":"Data required"):clinicalDashboardStatus(m);
            card.addElement(dashboardLine("Monitoring status: "+status,8,Font.BOLD,navy));
            if(cv)card.addElement(dashboardLine("Risk not estimated",9,Font.BOLD,navy));
            if(c!=null&&c.path("currentValue").isNumber()){
                card.addElement(dashboardLine((key.equals("anemia")?"Current Hb: ":key.equals("hyperkalemia")?"Current potassium: ":"Measured URR: ")+pdfNodeNumber(c.path("currentValue"))+" "+c.path("unit").asText(),9,Font.BOLD,navy));
                card.addElement(dashboardLine("Measurement date: "+clinicalDashboardDate(c.path("currentAt")),8,Font.NORMAL,Color.DARK_GRAY));
            }
            else if(key.equals("dialysisAdequacy"))card.addElement(dashboardLine("URR: Not calculated",9,Font.BOLD,navy));
            else if(c!=null&&c.path("creatinineChangePercent").isNumber())card.addElement(dashboardLine("Measured creatinine change: "+pdfNodeNumber(c.path("creatinineChangePercent"))+"% (not probability)",9,Font.BOLD,navy));
            if(r!=null&&r.path("requiredCount").asInt()>0){
                card.addElement(dashboardLine("Monitoring inputs: "+r.path("percent").asInt()+"% available ("+r.path("availableCount").asInt()+"/"+r.path("requiredCount").asInt()+")",8,Font.BOLD,disease));
                card.addElement(dashboardProgress(r.path("percent").asInt(),disease));
            }else card.addElement(dashboardLine("Available evidence: coverage not established",8,Font.NORMAL,Color.DARK_GRAY));
            if(c!=null&&c.isObject()){
                List<String> indicators=new ArrayList<>(),missing=new ArrayList<>();
                for(JsonNode f:c.path("featuresUsed"))indicators.add(f.path("label").asText()+" "+pdfNodeNumber(f.path("value"))+" "+f.path("unit").asText());
                for(JsonNode requirement:c.path("requirements"))if(!requirement.path("satisfied").asBoolean())missing.add(requirement.path("label").asText());
                if(!c.path("currentValue").isNumber())card.addElement(dashboardLine("Clinical indicators: "+(indicators.isEmpty()?"Source measurements required":String.join("; ",indicators)),8,Font.NORMAL,Color.DARK_GRAY));
                String coverage=missing.isEmpty()?(r.path("requiredCount").asInt()>0&&r.path("availableCount").asInt()>=r.path("requiredCount").asInt()?"Listed monitoring inputs recorded.":"Required input coverage is not established."):"Missing information: "+String.join("; ",missing);
                card.addElement(dashboardLine(coverage,8,Font.NORMAL,missing.isEmpty()?Color.DARK_GRAY:new Color(150,73,14)));
                if(key.equals("anemia"))card.addElement(dashboardLine("Extended workup: CBC / iron-study sources (PCV, RBC count, ferritin, iron profile) are not linked.",8,Font.NORMAL,Color.DARK_GRAY));
                JsonNode trend=c.path("trend");if(trend.path("ready").asBoolean()){
                    card.addElement(dashboardLine("Dated trend: "+pdfNodeNumber(trend.path("previousValue"))+" to "+pdfNodeNumber(trend.path("currentValue"))+" "+trend.path("unit").asText(),8,Font.BOLD,disease));
                    Image chart=moduleSparkline(writer,trend.path("points"),disease);if(chart!=null){chart.scaleToFit(195,22);card.addElement(chart);}
                }
                card.addElement(dashboardLine("AI explanation / clinical rule: "+(c.path("explanations").isEmpty()?"Insufficient source evidence for interpretation.":clinicalSummaryText(clinicalPdfText(c.path("explanations").get(0).asText()),185)),8,Font.NORMAL,Color.DARK_GRAY));
                if(key.equals("dialysisAdequacy"))card.addElement(dashboardLine("URR = ((Pre-HD urea - Post-HD urea) / Pre-HD urea) x 100",8,Font.NORMAL,disease));
                if(cv){
                    JsonNode context=c.path("diabetesContext");String diabetes=switch(context.path("status").asText()){case "CONFIRMED_DIABETES"->"Diabetes documented in the verified record";case "NO_KNOWN_DIABETES"->"No known diabetes in the reviewed record";default->"Unconfirmed";};
                    card.addElement(dashboardLine("Diabetes context: "+diabetes+(context.path("verifiedAt").isTextual()?" | "+clinicalDashboardDate(context.path("verifiedAt")):""),8,Font.NORMAL,navy));
                    if(context.path("sourceNote").isTextual())card.addElement(dashboardLine("Context source: "+clinicalSummaryText(clinicalPdfText(context.path("sourceNote").asText()),180),8,Font.NORMAL,Color.DARK_GRAY));
                    card.addElement(dashboardLine("Prediction readiness: cardiovascular model unavailable; factor completeness is not a risk probability.",8,Font.NORMAL,Color.DARK_GRAY));
                }
                else if(m!=null&&m.has("modelKey"))card.addElement(dashboardLine("Research prediction: "+m.path("researchReadiness").path("resultTitle").asText("Eligibility not established"),8,Font.NORMAL,Color.DARK_GRAY));
                card.addElement(dashboardLine("Clinical action: "+(cv?c.path("nextAction").path("label").asText("Review cardiovascular factors"):m.path("readiness").path("nextAction").path("label").asText("Review source evidence")),8,Font.BOLD,navy));
            }else card.addElement(dashboardLine("Missing information: dated clinical source evidence required. Open the patient workspace to review inputs.",8,Font.NORMAL,Color.DARK_GRAY));
            JsonNode review=m==null?null:m.path("clinicianReview");
            card.addElement(dashboardLine("Clinician notes: "+(review!=null&&review.isObject()?review.path("clinical_note").asText(review.path("reason").asText("No notes stored")):cv?"Review / record findings in the existing patient clinical record.":"No notes stored for this module snapshot."),8,Font.ITALIC,Color.DARK_GRAY));
            cards.addCell(card);
        }
        PdfPCell explanation=new PdfPCell();explanation.setPadding(11);explanation.setBackgroundColor(new Color(235,244,248));explanation.setBorderColor(new Color(222,231,238));
        explanation.addElement(dashboardLine("Why this result?",11,Font.BOLD,navy));
        explanation.addElement(dashboardLine("Interpret recorded creatinine, eGFR, potassium and hemoglobin with their actual source dates. Arrows and trends require repeated dated observations. Missing values do not imply low risk.",9,Font.NORMAL,navy));
        explanation.addElement(dashboardLine("Clinical monitoring uses transparent existing measurement rules. Research forecasts remain separately gated. Detailed source evidence, model information, limitations and stored clinician reviews follow.",9,Font.NORMAL,navy));
        cards.addCell(explanation);d.add(cards);spacer(d,8);
        d.add(new Paragraph("Data completeness is not diagnostic certainty, forecast eligibility or disease probability. No inference is run during export.",font(8,Font.ITALIC,navy)));
    }
    private static Paragraph dashboardLine(String text,int size,int style,Color color){
        Paragraph line=new Paragraph(clinicalPdfText(text),font(size,style,color));
        line.setLeading(size*1.3f);line.setSpacingAfter(2);return line;
    }
    static PdfPTable dashboardProgress(int percent,Color color){
        float fraction=Math.max(0,Math.min(100,percent))/100f;
        PdfPTable progress=table(1,new float[]{1});progress.setSpacingBefore(3);progress.setSpacingAfter(5);
        PdfPCell bar=new PdfPCell();bar.setFixedHeight(5);bar.setPadding(0);bar.setBorder(Rectangle.NO_BORDER);
        bar.setCellEvent((cell,position,canvases)->{
            PdfContentByte canvas=canvases[PdfPTable.BACKGROUNDCANVAS];canvas.saveState();
            canvas.setColorFill(new Color(224,231,237));canvas.rectangle(position.getLeft(),position.getBottom(),position.getWidth(),position.getHeight());canvas.fill();
            if(fraction>0){canvas.setColorFill(color);canvas.rectangle(position.getLeft(),position.getBottom(),position.getWidth()*fraction,position.getHeight());canvas.fill();}
            canvas.restoreState();
        });
        progress.addCell(bar);return progress;
    }
    private static String clinicalDashboardDate(JsonNode node){
        String value=node.asText(null);if(value==null)return "Undated snapshot; verify date";
        try{return OffsetDateTime.parse(value).toLocalDate().toString();}catch(java.time.format.DateTimeParseException ignored){}
        try{return java.time.LocalDate.parse(value).toString();}catch(java.time.format.DateTimeParseException ignored){return "Undated snapshot; verify date";}
    }
    private static String dashboardEvaluationDate(JsonNode node){
        try{return OffsetDateTime.parse(node.asText()).withOffsetSameInstant(java.time.ZoneOffset.UTC).format(java.time.format.DateTimeFormatter.ofPattern("dd MMM uuuu, HH:mm 'UTC'",Locale.ENGLISH));}
        catch(java.time.format.DateTimeParseException ignored){return "Not recorded / unverified";}
    }
    private static String clinicalSummaryText(String value,int limit){if(value.length()<=limit)return value;int end=value.lastIndexOf(" ",limit);return value.substring(0,end>0?end:limit)+"... Full explanation in evidence section.";}
    private static String clinicalDashboardStatus(JsonNode module){
        if(module==null||module.isMissingNode())return "Data required";
        JsonNode c=module.path("clinicalAssessment"),r=module.path("readiness");
        boolean historical=r.has("measurementNote");
        if(c.path("acuteReviewSignal").asBoolean()||c.path("riskLevel").asText().equals("High"))return historical?"Source review recommended":"Clinical review recommended";
        if(historical)return "Verify measurement date";
        if(!r.path("ready").asBoolean())return "Data required";
        if(List.of("Monitor","Moderate").contains(c.path("riskLevel").asText()))return "Continued monitoring";
        JsonNode t=c.path("trend");if(t.path("ready").asBoolean()&&Math.abs(t.path("currentValue").asDouble()-t.path("previousValue").asDouble())<=Math.abs(t.path("previousValue").asDouble())*.01)return "Stable";
        return "Monitoring";
    }
    private static PdfPCell clinicalFeaturePdfCard(PdfWriter writer,JsonNode module)throws Exception{
        JsonNode c=module.path("clinicalAssessment"),r=c.path("dataReadiness");PdfPCell card=new PdfPCell();card.setPadding(9);card.setBorderColor(new Color(207,219,222));card.setBackgroundColor(new Color(249,252,252));
        card.addElement(new Paragraph(c.path("title").asText(),font(9,Font.BOLD,TEAL)));
        card.addElement(new Paragraph(pretty(c.path("status").asText())+" | "+c.path("resultTitle").asText(),font(8,Font.BOLD,Color.DARK_GRAY)));
        card.addElement(new Paragraph("Monitoring inputs: "+r.path("percent").asInt()+"% available | "+r.path("availableCount").asInt()+"/"+r.path("requiredCount").asInt()+" parameters | Missing: "+r.path("missingCount").asInt(),font(7,Font.BOLD,TEAL)));
        if(c.path("currentValue").isNumber())card.addElement(new Paragraph("Measured: "+pdfNodeNumber(c.path("currentValue"))+" "+c.path("unit").asText()+" | "+c.path("currentAt").asText("Undated snapshot; time not verified"),font(7,Font.NORMAL,Color.DARK_GRAY)));
        if(c.path("riskLevel").isTextual())card.addElement(new Paragraph("Monitoring level: "+c.path("riskLevel").asText(),font(7,Font.BOLD,Color.DARK_GRAY)));
        card.addElement(new Paragraph(clinicalPdfText(c.path("message").asText()),font(7,Font.NORMAL,Color.DARK_GRAY)));
        int whyCount=0;for(JsonNode why:c.path("explanations"))if(whyCount++<3)card.addElement(new Paragraph("Why: "+clinicalPdfText(why.asText()),font(7,Font.NORMAL,Color.DARK_GRAY)));
        JsonNode t=c.path("trend");if(t.path("ready").asBoolean()){
            card.addElement(new Paragraph("Measured trend: "+pdfNodeNumber(t.path("previousValue"))+" to "+pdfNodeNumber(t.path("currentValue"))+" "+t.path("unit").asText()+" | "+t.path("previousAt").asText()+" to "+t.path("currentAt").asText(),font(6,Font.NORMAL,Color.DARK_GRAY)));
            Image chart=moduleSparkline(writer,t.path("points"));if(chart!=null){chart.scaleToFit(140,27);card.addElement(chart);}
        }
        if(c.path("creatinineChangePercent").isNumber())card.addElement(new Paragraph("Measured creatinine change: "+pdfNodeNumber(c.path("creatinineChangePercent"))+"% (not probability)",font(7,Font.BOLD,TEAL)));
        if(t.path("declineRatePerDay").isNumber())card.addElement(new Paragraph("Hb decline rate: "+formatPdfNumber(t.path("declineRatePerDay").asDouble())+" g/dL/day",font(7,Font.NORMAL,TEAL)));
        for(String field:List.of("longitudinalMessage","dialysisMessage"))if(c.path(field).isTextual())card.addElement(new Paragraph(c.path(field).asText(),font(7,Font.ITALIC,ORANGE)));
        int missing=0;for(JsonNode requirement:c.path("requirements"))if(!requirement.path("satisfied").asBoolean()&&missing++<3)card.addElement(new Paragraph("Needs: "+requirement.path("label").asText(),font(7,Font.NORMAL,ORANGE)));
        if(module.has("modelKey"))card.addElement(new Paragraph("Separate HD research forecast: "+module.path("researchReadiness").path("resultTitle").asText(),font(6,Font.ITALIC,Color.GRAY)));
        card.addElement(new Paragraph("Measurement-based monitoring; no new disease probability or confirmed diagnosis. Source details, rules and clinical recommendations follow.",font(6,Font.ITALIC,Color.DARK_GRAY)));return card;
    }
    private static String clinicalPdfText(String value){return value.replace("→"," to ").replace("−","-").replace("≥",">=").replace("≤","<=").replace("–","-").replace("²","2");}
    private static String renalPdfResult(JsonNode module){if(module.path("clinicalAssessment").isObject())return pretty(module.path("clinicalAssessment").path("status").asText())+" - "+module.path("clinicalAssessment").path("resultTitle").asText();return switch(module.path("status").asText()) {
        case "INSUFFICIENT_DATA"->"Result not calculated - insufficient longitudinal data.";
        case "NOT_APPLICABLE"->"Eligible dialysis context not verified; model not applicable under current eligibility criteria.";
        case "NOT_INSTALLED"->"Reviewed model not installed. Adding patient data cannot install it.";
        case "ERROR"->"Prediction service temporarily unavailable; technical error, not insufficient data.";
        case "BLOCKED_BY_SAFETY_GATE"->"Prediction intentionally suppressed - clinical source review required.";
        default->module.path("readiness").path("resultTitle").asText(pretty(module.path("signal").asText()));
    };}
    private static String pdfNodeNumber(JsonNode value){return value.isNumber()?formatPdfNumber(value.asDouble()):"Unavailable";}
    private static Image moduleSparkline(PdfWriter writer,JsonNode points) throws Exception { return moduleSparkline(writer,points,TEAL); }
    private static Image moduleSparkline(PdfWriter writer,JsonNode points,Color disease) throws Exception {
        if(points.size()<2)return null;List<Double> values=new ArrayList<>();for(JsonNode p:points)if(p.path("value").isNumber())values.add(p.path("value").asDouble());
        if(values.size()<2)return null;double low=Collections.min(values),high=Collections.max(values),span=Math.max(high-low,1e-9);
        PdfTemplate chart=writer.getDirectContent().createTemplate(145,35);chart.setColorStroke(disease);chart.setLineWidth(1.4f);
        for(int i=0;i<values.size();i++){float x=3+i*139f/(values.size()-1),y=high==low?17:3+(float)((values.get(i)-low)/span)*29;if(i==0)chart.moveTo(x,y);else chart.lineTo(x,y);}chart.stroke();return Image.getInstance(chart);
    }

    private static PdfPCell renalRiskCard(PdfWriter writer, String title, String result, String description,
            List<SriLankanRenalIntelligenceService.ObservationView> observations, String metric, Color color, String indicators) throws Exception {
        PdfPCell card = new PdfPCell(); card.setPadding(9); card.setBorderColor(new Color(207,219,222));
        card.setBackgroundColor(new Color(249,252,252));
        Paragraph heading = new Paragraph(title, font(9, Font.BOLD, color)); heading.setSpacingAfter(3); card.addElement(heading);
        card.addElement(new Paragraph(result, font(10, Font.BOLD, Color.DARK_GRAY)));
        Image spark = renalSparkline(writer, observations, metric, color); if (spark != null) { spark.scaleToFit(230,52); card.addElement(spark); }
        Paragraph body = new Paragraph(description, font(7, Font.NORMAL, Color.DARK_GRAY)); body.setSpacingBefore(3); card.addElement(body);
        Paragraph data = new Paragraph("Data: " + indicators, font(6, Font.ITALIC, Color.GRAY)); data.setSpacingBefore(3); card.addElement(data);
        return card;
    }

    private static PdfPCell renalCompositeCard(PdfWriter writer, SriLankanRenalIntelligenceService.RenalDeteriorationComposite composite) throws Exception {
        PdfPCell card = new PdfPCell(); card.setPadding(9); card.setBorderColor(new Color(207,219,222)); card.setBackgroundColor(new Color(249,252,252));
        card.addElement(new Paragraph("RENAL CLINICAL DETERIORATION", font(9, Font.BOLD, TEAL)));
        if (composite == null || composite.scorePercent() == null) {
            card.addElement(new Paragraph("Directional composite: Insufficient data", font(10, Font.BOLD, Color.DARK_GRAY)));
            card.addElement(new Paragraph("At least three domains need two valid observations.", font(7, Font.NORMAL, Color.DARK_GRAY)));
            return card;
        }
        card.addElement(new Paragraph("Directional composite: " + composite.scorePercent() + "%", font(10, Font.BOLD, Color.DARK_GRAY)));
        Image meter = renalCompositeBar(writer, composite.scorePercent()); meter.scaleToFit(230,20); card.addElement(meter);
        card.addElement(new Paragraph(composite.worseningComponents() + "/" + composite.evaluatedComponents()
                + " evaluable domains currently move in the predefined adverse direction. Status: " + pretty(composite.status()), font(7, Font.NORMAL, Color.DARK_GRAY)));
        String components = composite.components().stream().filter(SriLankanRenalIntelligenceService.CompositeComponent::evaluable)
                .map(c -> c.label() + " " + pretty(c.trendDirection()) + (c.worsening() ? "*" : ""))
                .collect(java.util.stream.Collectors.joining(" | "));
        card.addElement(new Paragraph(components, font(6, Font.NORMAL, Color.GRAY)));
        card.addElement(new Paragraph("* adverse direction. Equal-weight heuristic using the two latest valid values with a 1% stability band; not a validated prognostic score or disease probability.", font(6, Font.ITALIC, RED)));
        return card;
    }

    private static Image renalSparkline(PdfWriter writer, List<SriLankanRenalIntelligenceService.ObservationView> observations,
            String metric, Color color) throws Exception {
        List<Double> ordered = observations.stream()
                .sorted(java.util.Comparator.comparing(SriLankanRenalIntelligenceService.ObservationView::observedAt))
                .map(o -> o.measurements().get(metric)).filter(Objects::nonNull).filter(Double::isFinite).toList();
        List<Double> values = ordered.subList(Math.max(0, ordered.size() - 8), ordered.size());
        if (values.size() < 2) return null;
        float width=230,height=48,pad=6; double min=values.stream().mapToDouble(Double::doubleValue).min().orElse(0), max=values.stream().mapToDouble(Double::doubleValue).max().orElse(1);
        double span=Math.max(max-min,1e-9); PdfTemplate template=writer.getDirectContent().createTemplate(width,height);
        template.setColorFill(Color.WHITE); template.rectangle(0,0,width,height); template.fill();
        template.setColorStroke(new Color(225,230,232)); template.setLineWidth(.5f); template.moveTo(pad,pad); template.lineTo(width-pad,pad); template.stroke();
        template.setColorStroke(color); template.setLineWidth(1.8f);
        for(int i=0;i<values.size();i++) { float x=pad+i*(width-2*pad)/(values.size()-1); float y=pad+(float)((values.get(i)-min)/span)*(height-2*pad); if(i==0) template.moveTo(x,y); else template.lineTo(x,y); }
        template.stroke(); template.setColorFill(color);
        for(int i=0;i<values.size();i++) { float x=pad+i*(width-2*pad)/(values.size()-1); float y=pad+(float)((values.get(i)-min)/span)*(height-2*pad); template.circle(x,y,2); template.fill(); }
        return Image.getInstance(template);
    }

    private static Image renalCompositeBar(PdfWriter writer, int score) throws Exception {
        float width=230,height=14; PdfTemplate template=writer.getDirectContent().createTemplate(width,height);
        template.setColorFill(new Color(235,239,240)); template.rectangle(0,2,width,10); template.fill();
        template.setColorFill(score>=50 ? ORANGE : TEAL); template.rectangle(0,2,width*Math.max(0,Math.min(100,score))/100f,10); template.fill();
        return Image.getInstance(template);
    }

    private static SriLankanRenalIntelligenceService.PredictionView latestRenalPrediction(
            List<SriLankanRenalIntelligenceService.PredictionView> predictions, String key) {
        return predictions.stream().filter(p -> key.equals(p.modelKey())).max(java.util.Comparator.comparing(SriLankanRenalIntelligenceService.PredictionView::createdAt)).orElse(null);
    }
    private static Double latestRenalMeasurement(List<SriLankanRenalIntelligenceService.ObservationView> observations, String metric) {
        return observations.stream().sorted(java.util.Comparator.comparing(SriLankanRenalIntelligenceService.ObservationView::observedAt).reversed())
                .map(o -> o.measurements().get(metric)).filter(Objects::nonNull).filter(Double::isFinite).findFirst().orElse(null);
    }
    private static String valueWithUnit(Double value, String unit) { return value == null ? "Unavailable" : formatPdfNumber(value) + " " + unit; }
    private static String formatPdfNumber(double value) { return String.format(Locale.ROOT, "%.2f", value).replaceAll("\\.?0+$", ""); }

    private static void addRenalIntelligence(Document d,
            List<SriLankanRenalIntelligenceService.PredictionView> predictions) throws Exception {
        section(d, "SRI LANKAN RENAL PREDICTIVE INTELLIGENCE");
        d.add(new Paragraph("Stored research outputs from clinician-verified maintenance hemodialysis history. Hb/URR are continuous forecasts; hyperkalemia is an internally evaluated research risk score. Clinician review is required and no treatment target is inferred.",
                font(9, Font.ITALIC, Color.DARK_GRAY)));
        d.add(new Paragraph("Forecasts retain their original input dates. New measured results require a new snapshot; exporting this report does not recalculate the model.",
                font(8, Font.ITALIC, Color.DARK_GRAY)));
        d.add(new Paragraph("Clinical validation: NOT COMPLETED | Dataset permission: UNVERIFIED | Training population: Sri Lankan renal/hemodialysis research cohort; upstream preprocessing is not independently verified.",
                font(8, Font.BOLD, RED)));
        spacer(d, 10);
        for (var prediction : predictions) {
            var out = prediction.outputs();
            section(d, out.path("model").asText(prediction.modelKey()) + " - " + pretty(prediction.status()));
            PdfPTable details = table(2, new float[]{1.3f, 2.7f});
            row(details, "Snapshot / generated at", prediction.id() + " / " + prediction.createdAt());
            row(details, "Model version / method", out.path("model_version").asText("Unavailable") + " / " + out.path("method").asText("Unavailable"));
            row(details, "Algorithm", out.path("algorithm").asText("Unavailable"));
            boolean classifier = "hyperkalemia".equals(prediction.modelKey());
            row(details, "Predicted result", out.path("prediction").isNumber()
                    ? out.path("prediction").asText() + " " + out.path("unit").asText() + " (PREDICTED)"
                    : out.path("probability").isNumber() ? String.format(java.util.Locale.ROOT,"%.4f",out.path("probability").doubleValue()) + " research score (0-1; NOT CLINICALLY CALIBRATED)"
                    : "Unavailable - no research output calculated");
            var interval = out.path("interval");
            row(details, "Uncertainty / calibration", interval.isObject() ? interval.path("low").asText() + " to " + interval.path("high").asText()
                    + " " + out.path("unit").asText() + "; level " + interval.path("level").asText() + "; " + interval.path("method").asText()
                    : classifier ? "Probability calibration not established; use as a research risk score only" : "No estimated interval available");
            row(details, "Forecast origin / anchor", out.path("forecast_origin_date").asText("Unavailable") + " / " + out.path("forecast_date").asText("Unavailable"));
            row(details, "Horizon definition", out.path("horizon_definition").asText("Next-period research forecast"));
            row(details, "Internal validation", out.path("validation_status").asText("INTERNAL_RESEARCH_EVALUATION"));
            row(details, "Clinician review", prediction.reviewState() + " / version " + prediction.reviewVersion());
            if (prediction.reason() != null) row(details, "Review reason", prediction.reason());
            if (prediction.note() != null) row(details, "Clinical note", prediction.note());
            if (prediction.modifiedInterpretation() != null) row(details, "Clinician interpretation", prediction.modifiedInterpretation());
            if (prediction.reviewedAt() != null) row(details, "Reviewer / time", prediction.reviewedBy() + " / " + prediction.reviewedAt());
            row(details, "Data quality / missing fields", out.path("data_quality").path("flags").toString()
                    + " / " + out.path("data_quality").path("missing_fields").toString());
            row(details, "FHIR provenance", "RiskAssessment/" + prediction.id() + "; original source observations, author and immutable review events remain linked in the EHR");
            d.add(details); spacer(d, 7);
            if (out.path("forecast_origin_date").isTextual()) {
                try {
                    if (Duration.between(Instant.parse(out.path("forecast_origin_date").asText()), Instant.now()).toDays() > 62)
                        d.add(new Paragraph("Historical snapshot: forecast inputs are over 62 days old. Reconcile newer source results before clinical interpretation.", font(8, Font.BOLD, RED)));
                } catch (RuntimeException ignored) {
                    d.add(new Paragraph("The original forecast date cannot be verified from this stored snapshot.", font(8, Font.ITALIC, RED)));
                }
            }
            var explanation = out.path("explanation");
            d.add(new Paragraph("Why this prediction? " + explanation.path("method").asText("Unavailable"), font(9, Font.BOLD, TEAL)));
            for (var factor : explanation.path("top_factors")) d.add(new Paragraph(
                    factor.path("feature").asText() + ": " + factor.path("value").asText() + "; contribution "
                            + factor.path("contribution").asText() + "; " + factor.path("direction").asText()
                            + " (associated with the model output)", font(8, Font.NORMAL, Color.DARK_GRAY)));
            for (var trend : explanation.path("trends")) d.add(new Paragraph("Trend: " + (trend.isTextual() ? trend.asText() : trend.toString()), font(8, Font.NORMAL, Color.DARK_GRAY)));
            for (var limitation : explanation.path("limitations")) d.add(new Paragraph("Limitation: " + limitation.asText(), font(8, Font.ITALIC, RED)));
            spacer(d, 12);
        }
    }

    private static void addPredictiveIntelligence(Document d, PdfWriter writer,
                                                   PredictiveIntelligenceService.Overview data,
                                                   Map<Integer,CkdProgressionForecastService.Forecast> forecasts) throws Exception {
        section(d, "PREDICTIVE CLINICAL INTELLIGENCE - LONGITUDINAL REVIEW");
        d.add(new Paragraph("Live authorized EHR history at report generation time. Projected values are statistical extrapolations and are never stored or presented as laboratory observations.",
                font(8, Font.ITALIC, Color.DARK_GRAY)));
        spacer(d, 6);
        var analysis = data.analysis();
        var egfr = trend(analysis, "egfr");
        var creatinine = trend(analysis, "creatinine");
        var acr = trend(analysis, "acr");
        PdfPTable status = table(4, new float[]{1,1,1,1});
        summaryCell(status, "Recorded G / A category", valueOr(analysis.classification().gCategory(), "-") + " / "
                + valueOr(analysis.classification().aCategory(), "-"), TEAL);
        summaryCell(status, "Latest eGFR", observationValue(egfr), TEAL);
        summaryCell(status, "Latest creatinine", observationValue(creatinine), TEAL);
        summaryCell(status, "Data completeness", analysis.quality().completenessPercent() == null ? "Unavailable"
                : analysis.quality().completenessPercent() + "% · " + pretty(analysis.quality().qualityLevel()), TEAL);
        d.add(status); spacer(d, 9);

        section(d, "HISTORICAL eGFR & PROJECTED TRAJECTORY");
        if (egfr == null || egfr.observations().isEmpty()) {
            d.add(new Paragraph("No usable dated eGFR history is available.", font(9, Font.NORMAL, Color.DARK_GRAY)));
        } else {
            addEgfrChart(d, writer, egfr, forecasts);
            PdfPTable history = table(4, new float[]{1.2f,.8f,.9f,1.5f});
            headerRow(history, "Measured date", "eGFR", "Source", "Evidence identifier");
            for (var observation : egfr.observations()) {
                cell(history, observation.observedAt(), false); cell(history, observation.value() + " " + observation.unit(), false);
                cell(history, pretty(observation.source()), false); cell(history, observation.sourceId(), false);
            }
            d.add(history);
        }
        spacer(d, 9);
        PdfPTable forecast = table(7, new float[]{.55f,.8f,.8f,1f,.75f,.8f,1.25f});
        headerRow(forecast, "Horizon", "Current", "Projected", "Projected range", "Trend", "Reliability", "Status / interval method");
        for (int horizon : List.of(3,6,12)) {
            var value = forecasts.get(horizon);
            cell(forecast, horizon + " months", true);
            cell(forecast, value == null ? "Unavailable" : value.currentEgfr(), false);
            cell(forecast, value == null || value.projectedEgfr() == null ? "Unavailable" : value.projectedEgfr(), false);
            cell(forecast, value == null || value.projectedEgfrLow() == null || value.projectedEgfrHigh() == null
                    ? "Not estimated" : value.projectedEgfrLow() + " - " + value.projectedEgfrHigh(), false);
            cell(forecast, value == null ? "Unavailable" : pretty(value.trendDirection()), false);
            cell(forecast, value == null ? "Unavailable" : pretty(value.reliability()), false);
            cell(forecast, value == null ? "NOT INSTALLED" : pretty(value.status()) + "\n" + pretty(value.intervalMethod()), false);
        }
        d.add(forecast); spacer(d, 9);

        section(d, "EXPLAINABILITY & DATA-QUALITY LIMITATIONS");
        d.add(new Paragraph("Renal safety: " + pretty(analysis.safety().status()) + ". "
                + (analysis.safety().reasons().isEmpty() ? "No current safety reason was generated; this is not clinical clearance."
                : String.join(" ", analysis.safety().reasons())), font(8, Font.NORMAL, Color.DARK_GRAY)));
        for (var flag : analysis.quality().flags().stream().limit(15).toList())
            d.add(new Paragraph("- " + pretty(flag.code()) + ": " + flag.message(), font(8, Font.NORMAL, Color.DARK_GRAY)));
        d.add(new Paragraph("Medication context: " + data.medicationContext(), font(8, Font.NORMAL, Color.DARK_GRAY)));
        spacer(d, 8);

        section(d, "CLINICIAN-CONTROLLED RECOMMENDATIONS");
        if (data.recommendations().isEmpty()) d.add(new Paragraph("No current rule-based recommendation is available. This is not evidence that no care need exists.", font(8, Font.NORMAL, Color.DARK_GRAY)));
        for (var item : data.recommendations()) d.add(new Paragraph("- " + item.finding().title() + " | " + pretty(item.reviewState())
                + " | " + (item.modifiedRecommendation() == null ? item.finding().suggestedAction() : item.modifiedRecommendation()),
                font(8, Font.NORMAL, Color.DARK_GRAY)));
        spacer(d, 8);
        d.add(new Paragraph("Method: TREND PROJECTION · Model: " + CkdProgressionForecastService.MODEL_VERSION
                + " · Validation: " + CkdProgressionForecastService.VALIDATION_STATUS
                + " · Local validation: " + CkdProgressionForecastService.LOCAL_VALIDATION_STATUS,
                font(8, Font.BOLD, TEAL)));
        d.add(new Paragraph("Clinical decision support only. Forecasts and risk estimates are not autonomous diagnoses.",
                font(9, Font.BOLD | Font.ITALIC, RED)));
    }

    private static void addEgfrChart(Document d, PdfWriter writer, ClinicalIntelligenceEngine.Trend egfr,
                                     Map<Integer,CkdProgressionForecastService.Forecast> forecasts) throws Exception {
        float width = 510, height = 175, left = 42, right = 12, bottom = 25, top = 12;
        PdfContentByte content = writer.getDirectContent();
        PdfTemplate chart = content.createTemplate(width, height);
        List<ClinicalIntelligenceEngine.Observation> measured = egfr.observations();
        Instant start = measured.getFirst().observedAt();
        Instant end = forecasts.values().stream().filter(f -> f.forecastDate() != null).map(CkdProgressionForecastService.Forecast::forecastDate)
                .max(Instant::compareTo).orElse(measured.getLast().observedAt());
        if (!end.isAfter(start)) end = start.plus(Duration.ofDays(1));
        double maxValue = measured.stream().mapToDouble(ClinicalIntelligenceEngine.Observation::value).max().orElse(90);
        for (var f : forecasts.values()) if (f.projectedEgfrHigh() != null) maxValue = Math.max(maxValue, f.projectedEgfrHigh());
        double yMax = Math.max(100, Math.ceil((maxValue + 5) / 10) * 10);
        BaseFont base = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
        chart.setColorFill(Color.WHITE); chart.rectangle(0,0,width,height); chart.fill();
        for (int boundary : List.of(15,30,45,60,90)) {
            float y = bottom + (float)(boundary / yMax) * (height-bottom-top);
            chart.setColorStroke(new Color(210,215,218)); chart.setLineWidth(.45f); chart.moveTo(left,y); chart.lineTo(width-right,y); chart.stroke();
            chart.beginText(); chart.setFontAndSize(base,6); chart.setColorFill(Color.GRAY); chart.setTextMatrix(2,y-2); chart.showText(String.valueOf(boundary)); chart.endText();
        }
        chart.setColorStroke(new Color(40,104,160)); chart.setLineWidth(1.8f); chart.setLineDash(0);
        boolean first = true;
        for (var point : measured) {
            float x = chartX(point.observedAt(), start, end, left, width-right);
            float y = chartY(point.value(), yMax, bottom, height-top);
            if (first) { chart.moveTo(x,y); first=false; } else chart.lineTo(x,y);
        }
        chart.stroke();
        for (var point : measured) {
            float x=chartX(point.observedAt(),start,end,left,width-right), y=chartY(point.value(),yMax,bottom,height-top);
            chart.setColorFill(new Color(40,104,160)); chart.circle(x,y,2.4f); chart.fill();
        }
        List<CkdProgressionForecastService.Forecast> available = forecasts.values().stream().filter(f -> "AVAILABLE".equals(f.status()) && f.projectedEgfr() != null)
                .sorted(java.util.Comparator.comparingInt(CkdProgressionForecastService.Forecast::horizonMonths)).toList();
        if (!available.isEmpty()) {
            chart.setColorStroke(TEAL); chart.setLineWidth(1.7f); chart.setLineDash(5,3,0);
            var latest=measured.getLast(); chart.moveTo(chartX(latest.observedAt(),start,end,left,width-right),chartY(latest.value(),yMax,bottom,height-top));
            for (var point : available) chart.lineTo(chartX(point.forecastDate(),start,end,left,width-right), chartY(point.projectedEgfr(),yMax,bottom,height-top));
            chart.stroke(); chart.setLineDash(0);
            for (var point : available) {
                float x=chartX(point.forecastDate(),start,end,left,width-right);
                if (point.projectedEgfrLow()!=null && point.projectedEgfrHigh()!=null) {
                    float low=chartY(point.projectedEgfrLow(),yMax,bottom,height-top), high=chartY(point.projectedEgfrHigh(),yMax,bottom,height-top);
                    chart.setColorStroke(new Color(83,151,145)); chart.setLineWidth(3.2f); chart.moveTo(x,low); chart.lineTo(x,high); chart.stroke();
                }
                chart.setColorFill(TEAL); chart.circle(x,chartY(point.projectedEgfr(),yMax,bottom,height-top),2.5f); chart.fill();
            }
        }
        chart.setColorStroke(Color.DARK_GRAY); chart.setLineWidth(.7f); chart.rectangle(left,bottom,width-left-right,height-bottom-top); chart.stroke();
        Image image = Image.getInstance(chart); image.scaleToFit(width, height); image.setAlignment(Element.ALIGN_CENTER); d.add(image);
        d.add(new Paragraph("Blue solid line/points: measured eGFR. Teal dashed line: projected eGFR. Teal vertical bars: approximate prediction interval when estimable. Horizontal guides: eGFR category boundaries.",
                font(7, Font.ITALIC, Color.DARK_GRAY)));
    }

    private static float chartX(Instant value, Instant start, Instant end, float min, float max) {
        double total=Math.max(1,Duration.between(start,end).toMillis());
        return min+(float)(Duration.between(start,value).toMillis()/total)*(max-min);
    }
    private static float chartY(double value,double maxValue,float min,float max){return min+(float)(Math.max(0,Math.min(maxValue,value))/maxValue)*(max-min);}
    private static ClinicalIntelligenceEngine.Trend trend(ClinicalIntelligenceEngine.Analysis analysis,String key){return analysis.trends().stream().filter(t->key.equals(t.metric())).findFirst().orElse(null);}
    private static String observationValue(ClinicalIntelligenceEngine.Trend trend){return trend==null||trend.latest()==null?"Unavailable":trend.latest().value()+" "+trend.unit();}

    private static void addDiseaseProbabilities(Document d, Map<String, Object> assessment) throws DocumentException {
        section(d, "RELATED DISEASE PROBABILITIES");
        double probability = ((Number) assessment.get("probability")).doubleValue();
        var snapshot = DiseaseProbabilitySnapshot.fromStored(assessment.get("disease_probability_snapshot"),
                probability, Objects.toString(assessment.get("model_version"), ""));
        Paragraph note = new Paragraph("Assessment-time model outputs. Disease probabilities are separate from AI confidence, measured abnormalities and confirmed diagnoses.", font(8, Font.NORMAL, Color.DARK_GRAY));
        note.setSpacingAfter(6); d.add(note);
        if (snapshot.capturedAt() == null) {
            Paragraph legacy = new Paragraph("Related-risk availability was not captured for this older assessment. No historical percentages have been backfilled.", font(8, Font.ITALIC, Color.DARK_GRAY));
            legacy.setSpacingAfter(6); d.add(legacy);
        }
        PdfPTable risks = table(4, new float[]{1.2f, .85f, 1f, 2.1f});
        headerRow(risks, "Disease / outcome", "Probability", "Time horizon", "Model & availability");
        risks.setHeaderRows(1);
        risks.setSplitLate(false);
        for (var entry : snapshot.entries()) {
            cell(risks, entry.label(), true);
            cell(risks, "AVAILABLE".equals(entry.status()) ? pct(entry.probability()) : "Data unavailable", true);
            cell(risks, entry.horizon(), false);
            cell(risks, entry.modelVersion() + " · " + pretty(entry.status()) + "\n" + entry.reason(), false);
        }
        d.add(risks);
        Paragraph trace = new Paragraph(snapshot.capturedAt() == null ? "Related-risk snapshot: not recorded."
                : "Related-risk snapshot captured: " + snapshot.capturedAt() + " · Clinical interpretation required.", font(8, Font.ITALIC, Color.DARK_GRAY));
        trace.setSpacingBefore(5); d.add(trace);
    }

    private static void addStageIndicator(Document d, String selected) throws DocumentException {
        PdfPTable t = table(6, new float[]{1,1,1,1,1,1});
        for (String g : List.of("G1","G2","G3a","G3b","G4","G5")) {
            PdfPCell c = new PdfPCell(new Phrase((g.equals(selected) ? "● " : "○ ") + g, font(10, Font.BOLD, g.equals(selected) ? TEAL : Color.GRAY)));
            c.setHorizontalAlignment(Element.ALIGN_CENTER); c.setPadding(7); c.setBackgroundColor(g.equals(selected) ? LIGHT_TEAL : Color.WHITE); c.setBorderColor(new Color(210,215,218)); t.addCell(c);
        }
        d.add(t);
    }

    private static Map<String,Object> findInput(List<Map<String,Object>> inputs, String feature) {
        for (Map<String,Object> i : inputs) if (feature.equals(Objects.toString(i.get("feature_key"), ""))) return i;
        return null;
    }
    private static void inputRow(PdfPTable t, Map<String,Object> i) {
        cell(t, label(i.get("feature_key")), false); cell(t, value(i), false); cell(t, i.get("unit"), false); cell(t, source(i), false);
    }
    private static void inputRowWithCode(PdfPTable t, Map<String,Object> i) {
        cell(t, label(i.get("feature_key")), false); cell(t, value(i), false); cell(t, i.get("unit"), false); cell(t, source(i), false);
        String coding = i.get("code") == null ? "-" : (i.get("coding_system") != null && Objects.toString(i.get("coding_system")).contains("loinc") ? "LOINC " : "") + i.get("code");
        cell(t, coding, false);
    }
    private static void factorRow(PdfPTable t, Map<String,Object> f) {
        cell(t, label(f.get("feature_key")), false); cell(t, f.get("input_value"), false); cell(t, f.get("unit"), false);
        String dir = Objects.toString(f.get("contribution_direction"), "MODEL CONTRIBUTION").replace('_',' ');
        cell(t, dir.contains("INCREASE") ? "Increases prediction" : dir.contains("REDUCE") ? "Reduces prediction" : dir, false);
        cell(t, f.get("contribution_value"), false);
    }
    private static String source(Map<String,Object> i) {
        String s = Objects.toString(i.get("source_type"), "Not recorded");
        Object report = i.get("source_report"); if (report != null) s += "\n" + report;
        Object conf = i.get("extraction_confidence"); if (conf instanceof Number n) s += String.format(Locale.ROOT, "\n%.0f%% confidence", n.doubleValue()*100);
        if (Boolean.TRUE.equals(i.get("manual_override"))) s = "MANUAL OVERRIDE\n" + s;
        return s;
    }
    private static String value(Map<String,Object> i) { Object v=i.get("value_numeric"); return v==null?Objects.toString(i.get("value_text"),"Not recorded"):Objects.toString(v); }
    private static String label(Object feature) {
        return switch (Objects.toString(feature, "")) {
            case "Age" -> "Age"; case "BMI" -> "BMI"; case "SystolicBP" -> "Systolic blood pressure"; case "DiastolicBP" -> "Diastolic blood pressure";
            case "FastingBloodSugar" -> "Fasting blood sugar"; case "HbA1c" -> "HbA1c"; case "SerumCreatinine" -> "Serum creatinine";
            case "BUNLevels" -> "Blood urea nitrogen (BUN)"; case "GFR" -> "eGFR"; case "ProteinInUrine" -> "Urine protein";
            case "ACR" -> "Urine albumin/creatinine ratio (ACR)"; case "SerumElectrolytesPotassium" -> "Serum potassium";
            case "HemoglobinLevels" -> "Hemoglobin"; case "Edema" -> "Edema"; case "FamilyHistoryKidneyDisease" -> "Family history of kidney disease";
            case "PreviousAcuteKidneyInjury" -> "Previous acute kidney injury"; case "NSAIDsUse" -> "NSAID use"; default -> Objects.toString(feature, "Clinical feature");
        };
    }
    private static void title(Document d, String text, int size, Color color) throws DocumentException { Paragraph p=new Paragraph(text,font(size,Font.BOLD,color));p.setAlignment(Element.ALIGN_CENTER);d.add(p); }
    private static void section(Document d, String text) throws DocumentException { Paragraph p=new Paragraph(text,font(11,Font.BOLD,TEAL));p.setSpacingBefore(2);p.setSpacingAfter(5);d.add(p); }
    private static void spacer(Document d, float size) throws DocumentException { Paragraph p=new Paragraph(" ");p.setLeading(size);d.add(p); }
    private static PdfPTable table(int cols,float[] widths){PdfPTable t=new PdfPTable(cols);t.setWidthPercentage(100);try{t.setWidths(widths);}catch(DocumentException ignored){}t.setSplitRows(true);return t;}
    private static void headerRow(PdfPTable t,String... labels){for(String s:labels){PdfPCell c=new PdfPCell(new Phrase(s,font(8,Font.BOLD,Color.WHITE)));c.setBackgroundColor(TEAL);c.setPadding(5);c.setBorderColor(TEAL);t.addCell(c);}}
    private static void row(PdfPTable t,String k,Object v){PdfPCell a=new PdfPCell(new Phrase(k,font(8,Font.BOLD,Color.DARK_GRAY)));a.setBackgroundColor(LIGHT_GRAY);a.setPadding(5);a.setBorderColor(new Color(215,220,223));t.addCell(a);cell(t,valueOr(v,"Not recorded"),false);}
    private static void cell(PdfPTable t,Object v,boolean bold){PdfPCell c=new PdfPCell(new Phrase(valueOr(v,"-"),font(8,bold?Font.BOLD:Font.NORMAL,Color.DARK_GRAY)));c.setPadding(5);c.setBorderColor(new Color(215,220,223));t.addCell(c);}
    private static void summaryCell(PdfPTable t,String label,String value,Color color){PdfPCell c=new PdfPCell();c.setPadding(9);c.setBackgroundColor(new Color(248,250,250));c.setBorderColor(color);Paragraph a=new Paragraph(label,font(7,Font.BOLD,Color.GRAY));Paragraph b=new Paragraph(value,font(15,Font.BOLD,color));c.addElement(a);c.addElement(b);t.addCell(c);}
    private static Font font(int size,int style,Color color){return new Font(Font.HELVETICA,size,style,color);}
    private static String modelScore(Object value){return value instanceof Number n?String.format(Locale.ROOT,"%.4f (0-1; calibration unverified)",n.doubleValue()):"Not available";}
    private static String pct(Object v){if(v instanceof Number n)return String.format(Locale.ROOT,"%.1f%%",n.doubleValue()*100);return "N/A";}
    private static String pretty(Object v){return Objects.toString(v,"N/A").replace('_',' ');}
    private static String valueOr(Object v,String fallback){String s=Objects.toString(v,"").trim();return s.isEmpty()?fallback:s;}
    private static Color riskColor(Object risk){return switch(Objects.toString(risk,"HIGH")){case "LOW"->GREEN;case "MODERATE"->AMBER;case "URGENT_REVIEW"->RED;default->ORANGE;};}

    private static class FooterEvent extends PdfPageEventHelper {
        private final String patient; private final String report;
        FooterEvent(String patient,String report){this.patient=patient;this.report=report;}
        @Override public void onEndPage(PdfWriter writer, Document document){
            Font f=font(7,Font.NORMAL,Color.GRAY);
            ColumnText.showTextAligned(writer.getDirectContent(),Element.ALIGN_LEFT,new Phrase("GovCare EHR · CKD Clinical Decision Support · Patient: "+patient,f),document.left(),29,0);
            ColumnText.showTextAligned(writer.getDirectContent(),Element.ALIGN_RIGHT,new Phrase("Assessment: "+report+" · Page "+writer.getPageNumber(),f),document.right(),25,0);
            ColumnText.showTextAligned(writer.getDirectContent(),Element.ALIGN_LEFT,new Phrase("Clinical decision support only. Forecasts and risk estimates are not autonomous diagnoses.",f),document.left(),18,0);
        }
    }
    public record StoredReport(Resource resource,String filename){}
}
