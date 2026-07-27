package lk.gov.health.govcare.media;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MediaDocumentDto(
  UUID id,
  UUID hospitalId,
  UUID patientId,
  String module,
  String fileUrl,
  String fileName,
  String originalFileName,
  String mimeType,
  Long fileSizeBytes,
  String sha256Checksum,
  String visibilityLevel,
  String releaseStatus,
  OffsetDateTime createdAt
) {
  public static MediaDocumentDto from(MediaDocument document) {
    return new MediaDocumentDto(
      document.getId(),
      document.getHospitalId(),
      document.getPatientId(),
      document.getModule(),
      document.getFileUrl(),
      document.getFileName(),
      document.getOriginalFileName(),
      document.getMimeType(),
      document.getFileSizeBytes(),
      document.getSha256Checksum(),
      document.getVisibilityLevel(),
      document.getReleaseStatus(),
      document.getCreatedAt()
    );
  }
}

