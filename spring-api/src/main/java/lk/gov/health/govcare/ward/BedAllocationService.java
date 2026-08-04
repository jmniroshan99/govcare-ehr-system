package lk.gov.health.govcare.ward;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

import static lk.gov.health.govcare.ward.WardDtos.*;

@Service
public class BedAllocationService {
    private final SqlSupport sql;
    private final WardWorkflowSupport support;

    public BedAllocationService(SqlSupport sql, WardWorkflowSupport support) {
        this.sql = sql;
        this.support = support;
    }

    public List<Map<String,Object>> suggestions(GovCarePrincipal actor, UUID admissionId, BedSuggestionRequest input) {
        Map<String,Object> admission=admission(admissionId,false);
        UUID hospital=support.uuid(admission.get("hospital_id")); support.requireHospitalAccess(actor,hospital);
        List<Map<String,Object>> candidates=sql.list("""
            select b.id::text id,b.bed_code "bedCode",b.bed_no "bedNumber",b.bed_type "bedType",b.status,
              b.gender_restriction "genderRestriction",b.age_restriction "ageRestriction",b.isolation_support "isolationSupport",
              b.oxygen_support "oxygenSupport",b.ventilator_support "ventilatorSupport",b.accessible_bed "accessibleBed",
              w.id::text "wardId",w.name "wardName",w.ward_type "wardType",w.department_id::text "departmentId",
              r.id::text "roomId",r.room_number "roomNumber"
            from beds b join wards w on w.id=b.ward_id left join ward_rooms r on r.id=b.room_id
            where b.hospital_id=:hospital and b.status='AVAILABLE' and upper(w.status::text)='ACTIVE'
            order by w.name,r.room_number,b.bed_no
            """,Map.of("hospital",hospital));
        String requiredWard=support.upper(input.requiredWardType(),null);
        String gender=support.upper(input.genderRestriction(),Objects.toString(admission.get("patient_gender"),"ANY"));
        String age=support.upper(input.ageRestriction(),ageRestriction(admission.get("date_of_birth")));
        List<Map<String,Object>> ranked=new ArrayList<>();
        for(Map<String,Object> row:candidates){
            int score=100; List<String> reasons=new ArrayList<>(); List<String> warnings=new ArrayList<>();
            String wardType=Objects.toString(row.get("wardType"),"");
            if(requiredWard!=null){if(requiredWard.equals(wardType)){score+=40;reasons.add("Matches required ward type");}else{score-=20;warnings.add("Different ward type");}}
            if(compatible(Objects.toString(row.get("genderRestriction"),"ANY"),gender)){score+=20;reasons.add("Gender-compatible ward");}else{score-=100;warnings.add("Gender restriction mismatch");}
            if(compatible(Objects.toString(row.get("ageRestriction"),"ANY"),age)){score+=15;reasons.add("Age-compatible bed");}else{score-=100;warnings.add("Age restriction mismatch");}
            score=facility(score,input.isolationRequired(),Boolean.TRUE.equals(row.get("isolationSupport")),"Isolation support",reasons,warnings);
            score=facility(score,input.oxygenRequired(),Boolean.TRUE.equals(row.get("oxygenSupport")),"Oxygen support",reasons,warnings);
            score=facility(score,input.ventilatorRequired(),Boolean.TRUE.equals(row.get("ventilatorSupport")),"Ventilator support",reasons,warnings);
            score=facility(score,input.accessibleRequired(),Boolean.TRUE.equals(row.get("accessibleBed")),"Accessible bed",reasons,warnings);
            Map<String,Object> item=new LinkedHashMap<>(row);item.put("score",score);item.put("suitable",score>=70&&warnings.stream().noneMatch(x->x.contains("mismatch")||x.contains("required")));item.put("reasons",reasons);item.put("warnings",warnings);ranked.add(item);
        }
        ranked.sort(Comparator.comparingInt(x->-((Number)x.get("score")).intValue()));
        return ranked;
    }

