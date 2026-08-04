package lk.gov.health.govcare.ward;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static lk.gov.health.govcare.ward.WardDtos.*;

@Service
public class WardBedService {
    private static final Set<String> WARD_STATUSES = Set.of("ACTIVE","INACTIVE","TEMPORARILY_CLOSED","FULL","QUARANTINED","MAINTENANCE");
    private static final Set<String> BED_STATUSES = Set.of("AVAILABLE","RESERVED","OCCUPIED","CLEANING","BLOCKED","MAINTENANCE","OUT_OF_SERVICE","INFECTION_CONTROL","PENDING_DISCHARGE");
    private static final Set<String> BED_TYPES = Set.of("STANDARD","PAEDIATRIC","MATERNITY","ICU","HDU","ISOLATION","BARIATRIC","OBSERVATION","EMERGENCY","COT");

    private final SqlSupport sql;
    private final WardWorkflowSupport support;

    public WardBedService(SqlSupport sql, WardWorkflowSupport support) {
        this.sql = sql;
        this.support = support;
    }

    public Map<String,Object> dashboard(GovCarePrincipal actor, UUID hospitalId) {
        UUID hospital = support.scopedHospital(actor, hospitalId);
        Map<String,Object> summary = sql.required("""
            select count(*) "totalBeds",
                   count(*) filter(where status='AVAILABLE') "availableBeds",
                   count(*) filter(where status='OCCUPIED') "occupiedBeds",
                   count(*) filter(where status='RESERVED') "reservedBeds",
                   count(*) filter(where status='CLEANING') "cleaningBeds",
                   count(*) filter(where status in ('BLOCKED','INFECTION_CONTROL','OUT_OF_SERVICE')) "blockedBeds",
                   count(*) filter(where status='MAINTENANCE') "maintenanceBeds",
                   case when count(*)=0 then 0 else round(100.0*count(*) filter(where status='OCCUPIED')/count(*),1) end "occupancyPercent"
            from beds where hospital_id=:hospital
            """, Map.of("hospital", hospital), "Unable to load bed summary.");
        return Map.of("hospitalId", hospital.toString(), "summary", summary, "wards", listWards(actor, hospital));
    }

    public List<Map<String,Object>> listWards(GovCarePrincipal actor, UUID hospitalId) {
        UUID hospital = support.scopedHospital(actor, hospitalId);
        return sql.list("""
            select w.id::text id,w.hospital_id::text "hospitalId",w.department_id::text "departmentId",
                   w.ward_code "wardCode",w.name "wardName",w.ward_type "wardType",w.category,
                   w.building,w.floor,w.gender_restriction "genderRestriction",w.age_restriction "ageRestriction",
                   w.isolation_capable "isolationCapable",w.nurse_station "nurseStation",w.phone,
                   w.operational_status status,
                   count(b.id) "totalBeds",
                   count(b.id) filter(where b.status='AVAILABLE') "availableBeds",
                   count(b.id) filter(where b.status='OCCUPIED') "occupiedBeds",
                   count(b.id) filter(where b.status='RESERVED') "reservedBeds",
                   count(b.id) filter(where b.status='CLEANING') "cleaningBeds",
                   count(b.id) filter(where b.status in ('BLOCKED','INFECTION_CONTROL','OUT_OF_SERVICE')) "blockedBeds",
                   count(b.id) filter(where b.status='MAINTENANCE') "maintenanceBeds",
                   case when count(b.id)=0 then 0 else round(100.0*count(b.id) filter(where b.status='OCCUPIED')/count(b.id),1) end "occupancyPercent"
            from wards w left join beds b on b.ward_id=w.id
            where w.hospital_id=:hospital
            group by w.id order by w.name
            """, Map.of("hospital", hospital));
    }

    public Map<String,Object> wardDetail(GovCarePrincipal actor, UUID wardId) {
        Map<String,Object> ward = support.ward(wardId);
        support.requireHospitalAccess(actor, support.uuid(ward.get("hospital_id")));
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("ward", sql.required("""
            select w.id::text id,w.hospital_id::text "hospitalId",w.department_id::text "departmentId",
              w.ward_code "wardCode",w.name "wardName",w.ward_type "wardType",w.category,w.building,w.floor,
              w.gender_restriction "genderRestriction",w.age_restriction "ageRestriction",w.isolation_capable "isolationCapable",
              w.nurse_station "nurseStation",w.ward_manager_id::text "wardManagerId",
              w.responsible_consultant_id::text "responsibleConsultantId",w.phone,w.operational_status status,
              w.created_at "createdAt",w.updated_at "updatedAt"
            from wards w where w.id=:id
            """, Map.of("id", wardId), "Ward not found."));
        result.put("rooms", listRooms(actor, wardId));
        result.put("beds", listBeds(actor, support.uuid(ward.get("hospital_id")), wardId, null, null, null, false));
        return result;
    }

