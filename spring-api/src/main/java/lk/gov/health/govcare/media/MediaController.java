package lk.gov.health.govcare.media;

import jakarta.validation.constraints.NotBlank;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Validated
@RestController
@RequestMapping("/api/media")
public class MediaController {
  private final MediaStorageService mediaStorageService;

  public MediaController(MediaStorageService mediaStorageService) {
    this.mediaStorageService = mediaStorageService;
  }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public MediaDocumentDto upload(
    @RequestParam MultipartFile file,
    @RequestParam(required = false) UUID patientId,
    @RequestParam @NotBlank String module,
    @RequestParam(defaultValue = "private") String visibilityLevel
  ) throws IOException {
    return mediaStorageService.store(file, patientId, module, visibilityLevel);
  }

  @GetMapping
  public List<MediaDocumentDto> list(@RequestParam(required = false) UUID patientId) {
    return mediaStorageService.list(patientId);
  }

  @GetMapping("/{id}/download")
  public ResponseEntity<Resource> download(@PathVariable UUID id) throws IOException {
    MediaDocument document = mediaStorageService.getDownloadMetadata(id);
    Resource resource = mediaStorageService.loadForDownload(id);
    return ResponseEntity.ok()
      .contentType(MediaType.parseMediaType(document.getMimeType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : document.getMimeType()))
      .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(document.getOriginalFileName()).build().toString())
      .body(resource);
  }

  @PatchMapping("/{id}/release")
  public MediaDocumentDto release(@PathVariable UUID id) {
    return mediaStorageService.release(id);
  }
}