    @Transactional
    public Map<String,Object> reserve(GovCarePrincipal actor, UUID admissionId, ReserveBedRequest input) {
        expireReservations();
        Map<String,Object> admission=admission(admissionId,true); UUID patient=support.uuid(admission.get("patient_id")); UUID hospital=support.uuid(admission.get("hospital_id")); support.requireHospitalAccess(actor,hospital);
        Map<String,Object> bed=support.bed(input.bedId(),true); validateBedHospital(bed,hospital);
        String status=Objects.toString(bed.get("status"),"");
        if(!"AVAILABLE".equals(status)) throw ApiException.conflict("The selected bed is no longer available.");
        if(sql.one("select id from bed_reservations where bed_id=:bed and status='ACTIVE' and expires_at>now()",Map.of("bed",input.bedId())).isPresent()) throw ApiException.conflict("The selected bed is already reserved.");
        int minutes=input.reservationMinutes()==null?30:input.reservationMinutes(); OffsetDateTime expires=OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(minutes); UUID id=UUID.randomUUID();
        Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("hospital",hospital);p.put("patient",patient);p.put("admission",admissionId);p.put("bed",input.bedId());p.put("priority",priority(input.priority()));p.put("actor",actor.id());p.put("expires",expires);p.put("override",support.clean(input.overrideReason()));
        sql.update("""
            insert into bed_reservations(id,hospital_id,patient_id,admission_request_id,bed_id,priority,status,reserved_by,expires_at,override_reason)
            values(:id,:hospital,:patient,:admission,:bed,:priority,'ACTIVE',:actor,:expires,:override)
            """,p);
        sql.update("update beds set status='RESERVED',reserved_patient_id=:patient,reserved_until=:expires,updated_by=:actor,version=version+1 where id=:bed",p);
        support.audit(actor,"BED_RESERVED","bed_reservations",id,null,p);
        support.notifyRole(hospital,"nurse","Bed reserved","A bed has been reserved for an admission.","/admissions/bed-allocation",actor);
        return reservation(id);
    }

    @Transactional
    public Map<String,Object> allocate(GovCarePrincipal actor, UUID admissionId, AllocateBedRequest input) {
        expireReservations();
        Map<String,Object> admission=admission(admissionId,true); UUID patient=support.uuid(admission.get("patient_id")); UUID hospital=support.uuid(admission.get("hospital_id")); support.requireHospitalAccess(actor,hospital);
        Map<String,Object> bed=support.bed(input.bedId(),true); validateBedHospital(bed,hospital);
        String status=Objects.toString(bed.get("status"),""); UUID reservedPatient=support.uuid(bed.get("reserved_patient_id"));
        if(!"AVAILABLE".equals(status)&&!("RESERVED".equals(status)&&patient.equals(reservedPatient))) throw ApiException.conflict("The selected bed is not available for this patient.");
        if(sql.one("select id from patient_bed_assignments where admission_id=:admission and active=true",Map.of("admission",admissionId)).isPresent()) throw ApiException.conflict("This admission already has an active bed assignment.");
        if(sql.one("select id from patient_bed_assignments where bed_id=:bed and active=true",Map.of("bed",input.bedId())).isPresent()) throw ApiException.conflict("The bed was allocated by another request.");
        UUID ward=support.uuid(bed.get("ward_id")); UUID room=support.uuid(bed.get("room_id")); UUID assignmentId=UUID.randomUUID();
        Map<String,Object> p=new HashMap<>();p.put("id",assignmentId);p.put("hospital",hospital);p.put("patient",patient);p.put("admission",admissionId);p.put("ward",ward);p.put("room",room);p.put("bed",input.bedId());p.put("actor",actor.id());
        sql.update("""
            insert into patient_bed_assignments(id,hospital_id,patient_id,admission_id,ward_id,room_id,bed_id,assigned_by,active)
            values(:id,:hospital,:patient,:admission,:ward,:room,:bed,:actor,true)
            """,p);
        sql.update("update beds set status='OCCUPIED',current_patient_id=:patient,current_admission_id=:admission,reserved_patient_id=null,reserved_until=null,updated_by=:actor,version=version+1 where id=:bed",p);
        sql.update("update admissions set ward_id=:ward,bed_id=:bed,updated_by=:actor,status='active',updated_at=now() where id=:admission",p);
        sql.update("update bed_reservations set status='CONFIRMED',confirmed_at=now() where bed_id=:bed and patient_id=:patient and status='ACTIVE'",p);
        support.movement(patient,admissionId,null,"BED_ALLOCATED",hospital,hospital,null,ward,null,input.bedId(),actor,"Admission bed allocation confirmed.");
        support.audit(actor,"BED_ALLOCATED","patient_bed_assignments",assignmentId,null,p);
        support.notifyRole(hospital,"nurse","New ward admission","A patient has been allocated to a ward bed.","/wards/bed-board",actor);
        return assignment(actor, admissionId);
    }

    public Map<String,Object> assignment(GovCarePrincipal actor, UUID admissionId) {
        Map<String,Object> admission=admission(admissionId,false); support.requireHospitalAccess(actor,support.uuid(admission.get("hospital_id")));
        return sql.required("""
            select x.id::text id,x.hospital_id::text "hospitalId",x.patient_id::text "patientId",x.admission_id::text "admissionId",
              x.ward_id::text "wardId",w.name "wardName",x.room_id::text "roomId",r.room_number "roomNumber",
              x.bed_id::text "bedId",b.bed_code "bedCode",b.bed_no "bedNumber",x.assigned_at "assignedAt",x.active,
              p.patient_no "patientNumber",p.full_name "patientName",a.admission_no "admissionNumber"
            from patient_bed_assignments x join beds b on b.id=x.bed_id join wards w on w.id=x.ward_id
              left join ward_rooms r on r.id=x.room_id join patients p on p.id=x.patient_id join admissions a on a.id=x.admission_id
            where x.admission_id=:admission and x.active=true
            """,Map.of("admission",admissionId),"No active bed assignment was found for this admission.");
    }

