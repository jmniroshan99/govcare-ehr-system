package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayOutputStream;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class CkdOutlookUiAndPdfTest {
    static final ObjectMapper JSON=new ObjectMapper();
    static final UUID PATIENT=UUID.fromString("00000000-0000-4000-8000-000000000001"), HOSPITAL=UUID.fromString("00000000-0000-4000-8000-000000000002");
    static ObjectNode fixture(String kind) {
        Instant now=Instant.now();var source=CkdOutlookEngineTest.source();
        var current=(ObjectNode)source.path("clinicalFeatureData").path("current");
        current.withObject("egfr").put("observedAt",now.minusSeconds(86400).toString());current.withObject("acr").put("observedAt",now.minusSeconds(86400).toString());
        var history=(ObjectNode)source.path("clinicalFeatureData").path("history");
        var egfr=history.putArray("egfr");for(int i=0;i<5;i++)egfr.addObject().put("value",45-i*5).put("observedAt",now.minusSeconds((1+90L*(4-i))*86400).toString()).put("unit","mL/min/1.73m²").put("source","SYNTHETIC VERIFIED SOURCE").put("sourceId","synthetic-egfr-"+i);
        history.putArray("acr").add(current.path("acr").deepCopy());
        if(kind.equals("missing")){current.withObject("acr").putNull("value").put("state","MISSING");history.putArray("acr");}
        if(kind.equals("stale"))current.withObject("acr").put("observedAt",now.minusSeconds(100*86400).toString()).put("state","STALE");
        if(kind.equals("dialysis"))source.withObject("kidneyFailureStatus").put("dialysisStatus","VERIFIED_MAINTENANCE_HEMODIALYSIS").put("lastVerifiedDate",now.minusSeconds(86400).toString());
        for(String key:List.of("anemia","hyperkalemia","dialysisAdequacy","renalDeterioration","cardiovascularMonitoring")) {
            var module=source.putObject(key).put("label",key);var clinical=module.putObject("clinicalAssessment").put("title",key).put("riskLevel","Current monitoring");
            if(key.equals("anemia"))clinical.put("currentValue",11.3).put("unit","g/dL");
            else if(key.equals("hyperkalemia"))clinical.put("currentValue",5.1).put("unit","mmol/L");
            else clinical.putNull("currentValue").put("unit","");
        }
        var e=CkdOutlookEngine.evidence(source,Map.of("date_of_birth","1961-02-01","gender","Male"),false,now);
        var out=JSON.createObjectNode().put("patientId",PATIENT.toString()).put("hospitalId",HOSPITAL.toString()).put("generatedAt",now.toString()).put("canWrite",true).put("reportAssessmentId",UUID.randomUUID().toString());
        out.set("evidence",e);out.set("readiness",CkdOutlookEngine.assess(e,null,now));
        out.putNull("assessment");out.putArray("previousAssessments");
        if(kind.equals("available")||kind.equals("changed")) {
            var recorded=CkdOutlookEngine.assess(e,CkdOutlookEngineTest.CONFIRMED,now).put("id",UUID.randomUUID().toString()).put("patientId",PATIENT.toString()).put("hospitalId",HOSPITAL.toString()).put("evidenceFingerprint",e.path("fingerprint").asText()).put("reviewState","ACCEPT").put("reviewVersion",1);
            var review=recorded.putObject("review").put("reason","Synthetic operational clinical review").put("clinical_note","Software demonstration only; not a clinical subject.").putNull("modified_interpretation").put("reviewedAt",now.toString());
            review.putArray("milestones").addObject().put("year",1).put("title","Review verified renal measurements and the individualized follow-up interval");
            out.set("assessment",recorded);
            var past=out.withArray("previousAssessments");
            for(int i=0;i<2;i++){var item=past.addObject().put("id",i==0?recorded.path("id").asText():UUID.randomUUID().toString()).put("assessedAt",now.minusSeconds(i*90L*86400).toString()).put("status","AVAILABLE").put("twoYearRisk",i==0?recorded.path("twoYearRisk").asDouble():.07).put("fiveYearRisk",i==0?recorded.path("fiveYearRisk").asDouble():.25);item.put("evidenceFingerprint",e.path("fingerprint").asText());}
            if(kind.equals("changed")){e.withObject("inputs").withObject("acr").put("value",400);e.put("fingerprint","b".repeat(64));out.set("readiness",CkdOutlookEngine.assess(e,null,now));}
        }
        return out;
    }
    @Test void exportedPdfUsesTheStoredSnapshotAndPreservesTheExistingReport() throws Exception {
        var data=fixture("available");var snapshot=data.path("assessment");
        var row=new HashMap<String,Object>();row.put("patient_id",PATIENT.toString());row.put("patient_no","SYNTHETIC-OUTLOOK-QA");row.put("full_name","SYNTHETIC SOFTWARE DEMONSTRATION - NOT A CLINICAL RECORD");row.put("probability",.32);row.put("confidence",.8);row.put("risk_category","MODERATE");row.put("model_version","SOFTWARE-QA");row.put("created_at",Instant.now().toString());
        byte[] bytes=CkdAssessmentReportService.pdf(row,List.of(),List.of(),List.of(),UUID.randomUUID(),null,Map.of(),List.of(),null,null,snapshot);
        try(var pdf=Loader.loadPDF(bytes)){String text=new PDFTextStripper().getText(pdf);assertTrue(text.contains("FIVE-YEAR CKD OUTLOOK"));assertTrue(text.contains("30.63%"));assertTrue(text.contains("9.01%"));assertTrue(text.contains("NOT COMPLETED"));assertTrue(text.contains("Observed kidney history"));assertTrue(text.contains("individualized follow-up interval"));assertTrue(text.contains("CKD RISK SUMMARY"));assertTrue(text.contains("No inference was performed"));assertFalse(text.contains("Projected eGFR in five years"));}
        String output=System.getProperty("govcare.outlook.fixtureDir");
        if(output!=null){Path folder=Path.of(output);Files.createDirectories(folder);Files.write(folder.resolve("GovCare_V54_Synthetic_Five_Year_Outlook.pdf"),bytes);}
    }
    @Test void unavailableAndDialysisPdfNeverSubstituteZeroForMissingRisk() throws Exception {
        for(String kind:List.of("missing","dialysis")) {
            var result=fixture(kind).path("readiness");var stream=new ByteArrayOutputStream();var d=new Document();var writer=PdfWriter.getInstance(d,stream);d.open();CkdOutlookReport.add(d,writer,result);d.close();
            try(var pdf=Loader.loadPDF(stream.toByteArray())){String text=new PDFTextStripper().getText(pdf);assertTrue(text.contains("Not estimated"));assertFalse(text.contains("0.00%"));}
        }
    }
    @Test void browserFixturesComeFromTheActualEquationAndEligibilityEngine() throws Exception {
        var fixtures=JSON.createObjectNode();for(String kind:List.of("ready","available","missing","stale","dialysis","changed"))fixtures.set(kind,fixture(kind));
        var risk=lk.gov.health.govcare.ai.predictive.KfreFourVariableEquation.calculate(65,"MALE",30,400,"mg/g");
        fixtures.putObject("scenarioReference").put("hypothetical",true).put("persisted",false).put("snapshotId",fixtures.path("available").path("assessment").path("id").asText()).put("twoYearRisk",risk.twoYearRisk()).put("fiveYearRisk",risk.fiveYearRisk()).put("label","Hypothetical input sensitivity; not a treatment effect").put("recordedAsOf",fixtures.path("available").path("assessment").path("assessedAt").asText()).putObject("assumptions").put("egfr",30).put("acrMgG",400);
        assertEquals(.30627437347101205,fixtures.path("available").path("assessment").path("fiveYearRisk").asDouble(),1e-12);
        assertTrue(fixtures.path("dialysis").path("readiness").path("fiveYearRisk").isNull());
        String output=System.getProperty("govcare.outlook.fixtureDir");if(output!=null){Path folder=Path.of(output);Files.createDirectories(folder);Files.writeString(folder.resolve("ui-fixtures.json"),fixtures.toPrettyString());}
    }
}
