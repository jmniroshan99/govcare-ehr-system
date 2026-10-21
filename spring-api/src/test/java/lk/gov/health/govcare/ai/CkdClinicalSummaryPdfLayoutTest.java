package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lowagie.text.Document;
import com.lowagie.text.PageSize;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises the production summary renderer, including its actual text geometry and bar fills. */
class CkdClinicalSummaryPdfLayoutTest {
    @Test void undatedValuesRemainUsefulWithoutMisleadingMissingLabelsOrProgressBars() throws Exception {
        var snapshot=undated();
        byte[] bytes=render(snapshot);
        String text=inspect(bytes,"undated");
        assertTrue(text.contains("Current Hb: 13.8 g/dL"));
        assertTrue(text.contains("Current potassium: 3 mmol/L"));
        assertTrue(text.contains("Measurement date: Undated snapshot; verify date"));
        assertTrue(text.contains("Monitoring inputs: 100% available (1/1)"));
        assertTrue(text.contains("Monitoring inputs: 0% available (0/7)"));
        assertTrue(text.contains("Listed monitoring inputs recorded."));
        assertFalse(text.contains("Missing information: Listed monitoring inputs recorded"));
        assertFalse(text.contains("Risk status:"));
        assertTrue(text.contains("20 Oct 2026, 10:03 UTC"));
        try(var doc=Loader.loadPDF(bytes)) {
            assertTrue(doc.getNumberOfPages()<=2,"Exact seven-requirement URR guidance may continue onto a second readable page");
            var fractions=new ArrayList<Double>();
            for(int page=0;page<doc.getNumberOfPages();page++) {
                BufferedImage image=new PDFRenderer(doc).renderImageWithDPI(page,120);
                fractions.addAll(barFractions(image,new Color(0,105,92)));
                fractions.addAll(barFractions(image,new Color(216,27,96)));
            }
            assertTrue(fractions.stream().anyMatch(v->Math.abs(v-.25)<.015),"25% bar must fill a quarter of its full track");
            assertTrue(fractions.stream().anyMatch(v->Math.abs(v-.8)<.015),"80% bar must retain its remaining track");
        }
    }

    @Test void datedSummaryPreservesVerifiedContextAndMeasuredTrends() throws Exception {
        var snapshot=CkdEstablishedEvidenceTest.mapped(CkdEstablishedEvidenceTest.demoSnapshots(false),"NO_KNOWN_DIABETES",false,List.of());
        snapshot.put("snapshotId","SYNTHETIC-DATED-PDF-LAYOUT");
        String text=inspect(render(snapshot),"dated");
        assertTrue(text.contains("Diabetes context: No known diabetes in the reviewed record"));
        assertTrue(text.contains("Dated trend:"));
        assertTrue(text.contains("cardiovascular model unavailable"));
        assertTrue(text.contains("Why this result?"));
    }

    @Test void lengthySavedNotesFlowAcrossPagesWithoutClippingOrDroppingText() throws Exception {
        var snapshot=undated();
        String sentence="Synthetic source review retained in the stored clinical record. ";
        ((ObjectNode)snapshot.path("anemia")).putObject("clinicianReview")
                .put("clinical_note","SYNTHETIC-NOTE-START "+sentence.repeat(25)+"SYNTHETIC-NOTE-END");
        byte[] bytes=render(snapshot);
        String text=inspect(bytes,"long-notes");
        assertTrue(text.contains("SYNTHETIC-NOTE-START"));
        assertTrue(text.matches("(?s).*SYNTHETIC-NOTE-\\s*END.*"));
        assertEquals(25,text.split("Synthetic source review retained in the stored clinical record\\.",-1).length-1);
        assertTrue(text.contains("CKD Cardiovascular Monitoring"));
        assertTrue(text.contains("No inference is run during export."));
    }

    @Test void invalidDatesAndMissingSnapshotsNeverAppearVerified() throws Exception {
        var snapshot=undated();
        ((ObjectNode)snapshot.path("anemia").path("clinicalAssessment")).put("currentAt","2026-13-99T12:00:00Z");
        snapshot.put("generatedAt","not-a-date");
        String text=extract(render(snapshot));
        assertFalse(text.contains("2026-13-99"));
        assertTrue(text.contains("Measurement date: Undated snapshot; verify date"));
        assertTrue(text.contains("Evaluated: Not recorded / unverified"));
        String empty=extract(render(null));
        assertTrue(empty.contains("No related-risk snapshot available"));
        assertFalse(empty.contains("Listed monitoring inputs recorded"));
        assertFalse(empty.contains("100%"));
        var incomplete=ClinicalFeatureMappingEngineTest.JSON.createObjectNode();
        incomplete.putObject("anemia").putObject("clinicalAssessment");
        String unknown=extract(render(incomplete));
        assertTrue(unknown.contains("Required input coverage is not established."));
        assertFalse(unknown.contains("Listed monitoring inputs recorded"));
    }

