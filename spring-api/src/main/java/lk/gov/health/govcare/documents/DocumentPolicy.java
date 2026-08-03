package lk.gov.health.govcare.documents;

import java.util.Locale;
import java.util.Set;

final class DocumentPolicy {
    static final Set<String> DOCUMENT_TYPES = Set.of(
            "PATIENT_REGISTRATION", "PATIENT_ID_CARD", "CONSULTATION_REPORT", "PRESCRIPTION",
            "PHARMACY_DISPENSING_REPORT", "LABORATORY_REQUEST", "LABORATORY_RESULT",
            "RADIOLOGY_REQUEST", "RADIOLOGY_RESULT", "ADMISSION_REPORT", "DISCHARGE_SUMMARY",
            "NURSING_REPORT", "EMERGENCY_REPORT", "OPERATION_THEATRE_REPORT", "REFERRAL_LETTER",
            "CONSENT_FORM", "MEDICAL_CERTIFICATE", "OTHER_CLINICAL_DOCUMENT"
    );

    static final Set<String> ADMINISTRATIVE_TYPES = Set.of(
            "PATIENT_REGISTRATION", "PATIENT_ID_CARD", "CONSENT_FORM"
    );

    static final Set<String> LAB_TYPES = Set.of("LABORATORY_REQUEST", "LABORATORY_RESULT");
    static final Set<String> RADIOLOGY_TYPES = Set.of("RADIOLOGY_REQUEST", "RADIOLOGY_RESULT");
    static final Set<String> PHARMACY_TYPES = Set.of("PRESCRIPTION", "PHARMACY_DISPENSING_REPORT");
    static final Set<String> WARD_TYPES = Set.of(
            "ADMISSION_REPORT", "DISCHARGE_SUMMARY", "NURSING_REPORT", "LABORATORY_RESULT",
            "RADIOLOGY_RESULT", "PRESCRIPTION", "EMERGENCY_REPORT"
    );
    static final Set<String> DOCTOR_TYPES = Set.of(
            "CONSULTATION_REPORT", "PRESCRIPTION", "LABORATORY_REQUEST", "LABORATORY_RESULT",
            "RADIOLOGY_REQUEST", "RADIOLOGY_RESULT", "ADMISSION_REPORT", "DISCHARGE_SUMMARY",
            "NURSING_REPORT", "EMERGENCY_REPORT", "OPERATION_THEATRE_REPORT", "REFERRAL_LETTER",
            "MEDICAL_CERTIFICATE", "OTHER_CLINICAL_DOCUMENT"
    );

    private DocumentPolicy() {}

    static String normalizeType(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        if (!DOCUMENT_TYPES.contains(normalized)) {
            throw lk.gov.health.govcare.common.ApiException.badRequest("Unsupported document type.");
        }
        return normalized;
    }

    static String defaultTitle(String type) {
        return switch (type) {
            case "PATIENT_REGISTRATION" -> "Patient Registration";
            case "PATIENT_ID_CARD" -> "Patient Identification Card";
            case "CONSULTATION_REPORT" -> "Consultation Report";
            case "PRESCRIPTION" -> "Prescription";
            case "PHARMACY_DISPENSING_REPORT" -> "Pharmacy Dispensing Report";
            case "LABORATORY_REQUEST" -> "Laboratory Request";
            case "LABORATORY_RESULT" -> "Laboratory Result";
            case "RADIOLOGY_REQUEST" -> "Radiology Request";
            case "RADIOLOGY_RESULT" -> "Radiology Report";
            case "ADMISSION_REPORT" -> "Admission Report";
            case "DISCHARGE_SUMMARY" -> "Discharge Summary";
            case "NURSING_REPORT" -> "Nursing Report";
            case "EMERGENCY_REPORT" -> "Emergency Care Report";
            case "OPERATION_THEATRE_REPORT" -> "Operation Theatre Report";
            case "REFERRAL_LETTER" -> "Referral Letter";
            case "CONSENT_FORM" -> "Consent Form";
            case "MEDICAL_CERTIFICATE" -> "Medical Certificate";
            default -> "Clinical Document";
        };
    }

    static String storageCategory(String type) {
        if (LAB_TYPES.contains(type)) return "laboratory";
        if (RADIOLOGY_TYPES.contains(type)) return "radiology";
        if (PHARMACY_TYPES.contains(type)) return "pharmacy";
        return switch (type) {
            case "CONSULTATION_REPORT", "REFERRAL_LETTER", "MEDICAL_CERTIFICATE" -> "consultations";
            case "ADMISSION_REPORT" -> "admissions";
            case "DISCHARGE_SUMMARY" -> "discharge";
            case "NURSING_REPORT" -> "nursing";
            case "EMERGENCY_REPORT" -> "emergency";
            case "OPERATION_THEATRE_REPORT" -> "operation-theatre";
            case "PATIENT_REGISTRATION", "PATIENT_ID_CARD", "CONSENT_FORM" -> "administrative";
            default -> "other";
        };
    }
}
