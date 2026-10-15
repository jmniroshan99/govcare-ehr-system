package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.security.*;import org.springframework.core.io.Resource;import org.springframework.http.*;import org.springframework.web.bind.annotation.*;import java.io.*;import java.util.*;
@RestController @RequestMapping("/api/ai-cdss/ckd/assessments") public class CkdAssessmentReportController{
 private final CkdAssessmentReportService reports;private final CkdPredictionService predictions;private final CurrentUser current;public CkdAssessmentReportController(CkdAssessmentReportService r,CkdPredictionService p,CurrentUser c){reports=r;predictions=p;current=c;}
 @GetMapping("/{id}") public Map<String,Object> get(@PathVariable UUID id){return predictions.assessment(current.get(),id);}
 @PostMapping("/{id}/report") public Map<String,Object> generate(@PathVariable UUID id)throws IOException{return reports.generate(current.get(),id);}
 @GetMapping("/{id}/reports") public Map<String,Object> list(@PathVariable UUID id){return Map.of("items",reports.list(current.get(),id));}
 @GetMapping("/reports/{reportId}/download") public ResponseEntity<Resource> download(@PathVariable UUID reportId)throws IOException{var r=reports.content(current.get(),reportId);return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(r.filename()).build().toString()).body(r.resource());}
}
