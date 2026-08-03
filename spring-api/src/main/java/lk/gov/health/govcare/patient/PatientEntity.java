package lk.gov.health.govcare.patient;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name="patients")
public class PatientEntity {
    @Id @GeneratedValue private UUID id;
    @Column(name="hospital_id", nullable=false) private UUID hospitalId;
    @Column(name="patient_no", nullable=false) private String patientNo;
    @Column(name="guardian_id") private UUID guardianId;
    private String nic;
    @Column(name="passport_no") private String passportNo;
    @Column(name="birth_certificate_no") private String birthCertificateNo;
    private String title;
    @Column(name="full_name", nullable=false) private String fullName;
    @Column(name="preferred_name") private String preferredName;
    @Column(name="date_of_birth", nullable=false) private LocalDate dateOfBirth;
    @Column(name="age_years") private Integer ageYears;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) @Column(columnDefinition="gender_value") private GenderValue gender;
    @Column(name="blood_group") private String bloodGroup;
    private String nationality;
    private String address;
    private String district;
    private String province;
    private String phone;
    private String email;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="emergency_contact", columnDefinition="jsonb", nullable=false) private JsonNode emergencyContact;
    @Column(name="language_preference") private String languagePreference;
    @Column(name="profile_photo_url") private String profilePhotoUrl;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false) private JsonNode allergies;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="chronic_diseases", columnDefinition="jsonb", nullable=false) private JsonNode chronicDiseases;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false) private JsonNode disabilities;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="family_history", columnDefinition="jsonb", nullable=false) private JsonNode familyHistory;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="risk_flags", columnDefinition="jsonb", nullable=false) private JsonNode riskFlags;
    @Column(name="qr_payload") private String qrPayload;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) @Column(name="release_status", columnDefinition="release_status", nullable=false) private ReleaseStatus releaseStatus;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) @Column(columnDefinition="record_status", nullable=false) private RecordStatus status;
    @Column(name="created_by") private UUID createdBy;
    @Column(name="updated_by") private UUID updatedBy;
    @Column(name="created_at", insertable=false, updatable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", insertable=false) private OffsetDateTime updatedAt;

    @PrePersist void defaults() {
        if (emergencyContact==null) emergencyContact=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        if (allergies==null) allergies=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        if (chronicDiseases==null) chronicDiseases=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        if (disabilities==null) disabilities=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        if (familyHistory==null) familyHistory=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        if (riskFlags==null) riskFlags=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        if (languagePreference==null) languagePreference="en";
        if (releaseStatus==null) releaseStatus=ReleaseStatus.internal;
        if (status==null) status=RecordStatus.active;
    }

    public UUID getId(){return id;} public void setId(UUID v){id=v;}
    public UUID getHospitalId(){return hospitalId;} public void setHospitalId(UUID v){hospitalId=v;}
    public String getPatientNo(){return patientNo;} public void setPatientNo(String v){patientNo=v;}
    public UUID getGuardianId(){return guardianId;} public void setGuardianId(UUID v){guardianId=v;}
    public String getNic(){return nic;} public void setNic(String v){nic=v;}
    public String getPassportNo(){return passportNo;} public void setPassportNo(String v){passportNo=v;}
    public String getBirthCertificateNo(){return birthCertificateNo;} public void setBirthCertificateNo(String v){birthCertificateNo=v;}
    public String getTitle(){return title;} public void setTitle(String v){title=v;}
    public String getFullName(){return fullName;} public void setFullName(String v){fullName=v;}
    public String getPreferredName(){return preferredName;} public void setPreferredName(String v){preferredName=v;}
    public LocalDate getDateOfBirth(){return dateOfBirth;} public void setDateOfBirth(LocalDate v){dateOfBirth=v;}
    public Integer getAgeYears(){return ageYears;} public void setAgeYears(Integer v){ageYears=v;}
    public GenderValue getGender(){return gender;} public void setGender(GenderValue v){gender=v;}
    public String getBloodGroup(){return bloodGroup;} public void setBloodGroup(String v){bloodGroup=v;}
    public String getNationality(){return nationality;} public void setNationality(String v){nationality=v;}
    public String getAddress(){return address;} public void setAddress(String v){address=v;}
    public String getDistrict(){return district;} public void setDistrict(String v){district=v;}
    public String getProvince(){return province;} public void setProvince(String v){province=v;}
    public String getPhone(){return phone;} public void setPhone(String v){phone=v;}
    public String getEmail(){return email;} public void setEmail(String v){email=v;}
    public JsonNode getEmergencyContact(){return emergencyContact;} public void setEmergencyContact(JsonNode v){emergencyContact=v;}
    public String getLanguagePreference(){return languagePreference;} public void setLanguagePreference(String v){languagePreference=v;}
    public String getProfilePhotoUrl(){return profilePhotoUrl;} public void setProfilePhotoUrl(String v){profilePhotoUrl=v;}
    public JsonNode getAllergies(){return allergies;} public void setAllergies(JsonNode v){allergies=v;}
    public JsonNode getChronicDiseases(){return chronicDiseases;} public void setChronicDiseases(JsonNode v){chronicDiseases=v;}
    public JsonNode getDisabilities(){return disabilities;} public void setDisabilities(JsonNode v){disabilities=v;}
    public JsonNode getFamilyHistory(){return familyHistory;} public void setFamilyHistory(JsonNode v){familyHistory=v;}
    public JsonNode getRiskFlags(){return riskFlags;} public void setRiskFlags(JsonNode v){riskFlags=v;}
    public String getQrPayload(){return qrPayload;} public void setQrPayload(String v){qrPayload=v;}
    public ReleaseStatus getReleaseStatus(){return releaseStatus;} public void setReleaseStatus(ReleaseStatus v){releaseStatus=v;}
    public RecordStatus getStatus(){return status;} public void setStatus(RecordStatus v){status=v;}
    public UUID getCreatedBy(){return createdBy;} public void setCreatedBy(UUID v){createdBy=v;}
    public UUID getUpdatedBy(){return updatedBy;} public void setUpdatedBy(UUID v){updatedBy=v;}
    public OffsetDateTime getCreatedAt(){return createdAt;} public OffsetDateTime getUpdatedAt(){return updatedAt;}
}
