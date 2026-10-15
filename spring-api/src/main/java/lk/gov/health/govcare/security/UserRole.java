package lk.gov.health.govcare.security;

public enum UserRole {
    super_admin, hospital_admin, doctor, nurse, pharmacist, lab_technician, radiologist,
    receptionist, records_officer, patient, guardian, ict_admin, surgeon, anesthetist,
    mortuary_officer, pathologist, lab_manager, radiology_technician, opd_officer,
    ward_manager, inventory_officer, finance_officer, emergency_staff, quality_officer;

    public boolean isAssignableStaff() {
        return this != super_admin && this != patient && this != guardian;
    }

    public static String canonicalCode(String input) {
        if (input == null) return "";
        String code = input.trim().toLowerCase(java.util.Locale.ROOT).replace('-', '_').replace(' ', '_');
        return switch (code) {
            case "superadmin" -> "super_admin";
            case "front_desk", "front_desk_officer" -> "receptionist";
            case "it_admin", "it_administrator" -> "ict_admin";
            case "laboratory_technician" -> "lab_technician";
            case "laboratory_manager" -> "lab_manager";
            case "laboratory_pathologist" -> "pathologist";
            default -> code;
        };
    }
}
