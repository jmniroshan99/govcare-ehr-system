package lk.gov.health.govcare.media;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;
import lk.gov.health.govcare.security.AuthContext;
import lk.gov.health.govcare.security.RequestUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaStorageService {
  private final Path storageRoot;
  private final MediaDocumentRepository repository;

  public MediaStorageService(@Value("${govcare.storage.root}") String storageRoot, MediaDocumentRepository repository) {
    this.storageRoot = Path.of(storageRoot).toAbsolutePath().normalize();
    this.repository = repository;
  }

  @Transactional
  public MediaDocumentDto store(MultipartFile file, UUID patientId, String module, String visibilityLevel) throws IOException {
    RequestUser user = AuthContext.requireUser();
    validateUploadPermission(user, patientId);

    UUID id = UUID.randomUUID();
    String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "upload.bin" : file.getOriginalFilename());
    String extension = extensionOf(originalName);
    String storedName = id + extension;
    Path folder = storageRoot.resolve(user.hospitalId().toString()).resolve(module).resolve(patientId == null ? "general" : patientId.toString());
    Files.createDirectories(folder);
    Path target = folder.resolve(storedName).normalize();

    MessageDigest digest = sha256();
    try (InputStream input = new DigestInputStream(file.getInputStream(), digest)) {
      Files.copy(input, target);
    }

    MediaDocument document = new MediaDocument();
    document.setId(id);
    document.setHospitalId(user.hospitalId());
    document.setPatientId(patientId);
    document.setUploadedBy(user.userId());
    document.setUploaderRole(user.role());
    document.setModule(module);
    document.setFilePath(target.toString());
    document.setFileName(storedName);
    document.setOriginalFileName(originalName);
    document.setMimeType(file.getContentType());
    document.setFileSizeBytes(file.getSize());
    document.setSha256Checksum(HexFormat.of().formatHex(digest.digest()));
    document.setStorageProvider("spring-local");
    document.setVisibilityLevel(visibilityLevel == null || visibilityLevel.isBlank() ? "private" : visibilityLevel);
    document.setReleaseStatus("patient-released".equals(document.getVisibilityLevel()) ? "released" : "internal");
    document.setFileUrl("/api/media/" + id + "/download");
    document.setCreatedAt(OffsetDateTime.now());
    return MediaDocumentDto.from(repository.save(document));
  }

  @Transactional(readOnly = true)
  public Resource loadForDownload(UUID id) throws IOException {
    RequestUser user = AuthContext.requireUser();
    MediaDocument document = repository.findByIdAndHospitalId(id, user.hospitalId())
      .orElseThrow(() -> new IllegalArgumentException("Media document was not found."));
    validateReadPermission(user, document);
    Path path = Path.of(document.getFilePath()).normalize();
    Resource resource = new UrlResource(path.toUri());
    if (!resource.exists() || !resource.isReadable()) throw new IOException("Stored file is not readable.");
    return resource;
  }

  @Transactional(readOnly = true)
  public MediaDocument getDownloadMetadata(UUID id) {
    RequestUser user = AuthContext.requireUser();
    MediaDocument document = repository.findByIdAndHospitalId(id, user.hospitalId())
      .orElseThrow(() -> new IllegalArgumentException("Media document was not found."));
    validateReadPermission(user, document);
    return document;
  }

  @Transactional(readOnly = true)
  public java.util.List<MediaDocumentDto> list(UUID patientId) {
    RequestUser user = AuthContext.requireUser();
    if ("patient".equals(user.role())) {
      UUID ownPatientId = user.patientId();
      if (ownPatientId == null || !ownPatientId.equals(patientId)) throw new SecurityException("Patients can only view their own documents.");
    }
    return (patientId == null
      ? repository.findTop100ByHospitalIdAndStatusOrderByCreatedAtDesc(user.hospitalId(), "active")
      : repository.findTop100ByHospitalIdAndPatientIdAndStatusOrderByCreatedAtDesc(user.hospitalId(), patientId, "active"))
      .stream()
      .filter(document -> !"patient".equals(user.role()) || "released".equals(document.getReleaseStatus()))
      .map(MediaDocumentDto::from)
      .toList();
  }

  @Transactional
  public MediaDocumentDto release(UUID id) {
    RequestUser user = AuthContext.requireUser();
    if (!user.hasAnyRole("doctor", "hospital_admin", "super_admin", "records_officer")) {
      throw new SecurityException("Only authorized clinical/admin staff can release documents.");
    }
    MediaDocument document = repository.findByIdAndHospitalId(id, user.hospitalId())
      .orElseThrow(() -> new IllegalArgumentException("Media document was not found."));
    document.setReleaseStatus("released");
    document.setVisibilityLevel("patient-released");
    document.setReleasedBy(user.userId());
    document.setReleasedAt(OffsetDateTime.now());
    return MediaDocumentDto.from(repository.save(document));
  }

  private static void validateUploadPermission(RequestUser user, UUID patientId) {
    if ("patient".equals(user.role()) && (user.patientId() == null || !user.patientId().equals(patientId))) {
      throw new SecurityException("Patients can only upload documents to their own profile.");
    }
  }

  private static void validateReadPermission(RequestUser user, MediaDocument document) {
    if ("patient".equals(user.role())) {
      if (user.patientId() == null || !user.patientId().equals(document.getPatientId()) || !"released".equals(document.getReleaseStatus())) {
        throw new SecurityException("Document is not released to this patient.");
      }
    }
  }

  private static String extensionOf(String fileName) {
    int dot = fileName.lastIndexOf('.');
    if (dot < 0) return "";
    return fileName.substring(dot).replaceAll("[^A-Za-z0-9.]", "");
  }

  private static MessageDigest sha256() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 digest is unavailable.", error);
    }
  }
}

