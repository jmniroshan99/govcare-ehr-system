package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.pdf.PdfReportService;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Locale;
import java.util.UUID;

@Service
public class DocumentPdfService {
    private final PdfReportService reports;
    private final DocumentStorageService storage;

    public DocumentPdfService(PdfReportService reports, DocumentStorageService storage) {
        this.reports = reports;
        this.storage = storage;
    }

    public DocumentStorageService.StoredFile generate(
            GovCarePrincipal actor,
            UUID patientId,
            String documentType,
            String sourceKind,
            String sourceId
    ) throws IOException {
        String kind = sourceKind(documentType, sourceKind);
        if (sourceId == null || sourceId.isBlank()) throw ApiException.badRequest("A source record ID is required to generate the PDF.");
        PdfReportService.Report report = reports.generate(actor, kind, sourceId.trim());
        return storage.storeBytes(actor.hospitalId(), patientId, documentType, report.bytes(), report.filename(), "application/pdf");
    }

    static String sourceKind(String documentType, String requestedKind) {
        String expected = switch (documentType) {
            case "PATIENT_REGISTRATION", "PATIENT_ID_CARD" -> "patients";
            case "CONSULTATION_REPORT", "REFERRAL_LETTER", "MEDICAL_CERTIFICATE" -> "consultations";
            case "PRESCRIPTION", "PHARMACY_DISPENSING_REPORT" -> "pharmacy";
            case "LABORATORY_REQUEST", "LABORATORY_RESULT" -> "laboratory";
            case "RADIOLOGY_REQUEST", "RADIOLOGY_RESULT" -> "radiology";
            default -> throw ApiException.badRequest("This document type cannot be generated automatically.");
        };
        if (requestedKind == null || requestedKind.isBlank()) return expected;
        String candidate = requestedKind.trim().toLowerCase(Locale.ROOT);
        if (!candidate.equals(expected)) {
            throw ApiException.badRequest("The PDF source type does not match the selected document type.");
        }
        return candidate;
    }
}
