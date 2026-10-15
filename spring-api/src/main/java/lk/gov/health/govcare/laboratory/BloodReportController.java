package lk.gov.health.govcare.laboratory;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/laboratory")
public class BloodReportController {
    private final BloodReportService service;
    private final BloodReportPdfService pdfService;
    private final CurrentUser current;

    public BloodReportController(BloodReportService service, BloodReportPdfService pdfService, CurrentUser current) {
        this.service = service;
        this.pdfService = pdfService;
        this.current = current;
    }

    @GetMapping("/blood-reports")
    @PreAuthorize("hasAuthority('LAB_REQUEST_VIEW')")
    public Map<String, Object> list(@RequestParam(required = false) String search,
                                    @RequestParam(required = false) String status,
                                    @RequestParam(required = false) String patientUuid,
                                    @RequestParam(required = false) String from,
                                    @RequestParam(required = false) String to) {
        return Map.of("items", service.list(current.get(), search, status, patientUuid, from, to));
    }

    @GetMapping("/blood-reports/{id}")
    @PreAuthorize("hasAuthority('LAB_REQUEST_VIEW')")
    public Map<String, Object> get(@PathVariable String id) {
        return Map.of("report", service.get(current.get(), id));
    }

    @GetMapping("/reference-ranges/cbc")
    @PreAuthorize("hasAuthority('LAB_REQUEST_VIEW')")
    public Map<String, Object> ranges(@RequestParam(required = false) String patientUuid) {
        return Map.of("items", service.referenceRanges(current.get(), patientUuid));
    }

    @PostMapping("/blood-reports")
    @PreAuthorize("hasAuthority('LAB_RESULT_CREATE')")
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("report", service.create(current.get(), input)));
    }

    @PutMapping("/blood-reports/{id}")
    @PreAuthorize("hasAuthority('LAB_RESULT_CREATE')")
    public Map<String, Object> update(@PathVariable String id, @RequestBody Map<String, Object> input) {
        return Map.of("report", service.update(current.get(), id, input));
    }

    @PostMapping("/blood-reports/{id}/complete")
    @PreAuthorize("hasAuthority('LAB_RESULT_CREATE')")
    public Map<String, Object> complete(@PathVariable String id) {
        return Map.of("report", service.complete(current.get(), id));
    }

    @PostMapping("/blood-reports/{id}/verify")
    @PreAuthorize("hasAuthority('LAB_RESULT_VERIFY')")
    public Map<String, Object> verify(@PathVariable String id) {
        return Map.of("report", service.verify(current.get(), id));
    }

    @PostMapping("/blood-reports/{id}/release")
    @PreAuthorize("hasAuthority('LAB_RESULT_RELEASE')")
    public Map<String, Object> release(@PathVariable String id) {
        return Map.of("report", service.release(current.get(), id));
    }

    @GetMapping("/blood-reports/{id}/pdf")
    @PreAuthorize("hasAuthority('REPORT_DOWNLOAD')")
    public ResponseEntity<byte[]> pdf(@PathVariable String id) {
        BloodReportPdfService.Report pdf = pdfService.generate(current.get(), id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(pdf.filename()).build().toString())
                .body(pdf.bytes());
    }
}