    @Transactional
    public Map<String,Object> createWard(GovCarePrincipal actor, WardRequest input) {
        UUID hospital = support.scopedHospital(actor, input.hospitalId());
        String status = wardStatus(input.status());
        UUID id = UUID.randomUUID();
        Map<String,Object> p = new HashMap<>();
        p.put("id",id); p.put("hospital",hospital); p.put("department",input.departmentId());
        p.put("code",input.wardCode().trim().toUpperCase(Locale.ROOT)); p.put("name",input.wardName().trim());
        p.put("type",support.upper(input.wardType(),"GENERAL_MEDICAL_WARD")); p.put("category",category(input.wardType(), input.genderRestriction()));
        p.put("building",support.clean(input.building())); p.put("floor",support.clean(input.floor()));
        p.put("gender",support.upper(input.genderRestriction(),"ANY")); p.put("age",support.upper(input.ageRestriction(),"ANY"));
        p.put("isolation",input.isolationCapable()); p.put("station",support.clean(input.nurseStation()));
        p.put("manager",input.wardManagerId()); p.put("consultant",input.responsibleConsultantId()); p.put("phone",support.clean(input.phone()));
        p.put("status",status); p.put("actor",actor.id());
        sql.update("""
            insert into wards(id,hospital_id,department_id,ward_no,ward_code,name,ward_type,category,building,floor,
              gender_restriction,age_restriction,isolation_capable,nurse_station,ward_manager_id,responsible_consultant_id,
              phone,status,operational_status,created_by,updated_by)
            values(:id,:hospital,:department,:code,:code,:name,:type,:category,:building,:floor,:gender,:age,:isolation,
              :station,:manager,:consultant,:phone,case when :status='ACTIVE' then 'active'::record_status else 'inactive'::record_status end,:status,:actor,:actor)
            """, p);
        support.audit(actor,"WARD_CREATED","wards",id,null,p);
        return wardDetail(actor,id);
    }

    @Transactional
    public Map<String,Object> updateWard(GovCarePrincipal actor, UUID wardId, WardRequest input) {
        Map<String,Object> existing = support.ward(wardId);
        UUID hospital = support.uuid(existing.get("hospital_id"));
        support.requireHospitalAccess(actor,hospital);
        Map<String,Object> p = new HashMap<>();
        p.put("id",wardId); p.put("department",input.departmentId()); p.put("code",input.wardCode().trim().toUpperCase(Locale.ROOT));
        p.put("name",input.wardName().trim()); p.put("type",support.upper(input.wardType(),"GENERAL_MEDICAL_WARD"));
        p.put("category",category(input.wardType(), input.genderRestriction())); p.put("building",support.clean(input.building()));
        p.put("floor",support.clean(input.floor())); p.put("gender",support.upper(input.genderRestriction(),"ANY"));
        p.put("age",support.upper(input.ageRestriction(),"ANY")); p.put("isolation",input.isolationCapable());
        p.put("station",support.clean(input.nurseStation())); p.put("manager",input.wardManagerId());
        p.put("consultant",input.responsibleConsultantId()); p.put("phone",support.clean(input.phone()));
        p.put("status",wardStatus(input.status())); p.put("actor",actor.id());
        sql.update("""
            update wards set department_id=:department,ward_no=:code,ward_code=:code,name=:name,ward_type=:type,
              category=:category,building=:building,floor=:floor,gender_restriction=:gender,age_restriction=:age,
              isolation_capable=:isolation,nurse_station=:station,ward_manager_id=:manager,
              responsible_consultant_id=:consultant,phone=:phone,
              status=case when :status='ACTIVE' then 'active'::record_status else 'inactive'::record_status end,operational_status=:status,updated_by=:actor
            where id=:id
            """, p);
        support.audit(actor,"WARD_UPDATED","wards",wardId,existing,p);
        return wardDetail(actor,wardId);
    }

