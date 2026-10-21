import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import javax.imageio.ImageIO;
import java.nio.file.*;

/** Renders summary pages from a complete synthetic report, including its normal header/footer. */
class InspectClinicalSummaryPdf {
    public static void main(String[] args) throws Exception {
        Path output=Path.of(args[1]);Files.createDirectories(output);
        try(var document=Loader.loadPDF(Path.of(args[0]).toFile())) {
            var stripper=new PDFTextStripper();
            String all=stripper.getText(document);
            for(String title:new String[]{"CKD Related Clinical Intelligence Summary","Anemia Monitoring","Hyperkalemia Risk Monitoring","CKD Cardiovascular Monitoring"})
                if(!all.contains(title))throw new IllegalStateException("Missing summary section: "+title);
            if(all.contains("Missing information: Listed monitoring inputs recorded"))throw new IllegalStateException("Misleading missing-data label");
            int rendered=0;
            for(int page=0;page<document.getNumberOfPages();page++) {
                stripper.setStartPage(page+1);stripper.setEndPage(page+1);
                if(stripper.getText(document).contains("CKD Related Clinical Intelligence Summary")) {
                    ImageIO.write(new PDFRenderer(document).renderImageWithDPI(page,120),"PNG",output.resolve("summary-page-"+(page+1)+".png").toFile());
                    rendered++;
                }
            }
            Files.writeString(output.resolve("report-text.txt"),all);
            System.out.println("Complete synthetic report verified: "+document.getNumberOfPages()+" pages; "+rendered+" summary pages rendered.");
        }
    }
}
