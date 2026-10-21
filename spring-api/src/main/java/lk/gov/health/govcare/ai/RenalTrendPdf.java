package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import java.awt.Color;
import java.time.Instant;
import java.util.*;
import java.util.List;

/** Same immutable verified timeline as the dashboard. No database reads or model calls. */
final class RenalTrendPdf {
    private static final Color TEAL=new Color(10,92,88),NAVY=new Color(11,37,69);
    private RenalTrendPdf(){}
    static void add(Document d,PdfWriter writer,JsonNode snapshot)throws Exception{
        JsonNode timeline=snapshot.path("renalTimeline");d.newPage();
        d.add(text("Renal Intelligence - Clinical Trends & Research Forecasts",13,Font.BOLD));
        if(!timeline.isObject()){
            d.add(text("This saved snapshot predates the verified renal timeline. Graph source verification was not recorded. Open the authorized current renal workspace and export its saved snapshot to include verified dated graphs. This export does not rerun inference or invent collection dates.",9,Font.NORMAL));return;
        }
        d.add(text("Source snapshot: "+snapshot.path("snapshotId").asText()+" | Verified dated observations: "+timeline.path("verifiedDatedCount").asInt(),8,Font.NORMAL));
        d.add(text("Actual collection dates and source units. Solid lines / circles are measured; dashed estimates are research forecasts. No inference runs during export.",8,Font.NORMAL));
        if(timeline.path("historyTruncated").asBoolean())d.add(text("Data quality warning: partial history; retrieval limit reached. Reconcile the source record.",9,Font.BOLD));
        for(String key:List.of("hemoglobin","creatinine","egfr","potassium","potassium_pre","potassium_post","urea","urea_pre","urea_post","urr","albumin","sodium","calcium","creatinine_pre","creatinine_post","bun")){
            List<JsonNode> points=new ArrayList<>();for(JsonNode r:timeline.path("series").path(key))if(r.path("included").asBoolean()&&r.path("sourceVerified").asBoolean()&&r.path("value").isNumber()&&ClinicalFeatureNormalizer.instant(r.path("observedAt").asText())!=null)points.add(r);
            points.sort(Comparator.comparing(r->Instant.parse(r.path("observedAt").asText())));
            if(points.isEmpty()){
                if(Set.of("hemoglobin","creatinine","egfr","potassium","urr").contains(key))d.add(text(key+": graph unavailable - no verified dated measurements. Add two comparable collection dates with supported units; one valid result can be shown as a point.",8,Font.NORMAL));
                continue;
            }
            // Keep sampling contexts and units in separate clinical graphs.
            Map<String,List<JsonNode>> groups=new LinkedHashMap<>();for(var p:points)groups.computeIfAbsent(p.path("unit").asText()+"|"+p.path("sampleContext").asText("SERUM"),k->new ArrayList<>()).add(p);
            for(var group:groups.values()){
                JsonNode latest=group.getLast();String unit=latest.path("unit").asText();
                var block=new PdfPTable(1);block.setWidthPercentage(100);block.setKeepTogether(true);var cell=new PdfPCell();cell.setBorder(Rectangle.NO_BORDER);cell.setPadding(7);
                cell.addElement(text(key+" - "+latest.path("sampleContext").asText("SERUM")+" | latest verified: "+number(latest.path("value").asDouble())+" "+unit+" | "+day(latest),10,Font.BOLD));
                JsonNode forecast=forecast(snapshot,key,unit,group);
                cell.addElement(chart(writer,group,forecast));
                cell.addElement(text("Collection dates: "+group.stream().map(RenalTrendPdf::day).reduce((a,b)->a+", "+b).orElse("")+" | Y-axis: "+unit,7,Font.NORMAL));
                if(group.size()==1)cell.addElement(text("Single measured point. No measured trend established.",8,Font.NORMAL));
                cell.addElement(text("Source: "+latest.path("source").asText()+" / "+latest.path("sourceId").asText(),7,Font.NORMAL));
                if(forecast!=null)cell.addElement(text("Research forecast: "+number(forecast.path("prediction").asDouble())+" "+unit+" | Target: "+forecast.path("forecast_date").asText()+" | "+forecast.path("horizon_definition").asText()+" | Model: "+forecast.path("model").asText()+" v"+forecast.path("model_version").asText()+" | NOT CLINICALLY VALIDATED",8,Font.NORMAL));
                block.addCell(cell);d.add(block);
            }
        }
        d.add(text("Clinical Data Sources - excluded values",10,Font.BOLD));int excluded=0;
        for(JsonNode r:timeline.path("sources"))if(!r.path("included").asBoolean()){
            excluded++;d.add(text(r.path("metric").asText()+" | "+r.path("source").asText()+" / "+r.path("sourceId").asText()+" | "+r.path("exclusionReason").asText(),7,Font.NORMAL));
        }
        if(excluded==0)d.add(text("No exclusions recorded in this saved timeline.",8,Font.NORMAL));
        d.add(text("Clinician review context: "+snapshot.path("clinicianReviewStatus").path("state").asText("Review source snapshot")+". Stored forecast reviews and model limitations remain in the clinical evidence section.",8,Font.NORMAL));
    }
    private static JsonNode forecast(JsonNode root,String key,String unit,List<JsonNode> points){
        String model=key.equals("hemoglobin")?"hb":key.equals("urr")?"urr":null;if(model==null)return null;
        String module=key.equals("hemoglobin")?"anemia":"dialysisAdequacy";if(!root.path(module).path("forecast").isNumber())return null;
        JsonNode selected=null;
        for(JsonNode prediction:root.path("predictions"))if(prediction.path("model_key").asText().equals(model)&&(selected==null||prediction.path("created_at").asText().compareTo(selected.path("created_at").asText())>0))selected=prediction;
        if(selected==null)return null;JsonNode o=selected.path("outputs");Instant origin=ClinicalFeatureNormalizer.instant(o.path("forecast_origin_date").asText()),target=ClinicalFeatureNormalizer.instant(o.path("forecast_date").asText());
        return o.path("status").asText().equals("AVAILABLE")&&o.path("prediction").isNumber()&&unit.equals(o.path("unit").asText())&&origin!=null&&target!=null&&target.isAfter(origin)&&points.stream().anyMatch(p->p.path("observedAt").asText().equals(origin.toString()))?o:null;
    }
    private static Image chart(PdfWriter writer,List<JsonNode> points,JsonNode forecast)throws Exception{
        float width=480,height=125,left=40,right=12,bottom=22,top=12;
        Instant start=Instant.parse(points.getFirst().path("observedAt").asText()),end=Instant.parse(points.getLast().path("observedAt").asText());
        if(forecast!=null)end=Instant.parse(forecast.path("forecast_date").asText());if(start.equals(end)){start=start.minusSeconds(86400);end=end.plusSeconds(86400);}
        double low=points.stream().mapToDouble(p->p.path("value").asDouble()).min().orElse(0),high=points.stream().mapToDouble(p->p.path("value").asDouble()).max().orElse(1);
        if(forecast!=null){low=Math.min(low,forecast.path("prediction").asDouble());high=Math.max(high,forecast.path("prediction").asDouble());}
        double padding=Math.max((high-low)*.15,.5);low=Math.max(0,low-padding);high+=padding;
        var canvas=writer.getDirectContent().createTemplate(width,height);canvas.setColorStroke(new Color(220,229,235));canvas.setLineWidth(.5f);
        BaseFont base=BaseFont.createFont(BaseFont.HELVETICA,BaseFont.WINANSI,false);
        for(int i=0;i<4;i++){float y=bottom+i*(height-bottom-top)/3;canvas.moveTo(left,y);canvas.lineTo(width-right,y);canvas.stroke();label(canvas,base,3,y,String.format(Locale.ROOT,"%.1f",low+i*(high-low)/3));}
        canvas.setColorStroke(TEAL);canvas.setLineWidth(1.7f);
        for(int i=0;i<points.size();i++){var p=points.get(i);float x=x(p.path("observedAt").asText(),start,end,left,width-right),y=y(p.path("value").asDouble(),low,high,bottom,height-top);if(i==0)canvas.moveTo(x,y);else canvas.lineTo(x,y);}canvas.stroke();
        canvas.setColorFill(TEAL);for(var p:points){canvas.circle(x(p.path("observedAt").asText(),start,end,left,width-right),y(p.path("value").asDouble(),low,high,bottom,height-top),2.7f);canvas.fill();}
        if(forecast!=null){var anchor=points.stream().filter(p->p.path("observedAt").asText().equals(forecast.path("forecast_origin_date").asText())).findFirst().orElseThrow();canvas.setColorStroke(NAVY);canvas.setLineDash(5,4,0);canvas.moveTo(x(anchor.path("observedAt").asText(),start,end,left,width-right),y(anchor.path("value").asDouble(),low,high,bottom,height-top));canvas.lineTo(x(forecast.path("forecast_date").asText(),start,end,left,width-right),y(forecast.path("prediction").asDouble(),low,high,bottom,height-top));canvas.stroke();}
        label(canvas,base,left,7,start.toString().substring(0,10));label(canvas,base,width-78,7,end.toString().substring(0,10));
        return Image.getInstance(canvas);
    }
    private static float x(String at,Instant start,Instant end,float left,float right){return left+(float)((Instant.parse(at).toEpochMilli()-start.toEpochMilli())/(double)(end.toEpochMilli()-start.toEpochMilli()))*(right-left);}
    private static float y(double value,double low,double high,float bottom,float top){return bottom+(float)((value-low)/(high-low))*(top-bottom);}
    private static void label(PdfTemplate canvas,BaseFont font,float x,float y,String value){canvas.beginText();canvas.setFontAndSize(font,7);canvas.setColorFill(NAVY);canvas.setTextMatrix(x,y);canvas.showText(value);canvas.endText();}
    private static String number(double value){return java.math.BigDecimal.valueOf(value).setScale(2,java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();}
    private static String day(JsonNode p){return p.path("observedAt").asText().substring(0,10);}
    private static Paragraph text(String value,int size,int style){var p=new Paragraph(value.replace("²","2"),new Font(Font.HELVETICA,size,style,NAVY));p.setSpacingAfter(6);return p;}
}
