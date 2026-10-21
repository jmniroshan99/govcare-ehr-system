package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import java.awt.Color;
import java.util.List;

/** Presentation of immutable v4 result objects. No clinical calculation or model inference occurs here. */
final class ClinicalIntelligencePdfSummary {
    private static final Color NAVY=new Color(11,37,69),TEAL=new Color(10,92,88),MUTED=new Color(72,85,99),BORDER=new Color(220,229,235);
    private ClinicalIntelligencePdfSummary(){}
    static void add(Document document,PdfWriter writer,JsonNode snapshot)throws Exception{
        heading(document,"CKD Related Clinical Intelligence Summary");
        document.add(line("Assessment-linked snapshot: "+snapshot.path("snapshotId").asText("Not recorded"),8,Font.NORMAL,MUTED));
        document.add(line("Evaluated: "+snapshot.path("generatedAt").asText("Not recorded")+" | Rules: "+snapshot.path("clinicalRulesVersion").asText(),8,Font.NORMAL,MUTED));
        document.add(line("Recorded measurements, severity, observed trends, research predictions and input coverage are separate outputs.",9,Font.NORMAL,NAVY));
        PdfPTable cards=table(2);cards.setSplitLate(true);cards.setSplitRows(true);
        var continuation=new PdfPCell(new Phrase("CKD clinical intelligence summary - continued",font(9,Font.BOLD,TEAL)));continuation.setColspan(2);continuation.setBorder(Rectangle.NO_BORDER);continuation.setPaddingBottom(8);cards.addCell(continuation);cards.setHeaderRows(1);cards.setSkipFirstHeader(true);
        for(String key:List.of("anemia","hyperkalemia","dialysisAdequacy","renalTrajectory","cardiovascularMonitoring")){
            JsonNode c=assessment(snapshot,key),signal=c.path("clinicalSignal"),coverage=c.path("coverage");var card=cell();
            card.addElement(line(title(key),11,Font.BOLD,TEAL));
            card.addElement(line(signal.path("label").asText("Not assessed"),9,Font.BOLD,signal.path("abnormal").asBoolean()?new Color(164,31,42):NAVY));
            String label=key.equals("anemia")?"Recorded hemoglobin":key.equals("hyperkalemia")?"Recorded potassium":key.equals("dialysisAdequacy")?"Measured URR":"Recorded result";
            if(c.path("currentValue").isNumber()){
                card.addElement(line(label+": "+number(c.path("currentValue"))+" "+c.path("unit").asText(),10,Font.BOLD,NAVY));
                card.addElement(line("Collection: "+(c.path("currentAt").isTextual()?c.path("currentAt").asText():"Measurement date unverified; current relevance unknown"),8,Font.NORMAL,MUTED));
            }else if(key.equals("cardiovascularMonitoring"))card.addElement(line("Cardiovascular event risk not estimated - risk-factor review available.",9,Font.BOLD,NAVY));
            else if(c.path("trend").path("ready").asBoolean())card.addElement(line("Observed change: "+number(c.path("trend").path("absoluteChange"))+" "+c.path("trend").path("unit").asText()+" ("+number(c.path("trend").path("percentChange"))+"% change; not probability)",9,Font.BOLD,NAVY));
            else card.addElement(line(key.equals("renalTrajectory")?"Trend not established":"Result not calculated",9,Font.BOLD,NAVY));
            card.addElement(line("Recorded-input coverage: "+coverage.path("label").asText("Not established"),8,Font.BOLD,MUTED));
            card.addElement(CkdAssessmentReportService.dashboardProgress(coverage.path("percent").asInt(),MUTED));
            card.addElement(line("Evidence quality: "+readable(c.path("evidenceQuality").path("status").asText("NOT_ASSESSED")),8,Font.NORMAL,MUTED));
            for(JsonNode warning:c.path("evidenceQuality").path("warnings"))card.addElement(line(warning.asText(),8,Font.NORMAL,new Color(145,74,12)));
            if(signal.path("reviewPriority").asText().equals("PROMPT_VERIFICATION_AND_REVIEW"))card.addElement(line("Prompt source/date verification and clinical review required under the institutional protocol.",9,Font.BOLD,new Color(164,31,42)));
            String needs=joinRequirements(coverage.path("requiredInputs"));
            if(!needs.isBlank())card.addElement(line("Missing or unverified requirements: "+needs,8,Font.NORMAL,MUTED));
            JsonNode prediction=c.path("prediction");
            card.addElement(line("Prediction readiness: "+readable(prediction.path("status").asText()),8,Font.BOLD,NAVY));
            if(prediction.path("value").isNumber())card.addElement(line("Predicted value: "+number(prediction.path("value"))+" "+prediction.path("unit").asText()+" | "+prediction.path("outcome").asText(),8,Font.NORMAL,NAVY));
            if(prediction.path("researchScore").isNumber())card.addElement(line("Research score: "+number(prediction.path("researchScore"))+" (0-1 scale; uncalibrated)",8,Font.NORMAL,NAVY));
            card.addElement(line(prediction.path("reason").asText(),8,Font.NORMAL,MUTED));
            card.addElement(line("Rule: "+c.path("explanation").path("ruleId").asText()+" | "+c.path("explanation").path("version").asText(),8,Font.NORMAL,MUTED));
            card.addElement(line("Review priority: "+readable(c.path("review").path("priority").asText()),8,Font.BOLD,NAVY));
            cards.addCell(card);
        }
        var why=cell();why.setBackgroundColor(new Color(235,244,248));why.addElement(line("Why this result?",11,Font.BOLD,NAVY));
        why.addElement(line("The saved rule, equation or model produced each finding. Full explanations, evidence identifiers, units, collection times and versions follow. An unavailable prediction never suppresses a relevant recorded abnormality.",9,Font.NORMAL,NAVY));
        why.addElement(line("Coverage is not evidence quality or event risk. Measured URR and observed percentage change are not disease probabilities. No automatic treatment order is generated.",9,Font.NORMAL,NAVY));cards.addCell(why);document.add(cards);
        document.newPage();heading(document,"SAVED CLINICAL EVIDENCE AND REVIEW");
        for(String key:List.of("anemia","hyperkalemia","dialysisAdequacy","renalTrajectory","renalDeterioration","kidneyFailureStatus","cardiovascularMonitoring")){
            JsonNode c=assessment(snapshot,key),prediction=c.path("prediction");
            heading(document,title(key));
            document.add(line(c.path("message").asText(),9,Font.NORMAL,NAVY));
            document.add(line("Rule/method: "+c.path("rule").path("id").asText()+" | "+c.path("rule").path("version").asText()+" | "+c.path("method").asText(),8,Font.BOLD,TEAL));
            document.add(line("Coverage: "+c.path("coverage").path("label").asText()+". "+c.path("coverage").path("meaning").asText(),8,Font.NORMAL,MUTED));
            for(JsonNode requirement:c.path("coverage").path("requiredInputs"))document.add(line(requirement.path("label").asText()+": "+(requirement.path("recorded").asBoolean()?"recorded":"missing")+" | "+(requirement.path("satisfied").asBoolean()?"requirement satisfied":"requires review")+" | "+requirement.path("detail").asText(),8,Font.NORMAL,MUTED));
            for(JsonNode statement:c.path("explanation").path("statements"))document.add(line("Explanation: "+statement.asText(),8,Font.NORMAL,NAVY));
            for(JsonNode f:c.path("explanation").path("evidence"))document.add(line(f.path("label").asText()+": "+number(f.path("value"))+" "+f.path("unit").asText()+" | Collected: "+f.path("observedAt").asText("Measurement date unverified")+" | Source: "+f.path("source").asText()+" / "+f.path("sourceId").asText(),8,Font.NORMAL,MUTED));
            for(JsonNode warning:c.path("evidenceQuality").path("warnings"))document.add(line("Evidence limitation: "+warning.asText(),8,Font.NORMAL,new Color(145,74,12)));
            for(JsonNode investigation:c.path("supportingInvestigations"))document.add(line("Supporting investigation "+investigation.path("key").asText()+": "+(investigation.path("available").asBoolean()?number(investigation.path("measurement").path("value"))+" "+investigation.path("measurement").path("unit").asText():"not linked; source review required"),8,Font.NORMAL,MUTED));
            if(c.has("bloodPressurePair"))document.add(line("Paired blood pressure: "+(c.path("bloodPressurePair").path("verified").asBoolean()?c.path("bloodPressurePair").path("value").asText():"not verified; separate component provenance retained")+". "+c.path("bloodPressurePair").path("reason").asText(),8,Font.NORMAL,MUTED));
            JsonNode trend=c.path("trend");if(trend.path("ready").asBoolean())document.add(line("Observed dated pair: "+number(trend.path("previousValue"))+" to "+number(trend.path("currentValue"))+" "+trend.path("unit").asText()+" | "+trend.path("previousAt").asText()+" to "+trend.path("currentAt").asText()+" | elapsed "+number(trend.path("intervalDays"))+" days | absolute change "+number(trend.path("absoluteChange"))+" | percentage change "+number(trend.path("percentChange"))+"%. "+trend.path("message").asText(),8,Font.NORMAL,NAVY));
            document.add(line("Future output: "+prediction.path("outcome").asText()+" | Horizon: "+prediction.path("horizon").asText()+" | "+prediction.path("reason").asText(),8,Font.NORMAL,MUTED));
            document.add(line("Model: "+prediction.path("model").path("model").asText("Unavailable")+" | "+prediction.path("model").path("modelVersion").asText()+" | Method: "+prediction.path("model").path("method").asText()+" | Clinical validation: "+prediction.path("clinicalValidation").asText(),8,Font.NORMAL,MUTED));
            for(JsonNode factor:prediction.path("attribution").path("top_factors"))document.add(line("Model association: "+factor.path("feature").asText()+" | predictor "+number(factor.path("value"))+" | contribution "+number(factor.path("contribution"))+" "+prediction.path("attribution").path("contribution_unit").asText("not established")+" | imputed: "+factor.path("imputed").asBoolean()+". Model association, not a causal effect.",8,Font.NORMAL,MUTED));
            if(prediction.hasNonNull("dataQuality"))document.add(line("Model input quality / imputation: "+prediction.path("dataQuality").toString(),8,Font.NORMAL,MUTED));
            if(prediction.hasNonNull("uncertainty"))document.add(line("Model interval: "+prediction.path("uncertainty").toString(),8,Font.NORMAL,MUTED));
            if(!prediction.path("baselineExplanation").asText().isBlank())document.add(line(prediction.path("baselineExplanation").asText(),8,Font.NORMAL,MUTED));
            document.add(line("Clinician review: "+c.path("review").path("status").asText()+" | version "+c.path("review").path("version").asText("0")+" | Notes: "+c.path("review").path("note").asText("None recorded"),8,Font.NORMAL,NAVY));
            document.add(line(c.path("rule").path("localApproval").asText(),8,Font.ITALIC,MUTED));
            for(JsonNode source:c.path("rule").path("sources"))document.add(line("Reference: "+source.asText(),8,Font.NORMAL,TEAL));
            document.add(line("Source assessment snapshot: "+snapshot.path("snapshotId").asText(),8,Font.NORMAL,MUTED));
        }
    }
    private static JsonNode assessment(JsonNode snapshot,String key){return key.equals("cardiovascularMonitoring")?snapshot.path(key):snapshot.path(key).path("clinicalAssessment");}
    private static String title(String key){return switch(key){case "anemia"->"Hemoglobin Assessment";case "hyperkalemia"->"Potassium Assessment";case "dialysisAdequacy"->"Dialysis Adequacy";case "renalTrajectory"->"Renal Function and Progression";case "renalDeterioration"->"Acute Creatinine Review";case "kidneyFailureStatus"->"Recorded Kidney / Dialysis Status";default->"Cardiovascular Surveillance";};}
    private static String joinRequirements(JsonNode requirements){var labels=new java.util.ArrayList<String>();for(JsonNode r:requirements)if(!r.path("satisfied").asBoolean())labels.add(r.path("label").asText());return String.join("; ",labels);}
    private static String number(JsonNode node){return node.isNumber()?node.decimalValue().setScale(4,java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString():"Not recorded";}
    private static String readable(String value){return value.replace('_',' ').toLowerCase(java.util.Locale.ROOT);}
    private static Font font(int size,int style,Color color){return new Font(Font.HELVETICA,size,style,color);}
    private static Paragraph line(String text,int size,int style,Color color){var p=new Paragraph(text.replace("\u2265",">=").replace("\u2264","<=").replace("\u2192"," to ").replace("\u00d7","x").replace('\u2014','-').replace('\u2013','-').replace('\u2011','-'),font(size,style,color));p.setLeading(size*1.3f);p.setSpacingAfter(3);return p;}
    private static PdfPTable table(int columns){var t=new PdfPTable(columns);t.setWidthPercentage(100);return t;}
    private static PdfPCell cell(){var c=new PdfPCell();c.setPadding(11);c.setBorderColor(BORDER);c.setBackgroundColor(new Color(249,251,253));return c;}
    private static void heading(Document d,String text)throws DocumentException{var p=line(text,11,Font.BOLD,TEAL);p.setSpacingBefore(8);p.setSpacingAfter(6);d.add(p);}
}
