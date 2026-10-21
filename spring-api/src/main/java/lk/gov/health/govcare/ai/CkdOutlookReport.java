package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import java.awt.Color;
import java.util.List;
import java.util.Locale;

/** Renders stored evidence only. No calculator, clinical assembler or ML dependency. */
final class CkdOutlookReport {
    private static final Color NAVY=new Color(11,37,69), TEAL=new Color(0,137,123), LIGHT=new Color(240,248,248);
    private static final BaseFont REGULAR=loadFont("DejaVuSans.ttf"), BOLD=loadFont("DejaVuSans-Bold.ttf");
    private CkdOutlookReport() {}
    static void add(Document d,PdfWriter writer,JsonNode value) throws DocumentException {
        d.newPage();
        d.add(new Paragraph("FIVE-YEAR CKD OUTLOOK",font(17,Font.BOLD,NAVY)));
        d.add(new Paragraph("Future risk, current evidence, and clinical planning",font(10,Font.NORMAL,TEAL)));
        d.add(new Paragraph("RESEARCH PREVIEW | Local clinical validation: NOT COMPLETED",font(8,Font.BOLD,NAVY)));
        if(value==null||value.isNull()) {
            d.add(new Paragraph("No long-term outlook assessment has been stored. Open the authorized 5-Year CKD Outlook workspace to review eligibility and calculate an assessment. No new inference or risk calculation was performed for this export.",font(10,Font.NORMAL,Color.DARK_GRAY)));
            return;
        }
        var model=value.path("model");
        d.add(new Paragraph("Assessment: "+value.path("id").asText()+" | As of "+value.path("assessedAt").asText(),font(8,Font.NORMAL,Color.DARK_GRAY)));
        d.add(new Paragraph("Status: "+value.path("status").asText()+" | Review: "+value.path("reviewState").asText("AWAITING_REVIEW"),font(9,Font.BOLD,TEAL)));
        PdfPTable outcome=new PdfPTable(2);outcome.setWidthPercentage(100);outcome.setSpacingBefore(12);outcome.setSpacingAfter(12);
        cell(outcome,"WITHIN TWO YEARS\n"+risk(value.path("twoYearRisk")),true);
        cell(outcome,"WITHIN FIVE YEARS\n"+risk(value.path("fiveYearRisk")),true);d.add(outcome);
        d.add(new Paragraph(model.path("outcome").asText(),font(10,Font.BOLD,NAVY)));
        d.add(new Paragraph(value.path("interpretation").asText(),font(9,Font.NORMAL,Color.DARK_GRAY)));
        for(JsonNode reason:value.path("reasons"))d.add(new Paragraph("Review: "+reason.asText(),font(9,Font.NORMAL,Color.DARK_GRAY)));
        heading(d,writer,"Recorded clinical evidence");
        PdfPTable inputs=new PdfPTable(new float[]{1.1f,1.0f,1.6f,2.5f});inputs.setWidthPercentage(100);inputs.setHeaderRows(1);
        for(String text:List.of("Input","Value / unit","Measurement time","Evidence source"))cell(inputs,text,true);
        for(String key:List.of("age","sex","egfr","acr")) {
            JsonNode v=value.path("evidence").path("inputs").path(key);
            cell(inputs,v.path("label").asText(key),false);
            cell(inputs,(v.hasNonNull("value")?v.path("value").asText():"Missing")+" "+v.path("unit").asText(""),false);
            cell(inputs,date(v.path("observedAt").asText("Demographic / clinical confirmation")),false);
            cell(inputs,v.path("source").asText("Recorded evidence")+" "+v.path("sourceId").asText(""),false);
        }
        d.add(inputs);
        d.add(new Paragraph("Current recorded stage: "+value.path("evidence").path("stage").asText("Unknown")+" | Dialysis context: "+value.path("evidence").path("dialysisStatus").asText("Unconfirmed"),font(8,Font.NORMAL,Color.DARK_GRAY)));
        heading(d,writer,"Observed kidney history - recorded measurements only");
        PdfPTable history=new PdfPTable(new float[]{1,2,2});history.setWidthPercentage(100);history.setHeaderRows(1);
        for(String text:List.of("Metric","Measured at","Recorded value"))cell(history,text,true);
        int count=0;
        for(String key:List.of("egfr","acr")) {
            var points=value.path("evidence").path("history").path(key);
            for(int i=Math.max(0,points.size()-6);i<points.size();i++) {
                JsonNode point=points.get(i);if(!point.path("value").isNumber()||!point.path("observedAt").isTextual())continue;
                cell(history,key.equals("egfr")?"eGFR":"Urine ACR",false);cell(history,date(point.path("observedAt").asText()),false);cell(history,point.path("value").asText()+" "+point.path("unit").asText(),false);count++;
            }
        }
        if(count>0)d.add(history);else d.add(new Paragraph("No dated historical measurements are available in this stored assessment.",font(8,Font.NORMAL,Color.DARK_GRAY)));
        d.add(new Paragraph("Up to six recent measurements per metric are shown. No five-year laboratory values are forecast.",font(8,Font.NORMAL,Color.DARK_GRAY)));
        heading(d,writer,"Why this outlook?");
        d.add(new Paragraph(model.path("name").asText()+" | "+model.path("version").asText()+" | "+model.path("calibration").asText(),font(9,Font.NORMAL,Color.DARK_GRAY)));
        d.add(new Paragraph(model.path("uncertainty").asText(),font(8,Font.NORMAL,Color.DARK_GRAY)));
        if(value.has("confirmation"))d.add(new Paragraph("Verified clinical context: "+value.path("confirmation").path("sourceNote").asText(),font(9,Font.NORMAL,Color.DARK_GRAY)));
        heading(d,writer,"Clinician review and follow-up plan");
        JsonNode review=value.path("review");
        if(review.isObject()) {
            d.add(new Paragraph("Reason: "+review.path("reason").asText(),font(9,Font.NORMAL,Color.DARK_GRAY)));
            if(review.hasNonNull("clinical_note"))d.add(new Paragraph("Clinician notes: "+review.path("clinical_note").asText(),font(9,Font.NORMAL,Color.DARK_GRAY)));
            if(review.hasNonNull("modified_interpretation"))d.add(new Paragraph("Clinician interpretation (equation output retained): "+review.path("modified_interpretation").asText(),font(9,Font.NORMAL,Color.DARK_GRAY)));
            for(JsonNode plan:review.path("milestones"))d.add(new Paragraph((plan.path("year").asInt()==0?"Today":"Year "+plan.path("year").asInt())+" - "+plan.path("title").asText(),font(9,Font.NORMAL,Color.DARK_GRAY)));
            if(review.path("milestones").isEmpty())d.add(new Paragraph("No follow-up milestones recorded.",font(8,Font.NORMAL,Color.DARK_GRAY)));
        } else d.add(new Paragraph("Awaiting clinician review. No follow-up milestones have been recorded.",font(9,Font.NORMAL,Color.DARK_GRAY)));
        d.add(new Paragraph("Future milestones are clinician-defined plans, not predicted clinical events.",font(8,Font.BOLD,NAVY)));
        heading(d,writer,"Limitations and provenance");
        if(value.path("learnedModel").isObject()) {
            var learned=value.path("learnedModel");
            d.add(new Paragraph("Learned five-year research model: "+learned.path("status").asText()+". Probability: not estimated.",font(8,Font.BOLD,NAVY)));
            for(JsonNode reason:learned.path("reasons"))d.add(new Paragraph(reason.asText(),font(8,Font.NORMAL,Color.DARK_GRAY)));
            d.add(new Paragraph("Dataset audit SHA-256: "+learned.path("dataset_sha256").asText(),font(7,Font.NORMAL,Color.DARK_GRAY)));
        }
        for(JsonNode limitation:value.path("limitations"))d.add(new Paragraph("• "+limitation.asText(),font(8,Font.NORMAL,Color.DARK_GRAY)));
        d.add(new Paragraph("Reference: "+model.path("reference").asText(),font(8,Font.NORMAL,TEAL)));
        d.add(new Paragraph("Evidence fingerprint: "+value.path("evidenceFingerprint").asText()+"\nPDF reads the stored assessment and its latest appended review; no new prediction is generated.",font(7,Font.NORMAL,Color.DARK_GRAY)));
    }
    private static String risk(JsonNode n){return n.isNumber()?n.asDouble()>0&&n.asDouble()<0.0001?"<0.01%":String.format(Locale.ROOT,"%.2f%%",n.asDouble()*100):"Not estimated";}
    private static Font font(float size,int style,Color color){return new Font(style==Font.BOLD?BOLD:REGULAR,size,Font.NORMAL,color);}
    private static BaseFont loadFont(String name){
        try(var in=CkdOutlookReport.class.getResourceAsStream("/fonts/ckd-outlook/"+name)){
            if(in==null)throw new IllegalStateException("Outlook report font is missing: "+name);
            return BaseFont.createFont(name,BaseFont.IDENTITY_H,BaseFont.EMBEDDED,true,in.readAllBytes(),null);
        }catch(Exception e){throw new IllegalStateException("Unable to load the outlook report font.",e);}
    }
    private static String date(String value){
        try{return java.time.format.DateTimeFormatter.ofPattern("dd MMM uuuu HH:mm 'UTC'",Locale.ROOT)
            .withZone(java.time.ZoneOffset.UTC).format(java.time.Instant.parse(value));}
        catch(java.time.DateTimeException ignored){return value;}
    }
    private static void heading(Document d,PdfWriter writer,String text)throws DocumentException{
        if(writer.getVerticalPosition(true)<d.bottom()+100){
            d.newPage();
            d.add(new Paragraph("FIVE-YEAR CKD OUTLOOK | CONTINUED",font(9,Font.BOLD,TEAL)));
        }
        var p=new Paragraph(text,font(11,Font.BOLD,NAVY));p.setSpacingBefore(12);p.setSpacingAfter(6);d.add(p);
    }
    private static void cell(PdfPTable t,String text,boolean header){var c=new PdfPCell(new Phrase(text,font(header?9:8,header?Font.BOLD:Font.NORMAL,NAVY)));c.setPadding(8);c.setBorderColor(new Color(217,228,234));if(header)c.setBackgroundColor(LIGHT);t.addCell(c);}
}
