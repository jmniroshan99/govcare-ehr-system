package lk.gov.health.govcare.patient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SequenceService;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.util.*;

@Service
public class PatientService {
    private final PatientRepository patients;
    private final SqlSupport sql;
    private final SequenceService sequences;
    private final ObjectMapper mapper;
    private final AuditService audit;

    public PatientService(PatientRepository patients, SqlSupport sql, SequenceService sequences, ObjectMapper mapper, AuditService audit) {
        this.patients = patients;
        this.sql = sql;
        this.sequences = sequences;
        this.mapper = mapper;
        this.audit = audit;
    }

    public record PatientInput(
            String patientId, String fullName, LocalDate dateOfBirth, String gender,
            String title, String preferredName, String nic, String passportNo,
            String birthCertificateNo, String bloodGroup, String nationality,
            String phone, String email, String address, String district, String province,
            String profilePhotoUrl, String languagePreference, Map<String,Object> emergencyContact,
            List<String> allergies, List<String> chronicDiseases, List<String> disabilities,
            List<String> familyHistory, List<String> riskFlags, UUID guardianId
    ) {}

    public List<Map<String,Object>> list(GovCarePrincipal actor, String search) {
        if (actor.role().equals("patient") || actor.role().equals("guardian")) {
            if (actor.patientId() == null) return List.of();
            return patients.findById(actor.patientId())
                    .filter(p -> Objects.equals(p.getHospitalId(), actor.hospitalId()) && p.getStatus() != RecordStatus.deleted)
                    .map(p -> List.of(toMap(p, true)))
                    .orElseGet(List::of);
        }
        List<PatientEntity> rows = search == null || search.isBlank()
                ? patients.recent(actor.hospitalId(), PageRequest.of(0,50))
                : patients.search(actor.hospitalId(), search.trim(), PageRequest.of(0,50));
        boolean clinical = actor.permissions().contains("PATIENT_VIEW_CLINICAL")
                || actor.role().equals("super_admin") || actor.role().equals("hospital_admin");
        return rows.stream().map(p -> toMap(p, clinical)).toList();
    }

    public PatientEntity getEntity(GovCarePrincipal actor, String identifier) {
        PatientEntity patient = patients.findAccessible(actor.hospitalId(), identifier.trim())
                .orElseThrow(() -> ApiException.notFound("Patient not found."));
        if (actor.role().equals("patient") || actor.role().equals("guardian")) {
            if (actor.patientId() == null || !actor.patientId().equals(patient.getId())) {
                throw ApiException.notFound("Patient not found.");
            }
        }
        return patient;
    }

    public Map<String,Object> get(GovCarePrincipal actor, String identifier) {
        boolean clinical = actor.permissions().contains("PATIENT_VIEW_CLINICAL") || actor.role().equals("super_admin") || actor.role().equals("hospital_admin") || (actor.patientId()!=null);
        return toMap(getEntity(actor, identifier), clinical);
    }

    public Map<String,Object> duplicateCheck(GovCarePrincipal actor, Map<String,Object> input) {
        Map<String,Object> params = duplicateParams(actor.hospitalId(), input);
        List<Map<String,Object>> rows = sql.list(duplicateSql(), params);
        Map<String,Object> exact = rows.stream().filter(row -> matched(row).stream().anyMatch(Set.of("nic","passport","birthCertificate","email")::contains)).findFirst().orElse(null);
        Map<String,Object> possible = exact != null ? exact : rows.stream().findFirst().orElse(null);
        Map<String,Object> response = new LinkedHashMap<>();
        response.put("duplicate", exact != null);
        response.put("possibleMatch", possible != null);
        response.put("matchedBy", possible == null ? List.of() : matched(possible));
        response.put("patient", possible);
        return response;
    }

