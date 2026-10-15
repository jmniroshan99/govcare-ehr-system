package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class DocumentStorageService {
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "application/pdf", ".pdf",
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"
    );

    private final Path root;
    private final long maxBytes;

    public DocumentStorageService(
            @Value("${govcare.storage.root}") String root,
            @Value("${govcare.documents.max-bytes:26214400}") long maxBytes
    ) {
        this.root = Path.of(root).toAbsolutePath().normalize();
        this.maxBytes = maxBytes;
    }

    public StoredFile store(UUID hospitalId, UUID patientId, String documentType, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("A document file is required.");
        if (file.getSize() > maxBytes) throw ApiException.payloadTooLarge("The uploaded file exceeds the configured size limit.");

        String original = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "patient-document"));
        String mime = normalizedMime(file.getContentType(), original);
        String extension = extensionFor(mime, original);
        UUID fileId = UUID.randomUUID();
        Path folder = patientFolder(hospitalId, patientId, documentType);
        Files.createDirectories(folder);
        Path target = folder.resolve(fileId + extension).normalize();
        ensureInsideRoot(target);

        MessageDigest digest = sha256();
        try (InputStream input = new DigestInputStream(file.getInputStream(), digest)) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }

        return new StoredFile(
                root.relativize(target).toString().replace('\\', '/'),
                target.getFileName().toString(),
                original,
                mime,
                file.getSize(),
                HexFormat.of().formatHex(digest.digest())
        );
    }

    public StoredFile storeBytes(UUID hospitalId, UUID patientId, String documentType,
                                 byte[] bytes, String originalFileName, String mimeType) throws IOException {
        if (bytes == null || bytes.length == 0) throw ApiException.badRequest("Generated document content is empty.");
        if (bytes.length > maxBytes) throw ApiException.payloadTooLarge("The generated file exceeds the configured size limit.");
        String original = StringUtils.cleanPath(Objects.requireNonNullElse(originalFileName, "generated-report.pdf"));
        String mime = normalizedMime(mimeType, original);
        String extension = extensionFor(mime, original);
        Path folder = patientFolder(hospitalId, patientId, documentType);
        Files.createDirectories(folder);
        Path target = folder.resolve(UUID.randomUUID() + extension).normalize();
        ensureInsideRoot(target);
        Files.write(target, bytes);
        MessageDigest digest = sha256();
        digest.update(bytes);
        return new StoredFile(
                root.relativize(target).toString().replace('\\', '/'),
                target.getFileName().toString(),
                original,
                mime,
                bytes.length,
                HexFormat.of().formatHex(digest.digest())
        );
    }

    public Resource resource(String storageKey) throws IOException {
        Path path = resolveSecure(storageKey);
        Resource resource = new UrlResource(path.toUri());
        if (!resource.exists() || !resource.isReadable()) {
            throw ApiException.notFound("The stored document file is unavailable.");
        }
        return resource;
    }

    public Path resolveSecure(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) throw ApiException.notFound("Document storage information is missing.");
        Path supplied = Path.of(storageKey);
        Path resolved = supplied.isAbsolute() ? supplied.toAbsolutePath().normalize() : root.resolve(supplied).normalize();
        ensureInsideRoot(resolved);
        return resolved;
    }

    private Path patientFolder(UUID hospitalId, UUID patientId, String documentType) {
        return root.resolve("hospitals")
                .resolve(hospitalId.toString())
                .resolve("patients")
                .resolve(patientId.toString())
                .resolve(DocumentPolicy.storageCategory(documentType))
                .normalize();
    }

    private void ensureInsideRoot(Path path) {
        if (!path.toAbsolutePath().normalize().startsWith(root)) {
            throw ApiException.forbidden("Invalid document storage path.");
        }
    }

    private static String normalizedMime(String contentType, String filename) {
        String mime = contentType == null ? "" : contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        if (ALLOWED_TYPES.containsKey(mime)) return mime;
        String lower = filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        throw ApiException.badRequest("Unsupported file type. PDF, JPEG, PNG, and DOCX are allowed.");
    }

    private static String extensionFor(String mime, String filename) {
        String expected = ALLOWED_TYPES.get(mime);
        String lower = filename.toLowerCase(Locale.ROOT);
        if (mime.equals("image/jpeg") && lower.endsWith(".jpeg")) return ".jpeg";
        return expected;
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 is unavailable.", ex);
        }
    }

    public record StoredFile(
            String storageKey,
            String fileName,
            String originalFileName,
            String mimeType,
            long size,
            String checksum
    ) {}
}
