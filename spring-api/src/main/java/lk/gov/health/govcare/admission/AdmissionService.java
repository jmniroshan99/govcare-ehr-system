package lk.gov.health.govcare.admission;

import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import lk.gov.health.govcare.ward.WardWorkflowSupport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneOffset;
import java.util.*;

import static lk.gov.health.govcare.admission.AdmissionDtos.*;

@Service
public class AdmissionService {
    private static final Set<String> ADMISSION_TYPES = Set.of("EMERGENCY", "ELECTIVE", "TRANSFER", "OBSERVATION", "MATERNITY", "ICU");
    private static final Set<String> ACTIVE_WARD_STATUSES = Set.of("ACTIVE");

    private final SqlSupport sql;
    private final WardWorkflowSupport wardSupport;
    private final AuditService audit;

    public AdmissionService(SqlSupport sql, WardWorkflowSupport wardSupport, AuditService audit) {
        this.sql = sql;
        this.wardSupport = wardSupport;
        this.audit = audit;
    }

    public Map<String, Object> reference(GovCarePrincipal actor) {
        UUID hospital = wardSupport.scopedHospital(actor, actor.hospitalId());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hospital", sql.required("select id::text id,code,name,city,district from hospitals where id=:id and status='active'", Map.of("id", hospital), "Hospital not found."));
        result.put("departments", sql.list("""
                select id::text id,code,name,type,floor from departments
                where hospital_id=:hospital and status='active' order by name
                """, Map.of("hospital", hospital)));
        result.put("doctors", sql.list("""
                select u.id::text id,u.full_name "fullName",u.role::text role,u.department_id::text "departmentId",
                       d.name "departmentName"
                from app_users u left join departments d on d.id=u.department_id
                where u.hospital_id=:hospital and u.status='active'
                  and u.role in ('doctor','surgeon','anesthetist','hospital_admin','super_admin')
                order by u.full_name
                """, Map.of("hospital", hospital)));
        return result;
    }

    public List<Map<String, Object>> list(GovCarePrincipal actor, String status, String search) {
        UUID hospital = wardSupport.scopedHospital(actor, actor.hospitalId());
        Map<String, Object> params = new HashMap<>();
        params.put("hospital", hospital);
        params.put("status", clean(status));
        params.put("search", clean(search));
        StringBuilder query = new StringBuilder("""
                select a.id::text id,a.admission_no "admissionNumber",a.admission_type "admissionType",
                       a.patient_id::text "patientId",p.patient_no "patientNumber",p.full_name "patientName",
                       p.gender::text gender,p.date_of_birth "dateOfBirth",govcare_patient_age_years(p.date_of_birth) "ageYears",
                       a.ward_id::text "wardId",w.ward_code "wardCode",w.name "wardName",
                       a.bed_id::text "bedId",b.bed_code "bedCode",b.bed_no "bedNumber",
                       a.reason,a.provisional_diagnosis "provisionalDiagnosis",a.priority::text priority,
                       a.status::text status,a.admitted_at "admittedAt",a.discharged_at "dischargedAt",
                       coalesce(doc.full_name,creator.full_name) "admittingDoctor"
                from admissions a join patients p on p.id=a.patient_id
                  left join wards w on w.id=a.ward_id left join beds b on b.id=a.bed_id
                  left join app_users doc on doc.id=a.consultant_id left join app_users creator on creator.id=a.created_by
                where a.hospital_id=:hospital
                """);
        if (status != null && !status.isBlank()) query.append(" and a.status::text=:status");
        if (search != null && !search.isBlank()) query.append(" and (a.admission_no ilike '%'||:search||'%' or p.patient_no ilike '%'||:search||'%' or p.full_name ilike '%'||:search||'%')");
        query.append(" order by a.admitted_at desc limit 250");
        return sql.list(query.toString(), params);
    }

    public Map<String, Object> detail(GovCarePrincipal actor, UUID admissionId) {
        Map<String, Object> row = admissionDetail(admissionId, false);
        wardSupport.requireHospitalAccess(actor, uuid(row.get("hospitalId")));
        return row;
    }