    @Transactional
    public Map<String,Object> create(GovCarePrincipal actor, PatientInput input) {
        if (input.fullName()==null || input.fullName().trim().length()<2) throw ApiException.badRequest("Full name is required.");
        if (input.dateOfBirth()==null) throw ApiException.badRequest("Date of birth is required.");
        Map<String,Object> checkInput = new LinkedHashMap<>();
        checkInput.put("nic", input.nic()); checkInput.put("passportNo", input.passportNo());
        checkInput.put("birthCertificateNo", input.birthCertificateNo()); checkInput.put("phone", input.phone());
        checkInput.put("fullName", input.fullName()); checkInput.put("dateOfBirth", input.dateOfBirth().toString()); checkInput.put("email", input.email());

        sequences.lock("govcare:"+actor.hospitalId()+":patients");
        Map<String,Object> duplicate = duplicateCheck(actor, checkInput);
        if (Boolean.TRUE.equals(duplicate.get("duplicate"))) {
            return Map.of("duplicate", true, "matchedBy", duplicate.get("matchedBy"), "patient", duplicate.get("patient"));
        }

        String requested = clean(input.patientId());
        String patientNo = requested;
        if (patientNo == null || patients.existsByHospitalIdAndPatientNoIgnoreCase(actor.hospitalId(), patientNo)) {
            patientNo = sequences.nextPatientNo(actor.hospitalId());
        }

        PatientEntity p = new PatientEntity();
        p.setHospitalId(actor.hospitalId());
        p.setPatientNo(patientNo.toUpperCase());
        p.setGuardianId(input.guardianId());
        p.setNic(normalizeIdentifier(input.nic()));
        p.setPassportNo(normalizeIdentifier(input.passportNo()));
        p.setBirthCertificateNo(normalizeIdentifier(input.birthCertificateNo()));
        p.setTitle(clean(input.title()));
        p.setFullName(input.fullName().trim());
        p.setPreferredName(clean(input.preferredName()));
        p.setDateOfBirth(input.dateOfBirth());
        p.setAgeYears(Math.max(0, Period.between(input.dateOfBirth(), LocalDate.now()).getYears()));
        p.setGender(parseGender(input.gender()));
        p.setBloodGroup(clean(input.bloodGroup()));
        p.setNationality(clean(input.nationality()));
        p.setPhone(clean(input.phone()));
        p.setEmail(normalizeEmail(input.email()));
        p.setAddress(clean(input.address()));
        p.setDistrict(clean(input.district()));
        p.setProvince(clean(input.province()));
        p.setProfilePhotoUrl(clean(input.profilePhotoUrl()));
        p.setLanguagePreference(clean(input.languagePreference()) == null ? "en" : clean(input.languagePreference()));
        p.setEmergencyContact(mapper.valueToTree(input.emergencyContact()==null ? Map.of() : input.emergencyContact()));
        p.setAllergies(mapper.valueToTree(input.allergies()==null ? List.of() : input.allergies()));
        p.setChronicDiseases(mapper.valueToTree(input.chronicDiseases()==null ? List.of() : input.chronicDiseases()));
        p.setDisabilities(mapper.valueToTree(input.disabilities()==null ? List.of() : input.disabilities()));
        p.setFamilyHistory(mapper.valueToTree(input.familyHistory()==null ? List.of() : input.familyHistory()));
        p.setRiskFlags(mapper.valueToTree(input.riskFlags()==null ? List.of() : input.riskFlags()));
        p.setQrPayload(mapper.createObjectNode().put("patientId", patientNo).put("hospitalId", actor.hospitalId().toString()).toString());
        p.setCreatedBy(actor.id()); p.setUpdatedBy(actor.id());
        patients.saveAndFlush(p);
        Map<String,Object> result = toMap(p, true);
        audit.record(actor, "patients", "create", "patients", p.getId(), null, result);
        Map<String,Object> response = new LinkedHashMap<>();
        response.put("duplicate", false); response.put("matchedBy", List.of()); response.put("patient", result);
        return response;
    }