    @Transactional
    public Map<String,Object> release(GovCarePrincipal actor, UUID admissionId, ReleaseBedRequest input) {
        Map<String,Object> admission=admission(admissionId,true); UUID hospital=support.uuid(admission.get("hospital_id")); support.requireHospitalAccess(actor,hospital);
        Map<String,Object> current=sql.required("select * from patient_bed_assignments where admission_id=:admission and active=true for update",Map.of("admission",admissionId),"No active bed assignment was found.");
        UUID bedId=support.uuid(current.get("bed_id")); Map<String,Object> bed=support.bed(bedId,true); UUID patient=support.uuid(current.get("patient_id"));
        Map<String,Object> p=new HashMap<>();p.put("admission",admissionId);p.put("bed",bedId);p.put("actor",actor.id());p.put("reason",support.clean(input.reason()));
        sql.update("update patient_bed_assignments set active=false,released_by=:actor,released_at=now(),release_reason=:reason where admission_id=:admission and active=true",p);
        sql.update("update beds set status='CLEANING',current_patient_id=null,current_admission_id=null,reserved_patient_id=null,reserved_until=null,updated_by=:actor,version=version+1 where id=:bed",p);
        if(input.discharge()) sql.update("update admissions set bed_id=null,ward_id=null,status='completed',discharged_at=coalesce(discharged_at,now()),updated_by=:actor,updated_at=now() where id=:admission",p);
        else sql.update("update admissions set bed_id=null,updated_by=:actor,updated_at=now() where id=:admission",p);
        support.movement(patient,admissionId,null,input.discharge()?"DISCHARGED":"BED_RELEASED",hospital,hospital,support.uuid(current.get("ward_id")),null,bedId,null,actor,input.reason());
        support.audit(actor,"BED_RELEASED","beds",bedId,bed,Map.of("status","CLEANING","reason",Objects.toString(input.reason(),"")));
        return Map.of("admissionId",admissionId.toString(),"bedId",bedId.toString(),"bedStatus","CLEANING","released",true);
    }

    @Transactional
    public int expireReservations() {
        List<Map<String,Object>> expired=sql.list("select id,bed_id from bed_reservations where status='ACTIVE' and expires_at<=now() for update",Map.of());
        for(Map<String,Object> row:expired){UUID id=support.uuid(row.get("id"));UUID bed=support.uuid(row.get("bed_id"));sql.update("update bed_reservations set status='EXPIRED',cancelled_at=now(),cancellation_reason='Reservation expired' where id=:id",Map.of("id",id));sql.update("update beds set status='AVAILABLE',reserved_patient_id=null,reserved_until=null,version=version+1 where id=:bed and status='RESERVED' and not exists(select 1 from bed_reservations r where r.bed_id=:bed and r.status='ACTIVE' and r.expires_at>now())",Map.of("bed",bed));}
        return expired.size();
    }

    private Map<String,Object> admission(UUID id, boolean lock){return sql.required("""
        select a.*,p.gender::text patient_gender,p.date_of_birth,p.full_name patient_name,p.patient_no
        from admissions a join patients p on p.id=a.patient_id where a.id=:id
        """+(lock?" for update":""),Map.of("id",id),"Admission not found.");}
    private Map<String,Object> reservation(UUID id){return sql.required("select id::text id,patient_id::text \"patientId\",admission_request_id::text \"admissionId\",bed_id::text \"bedId\",priority,status,reserved_at \"reservedAt\",expires_at \"expiresAt\" from bed_reservations where id=:id",Map.of("id",id),"Reservation not found.");}
    private void validateBedHospital(Map<String,Object> bed, UUID hospital){if(!hospital.equals(support.uuid(bed.get("hospital_id"))))throw ApiException.badRequest("The selected bed belongs to another hospital.");}
    private String priority(String value){String p=support.upper(value,"ROUTINE");return Set.of("ROUTINE","URGENT","EMERGENCY","ICU_PRIORITY","ISOLATION_PRIORITY").contains(p)?p:"ROUTINE";}
    private boolean compatible(String restriction,String value){String r=support.upper(restriction,"ANY");String v=support.upper(value,"ANY");return "ANY".equals(r)||"ANY".equals(v)||r.equals(v);}
    private int facility(int score,boolean required,boolean available,String label,List<String> reasons,List<String> warnings){if(!required)return score;if(available){reasons.add(label+" available");return score+25;}warnings.add(label+" required but unavailable");return score-100;}
    private String ageRestriction(Object dob){if(dob==null)return "ANY";try{java.time.LocalDate date=dob instanceof java.time.LocalDate d?d:java.time.LocalDate.parse(dob.toString());return java.time.Period.between(date,java.time.LocalDate.now(ZoneOffset.UTC)).getYears()<14?"PAEDIATRIC":"ADULT";}catch(Exception e){return "ANY";}}
}