    public Optional<Map<String, Object>> activeAdmission(GovCarePrincipal actor, String patientIdentifier) {
        Map<String, Object> patient = patientByIdentifier(actor, patientIdentifier, false);
        UUID patientId = uuid(patient.get("id"));
        return activeAdmissionByPatient(patientId).map(row -> {
            wardSupport.requireHospitalAccess(actor, uuid(row.get("hospitalId")));
            return row;
        });
    }

    @Transactional
    public Map<String, Object> confirmIdentity(GovCarePrincipal actor, IdentityConfirmationRequest input) {
        Map<String, Object> patient = patientByIdentifier(actor, input.patientIdentifier(), true);
        UUID patientId = uuid(patient.get("id"));
        Optional<Map<String, Object>> active = activeAdmissionByPatient(patientId);
        if (input.expectedWardId() != null || input.expectedBedId() != null) {
            Map<String, Object> admission = active.orElseThrow(() -> ApiException.conflict("This patient does not have an active ward admission to verify."));
            if (input.expectedWardId() != null && !input.expectedWardId().toString().equals(String.valueOf(admission.get("wardId")))) {
                throw ApiException.conflict("The patient is not assigned to the selected ward.");
            }
            if (input.expectedBedId() != null && !input.expectedBedId().toString().equals(String.valueOf(admission.get("bedId")))) {
                throw ApiException.conflict("The patient is not assigned to the selected bed.");
            }
        }
        UUID confirmationId = UUID.randomUUID();
        Map<String, Object> confirmation = new HashMap<>();
        confirmation.put("id", confirmationId);
        confirmation.put("hospital", uuid(patient.get("hospitalId")));
        confirmation.put("patient", patientId);
        confirmation.put("actor", actor.id());
        confirmation.put("ward", input.expectedWardId());
        confirmation.put("bed", input.expectedBedId());
        sql.update("""
                insert into patient_identity_confirmations(id,hospital_id,patient_id,confirmed_by,expected_ward_id,expected_bed_id,
                  confirmed_at,expires_at)
                values(:id,:hospital,:patient,:actor,:ward,:bed,now(),now()+interval '30 minutes')
                """, confirmation);

        Map<String, Object> auditPayload = new LinkedHashMap<>();
        auditPayload.put("confirmationId", confirmationId.toString());
        auditPayload.put("patientId", patientId.toString());
        auditPayload.put("patientNumber", patient.get("patientNumber"));
        auditPayload.put("expectedWardId", input.expectedWardId());
        auditPayload.put("expectedBedId", input.expectedBedId());
        auditPayload.put("result", "CONFIRMED");
        audit.record(actor, "admissions", "PATIENT_IDENTITY_CONFIRMED", "patients", patientId, Map.of(), auditPayload);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("confirmed", true);
        result.put("confirmationId", confirmationId.toString());
        result.put("expiresAt", java.time.OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(30));
        result.put("confirmedAt", java.time.OffsetDateTime.now(ZoneOffset.UTC));
        result.put("confirmedBy", actor.fullName());
        result.put("patient", patient);
        result.put("activeAdmission", active.orElse(null));
        return result;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Map<String, Object> create(GovCarePrincipal actor, CreateAdmissionRequest input) {
        Map<String, Object> patient = patientByIdForUpdate(input.patientId());
        UUID hospital = uuid(patient.get("hospital_id"));
        wardSupport.requireHospitalAccess(actor, hospital);
        if (!"active".equalsIgnoreCase(String.valueOf(patient.get("status")))) {
            throw ApiException.conflict("The selected patient record is not active.");
        }
        if (activeAdmissionByPatient(input.patientId()).isPresent()) {
            throw ApiException.conflict("This patient already has an active admission.");
        }

        Map<String, Object> identityConfirmation = sql.one("""
                select id,hospital_id,patient_id,confirmed_by,confirmed_at,expires_at,consumed_at
                from patient_identity_confirmations
                where id=:id and patient_id=:patient and confirmed_by=:actor
                  and consumed_at is null and expires_at>now()
                for update
                """, Map.of("id", input.identityConfirmationId(), "patient", input.patientId(), "actor", actor.id()))
                .orElseThrow(() -> ApiException.conflict("Patient identity confirmation is missing or expired. Confirm the patient again."));
        if (!hospital.equals(uuid(identityConfirmation.get("hospital_id")))) {
            throw ApiException.forbidden("The identity confirmation belongs to another hospital.");
        }

        Map<String, Object> ward = wardForUpdate(input.wardId());
        Map<String, Object> bed = bedForUpdate(input.bedId());
        validateDepartment(hospital, input.referringDepartmentId());
        validateLocation(patient, hospital, ward, bed, input.isolationRequired());
        validateDoctor(hospital, input.admittingDoctorId());

        if (sql.one("select id from patient_bed_assignments where patient_id=:patient and active=true for update", Map.of("patient", input.patientId())).isPresent()) {
            throw ApiException.conflict("This patient already occupies another bed.");
        }
        if (sql.one("select id from patient_bed_assignments where bed_id=:bed and active=true for update", Map.of("bed", input.bedId())).isPresent()) {
            throw ApiException.conflict("The selected bed was allocated by another staff member.");
        }

        String admissionType = normalizeAdmissionType(input.admissionType());
        String priority = normalizePriority(input.priority());
        String admissionNo = String.valueOf(sql.required("select next_admission_no() admission_no", Map.of(), "Unable to generate an admission number.").get("admission_no"));
        UUID admissionId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();

        Map<String, Object> params = new HashMap<>();
        params.put("id", admissionId);
        params.put("hospital", hospital);
        params.put("patient", input.patientId());
        params.put("visit", input.visitId());
        params.put("ward", input.wardId());
        params.put("bed", input.bedId());
        params.put("doctor", input.admittingDoctorId());
        params.put("number", admissionNo);
        params.put("type", admissionType);
        params.put("reason", required(input.admissionReason(), "Admission reason"));
        params.put("complaint", clean(input.presentingComplaint()));
        params.put("diagnosis", clean(input.provisionalDiagnosis()));
        params.put("department", input.referringDepartmentId());
        params.put("priority", priority);
        params.put("isolation", input.isolationRequired());
        params.put("nursing", clean(input.specialNursingRequirement()));
        params.put("notes", clean(input.admissionNotes()));
        params.put("actor", actor.id());
        sql.update("""
                insert into admissions(id,hospital_id,patient_id,visit_id,ward_id,bed_id,consultant_id,admission_no,
                  admission_type,reason,presenting_complaint,provisional_diagnosis,referring_department_id,priority,
                  isolation_required,special_nursing_requirement,admission_notes,identity_confirmed_by,identity_confirmed_at,
                  admitted_at,status,created_by,updated_by)
                values(:id,:hospital,:patient,:visit,:ward,:bed,:doctor,:number,:type,:reason,:complaint,:diagnosis,
                  :department,cast(:priority as priority_level),:isolation,:nursing,:notes,:actor,now(),now(),'active',:actor,:actor)
                """, params);

        Map<String, Object> assignment = new HashMap<>();
        assignment.put("id", assignmentId);
        assignment.put("hospital", hospital);
        assignment.put("patient", input.patientId());
        assignment.put("admission", admissionId);
        assignment.put("ward", input.wardId());
        assignment.put("room", bed.get("room_id"));
        assignment.put("bed", input.bedId());
        assignment.put("actor", actor.id());
        sql.update("""
                insert into patient_bed_assignments(id,hospital_id,patient_id,admission_id,ward_id,room_id,bed_id,assigned_by,active)
                values(:id,:hospital,:patient,:admission,:ward,:room,:bed,:actor,true)
                """, assignment);

        int updated = sql.update("""
                update beds set status='OCCUPIED',current_patient_id=:patient,current_admission_id=:admission,
                  reserved_patient_id=null,reserved_until=null,updated_by=:actor,version=version+1
                where id=:bed and status='AVAILABLE' and current_patient_id is null and current_admission_id is null
                """, assignment);
        if (updated != 1) throw ApiException.conflict("The selected bed is no longer available. Refresh the bed list and select another bed.");

        wardSupport.movement(input.patientId(), admissionId, null, "PATIENT_ADMITTED", hospital, hospital,
                null, input.wardId(), null, input.bedId(), actor, input.admissionReason());
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("admissionId", admissionId.toString());
        after.put("admissionNumber", admissionNo);
        after.put("patientId", input.patientId().toString());
        after.put("wardId", input.wardId().toString());
        after.put("bedId", input.bedId().toString());
        after.put("status", "active");
        audit.record(actor, "admissions", "ADMISSION_CREATED_AND_BED_ASSIGNED", "admissions", admissionId, Map.of(), after);
        wardSupport.notifyRole(hospital, "nurse", "New ward admission",
                String.valueOf(patient.get("full_name")) + " was admitted to a ward bed.",
                "/nurse-notes?wardId=" + input.wardId(), actor);
        sql.update("update patient_identity_confirmations set consumed_at=now(),admission_id=:admission where id=:confirmation",
                Map.of("admission", admissionId, "confirmation", input.identityConfirmationId()));
        return admissionDetail(admissionId, false);
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Map<String, Object> transfer(GovCarePrincipal actor, UUID admissionId, TransferAdmissionRequest input) {
        Map<String, Object> admission = admissionDetail(admissionId, true);
        UUID hospital = uuid(admission.get("hospitalId"));
        UUID patientId = uuid(admission.get("patientId"));
        wardSupport.requireHospitalAccess(actor, hospital);
        requireActive(admission);

        Map<String, Object> currentAssignment = sql.required("select * from patient_bed_assignments where admission_id=:id and active=true for update", Map.of("id", admissionId), "No active bed assignment was found.");
        UUID oldWardId = uuid(currentAssignment.get("ward_id"));
        UUID oldBedId = uuid(currentAssignment.get("bed_id"));
        if (oldBedId.equals(input.bedId())) throw ApiException.badRequest("Select a different destination bed.");

        Map<String, Object> patient = patientByIdForUpdate(patientId);
        Map<String, Object> ward = wardForUpdate(input.wardId());
        Map<String, Object> bed = bedForUpdate(input.bedId());
        validateLocation(patient, hospital, ward, bed, input.isolationRequired());
        if (sql.one("select id from patient_bed_assignments where bed_id=:bed and active=true for update", Map.of("bed", input.bedId())).isPresent()) {
            throw ApiException.conflict("The destination bed was allocated by another staff member.");
        }

        Map<String, Object> p = new HashMap<>();
        p.put("admission", admissionId);
        p.put("patient", patientId);
        p.put("oldBed", oldBedId);
        p.put("newBed", input.bedId());
        p.put("newWard", input.wardId());
        p.put("room", bed.get("room_id"));
        p.put("actor", actor.id());
        p.put("reason", required(input.reason(), "Transfer reason"));
        sql.update("update patient_bed_assignments set active=false,released_by=:actor,released_at=now(),release_reason=:reason where admission_id=:admission and active=true", p);
        sql.update("update beds set status='CLEANING',current_patient_id=null,current_admission_id=null,updated_by=:actor,version=version+1 where id=:oldBed", p);
        UUID assignmentId = UUID.randomUUID();
        p.put("assignment", assignmentId);
        sql.update("""
                insert into patient_bed_assignments(id,hospital_id,patient_id,admission_id,ward_id,room_id,bed_id,assigned_by,active)
                values(:assignment,:hospital,:patient,:admission,:newWard,:room,:newBed,:actor,true)
                """, with(p, "hospital", hospital));
        int updated = sql.update("""
                update beds set status='OCCUPIED',current_patient_id=:patient,current_admission_id=:admission,
                  reserved_patient_id=null,reserved_until=null,updated_by=:actor,version=version+1
                where id=:newBed and status='AVAILABLE' and current_patient_id is null
                """, p);
        if (updated != 1) throw ApiException.conflict("The destination bed is no longer available.");
        sql.update("update admissions set ward_id=:newWard,bed_id=:newBed,updated_by=:actor,updated_at=now() where id=:admission", p);
        wardSupport.movement(patientId, admissionId, null, "INTERNAL_TRANSFER_COMPLETED", hospital, hospital,
                oldWardId, input.wardId(), oldBedId, input.bedId(), actor, input.reason());
        audit.record(actor, "admissions", "ADMISSION_TRANSFERRED", "admissions", admissionId,
                Map.of("wardId", oldWardId.toString(), "bedId", oldBedId.toString()),
                Map.of("wardId", input.wardId().toString(), "bedId", input.bedId().toString(), "reason", input.reason()));
        return admissionDetail(admissionId, false);
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Map<String, Object> discharge(GovCarePrincipal actor, UUID admissionId, DischargeAdmissionRequest input) {
        Map<String, Object> admission = admissionDetail(admissionId, true);
        UUID hospital = uuid(admission.get("hospitalId"));
        UUID patientId = uuid(admission.get("patientId"));
        wardSupport.requireHospitalAccess(actor, hospital);
        requireActive(admission);
        Map<String, Object> assignment = sql.required("select * from patient_bed_assignments where admission_id=:id and active=true for update", Map.of("id", admissionId), "No active bed assignment was found.");
        UUID wardId = uuid(assignment.get("ward_id"));
        UUID bedId = uuid(assignment.get("bed_id"));
        Map<String, Object> p = new HashMap<>();
        p.put("id", admissionId);
        p.put("bed", bedId);
        p.put("actor", actor.id());
        p.put("reason", required(input.reason(), "Discharge reason"));
        p.put("notes", clean(input.notes()));
        sql.update("update patient_bed_assignments set active=false,released_by=:actor,released_at=now(),release_reason=:reason where admission_id=:id and active=true", p);
        sql.update("update beds set status='CLEANING',current_patient_id=null,current_admission_id=null,reserved_patient_id=null,reserved_until=null,updated_by=:actor,version=version+1 where id=:bed", p);
        sql.update("""
                update admissions set status='completed',discharged_at=now(),discharge_reason=:reason,discharge_notes=:notes,
                  bed_id=null,updated_by=:actor,updated_at=now() where id=:id
                """, p);
        wardSupport.movement(patientId, admissionId, null, "PATIENT_DISCHARGED", hospital, hospital,
                wardId, null, bedId, null, actor, input.reason());
        audit.record(actor, "admissions", "PATIENT_DISCHARGED", "admissions", admissionId,
                Map.of("wardId", wardId.toString(), "bedId", bedId.toString(), "status", "active"),
                Map.of("status", "completed", "bedStatus", "CLEANING", "reason", input.reason()));
        return admissionDetail(admissionId, false);
    }

    private Map<String, Object> patientByIdentifier(GovCarePrincipal actor, String identifier, boolean lock) {
        String value = required(identifier, "Patient identifier");
        Map<String, Object> params = new HashMap<>();
        params.put("identifier", value);
        params.put("hospital", actor.hospitalId());
        String suffix = lock ? " for update" : "";
        Map<String, Object> patient = sql.required("""
                select p.id::text id,p.hospital_id::text "hospitalId",p.patient_no "patientNumber",p.full_name "fullName",
                       p.nic,p.passport_no "passportNumber",p.birth_certificate_no "birthCertificateNumber",
                       p.date_of_birth "dateOfBirth",govcare_patient_age_years(p.date_of_birth) "ageYears",p.gender::text gender,
                       p.blood_group "bloodGroup",p.phone,p.profile_photo_url "profilePhotoUrl",p.allergies,p.chronic_diseases "chronicDiseases",
                       p.risk_flags "riskFlags",p.status::text status
                from patients p
                where (:hospital is null or p.hospital_id=:hospital) and p.status<>'deleted' and
                  (p.id::text=:identifier or p.patient_no=:identifier or upper(coalesce(p.nic,''))=upper(:identifier)
                   or upper(coalesce(p.passport_no,''))=upper(:identifier) or upper(coalesce(p.birth_certificate_no,''))=upper(:identifier)
                   or regexp_replace(coalesce(p.phone,''),'[^0-9]','','g')=regexp_replace(:identifier,'[^0-9]','','g'))
                order by p.created_at desc limit 1
                """ + suffix, params, "Patient not found.");
        wardSupport.requireHospitalAccess(actor, uuid(patient.get("hospitalId")));
        return patient;
    }

    private Map<String, Object> patientByIdForUpdate(UUID patientId) {
        return sql.required("select * from patients where id=:id for update", Map.of("id", patientId), "Patient not found.");
    }

    private Optional<Map<String, Object>> activeAdmissionByPatient(UUID patientId) {
        return sql.one(activeAdmissionSql() + " where a.patient_id=:patient and a.status='active' and a.discharged_at is null order by a.admitted_at desc limit 1", Map.of("patient", patientId));
    }

    private Map<String, Object> admissionDetail(UUID admissionId, boolean lock) {
        String suffix = lock ? " for update of a" : "";
        return sql.required(activeAdmissionSql() + " where a.id=:id" + suffix, Map.of("id", admissionId), "Admission not found.");
    }

    private String activeAdmissionSql() {
        return """
                select a.id::text id,a.hospital_id::text "hospitalId",h.name "hospitalName",a.patient_id::text "patientId",
                       p.patient_no "patientNumber",p.full_name "patientName",p.profile_photo_url "profilePhotoUrl",
                       p.nic,p.passport_no "passportNumber",p.date_of_birth "dateOfBirth",govcare_patient_age_years(p.date_of_birth) "ageYears",
                       p.gender::text gender,p.blood_group "bloodGroup",p.allergies,p.risk_flags "riskFlags",
                       a.admission_no "admissionNumber",a.admission_type "admissionType",a.reason,
                       a.presenting_complaint "presentingComplaint",a.provisional_diagnosis "provisionalDiagnosis",
                       a.priority::text priority,a.isolation_required "isolationRequired",a.special_nursing_requirement "specialNursingRequirement",
                       a.admission_notes "admissionNotes",a.status::text status,a.admitted_at "admittedAt",a.discharged_at "dischargedAt",
                       a.discharge_reason "dischargeReason",a.ward_id::text "wardId",w.ward_code "wardCode",w.name "wardName",
                       w.ward_type "wardType",a.bed_id::text "bedId",b.bed_code "bedCode",b.bed_no "bedNumber",
                       r.room_number "roomNumber",r.room_name "roomName",a.consultant_id::text "admittingDoctorId",
                       coalesce(doc.full_name,creator.full_name) "admittingDoctor",d.id::text "departmentId",d.name "departmentName",
                       a.identity_confirmed_at "identityConfirmedAt",confirmer.full_name "identityConfirmedBy"
                from admissions a join hospitals h on h.id=a.hospital_id join patients p on p.id=a.patient_id
                  left join wards w on w.id=a.ward_id left join beds b on b.id=a.bed_id left join ward_rooms r on r.id=b.room_id
                  left join app_users doc on doc.id=a.consultant_id left join app_users creator on creator.id=a.created_by
                  left join app_users confirmer on confirmer.id=a.identity_confirmed_by
                  left join departments d on d.id=a.referring_department_id
                """;
    }

    private Map<String, Object> wardForUpdate(UUID wardId) {
        return sql.required("""
                select w.id,w.hospital_id,w.department_id,w.ward_code,w.name,w.ward_type,w.gender_restriction,
                       w.age_restriction,w.isolation_capable,w.operational_status,w.status::text record_status
                from wards w where w.id=:id for update
                """, Map.of("id", wardId), "Ward not found.");
    }

    private Map<String, Object> bedForUpdate(UUID bedId) {
        return sql.required("""
                select b.id,b.hospital_id,b.ward_id,b.room_id,b.bed_code,b.bed_no,b.bed_type,b.status,
                       b.current_patient_id,b.current_admission_id,b.gender_restriction,b.age_restriction,b.isolation_support
                from beds b where b.id=:id for update
                """, Map.of("id", bedId), "Bed not found.");
    }

    private void validateLocation(Map<String, Object> patient, UUID hospital, Map<String, Object> ward, Map<String, Object> bed,
                                  boolean isolationRequired) {
        if (!hospital.equals(uuid(ward.get("hospital_id"))) || !hospital.equals(uuid(bed.get("hospital_id")))) {
            throw ApiException.badRequest("The selected ward or bed belongs to another hospital.");
        }
        if (!uuid(ward.get("id")).equals(uuid(bed.get("ward_id")))) {
            throw ApiException.badRequest("The selected bed does not belong to the selected ward.");
        }
        // referring_department_id records where the patient came from. It is
        // intentionally not required to equal the destination ward department:
        // OPD, Emergency and specialty clinics commonly refer patients to a
        // different inpatient ward. Destination safety is enforced below by
        // hospital, ward/bed ownership, status, gender, age and isolation rules.
        String wardStatus = upper(ward.get("operational_status"));
        if (!ACTIVE_WARD_STATUSES.contains(wardStatus) || !"active".equalsIgnoreCase(String.valueOf(ward.get("record_status")))) {
            throw ApiException.unprocessable("The selected ward is not active for new admissions.");
        }
        if (!"AVAILABLE".equals(upper(bed.get("status"))) || bed.get("current_patient_id") != null || bed.get("current_admission_id") != null) {
            throw ApiException.conflict("The selected bed is not available.");
        }
        String gender = upper(patient.get("gender"));
        if (!compatible(String.valueOf(ward.get("gender_restriction")), gender) || !compatible(String.valueOf(bed.get("gender_restriction")), gender)) {
            throw ApiException.unprocessable("The selected ward or bed is not compatible with the patient's gender.");
        }
        String ageGroup = ageGroup(patient.get("date_of_birth"));
        if (!compatible(String.valueOf(ward.get("age_restriction")), ageGroup) || !compatible(String.valueOf(bed.get("age_restriction")), ageGroup)) {
            throw ApiException.unprocessable("The selected ward or bed is not compatible with the patient's age group.");
        }
        boolean isolationSupported = Boolean.TRUE.equals(ward.get("isolation_capable")) || Boolean.TRUE.equals(bed.get("isolation_support"));
        if (isolationRequired && !isolationSupported) {
            throw ApiException.unprocessable("Isolation is required, but the selected ward and bed do not provide isolation support.");
        }
    }

    private void validateDepartment(UUID hospital, UUID departmentId) {
        if (departmentId == null) return;
        if (sql.one("select id from departments where id=:id and hospital_id=:hospital and status='active'", Map.of("id", departmentId, "hospital", hospital)).isEmpty()) {
            throw ApiException.badRequest("The referring department is invalid or inactive.");
        }
    }

    private void validateDoctor(UUID hospital, UUID doctorId) {
        if (doctorId == null) return;
        if (sql.one("select id from app_users where id=:id and hospital_id=:hospital and status='active' and role in ('doctor','surgeon','anesthetist','hospital_admin','super_admin')", Map.of("id", doctorId, "hospital", hospital)).isEmpty()) {
            throw ApiException.badRequest("The admitting doctor is invalid or inactive.");
        }
    }

    private void requireActive(Map<String, Object> admission) {
        if (!"active".equalsIgnoreCase(String.valueOf(admission.get("status"))) || admission.get("dischargedAt") != null) {
            throw ApiException.conflict("This admission is no longer active.");
        }
    }

    private String normalizeAdmissionType(String value) {
        String normalized = upper(value);
        if (!ADMISSION_TYPES.contains(normalized)) throw ApiException.badRequest("Unsupported admission type.");
        return normalized;
    }

    private String normalizePriority(String value) {
        String normalized = upper(value);
        return switch (normalized) {
            case "ROUTINE" -> "routine";
            case "URGENT" -> "urgent";
            case "EMERGENCY", "STAT" -> "stat";
            case "CRITICAL" -> "critical";
            default -> throw ApiException.badRequest("Unsupported admission priority.");
        };
    }

    private boolean compatible(String restriction, String patientValue) {
        String r = upper(restriction);
        String p = upper(patientValue);
        return r.isBlank() || "ANY".equals(r) || p.isBlank() || "ANY".equals(p) || r.equals(p)
                || ("ADULT".equals(r) && "ADULT".equals(p))
                || ("PAEDIATRIC".equals(r) && "PAEDIATRIC".equals(p));
    }

    private String ageGroup(Object dateOfBirth) {
        if (dateOfBirth == null) return "ANY";
        try {
            LocalDate dob = dateOfBirth instanceof LocalDate date ? date : LocalDate.parse(String.valueOf(dateOfBirth));
            return Period.between(dob, LocalDate.now(ZoneOffset.UTC)).getYears() < 14 ? "PAEDIATRIC" : "ADULT";
        } catch (Exception ignored) {
            return "ANY";
        }
    }

    private static UUID uuid(Object value) {
        if (value == null) return null;
        if (value instanceof UUID id) return id;
        return UUID.fromString(String.valueOf(value));
    }

    private static String clean(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String required(String value, String label) {
        String normalized = clean(value);
        if (normalized == null) throw ApiException.badRequest(label + " is required.");
        return normalized;
    }

    private static String upper(Object value) {
        if (value == null) return "";
        return String.valueOf(value).trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
    }

    private static Map<String, Object> with(Map<String, Object> source, String key, Object value) {
        Map<String, Object> copy = new HashMap<>(source);
        copy.put(key, value);
        return copy;
    }
}