    public List<Map<String,Object>> listRooms(GovCarePrincipal actor, UUID wardId) {
        Map<String,Object> ward = support.ward(wardId);
        support.requireHospitalAccess(actor,support.uuid(ward.get("hospital_id")));
        return sql.list("""
            select r.id::text id,r.ward_id::text "wardId",r.room_number "roomNumber",r.room_name "roomName",
              r.room_type "roomType",r.floor,r.maximum_beds "maximumBeds",r.gender_restriction "genderRestriction",
              r.isolation_room "isolationRoom",r.negative_pressure_room "negativePressureRoom",
              r.oxygen_available "oxygenAvailable",r.ventilator_support "ventilatorSupport",
              r.bathroom_available "bathroomAvailable",r.status,
              count(b.id) "bedCount",count(b.id) filter(where b.status='AVAILABLE') "availableBeds"
            from ward_rooms r left join beds b on b.room_id=r.id where r.ward_id=:ward
            group by r.id order by r.room_number
            """, Map.of("ward",wardId));
    }

    @Transactional
    public Map<String,Object> createRoom(GovCarePrincipal actor, UUID wardId, RoomRequest input) {
        Map<String,Object> ward = support.ward(wardId);
        support.requireHospitalAccess(actor,support.uuid(ward.get("hospital_id")));
        UUID id=UUID.randomUUID();
        Map<String,Object> p=roomParams(id,wardId,input,actor.id());
        sql.update("""
            insert into ward_rooms(id,ward_id,room_number,room_name,room_type,floor,maximum_beds,gender_restriction,
              isolation_room,negative_pressure_room,oxygen_available,ventilator_support,bathroom_available,status,created_by,updated_by)
            values(:id,:ward,:number,:name,:type,:floor,:maxBeds,:gender,:isolation,:negativePressure,:oxygen,:ventilator,:bathroom,:status,:actor,:actor)
            """,p);
        support.audit(actor,"ROOM_CREATED","ward_rooms",id,null,p);
        return sql.required("select id::text id,ward_id::text \"wardId\",room_number \"roomNumber\",room_name \"roomName\",room_type \"roomType\",status from ward_rooms where id=:id",Map.of("id",id),"Room not found.");
    }

    @Transactional
    public Map<String,Object> updateRoom(GovCarePrincipal actor, UUID wardId, UUID roomId, RoomRequest input) {
        Map<String,Object> ward=support.ward(wardId); support.requireHospitalAccess(actor,support.uuid(ward.get("hospital_id")));
        Map<String,Object> p=roomParams(roomId,wardId,input,actor.id());
        int changed=sql.update("""
            update ward_rooms set room_number=:number,room_name=:name,room_type=:type,floor=:floor,maximum_beds=:maxBeds,
              gender_restriction=:gender,isolation_room=:isolation,negative_pressure_room=:negativePressure,
              oxygen_available=:oxygen,ventilator_support=:ventilator,bathroom_available=:bathroom,status=:status,updated_by=:actor
            where id=:id and ward_id=:ward
            """,p);
        if(changed==0) throw ApiException.notFound("Room not found in this ward.");
        support.audit(actor,"ROOM_UPDATED","ward_rooms",roomId,null,p);
        return sql.required("select id::text id,ward_id::text \"wardId\",room_number \"roomNumber\",room_name \"roomName\",room_type \"roomType\",status from ward_rooms where id=:id",Map.of("id",roomId),"Room not found.");
    }

    public List<Map<String,Object>> listBeds(GovCarePrincipal actor, UUID hospitalId, UUID wardId, UUID roomId,
                                             String status, String bedType, boolean availableOnly) {
        UUID hospital=support.scopedHospital(actor,hospitalId);
        Map<String,Object> p=new HashMap<>(); p.put("hospital",hospital); p.put("ward",wardId); p.put("room",roomId);
        p.put("status",status==null?null:support.upper(status,null)); p.put("type",bedType==null?null:support.upper(bedType,null));
        StringBuilder q=new StringBuilder("""
            select b.id::text id,b.hospital_id::text "hospitalId",b.ward_id::text "wardId",b.room_id::text "roomId",
              b.bed_no "bedNumber",b.bed_code "bedCode",b.bed_type "bedType",b.status,
              b.gender_restriction "genderRestriction",b.age_restriction "ageRestriction",
              b.isolation_support "isolationSupport",b.oxygen_support "oxygenSupport",b.ventilator_support "ventilatorSupport",
              b.monitor_support "monitorSupport",b.electric_bed "electricBed",b.accessible_bed "accessibleBed",
              b.current_patient_id::text "currentPatientId",b.current_admission_id::text "currentAdmissionId",
              b.reserved_patient_id::text "reservedPatientId",b.reserved_until "reservedUntil",b.blocked_reason "blockedReason",
              w.name "wardName",w.ward_code "wardCode",r.room_number "roomNumber",r.room_name "roomName",
              p.patient_no "patientNumber",p.full_name "patientName",p.gender::text "patientGender",p.date_of_birth "patientDateOfBirth",
              a.admission_no "admissionNumber",a.admitted_at "admittedAt",u.full_name "responsibleDoctor"
            from beds b join wards w on w.id=b.ward_id left join ward_rooms r on r.id=b.room_id
              left join patients p on p.id=b.current_patient_id left join admissions a on a.id=b.current_admission_id
              left join app_users u on u.id=a.consultant_id
            where b.hospital_id=:hospital
            """);
        if(wardId!=null) q.append(" and b.ward_id=:ward");
        if(roomId!=null) q.append(" and b.room_id=:room");
        if(status!=null&&!status.isBlank()) q.append(" and b.status=:status");
        if(bedType!=null&&!bedType.isBlank()) q.append(" and b.bed_type=:type");
        if(availableOnly) q.append(" and b.status='AVAILABLE'");
        q.append(" order by w.name,r.room_number,b.bed_no");
        return sql.list(q.toString(),p);
    }

