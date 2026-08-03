package lk.gov.health.govcare.documents;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class DocumentDtos {
    private DocumentDtos() {}

    public record GenerateDocumentRequest(
            String documentType,
            String title,
            String description,
            String sourceKind,
            String sourceId,
            UUID encounterId,
            UUID consultationId,
            UUID prescriptionId,
            UUID laboratoryRequestId,
            UUID radiologyRequestId,
            UUID admissionId
    ) {}

    public record ShareDocumentRequest(
            UUID departmentId,
            String accessType,
            OffsetDateTime expiresAt
    ) {}

    public record RejectDocumentRequest(String reason) {}
}