    @Transactional
    public Map<String,Object> update(GovCarePrincipal actor, String identifier, Map<String,Object> input) {
        PatientEntity p = getEntity(actor, identifier);
        Map<String,Object> before = toMap(p, true);
        if (input.containsKey("fullName")) p.setFullName(requiredString(input.get("fullName"), "Full name"));
        if (input.containsKey("dateOfBirth")) {
            LocalDate dob = LocalDate.parse(String.valueOf(input.get("dateOfBirth")));
            p.setDateOfBirth(dob); p.setAgeYears(Math.max(0, Period.between(dob, LocalDate.now()).getYears()));
        }
        if (input.containsKey("gender")) p.setGender(parseGender(string(input.get("gender"))));
        if (input.containsKey("title")) p.setTitle(clean(string(input.get("title"))));
        if (input.containsKey("preferredName")) p.setPreferredName(clean(string(input.get("preferredName"))));
        if (input.containsKey("nic")) p.setNic(normalizeIdentifier(string(input.get("nic"))));
        if (input.containsKey("passportNo")) p.setPassportNo(normalizeIdentifier(string(input.get("passportNo"))));
        if (input.containsKey("birthCertificateNo")) p.setBirthCertificateNo(normalizeIdentifier(string(input.get("birthCertificateNo"))));
        if (input.containsKey("bloodGroup")) p.setBloodGroup(clean(string(input.get("bloodGroup"))));
        if (input.containsKey("nationality")) p.setNationality(clean(string(input.get("nationality"))));
        if (input.containsKey("phone")) p.setPhone(clean(string(input.get("phone"))));
        if (input.containsKey("email")) p.setEmail(normalizeEmail(string(input.get("email"))));
        if (input.containsKey("address")) p.setAddress(clean(string(input.get("address"))));
        if (input.containsKey("district")) p.setDistrict(clean(string(input.get("district"))));
        if (input.containsKey("province")) p.setProvince(clean(string(input.get("province"))));
        if (input.containsKey("profilePhotoUrl")) p.setProfilePhotoUrl(clean(string(input.get("profilePhotoUrl"))));
        if (input.containsKey("languagePreference")) p.setLanguagePreference(clean(string(input.get("languagePreference"))));
        if (input.containsKey("emergencyContact")) p.setEmergencyContact(mapper.valueToTree(input.get("emergencyContact")));
        if (input.containsKey("allergies")) p.setAllergies(mapper.valueToTree(input.get("allergies")));
        if (input.containsKey("chronicDiseases")) p.setChronicDiseases(mapper.valueToTree(input.get("chronicDiseases")));
        if (input.containsKey("disabilities")) p.setDisabilities(mapper.valueToTree(input.get("disabilities")));
        if (input.containsKey("familyHistory")) p.setFamilyHistory(mapper.valueToTree(input.get("familyHistory")));
        if (input.containsKey("riskFlags")) p.setRiskFlags(mapper.valueToTree(input.get("riskFlags")));
        p.setUpdatedBy(actor.id());
        patients.saveAndFlush(p);
        Map<String,Object> after = toMap(p, true);
        audit.record(actor, "patients", "update", "patients", p.getId(), before, after);
        return Map.of("patient", after, "previous", before);
    }

    @Transactional
    public void delete(GovCarePrincipal actor, String identifier) {
        PatientEntity p = getEntity(actor, identifier);
        p.setStatus(RecordStatus.deleted); p.setUpdatedBy(actor.id()); patients.save(p);
        audit.record(actor, "patients", "delete", "patients", p.getId(), null, null);
    }

    public Map<String,Object> toMap(PatientEntity p, boolean clinical) {
        Map<String,Object> row = new LinkedHashMap<>();
        row.put("id", p.getId()==null?null:p.getId().toString()); row.put("hospital_id", p.getHospitalId()==null?null:p.getHospitalId().toString());
        row.put("patient_no", p.getPatientNo()); row.put("guardian_id", p.getGuardianId()==null?null:p.getGuardianId().toString());
        row.put("nic", p.getNic()); row.put("passport_no", p.getPassportNo()); row.put("birth_certificate_no", p.getBirthCertificateNo());
        row.put("title", p.getTitle()); row.put("full_name", p.getFullName()); row.put("preferred_name", p.getPreferredName());
        row.put("date_of_birth", p.getDateOfBirth()); row.put("age_years", p.getAgeYears()); row.put("gender", p.getGender()==null?null:p.getGender().name());
        row.put("blood_group", p.getBloodGroup()); row.put("nationality", p.getNationality()); row.put("phone", p.getPhone()); row.put("email", p.getEmail());
        row.put("address", p.getAddress()); row.put("district", p.getDistrict()); row.put("province", p.getProvince());
        row.put("profile_photo_url", p.getProfilePhotoUrl()); row.put("emergency_contact", p.getEmergencyContact()); row.put("language_preference", p.getLanguagePreference());
        if (clinical) {
            row.put("allergies", p.getAllergies()); row.put("chronic_diseases", p.getChronicDiseases()); row.put("disabilities", p.getDisabilities());
            row.put("family_history", p.getFamilyHistory()); row.put("risk_flags", p.getRiskFlags());
        }
        row.put("status", p.getStatus()==null?null:p.getStatus().name()); row.put("created_at", p.getCreatedAt()); row.put("updated_at", p.getUpdatedAt());
        return row;
    }