    @Transactional
    public Map<String,Object> createBed(GovCarePrincipal actor, UUID wardId, BedRequest input) {
        Map<String,Object> ward=support.ward(wardId); UUID hospital=support.uuid(ward.get("hospital_id")); support.requireHospitalAccess(actor,hospital);
        if(input.roomId()!=null) validateRoom(input.roomId(),wardId);
        UUID id=UUID.randomUUID(); String code=input.bedCode()==null||input.bedCode().isBlank()?"BED-"+id.toString().substring(0,8).toUpperCase(Locale.ROOT):input.bedCode().trim().toUpperCase(Locale.ROOT);
        String type=support.upper(input.bedType(),"STANDARD"); if(!BED_TYPES.contains(type)) throw ApiException.badRequest("Unsupported bed type.");
        Map<String,Object> p=new HashMap<>(); p.put("id",id);p.put("hospital",hospital);p.put("ward",wardId);p.put("room",input.roomId());
        p.put("number",input.bedNumber().trim());p.put("code",code);p.put("type",type);p.put("gender",support.upper(input.genderRestriction(),"ANY"));
        p.put("age",support.upper(input.ageRestriction(),"ANY"));p.put("isolation",input.isolationSupport());p.put("oxygen",input.oxygenSupport());
        p.put("ventilator",input.ventilatorSupport());p.put("monitor",input.monitorSupport());p.put("electric",input.electricBed());p.put("accessible",input.accessibleBed());p.put("actor",actor.id());
        sql.update("""
            insert into beds(id,hospital_id,ward_id,room_id,bed_no,bed_code,bed_type,status,gender_restriction,age_restriction,
              isolation_support,oxygen_support,ventilator_support,monitor_support,electric_bed,accessible_bed,created_by,updated_by)
            values(:id,:hospital,:ward,:room,:number,:code,:type,'AVAILABLE',:gender,:age,:isolation,:oxygen,:ventilator,:monitor,:electric,:accessible,:actor,:actor)
            """,p);
        support.audit(actor,"BED_CREATED","beds",id,null,p);
        return bedDetail(actor,id);
    }

    public Map<String,Object> bedDetail(GovCarePrincipal actor, UUID bedId) {
        Map<String,Object> bed=support.bed(bedId,false); support.requireHospitalAccess(actor,support.uuid(bed.get("hospital_id")));
        return listBeds(actor,support.uuid(bed.get("hospital_id")),support.uuid(bed.get("ward_id")),support.uuid(bed.get("room_id")),null,null,false)
                .stream().filter(x->bedId.toString().equals(x.get("id"))).findFirst().orElseThrow(()->ApiException.notFound("Bed not found."));
    }

