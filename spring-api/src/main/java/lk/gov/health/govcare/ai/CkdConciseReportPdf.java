package lk.gov.health.govcare.ai;
import com.fasterxml.jackson.databind.*;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.List;

/** Clinical summary of saved evidence only. This renderer has no service or inference dependencies. */
final class CkdConciseReportPdf {
 static final String VERSION="GOVCARE-CLINICAL-SUMMARY-3.0";
 private static final Color NAVY=new Color(15,38,65),TEAL=new Color(0,111,110),LIGHT=new Color(237,246,247),GRAY=new Color(79,96,110),BORDER=new Color(214,225,232);
 private static final ObjectMapper JSON=new ObjectMapper();
 private static final List<String> MODULES=List.of("anemia","hyperkalemia","dialysisAdequacy","renalTrajectory","cardiovascularMonitoring");
 private CkdConciseReportPdf(){}
 static byte[] render(Map<String,Object> assessment,List<Map<String,Object>> inputs,List<Map<String,Object>> factors,List<Map<String,Object>> recommendations,UUID id,JsonNode snapshot,boolean appendix){
  try{
   var output=new ByteArrayOutputStream();var d=new Document(PageSize.A4,38,38,54,48);var writer=PdfWriter.getInstance(d,output);
   boolean synthetic=Boolean.TRUE.equals(assessment.get("synthetic"));writer.setPageEvent(new Pages(Objects.toString(assessment.get("patient_no"),"Unavailable"),synthetic));d.addTitle("GovCare CKD clinical summary");d.addSubject(VERSION+" | assessment "+id);d.open();
   heading(d,"CKD CLINICAL SUMMARY",20);text(d,"GovCare EHR | Saved assessment | "+date(assessment.get("created_at")),9);
   if(synthetic)notice(d,"SYNTHETIC TEST DATA - NOT FOR PATIENT CARE");
   var identity=table(2,1,1);entry(identity,"Patient",assessment.get("full_name"));entry(identity,"Patient ID",assessment.get("patient_no"));entry(identity,"Date of birth / sex",Objects.toString(assessment.get("date_of_birth"),"Not recorded")+" / "+Objects.toString(assessment.get("gender"),"Not recorded"));entry(identity,"Hospital",assessment.get("hospital_name"));d.add(identity);
   heading(d,"CKD screening result",12);var score=table(3,1,1,1);
   entry(score,"Screening model score",ClinicalScoreDisplay.percent(assessment.get("probability")));entry(score,"Selected-class score",ClinicalScoreDisplay.percent(assessment.get("confidence")));entry(score,"Stored review band",readable(assessment.get("risk_category")));d.add(score);
   text(d,"Uncalibrated model scores. Clinical probability calibration and a future-event horizon have not been established. These percentages do not establish a diagnosis or clinical certainty.",9);
   heading(d,"Renal classification and review",12);
   text(d,"Suggested G category: "+Objects.toString(assessment.get("suggested_ckd_g_category"),"Not assigned")+" | "+Objects.toString(assessment.get("suggested_ckd_stage"),"Classification unavailable")+" | Review: "+readable(assessment.get("review_status")),10);
   text(d,"A single eGFR result does not establish CKD chronicity. G5D requires documented dialysis context. Suggested coding: "+Objects.toString(assessment.get("suggested_icd_code"),"Not assigned")+"; clinician confirmation required.",9);
   heading(d,"Measurements used in this saved assessment",12);
   var labs=table(4,2.3f,1.2f,1.5f,2.4f);headers(labs,"Parameter","Assessment value","Collection time","Source");
   for(String feature:List.of("GFR","SerumCreatinine","ACR","HemoglobinLevels","SerumElectrolytesPotassium","BUNLevels","SystolicBP","DiastolicBP","HbA1c")){
    var input=inputs.stream().filter(x->feature.equals(x.get("feature_key"))).findFirst();var definition=ClinicalFeatureNormalizer.definition(feature);
    cell(labs,definition.label(),false);cell(labs,input.map(x->number(x.get("value_numeric"))+" "+Objects.toString(x.get("unit"),definition.unit())).orElse("Not recorded"),false);
    JsonNode metadata=input.map(x->ClinicalFeatureNormalizer.node(x.get("source_metadata"))).orElse(JSON.createObjectNode());cell(labs,date(metadata.path("clinicalDate").asText(null)),false);cell(labs,input.map(x->Objects.toString(x.get("source_report"),readable(x.get("source_type")))).orElse("Not recorded"),false);
   }d.add(labs);text(d,"Assessment measurements above remain unchanged when later patient history is recorded. Evidence in the following pages is linked to this saved assessment; review its collection dates separately.",8);

   d.newPage();heading(d,"RELATED CLINICAL FINDINGS",17);text(d,"Evidence context: "+(snapshot==null?"No linked clinical snapshot available":date(snapshot.path("generatedAt").asText()))+". Collection dates describe measurements, not upload time.",9);
   var findings=table(4,1.2f,2.6f,2.0f,1.8f);headers(findings,"Module","Recorded finding","Future output","Next action");
   for(String key:MODULES){var c=clinical(snapshot,key);String measured=c.path("currentValue").isNumber()?number(c.get("currentValue"))+" "+c.path("unit").asText()+"\n"+date(c.path("currentAt").asText(null)):key.equals("cardiovascularMonitoring")?"Risk-factor surveillance only":c.path("trend").path("ready").asBoolean()?number(c.path("trend").path("absoluteChange"))+" "+c.path("trend").path("unit").asText()+" measured change":"Result unavailable";
    cell(findings,title(key),true);cell(findings,measured+"\n"+c.path("clinicalSignal").path("label").asText("Source review required"),false);cell(findings,prediction(c.path("prediction")),false);cell(findings,next(c,key),false);
   }d.add(findings);
   text(d,"Measured URR is the reduction in urea during a verified dialysis session. It is not a disease-risk percentage. Input coverage describes available data and never estimates event risk.",9);
   heading(d,"Dialysis / kidney-failure context",12);var kidney=clinical(snapshot,"kidneyFailureStatus");text(d,kidney.path("message").asText("Dialysis status is not established in the linked assessment evidence."),9);
   heading(d,"Prediction methods and limitations",12);
   for(String key:List.of("anemia","hyperkalemia","dialysisAdequacy","renalTrajectory")){
    var p=clinical(snapshot,key).path("prediction");String method=p.path("model").path("model").asText("No eligible model output");String version=p.path("model").path("modelVersion").asText("");
    text(d,title(key)+": "+method+(version.isBlank()?"":" / "+version)+". Outcome: "+p.path("outcome").asText("Not estimated")+". Horizon: "+p.path("horizon").asText("Not established")+". Validation: "+readable(p.path("clinicalValidation").asText("Not established"))+".",8);
   }

   d.newPage();heading(d,"DATED CLINICAL TRENDS",17);text(d,"Measured results from the linked saved evidence. Only comparable, verified observations with distinct collection times form a trend. No model runs during report generation.",9);
   var charts=table(2,1,1);int plotted=0;var missing=new ArrayList<String>();
   for(String key:List.of("egfr","creatinine","hemoglobin","potassium","urr")){
    var points=points(snapshot,key);if(points.size()<2){missing.add(key+": "+(points.isEmpty()?"no comparable verified dated results":"one verified dated result; trend not established"));continue;}
    var tile=new PdfPCell();tile.setPadding(9);tile.setBorderColor(BORDER);tile.addElement(paragraph(label(key)+" | "+points.getFirst().path("unit").asText(),10,true));tile.addElement(chart(writer,points));tile.addElement(paragraph("Measured: "+date(points.getFirst().path("observedAt").asText())+" to "+date(points.getLast().path("observedAt").asText()),7,false));charts.addCell(tile);plotted++;
   }if(plotted%2==1){var blank=new PdfPCell();blank.setBorder(Rectangle.NO_BORDER);charts.addCell(blank);}if(plotted>0)d.add(charts);
   if(!missing.isEmpty()){heading(d,"Trends requiring more evidence",11);for(String item:missing)text(d,item,8);}
   heading(d,"Why did the screening model return this result?",12);text(d,"The following are saved model associations. They are not causal effects and do not determine whether a measurement is clinically safe.",8);
   for(var factor:factors.stream().limit(4).toList())text(d,Objects.toString(factor.get("display_name"),Objects.toString(factor.get("feature_key"),"Factor"))+": "+number(factor.get("input_value"))+" "+Objects.toString(factor.get("unit"),"")+" | "+readable(factor.get("contribution_direction"))+". "+Objects.toString(factor.get("explanation"),""),8);
   if(factors.isEmpty())text(d,"No saved factor explanation is available.",9);

   d.newPage();heading(d,"EVIDENCE QUALITY AND CLINICAL REVIEW",17);
   var grouped=excluded(snapshot);heading(d,"Clinical source conflicts / invalid records",12);
   if(grouped.isEmpty())text(d,"No excluded source records are listed in the linked snapshot. This does not establish that every source has been verified.",9);
   else{var counts=table(2,3,1);headers(counts,"Measurement","Unique source records requiring reconciliation");for(var entry:grouped.entrySet()){cell(counts,label(entry.getKey()),false);cell(counts,String.valueOf(entry.getValue().size()),false);}d.add(counts);}
   var warnings=new LinkedHashSet<String>();for(String key:MODULES){var c=clinical(snapshot,key);for(JsonNode w:c.path("evidenceQuality").path("warnings"))if(!w.asText().contains("excluded conflicting/invalid source"))warnings.add(w.asText());}
   heading(d,"Missing information and follow-up",12);var needs=new LinkedHashSet<String>();for(String key:MODULES){for(JsonNode r:clinical(snapshot,key).path("coverage").path("requiredInputs"))if(!r.path("satisfied").asBoolean())needs.add(r.path("label").asText());}
   text(d,needs.isEmpty()?"Review source dates, eligibility and quality before clinical interpretation.":String.join("; ",needs),9);
   for(String warning:warnings.stream().limit(6).toList())text(d,warning,8);if(warnings.size()>6)text(d,(warnings.size()-6)+" additional distinct evidence limitations remain in the detailed source record / optional appendix.",8);
   heading(d,"Verified source and assessment traceability",12);var sources=new LinkedHashSet<String>();for(var input:inputs)if(input.get("source_report")!=null)sources.add(input.get("source_report").toString());text(d,sources.isEmpty()?"Source files are not linked; review the saved input provenance.":String.join("; ",sources),8);
   text(d,"Assessment reference: "+id+" | Model: "+Objects.toString(assessment.get("model_version"),"Not recorded"),8);text(d,"Rules: "+(snapshot==null?"Not recorded":snapshot.path("clinicalRulesVersion").asText(snapshot.path("ruleVersion").asText("Not recorded")))+" | Report: "+VERSION,8);
   heading(d,"Clinician interpretation and review",12);text(d,"Assessment review: "+readable(assessment.get("review_status"))+". Report generated by: "+Objects.toString(assessment.get("clinician_name"),"Not recorded")+". Report generation does not confirm a clinical interpretation.",9);
   boolean notes=false;for(String key:MODULES){var review=clinical(snapshot,key).path("review");var stored=snapshot==null?JSON.createObjectNode():snapshot.path(key).path("clinicianReview");String note=stored.path("clinical_note").asText(review.path("note").asText(""));if(!note.isBlank()){notes=true;text(d,title(key)+": "+note,9);text(d,"Reviewed by: "+stored.path("actor_id").asText("Not recorded")+" | "+date(stored.path("created_at").asText(null)),8);}}
   if(!notes)text(d,"No linked clinician interpretation note is recorded. Review the findings and document the agreed plan in the clinical workspace.",9);
   if(!recommendations.isEmpty()){heading(d,"Saved recommended actions",11);for(var rec:recommendations.stream().limit(4).toList())text(d,Objects.toString(rec.get("recommendation_text"),""),8);}
   text(d,"Clinical decision support only. No new diagnosis, calibrated probability, treatment order or missing measurement is generated by this export. Detailed audit evidence remains stored and available.",8);
   if(appendix){d.newPage();heading(d,"TECHNICAL EVIDENCE APPENDIX",16);text(d,"Unique excluded source records are listed below. The underlying stored evidence is unchanged.",9);for(var group:grouped.entrySet())for(var item:group.getValue().values())text(d,label(group.getKey())+" | "+item,8);
    heading(d,"Saved assessment input provenance",12);for(var input:inputs)text(d,Objects.toString(input.get("feature_key"))+" | "+number(input.get("value_numeric"))+" "+Objects.toString(input.get("unit"),"")+" | "+Objects.toString(input.get("source_metadata"),"Not recorded"),7);
    if(snapshot!=null){heading(d,"Model, evidence and review detail",12);for(String key:MODULES){var c=clinical(snapshot,key);text(d,title(key)+" | "+c.path("prediction")+" | Review: "+c.path("review"),7);for(JsonNode w:c.path("evidenceQuality").path("warnings"))text(d,w.asText(),7);}}
   }
   d.close();return output.toByteArray();
  }catch(Exception e){throw new IllegalStateException("Unable to render the saved CKD clinical summary.",e);}
 }
 static Map<String,LinkedHashMap<String,String>> excluded(JsonNode snapshot){var groups=new LinkedHashMap<String,LinkedHashMap<String,String>>();if(snapshot==null)return groups;for(JsonNode item:snapshot.path("clinicalFeatureData").path("excludedData")){String key=item.path("key").asText("Unknown measurement"),identity=item.path("sourceId").asText("")+"|"+item.path("observedAt").asText("");if(identity.equals("|"))identity=item.toString();groups.computeIfAbsent(key,k->new LinkedHashMap<>()).putIfAbsent(identity,item.path("sourceId").asText("Unidentified source")+" | "+date(item.path("observedAt").asText(null))+" | "+item.path("originalValue").asText(item.path("value").asText("Unavailable"))+" "+item.path("originalUnit").asText(item.path("unit").asText())+" | "+item.path("qualityFlags"));}return groups;}
 private static JsonNode clinical(JsonNode root,String key){return root==null?JSON.createObjectNode():key.equals("cardiovascularMonitoring")?root.path(key):root.path(key).path("clinicalAssessment");}
 private static String next(JsonNode c,String key){var needs=new ArrayList<String>();for(JsonNode r:c.path("coverage").path("requiredInputs"))if(!r.path("satisfied").asBoolean())needs.add(r.path("label").asText());return needs.isEmpty()?switch(key){case "anemia"->"Review blood results";case "hyperkalemia"->"Review electrolytes";case "dialysisAdequacy"->"Review dialysis session";case "renalTrajectory"->"Review renal history";default->"Review clinical factors";}:"Verify "+String.join("; ",needs.stream().limit(2).toList())+(needs.size()>2?"; "+(needs.size()-2)+" further requirements":"");}
 private static String prediction(JsonNode p){if(p.path("researchScore").isNumber())return "Research model score: "+ClinicalScoreDisplay.percent(p.get("researchScore").numberValue())+"\nNot a calibrated clinical probability.\n"+p.path("outcome").asText()+" | "+p.path("horizon").asText();if(p.path("value").isNumber())return "Research forecast: "+number(p.get("value"))+" "+p.path("unit").asText()+"\n"+p.path("outcome").asText()+" | "+p.path("horizon").asText()+"\nClinical validation incomplete";return "Not estimated\n"+p.path("reason").asText("Required verified history or an appropriate model is unavailable.");}
 private static List<JsonNode> points(JsonNode root,String key){var groups=new LinkedHashMap<String,TreeMap<Instant,JsonNode>>();if(root!=null)for(JsonNode point:root.path("renalTimeline").path("series").path(key)){Instant at=ClinicalFeatureNormalizer.instant(point.path("observedAt").asText(null));if(point.path("included").asBoolean()&&point.path("sourceVerified").asBoolean()&&point.path("value").isNumber()&&Double.isFinite(point.path("value").asDouble())&&at!=null)groups.computeIfAbsent(point.path("unit").asText()+"|"+point.path("sampleContext").asText(),k->new TreeMap<>()).put(at,point);}return groups.values().stream().max(Comparator.comparingInt(Map::size)).map(g->List.copyOf(g.values())).orElse(List.of());}
 private static Image chart(PdfWriter writer,List<JsonNode> points)throws Exception{float w=238,h=105,left=27,right=8,bottom=17,top=12;var image=writer.getDirectContent().createTemplate(w,h);double low=points.stream().mapToDouble(p->p.path("value").asDouble()).min().orElse(0),high=points.stream().mapToDouble(p->p.path("value").asDouble()).max().orElse(1);double pad=Math.max((high-low)*.15,.2);low-=pad;high+=pad;var first=Instant.parse(points.getFirst().path("observedAt").asText());double elapsed=java.time.Duration.between(first,Instant.parse(points.getLast().path("observedAt").asText())).toMillis();var base=BaseFont.createFont(BaseFont.HELVETICA,BaseFont.WINANSI,false);
  for(int i=0;i<3;i++){float y=bottom+i*(h-top-bottom)/2;image.setColorStroke(BORDER);image.moveTo(left,y);image.lineTo(w-right,y);image.stroke();image.beginText();image.setFontAndSize(base,6);image.setColorFill(GRAY);image.setTextMatrix(0,y-2);image.showText(String.format(Locale.ROOT,"%.1f",low+i*(high-low)/2));image.endText();}
  image.setColorStroke(TEAL);image.setLineWidth(1.5f);for(int i=0;i<points.size();i++){var p=points.get(i);float x=left+(float)(Duration.between(first,Instant.parse(p.path("observedAt").asText())).toMillis()/elapsed)*(w-left-right),y=bottom+(float)((p.path("value").asDouble()-low)/(high-low))*(h-bottom-top);if(i==0)image.moveTo(x,y);else image.lineTo(x,y);}image.stroke();return Image.getInstance(image);}
 private static String title(String key){return switch(key){case "anemia"->"Hemoglobin";case "hyperkalemia"->"Potassium";case "dialysisAdequacy"->"Dialysis adequacy";case "renalTrajectory"->"Renal progression";case "kidneyFailureStatus"->"Kidney-failure context";default->"Cardiovascular surveillance";};}
 private static String label(String key){var d=ClinicalFeatureNormalizer.definition(key);return d==null?key.equals("urr")?"Measured URR":key:d.label();}
 private static String readable(Object value){return value==null?"Not recorded":value.toString().replace('_',' ').toLowerCase(Locale.ROOT);}
 private static String number(Object value){if(value instanceof JsonNode n)return n.isNumber()&&Double.isFinite(n.asDouble())?n.decimalValue().setScale(2,java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString():"Unavailable";if(value instanceof Number n&&Double.isFinite(n.doubleValue()))return new java.math.BigDecimal(n.toString()).setScale(2,java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();return "Not recorded";}
 private static String date(Object raw){if(raw==null||raw.toString().isBlank())return "Date unverified";Instant at=ClinicalFeatureNormalizer.instant(raw);if(at==null)try{at=Instant.parse(raw.toString());}catch(Exception ignored){}return at==null?"Date unverified":DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm 'UTC'",Locale.ENGLISH).withZone(ZoneOffset.UTC).format(at);}
 private static String safe(String s){return s.replace('\u2014','-').replace('\u2013','-').replace('\u2011','-').replace("\u2192"," to ").replace("\u2265",">=").replace("\u2264","<=").replace('\u03bc','u').replace('\u00b5','u');}
 private static Font font(float size,boolean bold){return new Font(Font.HELVETICA,size,bold?Font.BOLD:Font.NORMAL,NAVY);}
 private static Paragraph paragraph(String value,int size,boolean bold){var p=new Paragraph(safe(value),font(size,bold));p.setLeading(size*1.35f);p.setSpacingAfter(5);return p;}
 private static void text(Document d,String text,int size)throws DocumentException{d.add(paragraph(text,size,false));}
 private static void heading(Document d,String text,int size)throws DocumentException{var p=paragraph(text,size,true);p.setSpacingBefore(8);p.setSpacingAfter(9);d.add(p);}
 private static void notice(Document d,String text)throws DocumentException{var t=table(1,1);var cell=new PdfPCell(paragraph(text,10,true));cell.setPadding(9);cell.setBackgroundColor(LIGHT);cell.setBorderColor(TEAL);t.addCell(cell);d.add(t);}
 private static PdfPTable table(int columns,float...widths){var t=new PdfPTable(columns);t.setWidthPercentage(100);try{t.setWidths(widths);}catch(Exception e){throw new IllegalArgumentException(e);}t.setSpacingAfter(8);t.setSplitRows(true);t.setSplitLate(false);return t;}
 private static void entry(PdfPTable t,String label,Object value){var c=new PdfPCell();c.setPadding(8);c.setBorderColor(BORDER);c.addElement(paragraph(label,8,false));c.addElement(paragraph(Objects.toString(value,"Not recorded"),10,true));t.addCell(c);}
 private static void cell(PdfPTable t,String value,boolean bold){var c=new PdfPCell(paragraph(value,8,bold));c.setPadding(7);c.setBorderColor(BORDER);t.addCell(c);}
 private static void headers(PdfPTable t,String...labels){for(String label:labels){var c=new PdfPCell(paragraph(label,8,true));c.setPadding(7);c.setBackgroundColor(LIGHT);c.setBorderColor(BORDER);t.addCell(c);}t.setHeaderRows(1);}
 private static class Pages extends PdfPageEventHelper{final String patient;final boolean synthetic;PdfTemplate total;Pages(String p,boolean s){patient=p;synthetic=s;}public void onOpenDocument(PdfWriter w,Document d){total=w.getDirectContent().createTemplate(24,12);}public void onEndPage(PdfWriter w,Document d){var c=w.getDirectContent();ColumnText.showTextAligned(c,Element.ALIGN_LEFT,new Phrase("GovCare | "+patient+" | "+(synthetic?"SYNTHETIC TEST | ":"")+"Clinical review required",new Font(Font.HELVETICA,7)),38,29,0);ColumnText.showTextAligned(c,Element.ALIGN_RIGHT,new Phrase("Page "+w.getPageNumber()+" of ",new Font(Font.HELVETICA,7)),535,29,0);c.addTemplate(total,537,29);}public void onCloseDocument(PdfWriter w,Document d){ColumnText.showTextAligned(total,Element.ALIGN_LEFT,new Phrase(String.valueOf(w.getPageNumber()-1),new Font(Font.HELVETICA,7)),0,0,0);}}
}
