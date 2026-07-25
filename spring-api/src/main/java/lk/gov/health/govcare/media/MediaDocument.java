package lk.gov.health.govcare.media;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "global_media")
public class MediaDocument {
  @Id
  private UUID id;

  @Column(name = "hospital_id", nullable = false)
  private UUID hospitalId;

  @Column(name = "patient_id")
  private UUID patientId;

  @Column(name = "uploaded_by")
  private UUID uploadedBy;

  @Column(name = "uploader_role")
  private String uploaderRole;

  @Column(nullable = false)
  private String module;

  @Column(name = "file_url", nullable = false)
  private String fileUrl;

  @Column(name = "file_path")
  private String filePath;

  @Column(name = "file_name")
  private String fileName;

  @Column(name = "original_file_name")
  private String originalFileName;

  @Column(name = "mime_type")
  private String mimeType;

  @Column(name = "file_size_bytes")
  private Long fileSizeBytes;

  @Column(name = "sha256_checksum")
  private String sha256Checksum;

  @Column(name = "storage_provider", nullable = false)
  private String storageProvider = "spring-local";

  @Column(name = "visibility_level", nullable = false)
  private String visibilityLevel = "private";

  @Column(nullable = false)
  private String status = "active";

  @Column(name = "release_status", nullable = false)
  private String releaseStatus = "internal";

  @Column(name = "released_by")
  private UUID releasedBy;

  @Column(name = "released_at")
  private OffsetDateTime releasedAt;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }
  public UUID getHospitalId() { return hospitalId; }
  public void setHospitalId(UUID hospitalId) { this.hospitalId = hospitalId; }
  public UUID getPatientId() { return patientId; }
  public void setPatientId(UUID patientId) { this.patientId = patientId; }
  public UUID getUploadedBy() { return uploadedBy; }
  public void setUploadedBy(UUID uploadedBy) { this.uploadedBy = uploadedBy; }
  public String getUploaderRole() { return uploaderRole; }
  public void setUploaderRole(String uploaderRole) { this.uploaderRole = uploaderRole; }
  public String getModule() { return module; }
  public void setModule(String module) { this.module = module; }
  public String getFileUrl() { return fileUrl; }
  public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
  public String getFilePath() { return filePath; }
  public void setFilePath(String filePath) { this.filePath = filePath; }
  public String getFileName() { return fileName; }
  public void setFileName(String fileName) { this.fileName = fileName; }
  public String getOriginalFileName() { return originalFileName; }
  public void setOriginalFileName(String originalFileName) { this.originalFileName = originalFileName; }
  public String getMimeType() { return mimeType; }
  public void setMimeType(String mimeType) { this.mimeType = mimeType; }
  public Long getFileSizeBytes() { return fileSizeBytes; }
  public void setFileSizeBytes(Long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }
  public String getSha256Checksum() { return sha256Checksum; }
  public void setSha256Checksum(String sha256Checksum) { this.sha256Checksum = sha256Checksum; }
  public String getStorageProvider() { return storageProvider; }
  public void setStorageProvider(String storageProvider) { this.storageProvider = storageProvider; }
  public String getVisibilityLevel() { return visibilityLevel; }
  public void setVisibilityLevel(String visibilityLevel) { this.visibilityLevel = visibilityLevel; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getReleaseStatus() { return releaseStatus; }
  public void setReleaseStatus(String releaseStatus) { this.releaseStatus = releaseStatus; }
  public UUID getReleasedBy() { return releasedBy; }
  public void setReleasedBy(UUID releasedBy) { this.releasedBy = releasedBy; }
  public OffsetDateTime getReleasedAt() { return releasedAt; }
  public void setReleasedAt(OffsetDateTime releasedAt) { this.releasedAt = releasedAt; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}

