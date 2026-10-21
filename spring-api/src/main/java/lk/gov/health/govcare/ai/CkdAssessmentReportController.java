package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.security.*;import org.springframework.core.io.Resource;import org.springframework.http.*;import org.springframework.web.bind.annotation.*;import java.io.*;import java.util.*;
@RestController @RequestMapping("/api/ai-cdss/ckd/assessments") public class CkdAssessmentReportController{
 private final CkdAssessmentReportService reports;private final CkdPredictionService predictions;private final CurrentUser current;public CkdAssessmentReportController(CkdAssessmentReportService r,CkdPredictionService p,CurrentUser c){reports=r;predictions=p;current=c;}
 @GetMapping("/{id}") public Map<String,Object> get(@PathVariable UUID id){return predictions.assessment(current.get(),id);}
 public record ReportSelection(UUID clinicalSnapshotId,UUID outlookSnapshotId,boolean technicalAppendix){}
 @PostMapping("/{id}/report") public Map<String,Object> generate(@PathVariable UUID id,@RequestBody(required=false) ReportSelection selection)throws IOException{return selection==null?reports.generate(current.get(),id):selection.technicalAppendix()?reports.generate(current.get(),id,selection.clinicalSnapshotId(),selection.outlookSnapshotId(),true):reports.generate(current.get(),id,selection.clinicalSnapshotId(),selection.outlookSnapshotId());}
 @GetMapping("/{id}/reports") public Map<String,Object> list(@PathVariable UUID id){return Map.of("items",reports.list(current.get(),id));}
 @GetMapping("/reports/{reportId}/download") public ResponseEntity<byte[]> download(@PathVariable UUID reportId)throws IOException{
  var r=reports.content(current.get(),reportId);byte[] bytes;
  try(var stream=r.resource().getInputStream()){bytes=stream.readAllBytes();}
  // A generated report is a complete immutable document. Return one bounded body
  // rather than Resource range conversion. Clinical responses must not be cached.
  return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).contentLength(bytes.length).cacheControl(CacheControl.noStore())
   .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(r.filename()).build().toString()).body(bytes);
 }
}