    private ObjectNode undated() {
        var row=CkdAssessmentFeatureBridgeTest.savedAssessment(72.0,null);
        @SuppressWarnings("unchecked") var raw=(Map<String,Object>)row.get("raw_inputs");
        raw.putAll(Map.of("Age",39,"HemoglobinLevels",13.8,"SerumElectrolytesPotassium",3.0,"SerumCreatinine",1.4,"SystolicBP",146,"DiastolicBP",92));
        Instant now=Instant.parse("2026-10-20T10:03:45.291456700Z");
        var context=new SriLankanRenalIntelligenceService.Overview(CkdAssessmentFeatureBridgeTest.PATIENT,CkdAssessmentFeatureBridgeTest.HOSPITAL,
                new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","Synthetic PDF layout test"),List.of(),List.of(),null,true,false);
        var snapshot=ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(context,RenalReadinessTest.registry(),now),
                new ClinicalPredictionFeatureService.FeatureData(context.patientId(),context.hospitalId(),List.of(ClinicalFeatureNormalizer.assessment(row,now)),List.of(),false),now);
        snapshot.put("snapshotId","SYNTHETIC-UNDATED-PDF-LAYOUT");
        return snapshot;
    }

    private byte[] render(ObjectNode snapshot) throws Exception {
        var bytes=new ByteArrayOutputStream();
        var document=new Document(PageSize.A4,38,38,56,48);
        var writer=PdfWriter.getInstance(document,bytes);
        document.open();
        var method=CkdAssessmentReportService.class.getDeclaredMethod("addClinicalRiskDashboard",Document.class,PdfWriter.class,com.fasterxml.jackson.databind.JsonNode.class);
        method.setAccessible(true);method.invoke(null,document,writer,snapshot);
        document.close();
        return bytes.toByteArray();
    }

    private String inspect(byte[] bytes,String name) throws Exception {
        String directory=System.getProperty("govcare.summary.qa.output");
        try(var doc=Loader.loadPDF(bytes)) {
            var positions=new ArrayList<TextPosition>();
            var stripper=new PDFTextStripper(){
                @Override protected void writeString(String value,List<TextPosition> glyphs) throws java.io.IOException {
                    positions.addAll(glyphs);super.writeString(value,glyphs);
                }
            };
            String text=stripper.getText(doc).replaceAll("\\s+"," ");
            for(TextPosition glyph:positions){
                assertTrue(glyph.getFontSizeInPt()>=8,"Summary text should remain legible without font shrinking");
                assertTrue(glyph.getXDirAdj()>=35&&glyph.getXDirAdj()+glyph.getWidthDirAdj()<=PageSize.A4.getWidth()-35,"Text crosses a side margin: "+glyph.getUnicode());
                assertTrue(glyph.getYDirAdj()>=35&&glyph.getYDirAdj()<=PageSize.A4.getHeight()-35,"Text crosses a page margin: "+glyph.getUnicode());
            }
            if(directory!=null){
                Path output=Path.of(directory);Files.createDirectories(output);
                try(var old=Files.list(output)){
                    for(Path page:old.filter(p->p.getFileName().toString().startsWith(name+"-page-")&&p.getFileName().toString().endsWith(".png")).toList())Files.delete(page);
                }
                Files.write(output.resolve("ckd-clinical-summary-"+name+".pdf"),bytes);
                Files.writeString(output.resolve(name+"-text.txt"),text);
                for(int page=0;page<doc.getNumberOfPages();page++)ImageIO.write(new PDFRenderer(doc).renderImageWithDPI(page,120),"PNG",output.resolve(name+"-page-"+(page+1)+".png").toFile());
            }
            return text;
        }
    }

    private String extract(byte[] bytes) throws Exception {
        try(var doc=Loader.loadPDF(bytes)){return new PDFTextStripper().getText(doc).replaceAll("\\s+"," ");}
    }

    private List<Double> barFractions(BufferedImage image,Color fill) {
        var fractions=new ArrayList<Double>();
        int ink=fill.getRGB()&0xffffff,track=new Color(224,231,237).getRGB()&0xffffff;
        for(int y=0;y<image.getHeight();y++)for(int x=0;x<image.getWidth();){
            if((image.getRGB(x,y)&0xffffff)!=ink){x++;continue;}
            int start=x;while(x<image.getWidth()&&(image.getRGB(x,y)&0xffffff)==ink)x++;
            int filled=x-start,remaining=0;
            while(x<image.getWidth()&&(image.getRGB(x,y)&0xffffff)==track){remaining++;x++;}
            if(filled>15&&remaining>15)fractions.add((double)filled/(filled+remaining));
        }
        return fractions;
    }
}
