package lk.gov.health.govcare.documents;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Local, non-network PDF extraction. The original file is never modified. */
@Service
public class LocalPdfExtractionService {
    public ExtractionResult extract(byte[] pdf) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            List<PageText> pages = new ArrayList<>();
            List<ImportantDetail> details = new ArrayList<>();
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String text = stripper.getText(document).replace("\u0000", "").trim();
                pages.add(new PageText(page, text));
                for (String line : text.lines().map(String::trim).filter(s -> !s.isBlank()).toList()) {
                    String lower = line.toLowerCase(Locale.ROOT);
                    Priority priority = priorityOf(lower);
                    if (priority != null) {
                        details.add(new ImportantDetail(priority.name(), line, page,
                                "Extracted locally from the source PDF; verify the original report."));
                    }
                }
            }
            boolean needsReview = pages.stream().allMatch(p -> p.text().isBlank());
            return new ExtractionResult("LOCAL_TEXT", needsReview ? "NEEDS_MANUAL_REVIEW" : "COMPLETED",
                    pages, details, needsReview ? "No selectable text was found. Local OCR is required for this scanned PDF." : null);
        }
    }

    private Priority priorityOf(String line) {
        if (line.matches(".*\\b(critical|urgent|panic|life[- ]?threatening)\\b.*")) return Priority.CRITICAL;
        if (line.matches(".*\\b(abnormal|high|low|positive|elevated|decreased|increased|flagged)\\b.*")) return Priority.HIGH;
        if (line.matches(".*\\b(pending|follow[- ]?up|review|repeat|recommend)\\b.*")) return Priority.MEDIUM;
        return null;
    }

    private enum Priority { CRITICAL, HIGH, MEDIUM }
    public record PageText(int page, String text) {}
    public record ImportantDetail(String priority, String statement, int sourcePage, String note) {}
    public record ExtractionResult(String method, String status, List<PageText> pages,
                                   List<ImportantDetail> importantDetails, String warning) {}
}