    private String duplicateSql() {
        return """
            select id::text,hospital_id::text,patient_no,full_name,nic,passport_no,birth_certificate_no,date_of_birth,phone,email,gender::text,age_years,blood_group,profile_photo_url,
              array_remove(array[
                case when :nic<>'' and regexp_replace(upper(coalesce(nic,'')),'[^A-Z0-9]','','g')=:nic then 'nic' end,
                case when :passport<>'' and regexp_replace(upper(coalesce(passport_no,'')),'[^A-Z0-9]','','g')=:passport then 'passport' end,
                case when :birth<>'' and regexp_replace(upper(coalesce(birth_certificate_no,'')),'[^A-Z0-9]','','g')=:birth then 'birthCertificate' end,
                case when :phone<>'' and right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),9)=:phone then 'phone' end,
                case when :name<>'' and cast(:dob as date) is not null and lower(regexp_replace(trim(full_name),'\\s+',' ','g'))=:name and date_of_birth=cast(:dob as date) then 'nameAndDateOfBirth' end,
                case when :email<>'' and lower(trim(coalesce(email,'')))=:email then 'email' end
              ],null) as matched_by
            from patients where hospital_id=:hospitalId and status<>'deleted' and (
              (:nic<>'' and regexp_replace(upper(coalesce(nic,'')),'[^A-Z0-9]','','g')=:nic) or
              (:passport<>'' and regexp_replace(upper(coalesce(passport_no,'')),'[^A-Z0-9]','','g')=:passport) or
              (:birth<>'' and regexp_replace(upper(coalesce(birth_certificate_no,'')),'[^A-Z0-9]','','g')=:birth) or
              (:phone<>'' and right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),9)=:phone) or
              (:name<>'' and cast(:dob as date) is not null and lower(regexp_replace(trim(full_name),'\\s+',' ','g'))=:name and date_of_birth=cast(:dob as date)) or
              (:email<>'' and lower(trim(coalesce(email,'')))=:email)
            ) order by created_at desc limit 5
            """;
    }

    private Map<String,Object> duplicateParams(UUID hospitalId, Map<String,Object> input) {
        Map<String,Object> p = new HashMap<>(); p.put("hospitalId", hospitalId);
        p.put("nic", normalizeIdentifier(string(input.get("nic"))) == null ? "" : normalizeIdentifier(string(input.get("nic"))));
        p.put("passport", normalizeIdentifier(string(input.get("passportNo"))) == null ? "" : normalizeIdentifier(string(input.get("passportNo"))));
        p.put("birth", normalizeIdentifier(string(input.get("birthCertificateNo"))) == null ? "" : normalizeIdentifier(string(input.get("birthCertificateNo"))));
        p.put("phone", normalizePhone(string(input.get("phone")))); p.put("name", normalizeName(string(input.get("fullName"))));
        p.put("dob", clean(string(input.get("dateOfBirth")))); p.put("email", normalizeEmail(string(input.get("email"))) == null ? "" : normalizeEmail(string(input.get("email"))));
        return p;
    }

    @SuppressWarnings("unchecked")
    private List<String> matched(Map<String,Object> row) {
        Object value = row.get("matched_by");
        if (value instanceof java.sql.Array array) try { return Arrays.stream((Object[])array.getArray()).map(String::valueOf).toList(); } catch(Exception ignored) {}
        if (value instanceof List<?> list) return list.stream().map(String::valueOf).toList();
        return List.of();
    }

    private static String string(Object v){return v==null?null:String.valueOf(v);}
    private static String clean(String v){if(v==null)return null; String s=v.trim(); return s.isEmpty()?null:s;}
    private static String requiredString(Object v,String n){String s=clean(string(v)); if(s==null)throw ApiException.badRequest(n+" is required."); return s;}
    private static String normalizeIdentifier(String v){String s=clean(v); return s==null?null:s.toUpperCase().replaceAll("[^A-Z0-9]","");}
    private static String normalizeEmail(String v){String s=clean(v); return s==null?null:s.toLowerCase();}
    private static String normalizePhone(String v){String s=v==null?"":v.replaceAll("\\D",""); return s.length()>=9?s.substring(s.length()-9):s;}
    private static String normalizeName(String v){String s=clean(v); return s==null?"":s.toLowerCase().replaceAll("\\s+"," ");}
    private static GenderValue parseGender(String v){String s=clean(v); if(s==null)return null; try{return GenderValue.valueOf(s.toLowerCase().replace(' ','_'));}catch(Exception e){throw ApiException.badRequest("Invalid gender value.");}}
}
