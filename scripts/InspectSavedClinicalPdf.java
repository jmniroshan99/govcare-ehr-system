import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import javax.imageio.ImageIO;
import java.nio.file.*;

/** Visual QA of every page of the production synthetic saved-contract report. */
class InspectSavedClinicalPdf {
    public static void main(String[] args)throws Exception{
        var destination=Path.of(args[1]);Files.createDirectories(destination);
        try(var document=Loader.loadPDF(Path.of(args[0]).toFile())){
            String all=new PDFTextStripper().getText(document);
            var bounds=new PDFTextStripper(){
                @Override protected void processTextPosition(TextPosition p){
                    if(p.getFontSizeInPt()>=8&&(p.getYDirAdj()>798||p.getXDirAdj()<36||p.getXDirAdj()+p.getWidthDirAdj()>560))
                        throw new IllegalStateException("Body text outside content area on page "+getCurrentPageNo()+": "+p.getUnicode()+" at "+p.getXDirAdj()+","+p.getYDirAdj());
                    super.processTextPosition(p);
                }
            };bounds.getText(document);
            for(String expected:new String[]{"CKD Related Clinical Intelligence Summary","Severe low potassium","Recorded potassium: 2 mmol/L","1 of 1 listed inputs recorded","SAVED CLINICAL EVIDENCE AND REVIEW","GOVCARE-CLINICAL-RULES-2.0"})
                if(!all.contains(expected))throw new IllegalStateException("Missing saved result: "+expected);
            if(all.contains("risk not estimated?"))throw new IllegalStateException("Invalid separator glyph");
            var renderer=new PDFRenderer(document);
            for(int page=0;page<document.getNumberOfPages();page++)ImageIO.write(renderer.renderImageWithDPI(page,100),"PNG",destination.resolve("page-"+(page+1)+".png").toFile());
            Files.writeString(destination.resolve("report-text.txt"),all);
            System.out.println("Rendered all "+document.getNumberOfPages()+" pages; saved synthetic result text verified.");
        }
    }
}
