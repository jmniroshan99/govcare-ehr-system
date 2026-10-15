package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.ai.predictive.CkdProgressionForecastService;
import lk.gov.health.govcare.documents.DocumentStorageService;
import lk.gov.health.govcare.security.ClinicalPatientAccess;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CkdAssessmentReportTest {
    private static final UUID PATIENT = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final UUID ASSESSMENT = UUID.fromString("00000000-0000-4000-8000-000000000002");
    private static final String MODEL = "GOVCARE-CKD-LOGISTIC-1.0";

    private Map<String,Object> fixture(boolean withSnapshot) {
        Map<String,Object> m = new HashMap<>();
        m.put("patient_id", PATIENT.toString()); m.put("patient_no", "SYNTHETIC-QA-ONLY");
        m.put("full_name", "SYNTHETIC TEST FIXTURE - NOT A PATIENT RECORD");
        m.put("probability", .32145); m.put("confidence", .99); m.put("risk_category", "LOW");
        m.put("model_version", MODEL); m.put("created_at", "2026-10-06T12:00:00Z");
        if (withSnapshot) m.put("disease_probability_snapshot", DiseaseProbabilityChecks.stored(
                DiseaseProbabilitySnapshot.capture(.32145, MODEL, Instant.parse("2026-10-06T12:00:00Z"), List.of())));
        return m;
    }

    @Test void actualPdfIncludesAllOutcomesAndSeparatesConfidence() throws Exception {
        byte[] bytes = CkdAssessmentReportService.pdf(fixture(true), List.of(), List.of(), List.of(), ASSESSMENT);
        try (var document = Loader.loadPDF(bytes)) {
            String text = new PDFTextStripper().getText(document).replaceAll("\\s+", " ");
            assertTrue(text.contains("CKD-RELATED CLINICAL RISKS & PREDICTIVE INTELLIGENCE"));
            assertTrue(text.contains("32.1%")); assertTrue(text.contains("99.0%"));
            assertTrue(text.contains("Result not calculated - insufficient longitudinal data.")); assertFalse(text.contains("0.0%"));
            for (String label : List.of("Renal Clinical Trajectory", "Kidney Failure / G5D", "Hyperkalemia Monitoring", "Anemia / Hb Deterioration", "Dialysis Adequacy / URR", "Renal Clinical Deterioration")) assertTrue(text.contains(label), label);
            assertFalse(text.contains("RELATED DISEASE PROBABILITIES"));
            assertTrue(text.contains("2026-10-06T12:00:00Z"));
            assertTrue(document.getNumberOfPages() >= 2);
        }
    }

    @Test void oldAssessmentPdfDoesNotInventHistoricalAvailability() throws Exception {
        byte[] bytes = CkdAssessmentReportService.pdf(fixture(false), List.of(), List.of(), List.of(), ASSESSMENT);
        try (var document = Loader.loadPDF(bytes)) {
            String text = new PDFTextStripper().getText(document).replaceAll("\\s+", " ");
            assertTrue(text.contains("No six-module snapshot has been stored")); assertTrue(text.contains("Result not calculated - insufficient longitudinal data."));
            assertTrue(text.contains("No inference was performed")); assertFalse(text.contains("0.0%"));
        }
    }

    @Test void predictiveAppendixLabelsMeasuredAndProjectedEvidenceWithLimitations() throws Exception {
        Instant now=Instant.parse("2026-10-01T00:00:00Z");
        var analysis=ClinicalIntelligenceEngine.analyze(List.of(
                observation("e1","egfr",52,"mL/min/1.73m2",now.minus(365,ChronoUnit.DAYS),"48642-3"),
                observation("e2","egfr",47,"mL/min/1.73m2",now.minus(180,ChronoUnit.DAYS),"48642-3"),
                observation("e3","egfr",43,"mL/min/1.73m2",now.minus(2,ChronoUnit.DAYS),"48642-3"),
                observation("c1","creatinine",1.2,"mg/dL",now.minus(2,ChronoUnit.DAYS),"2160-0")
        ),now,LocalDate.of(1970,1,1));
        var engine=new CkdProgressionForecastService();
        Map<Integer,CkdProgressionForecastService.Forecast> forecasts=new java.util.LinkedHashMap<>();
        for(int horizon:List.of(3,6,12)) forecasts.put(horizon,engine.calculate(analysis,horizon,false));
        var risk=new PredictiveIntelligenceService.RiskCapability("ckd_progression","CKD progression trajectory","AVAILABLE",
                "Patient-specific trend projection.",null,CkdProgressionForecastService.MODEL_VERSION,
                "Patient-specific eGFR trajectory; not a population disease probability.","TREND_PROJECTION",
                CkdProgressionForecastService.VALIDATION_STATUS,"3 / 6 / 12 months","DECLINING","MODERATE",
                "Patient-specific eGFR projection",CkdProgressionForecastService.LOCAL_VALIDATION_STATUS,"ACTIVE",
                List.of("dated_egfr_series"),List.of(),List.of("Adults"),"Ordinary least squares",now,null);
        var medications=new LongitudinalClinicalFeatureService.MedicationContext(List.of(),List.of(),false,false,
                "Medication context unavailable; reconcile with the patient.");
        var overview=new PredictiveIntelligenceService.Overview(Map.of("id",PATIENT),analysis,List.of(),List.of(risk),
                List.of(),true,false,medications.limitation(),medications);

        byte[] bytes=CkdAssessmentReportService.pdf(fixture(true),List.of(),List.of(),List.of(),ASSESSMENT,overview,forecasts);

        try(var document=Loader.loadPDF(bytes)) {
            String text=new PDFTextStripper().getText(document).replaceAll("\\s+"," ");
            assertTrue(text.contains("PREDICTIVE CLINICAL INTELLIGENCE"));
            assertTrue(text.contains("HISTORICAL eGFR & PROJECTED TRAJECTORY"));
            assertTrue(text.contains("CKD-RELATED CLINICAL RISKS & PREDICTIVE INTELLIGENCE"));
            assertTrue(text.contains("3 months"));
            assertTrue(text.contains("12 months"));
            assertTrue(text.contains(CkdProgressionForecastService.MODEL_VERSION));
            assertTrue(text.contains("not autonomous diagnoses"));
            assertTrue(text.contains("Medication context unavailable"));
        }
    }

    private static ClinicalIntelligenceEngine.RawObservation observation(String id,String metric,double value,
                                                                          String unit,Instant at,String code) {
        return new ClinicalIntelligenceEngine.RawObservation(id,metric,value,unit,at.toString(),"TEST",id,null,null,code);
    }

    private GovCarePrincipal actor() {
        return new GovCarePrincipal(UUID.randomUUID(), UUID.randomUUID(), null, null, "qa@govcare.test", "Synthetic test clinician",
                "doctor", Set.of("PATIENT_VIEW_CLINICAL", "CONSULTATION_UPDATE"), true, false, 1);
    }

    @Test void deniedAssessmentCannotReadDataOrGenerateAFile() {
        SqlSupport sql = mock(SqlSupport.class); DocumentStorageService storage = mock(DocumentStorageService.class);
        ClinicalPatientAccess access = mock(ClinicalPatientAccess.class); CkdPredictionService predictions = mock(CkdPredictionService.class);
        var actor = actor(); when(predictions.assessmentScope(actor, ASSESSMENT, true)).thenThrow(ApiException.forbidden("Not assigned"));
        var service = new CkdAssessmentReportService(sql, storage, access, predictions);
        assertThrows(ApiException.class, () -> service.generate(actor, ASSESSMENT)); verifyNoInteractions(sql, storage);
    }

    @Test void reportGenerationRequiresClinicalWrite() {
        SqlSupport sql = mock(SqlSupport.class); DocumentStorageService storage = mock(DocumentStorageService.class);
        ClinicalPatientAccess access = mock(ClinicalPatientAccess.class); CkdPredictionService predictions = mock(CkdPredictionService.class);
        var actor = actor(); when(predictions.assessmentScope(actor, ASSESSMENT, true)).thenReturn(actor);
        when(sql.required(anyString(), anyMap(), anyString())).thenReturn(fixture(true));
        doThrow(ApiException.forbidden("Write required")).when(access).requireClinicalWrite(actor, PATIENT);
        var service = new CkdAssessmentReportService(sql, storage, access, predictions);
        assertThrows(ApiException.class, () -> service.generate(actor, ASSESSMENT));
        verify(sql, never()).list(anyString(), anyMap()); verifyNoInteractions(storage);
    }

    @Test void reportDownloadChecksPatientScopeBeforeStorageAccess() {
        SqlSupport sql = mock(SqlSupport.class); DocumentStorageService storage = mock(DocumentStorageService.class);
        ClinicalPatientAccess access = mock(ClinicalPatientAccess.class); CkdPredictionService predictions = mock(CkdPredictionService.class);
        var actor = actor(); when(sql.required(anyString(), anyMap(), anyString())).thenReturn(Map.of("patient_id", PATIENT));
        when(access.clinicalScope(actor, PATIENT, false)).thenThrow(ApiException.forbidden("Different hospital"));
        var service = new CkdAssessmentReportService(sql, storage, access, predictions);
        assertThrows(ApiException.class, () -> service.content(actor, UUID.randomUUID())); verifyNoInteractions(storage);
    }
}
