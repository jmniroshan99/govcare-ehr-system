package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SriLankanRenalReportTest {
    @Test void exportedReportIncludesStoredModelMethodValidationExplanationAndReviewProvenance() throws Exception {
        var mapper = new ObjectMapper(); UUID id = UUID.randomUUID();
        var output = mapper.readTree("""
                {"status":"AVAILABLE","model":"LK-RENAL-HB-1.0","model_key":"hb","model_version":"1.0.0",
                 "method":"PERSISTENCE_BASELINE","algorithm":"Persistence","prediction":10.5,"unit":"g/dL","probability":null,
                 "validation_status":"INTERNAL_RESEARCH_EVALUATION","clinical_validation":"NOT_COMPLETED","dataset_permission_status":"UNVERIFIED",
                 "data_quality":{"flags":[],"missing_fields":["albumin"]},"interval":null,
                 "explanation":{"method":"BASELINE","top_factors":[],"trends":["Latest measured Hb is the persistence estimate"],
                 "limitations":["Candidate model failed to beat persistence; no clinical validation"]}}
                """);
        var prediction = new SriLankanRenalIntelligenceService.PredictionView(id, "hb", "AVAILABLE", output,
                Instant.parse("2026-01-01T12:00:00Z"), "DEFER", 2);
        var identity = Map.<String,Object>of("patient_no", "P-1", "full_name", "Test patient", "model_version", "Test",
                "probability", .1, "risk_category", "LOW", "confidence", .8);
        byte[] pdf = CkdAssessmentReportService.pdf(identity, List.of(), List.of(), List.of(), UUID.randomUUID(), null, Map.of(), List.of(prediction));
        try (var document = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(document);
            assertTrue(text.contains("SRI LANKAN RENAL PREDICTIVE INTELLIGENCE"));
            assertTrue(text.contains("LK-RENAL-HB-1.0")); assertTrue(text.contains("PERSISTENCE_BASELINE"));
            assertTrue(text.contains("Clinical validation: NOT COMPLETED")); assertTrue(text.contains("Dataset permission: UNVERIFIED"));
            assertTrue(text.contains("10.5 g/dL (PREDICTED)")); assertTrue(text.contains("DEFER / version 2"));
            assertTrue(text.contains("RiskAssessment/" + id)); assertTrue(text.contains("Candidate model failed to beat persistence"));
            assertTrue(document.getNumberOfPages() >= 3);
        }
    }
    @Test void exportedReportAutomaticallyIncludesFourRenalGraphicsAndCompositeResearchSignals() throws Exception {
        var mapper = new ObjectMapper(); UUID hyperId = UUID.randomUUID();
        var hyperOutput = mapper.readTree("""
                {"status":"AVAILABLE","model":"LK-RENAL-HYPERK-1.0","model_key":"hyperkalemia","model_version":"1.0.0",
                 "method":"RESEARCH_MODEL","algorithm":"LogisticRegression","prediction":null,"probability":0.42,"unit":"probability",
                 "risk_category":"RESEARCH_RISK_SCORE","interval":null,"validation_status":"INTERNAL_RESEARCH_EVALUATION",
                 "clinical_validation":"NOT_COMPLETED","dataset_permission_status":"UNVERIFIED","requires_clinician_review":true,
                 "data_quality":{"flags":[],"missing_fields":[]},"explanation":{"method":"SHAP","top_factors":[],"trends":[],
                 "limitations":["Research probability is not clinically calibrated"]}}
                """);
        var hyper = new SriLankanRenalIntelligenceService.PredictionView(hyperId, "hyperkalemia", "AVAILABLE", hyperOutput,
                Instant.parse("2026-02-01T12:00:00Z"), "AWAITING_REVIEW", 0);
        var first = new SriLankanRenalIntelligenceService.ObservationView(UUID.randomUUID(), Instant.parse("2026-01-01T10:00:00Z"), true,
                Map.of("hb", 10.8, "potassium_pre", 4.8, "creatinine_pre", 700.0, "urea_pre", 20.0, "albumin", 38.0, "urr", 68.0),
                Map.of("hb", "g/dL", "potassium_pre", "mmol/L", "creatinine_pre", "umol/L", "urea_pre", "mmol/L", "albumin", "g/L", "urr", "%"),
                "Verified", List.of());
        var second = new SriLankanRenalIntelligenceService.ObservationView(UUID.randomUUID(), Instant.parse("2026-02-01T10:00:00Z"), true,
                Map.of("hb", 10.2, "potassium_pre", 5.2, "creatinine_pre", 730.0, "urea_pre", 22.0, "albumin", 37.0, "urr", 64.0),
                Map.of("hb", "g/dL", "potassium_pre", "mmol/L", "creatinine_pre", "umol/L", "urea_pre", "mmol/L", "albumin", "g/L", "urr", "%"),
                "Verified", List.of());
        var components = List.of(
                new SriLankanRenalIntelligenceService.CompositeComponent("creatinine_pre","Pre-dialysis creatinine","RISING","RISING",730.0,700.0,"umol/L",true,true),
                new SriLankanRenalIntelligenceService.CompositeComponent("urea_pre","Pre-dialysis urea","RISING","RISING",22.0,20.0,"mmol/L",true,true),
                new SriLankanRenalIntelligenceService.CompositeComponent("potassium_pre","Pre-dialysis potassium","RISING","RISING",5.2,4.8,"mmol/L",true,true),
                new SriLankanRenalIntelligenceService.CompositeComponent("hb","Hemoglobin","FALLING","FALLING",10.2,10.8,"g/dL",true,true),
                new SriLankanRenalIntelligenceService.CompositeComponent("albumin","Albumin","FALLING","FALLING",37.0,38.0,"g/L",true,true),
                new SriLankanRenalIntelligenceService.CompositeComponent("urr","URR","FALLING","FALLING",64.0,68.0,"%",true,true));
        var composite = new SriLankanRenalIntelligenceService.RenalDeteriorationComposite("MULTIDOMAIN_WORSENING_SIGNAL",100,6,6,
                "HEURISTIC_DIRECTIONAL_COMPOSITE","NOT_CLINICALLY_VALIDATED",List.of("Not a disease probability"),components);
        var overview = new SriLankanRenalIntelligenceService.Overview(UUID.randomUUID(), UUID.randomUUID(),
                new SriLankanRenalIntelligenceService.RenalStatus("G5D","Kidney Failure on Dialysis","Verified maintenance hemodialysis"),
                List.of(first,second),List.of(hyper),composite,true,false);
        var identity = Map.<String,Object>of("patient_no", "P-2", "full_name", "Research fixture", "model_version", "Test",
                "probability", .2, "risk_category", "MODERATE", "confidence", .7);
        byte[] pdf = CkdAssessmentReportService.pdf(identity, List.of(), List.of(), List.of(), UUID.randomUUID(), null, Map.of(), List.of(hyper), overview);
        try (var document = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(document);
            assertTrue(text.contains("CKD-RELATED CLINICAL RISKS & PREDICTIVE INTELLIGENCE"));
            assertTrue(text.contains("Anemia / Hb Deterioration")); assertTrue(text.contains("Hyperkalemia Monitoring"));
            assertTrue(text.contains("Dialysis Adequacy / URR")); assertTrue(text.contains("Renal Clinical Deterioration"));
            assertTrue(text.contains("Renal Clinical Trajectory")); assertTrue(text.contains("Kidney Failure / G5D"));
            assertFalse(text.contains("RELATED DISEASE PROBABILITIES"));
        }
    }

}
