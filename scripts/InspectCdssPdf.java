import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.rendering.PDFRenderer;
import javax.imageio.ImageIO;
import java.nio.file.*;

/** Read-only inspection of the synthetic native-stack export. */
class InspectCdssPdf {
    public static void main(String[] args) throws Exception {
        Path output=Path.of(args[1]);Files.createDirectories(output);
        try(var document=Loader.loadPDF(Path.of(args[0]).toFile())) {
            var stripper=new PDFTextStripper();String all=stripper.getText(document);
            for(String required:new String[]{"FIVE-YEAR CKD OUTLOOK","KFRE4-NNA-2016-GOVCARE-1.0","30.63%","INSUFFICIENT_LONG_TERM_OUTCOME_DATA","Synthetic review milestone"})
                if(!all.contains(required))throw new IllegalStateException("Missing stored provenance: "+required);
            var renderer=new PDFRenderer(document);int rendered=0;
            for(int i=0;i<document.getNumberOfPages();i++) {
                stripper.setStartPage(i+1);stripper.setEndPage(i+1);String page=stripper.getText(document);
                if(page.contains("FIVE-YEAR CKD OUTLOOK")) {
                    ImageIO.write(renderer.renderImageWithDPI(i,120),"PNG",output.resolve("outlook-page-"+(i+1)+".png").toFile());rendered++;
                }
            }
            Files.writeString(output.resolve("extracted-text.txt"),all);
            System.out.println("PDF provenance verified; total pages="+document.getNumberOfPages()+"; rendered outlook pages="+rendered);
        }
    }
}