    @Transactional
    public Map<String,Object> updateBed(GovCarePrincipal actor, UUID bedId, BedRequest input) {
        Map<String,Object> bed=support.bed(bedId,true); UUID hospital=support.uuid(bed.get("hospital_id")); support.requireHospitalAccess(actor,hospital);
        UUID wardId=support.uuid(bed.get("ward_id")); if(input.roomId()!=null) validateRoom(input.roomId(),wardId);
        String type=support.upper(input.bedType(),"STANDARD"); if(!BED_TYPES.contains(type)) throw ApiException.badRequest("Unsupported bed type.");
        Map<String,Object> p=new HashMap<>();p.put("id",bedId);p.put("room",input.roomId());p.put("number",input.bedNumber().trim());
        p.put("code",input.bedCode()==null||input.bedCode().isBlank()?bed.get("bed_code"):input.bedCode().trim().toUpperCase(Locale.ROOT));p.put("type",type);
        p.put("gender",support.upper(input.genderRestriction(),"ANY"));p.put("age",support.upper(input.ageRestriction(),"ANY"));p.put("isolation",input.isolationSupport());
        p.put("oxygen",input.oxygenSupport());p.put("ventilator",input.ventilatorSupport());p.put("monitor",input.monitorSupport());p.put("electric",input.electricBed());p.put("accessible",input.accessibleBed());p.put("actor",actor.id());
        sql.update("""
            update beds set room_id=:room,bed_no=:number,bed_code=:code,bed_type=:type,gender_restriction=:gender,
              age_restriction=:age,isolation_support=:isolation,oxygen_support=:oxygen,ventilator_support=:ventilator,
              monitor_support=:monitor,electric_bed=:electric,accessible_bed=:accessible,updated_by=:actor,version=version+1
            where id=:id
            """,p);
        support.audit(actor,"BED_UPDATED","beds",bedId,bed,p);
        return bedDetail(actor,bedId);
    }

    @Transactional
    public Map<String,Object> changeBedStatus(GovCarePrincipal actor, UUID bedId, BedStatusRequest input) {
        Map<String,Object> bed=support.bed(bedId,true); support.requireHospitalAccess(actor,support.uuid(bed.get("hospital_id")));
        String next=support.upper(input.status(),null); if(!BED_STATUSES.contains(next)) throw ApiException.badRequest("Unsupported bed status.");
        String current=Objects.toString(bed.get("status"),"");
        if("OCCUPIED".equals(current)&&!Set.of("PENDING_DISCHARGE","CLEANING").contains(next)) throw ApiException.conflict("Release or transfer the current patient before changing this occupied bed.");
        if("AVAILABLE".equals(next)&&bed.get("current_patient_id")!=null) throw ApiException.conflict("An assigned patient must be released before marking the bed available.");
        Map<String,Object> p=new HashMap<>();p.put("id",bedId);p.put("status",next);p.put("reason",support.clean(input.reason()));p.put("actor",actor.id());
        sql.update("update beds set status=:status,blocked_reason=case when :status in ('BLOCKED','MAINTENANCE','INFECTION_CONTROL','OUT_OF_SERVICE') then :reason else null end,updated_by=:actor,version=version+1 where id=:id",p);
        String action=switch(next){case "BLOCKED","INFECTION_CONTROL","OUT_OF_SERVICE"->"BED_BLOCKED";case "CLEANING"->"BED_MARKED_CLEANING";case "AVAILABLE"->"BED_MARKED_AVAILABLE";default->"BED_UPDATED";};
        support.audit(actor,action,"beds",bedId,Map.of("status",current),Map.of("status",next,"reason",Objects.toString(input.reason(),"")));
        return bedDetail(actor,bedId);
    }

    private void validateRoom(UUID roomId, UUID wardId) {
        if(sql.one("select id from ward_rooms where id=:id and ward_id=:ward",Map.of("id",roomId,"ward",wardId)).isEmpty()) throw ApiException.badRequest("The selected room does not belong to this ward.");
    }

    private Map<String,Object> roomParams(UUID id, UUID wardId, RoomRequest input, UUID actor) {
        Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("ward",wardId);p.put("number",input.roomNumber().trim());p.put("name",support.clean(input.roomName()));
        p.put("type",support.upper(input.roomType(),"GENERAL"));p.put("floor",support.clean(input.floor()));p.put("maxBeds",input.maximumBeds());p.put("gender",support.upper(input.genderRestriction(),"ANY"));
        p.put("isolation",input.isolationRoom());p.put("negativePressure",input.negativePressureRoom());p.put("oxygen",input.oxygenAvailable());p.put("ventilator",input.ventilatorSupport());p.put("bathroom",input.bathroomAvailable());
        p.put("status",support.upper(input.status(),"ACTIVE"));p.put("actor",actor);return p;
    }

    private String wardStatus(String value) {String s=support.upper(value,"ACTIVE");if(!WARD_STATUSES.contains(s)) throw ApiException.badRequest("Unsupported ward status.");return s;}
    private String category(String type,String gender){String t=support.upper(type,"");if(t.contains("ICU"))return "icu";if(t.contains("HDU"))return "hdu";if(t.contains("ISOLATION"))return "isolation";if(t.contains("PAEDIATRIC"))return "children";String g=support.upper(gender,"ANY");return "FEMALE".equals(g)?"female":"MALE".equals(g)?"male":"male";}
}
