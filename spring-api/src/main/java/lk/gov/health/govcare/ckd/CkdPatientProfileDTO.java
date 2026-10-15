package lk.gov.health.govcare.ckd;

public record CkdPatientProfileDTO(
 String id, String name, String photoUrl, String nic,
 String dateOfBirth, Integer age, String gender,
 String bloodGroup, String contactNumber, String address
) {}
