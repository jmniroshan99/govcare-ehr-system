package lk.gov.health.govcare.transfer;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import lk.gov.health.govcare.ward.WardWorkflowSupport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

import static lk.gov.health.govcare.transfer.TransferDtos.*;

@Service
public class InterHospitalTransferService {
    private final SqlSupport sql;
    private final WardWorkflowSupport support;

    public InterHospitalTransferService(SqlSupport sql, WardWorkflowSupport support) {
        this.sql=sql;this.support=support;
    }

    public Map<String,Object> options(GovCarePrincipal actor) {
        List<Map<String,Object>> hospitals = sql.list("select id::text id,code,name,city,district from hospitals where status=\'active\' order by name", Map.of());
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("currentHospitalId", actor.hospitalId() == null ? null : actor.hospitalId().toString());
        result.put("hospitals", hospitals);
        return result;
    }

    public List<Map<String,Object>> list(GovCarePrincipal actor,String direction,String status){
        Map<String,Object> p=new HashMap<>();p.put("status",status==null?null:support.upper(status,null));
        StringBuilder where=new StringBuilder(" where 1=1");
        if(!support.isSuper(actor)){
            if(actor.hospitalId()==null)throw ApiException.forbidden("Hospital assignment is required.");p.put("hospital",actor.hospitalId());
            if("incoming".equalsIgnoreCase(direction))where.append(" and t.destination_hospital_id=:hospital");
            else if("outgoing".equalsIgnoreCase(direction))where.append(" and t.source_hospital_id=:hospital");
            else where.append(" and (t.source_hospital_id=:hospital or t.destination_hospital_id=:hospital)");
        }
        if(status!=null&&!status.isBlank())where.append(" and t.status=:status");
        return sql.list(baseQuery()+where+" order by t.created_at desc",p);
    }

    public Map<String,Object> detail(GovCarePrincipal actor,UUID id){Map<String,Object> row=sql.required(baseQuery()+" where t.id=:id",Map.of("id",id),"Inter-hospital transfer not found.");requireParty(actor,row);Map<String,Object> result=new LinkedHashMap<>(row);result.put("documents",documents(actor,id));return result;}

    @Transactional
    public Map<String,Object> create(GovCarePrincipal actor,CreateInterHospitalTransferRequest input){
        Map<String,Object> admission=sql.required("""
            select a.*,p.full_name patient_name,p.patient_no,p.date_of_birth,p.gender::text patient_gender,p.nic,p.phone,
              b.id source_bed_id,w.id source_ward_id,w.department_id source_department_id
            from admissions a join patients p on p.id=a.patient_id left join beds b on b.id=a.bed_id left join wards w on w.id=a.ward_id
            where a.id=:id and a.status='active' for update
            """,Map.of("id",input.sourceAdmissionId()),"Active source admission not found.");
        UUID sourceHospital=support.uuid(admission.get("hospital_id"));support.requireHospitalAccess(actor,sourceHospital);
        if(sourceHospital.equals(input.destinationHospitalId()))throw ApiException.badRequest("Source and destination hospitals must be different.");
        support.hospital(input.destinationHospitalId());
        UUID id=UUID.randomUUID();Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("patient",admission.get("patient_id"));p.put("sourceHospital",sourceHospital);p.put("destinationHospital",input.destinationHospitalId());p.put("sourceAdmission",input.sourceAdmissionId());p.put("sourceDepartment",admission.get("source_department_id"));p.put("sourceWard",admission.get("source_ward_id"));p.put("sourceBed",admission.get("source_bed_id"));p.put("destinationDepartment",input.requestedDestinationDepartmentId());p.put("wardType",support.upper(input.requestedWardType(),null));p.put("specialty",support.clean(input.requestedSpecialty()));p.put("consultant",input.preferredConsultantId());p.put("reason",input.transferReason().trim());p.put("summary",input.clinicalSummary().trim());p.put("diagnosis",support.clean(input.currentDiagnosis()));p.put("condition",support.clean(input.currentCondition()));p.put("allergies",support.clean(input.allergies()));p.put("medication",support.clean(input.currentMedication()));p.put("infection",support.clean(input.infectionStatus()));p.put("isolation",input.isolationRequired());p.put("oxygen",input.oxygenRequired());p.put("ventilator",input.ventilatorRequired());p.put("mobility",support.clean(input.mobilityStatus()));p.put("risk",support.clean(input.riskLevel()));p.put("equipment",support.clean(input.requiredEquipment()));p.put("priority",priority(input.priority()));p.put("estimatedDeparture",input.estimatedDeparture());p.put("estimatedArrival",input.estimatedArrival());p.put("actor",actor.id());
        sql.update("""
            insert into inter_hospital_transfers(id,patient_id,source_hospital_id,destination_hospital_id,source_admission_id,
              source_department_id,source_ward_id,source_bed_id,requested_destination_department_id,requested_ward_type,
              requested_specialty,preferred_consultant_id,transfer_reason,clinical_summary,current_diagnosis,current_condition,
              allergies,current_medication,infection_status,isolation_required,oxygen_required,ventilator_required,mobility_status,
              risk_level,required_equipment,priority,status,estimated_departure,estimated_arrival,requested_by)
            values(:id,:patient,:sourceHospital,:destinationHospital,:sourceAdmission,:sourceDepartment,:sourceWard,:sourceBed,
              :destinationDepartment,:wardType,:specialty,:consultant,:reason,:summary,:diagnosis,:condition,:allergies,:medication,
              :infection,:isolation,:oxygen,:ventilator,:mobility,:risk,:equipment,:priority,'DRAFT',:estimatedDeparture,:estimatedArrival,:actor)
            """,p);
        if(input.documentIds()!=null)for(UUID documentId:input.documentIds())attachDocumentInternal(actor,id,documentId,"TRANSFER_SUPPORTING_DOCUMENT");
        support.audit(actor,"INTER_HOSPITAL_TRANSFER_CREATED","inter_hospital_transfers",id,null,p);return detail(actor,id);
    }

    @Transactional public Map<String,Object> submit(GovCarePrincipal actor,UUID id){Map<String,Object> t=locked(id);requireSource(actor,t);String current=status(t);if(!Set.of("DRAFT","MORE_INFORMATION_REQUIRED").contains(current))throw state(current,"SUBMITTED");sql.update("update inter_hospital_transfers set status='SUBMITTED' where id=:id",Map.of("id",id));support.audit(actor,"INTER_HOSPITAL_TRANSFER_SUBMITTED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","SUBMITTED"));support.notifyRole(support.uuid(t.get("destination_hospital_id")),"hospital_admin","Incoming patient transfer","A new inter-hospital transfer requires review.","/transfers/inter-hospital/incoming",actor);return detail(actor,id);}

    @Transactional public Map<String,Object> requestInformation(GovCarePrincipal actor,UUID id,InformationRequest input){Map<String,Object> t=locked(id);requireDestination(actor,t);String current=status(t);if(!Set.of("SUBMITTED","UNDER_REVIEW").contains(current))throw state(current,"MORE_INFORMATION_REQUIRED");sql.update("update inter_hospital_transfers set status='MORE_INFORMATION_REQUIRED',information_request=:info,reviewed_by=:actor where id=:id",Map.of("info",input.requestedInformation().trim(),"actor",actor.id(),"id",id));support.audit(actor,"INTER_HOSPITAL_TRANSFER_INFORMATION_REQUESTED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","MORE_INFORMATION_REQUIRED"));return detail(actor,id);}

    @Transactional public Map<String,Object> accept(GovCarePrincipal actor,UUID id){Map<String,Object> t=locked(id);requireDestination(actor,t);String current=status(t);if(!Set.of("SUBMITTED","UNDER_REVIEW").contains(current))throw state(current,"ACCEPTED");sql.update("update inter_hospital_transfers set status='ACCEPTED',accepted_by=:actor,reviewed_by=:actor where id=:id",Map.of("actor",actor.id(),"id",id));support.audit(actor,"INTER_HOSPITAL_TRANSFER_ACCEPTED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","ACCEPTED"));support.notifyRole(support.uuid(t.get("source_hospital_id")),"doctor","Transfer accepted","The receiving hospital accepted the transfer.","/transfers/inter-hospital/outgoing",actor);return detail(actor,id);}

    @Transactional public Map<String,Object> reject(GovCarePrincipal actor,UUID id,RejectionRequest input){Map<String,Object> t=locked(id);requireDestination(actor,t);String current=status(t);if(!Set.of("SUBMITTED","UNDER_REVIEW","MORE_INFORMATION_REQUIRED").contains(current))throw state(current,"REJECTED");sql.update("update inter_hospital_transfers set status='REJECTED',rejection_reason=:reason,reviewed_by=:actor where id=:id",Map.of("reason",input.reason().trim(),"actor",actor.id(),"id",id));support.audit(actor,"INTER_HOSPITAL_TRANSFER_REJECTED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","REJECTED","reason",input.reason()));return detail(actor,id);}

    @Transactional
    public Map<String,Object> reserveBed(GovCarePrincipal actor,UUID id,DestinationBedRequest input){
        Map<String,Object> t=locked(id);requireDestination(actor,t);String current=status(t);if(!"ACCEPTED".equals(current))throw state(current,"BED_RESERVED");
        Map<String,Object> bed=support.bed(input.bedId(),true);UUID destination=support.uuid(t.get("destination_hospital_id"));if(!destination.equals(support.uuid(bed.get("hospital_id"))))throw ApiException.badRequest("The selected bed is not in the receiving hospital.");if(!"AVAILABLE".equals(Objects.toString(bed.get("status"),"")))throw ApiException.conflict("The selected destination bed is unavailable.");
        UUID patient=support.uuid(t.get("patient_id"));int minutes=input.reservationMinutes()==null?180:Math.max(30,Math.min(input.reservationMinutes(),2880));OffsetDateTime expiry=OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(minutes);UUID reservation=UUID.randomUUID();Map<String,Object> p=new HashMap<>();p.put("reservation",reservation);p.put("hospital",destination);p.put("patient",patient);p.put("admission",t.get("source_admission_id"));p.put("bed",input.bedId());p.put("priority",Objects.toString(t.get("priority"),"ROUTINE"));p.put("actor",actor.id());p.put("expiry",expiry);p.put("id",id);p.put("ward",bed.get("ward_id"));
        sql.update("insert into bed_reservations(id,hospital_id,patient_id,admission_request_id,bed_id,priority,status,reserved_by,expires_at) values(:reservation,:hospital,:patient,:admission,:bed,:priority,'ACTIVE',:actor,:expiry)",p);
        sql.update("update beds set status='RESERVED',reserved_patient_id=:patient,reserved_until=:expiry,updated_by=:actor,version=version+1 where id=:bed",p);
        sql.update("update inter_hospital_transfers set status='BED_RESERVED',destination_ward_id=:ward,destination_bed_id=:bed where id=:id",p);
        support.audit(actor,"INTER_HOSPITAL_TRANSFER_BED_RESERVED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","BED_RESERVED","bedId",input.bedId()));return detail(actor,id);
    }

    @Transactional
    public Map<String,Object> scheduleTransport(GovCarePrincipal actor,UUID id,TransportRequest input){Map<String,Object> t=locked(id);requireSource(actor,t);String current=status(t);if(!Set.of("BED_RESERVED","ACCEPTED").contains(current))throw state(current,"TRANSPORT_SCHEDULED");Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("type",input.transportType().trim());p.put("provider",support.clean(input.ambulanceProvider()));p.put("vehicle",support.clean(input.vehicleNumber()));p.put("driver",support.clean(input.driverName()));p.put("contact",support.clean(input.driverContact()));p.put("doctor",input.escortDoctorId());p.put("nurse",input.escortNurseId());p.put("departure",input.estimatedDeparture());p.put("arrival",input.estimatedArrival());p.put("notes",support.clean(input.transportNotes()));sql.update("""
        update inter_hospital_transfers set status='TRANSPORT_SCHEDULED',transport_type=:type,ambulance_provider=:provider,
          vehicle_number=:vehicle,driver_name=:driver,driver_contact=:contact,escort_doctor_id=:doctor,escort_nurse_id=:nurse,
          estimated_departure=:departure,estimated_arrival=:arrival,transport_notes=:notes where id=:id
        """,p);support.audit(actor,"INTER_HOSPITAL_TRANSFER_TRANSPORT_SCHEDULED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","TRANSPORT_SCHEDULED"));return detail(actor,id);}

    @Transactional
    public Map<String,Object> depart(GovCarePrincipal actor,UUID id){Map<String,Object> t=locked(id);requireSource(actor,t);String current=status(t);if(!Set.of("TRANSPORT_SCHEDULED","READY_FOR_DEPARTURE","BED_RESERVED").contains(current))throw state(current,"DEPARTED");UUID admission=support.uuid(t.get("source_admission_id"));UUID sourceBed=support.uuid(t.get("source_bed_id"));UUID patient=support.uuid(t.get("patient_id"));Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("actor",actor.id());p.put("admission",admission);p.put("bed",sourceBed);
        sql.update("update patient_bed_assignments set active=false,released_by=:actor,released_at=now(),release_reason='inter_hospital_transfer' where admission_id=:admission and active=true",p);
        if(sourceBed!=null)sql.update("update beds set status='CLEANING',current_patient_id=null,current_admission_id=null,reserved_patient_id=null,reserved_until=null,updated_by=:actor,version=version+1 where id=:bed",p);
        sql.update("update admissions set status='completed',discharged_at=now(),bed_id=null,ward_id=null,updated_by=:actor,updated_at=now() where id=:admission",p);
        sql.update("update inter_hospital_transfers set status='DEPARTED',actual_departure=now(),departed_by=:actor where id=:id",p);
        support.movement(patient,admission,id,"INTER_HOSPITAL_DEPARTURE",support.uuid(t.get("source_hospital_id")),support.uuid(t.get("destination_hospital_id")),support.uuid(t.get("source_ward_id")),support.uuid(t.get("destination_ward_id")),sourceBed,support.uuid(t.get("destination_bed_id")),actor,"Patient departed sending hospital.");support.audit(actor,"INTER_HOSPITAL_TRANSFER_DEPARTED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","DEPARTED"));return detail(actor,id);}

    @Transactional public Map<String,Object> arrive(GovCarePrincipal actor,UUID id){Map<String,Object> t=locked(id);requireDestination(actor,t);String current=status(t);if(!Set.of("DEPARTED","IN_TRANSIT").contains(current))throw state(current,"ARRIVED");sql.update("update inter_hospital_transfers set status='ARRIVED',actual_arrival=now(),arrived_by=:actor where id=:id",Map.of("actor",actor.id(),"id",id));support.audit(actor,"INTER_HOSPITAL_TRANSFER_ARRIVED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","ARRIVED"));return detail(actor,id);}

    @Transactional
    public Map<String,Object> confirmAdmission(GovCarePrincipal actor,UUID id){Map<String,Object> t=locked(id);requireDestination(actor,t);String current=status(t);if(!"ARRIVED".equals(current))throw state(current,"ADMISSION_CONFIRMED");UUID bedId=support.uuid(t.get("destination_bed_id"));if(bedId==null)throw ApiException.conflict("Receiving bed has not been reserved.");Map<String,Object> bed=support.bed(bedId,true);UUID patient=support.uuid(t.get("patient_id"));if(!"RESERVED".equals(Objects.toString(bed.get("status"),""))||!patient.equals(support.uuid(bed.get("reserved_patient_id"))))throw ApiException.conflict("Receiving bed reservation is no longer valid.");UUID destinationHospital=support.uuid(t.get("destination_hospital_id"));UUID ward=support.uuid(bed.get("ward_id"));UUID room=support.uuid(bed.get("room_id"));UUID admissionId=UUID.randomUUID();String admissionNo="ADM-"+OffsetDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("yyyyMMdd"))+"-"+id.toString().substring(0,6).toUpperCase(Locale.ROOT);Map<String,Object> p=new HashMap<>();p.put("admission",admissionId);p.put("hospital",destinationHospital);p.put("patient",patient);p.put("ward",ward);p.put("bed",bedId);p.put("consultant",t.get("preferred_consultant_id"));p.put("number",admissionNo);p.put("reason",t.get("transfer_reason"));p.put("diagnosis",t.get("current_diagnosis"));p.put("priority",priority(Objects.toString(t.get("priority"),"ROUTINE")).toLowerCase(Locale.ROOT).replace("emergency","urgent").replace("icu_priority","critical").replace("isolation_priority","urgent"));p.put("actor",actor.id());p.put("room",room);p.put("id",id);
        sql.update("""
          insert into admissions(id,hospital_id,patient_id,ward_id,bed_id,consultant_id,admission_no,reason,provisional_diagnosis,priority,status,created_by,updated_by)
          values(:admission,:hospital,:patient,:ward,:bed,:consultant,:number,:reason,:diagnosis,cast(:priority as priority_level),'active',:actor,:actor)
          """,p);
        UUID assignment=UUID.randomUUID();p.put("assignment",assignment);sql.update("insert into patient_bed_assignments(id,hospital_id,patient_id,admission_id,ward_id,room_id,bed_id,assigned_by,active) values(:assignment,:hospital,:patient,:admission,:ward,:room,:bed,:actor,true)",p);
        sql.update("update beds set status='OCCUPIED',current_patient_id=:patient,current_admission_id=:admission,reserved_patient_id=null,reserved_until=null,updated_by=:actor,version=version+1 where id=:bed",p);
        sql.update("update bed_reservations set status='CONFIRMED',confirmed_at=now() where bed_id=:bed and patient_id=:patient and status='ACTIVE'",p);
        sql.update("update inter_hospital_transfers set status='ADMISSION_CONFIRMED',destination_admission_id=:admission where id=:id",p);
        support.movement(patient,admissionId,id,"INTER_HOSPITAL_ARRIVAL",support.uuid(t.get("source_hospital_id")),destinationHospital,support.uuid(t.get("source_ward_id")),ward,support.uuid(t.get("source_bed_id")),bedId,actor,"Receiving admission confirmed.");support.audit(actor,"INTER_HOSPITAL_TRANSFER_ADMISSION_CONFIRMED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","ADMISSION_CONFIRMED","destinationAdmissionId",admissionId));return detail(actor,id);}

    @Transactional public Map<String,Object> complete(GovCarePrincipal actor,UUID id){Map<String,Object> t=locked(id);requireDestination(actor,t);String current=status(t);if(!"ADMISSION_CONFIRMED".equals(current))throw state(current,"COMPLETED");sql.update("update inter_hospital_transfers set status='COMPLETED',completed_by=:actor,completed_at=now() where id=:id",Map.of("actor",actor.id(),"id",id));support.audit(actor,"INTER_HOSPITAL_TRANSFER_COMPLETED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","COMPLETED"));return detail(actor,id);}

    @Transactional public Map<String,Object> cancel(GovCarePrincipal actor,UUID id,CancelRequest input){Map<String,Object> t=locked(id);requireSource(actor,t);String current=status(t);if(Set.of("DEPARTED","IN_TRANSIT","ARRIVED","ADMISSION_CONFIRMED","COMPLETED","CANCELLED").contains(current))throw ApiException.conflict("This transfer can no longer be cancelled by the sending hospital.");UUID bed=support.uuid(t.get("destination_bed_id"));if(bed!=null){sql.update("update bed_reservations set status='CANCELLED',cancelled_at=now(),cancellation_reason=:reason where bed_id=:bed and status='ACTIVE'",Map.of("reason",input.reason(),"bed",bed));sql.update("update beds set status='AVAILABLE',reserved_patient_id=null,reserved_until=null,version=version+1 where id=:bed and status='RESERVED'",Map.of("bed",bed));}sql.update("update inter_hospital_transfers set status='CANCELLED',rejection_reason=:reason where id=:id",Map.of("reason",input.reason(),"id",id));support.audit(actor,"INTER_HOSPITAL_TRANSFER_CANCELLED","inter_hospital_transfers",id,Map.of("status",current),Map.of("status","CANCELLED","reason",input.reason()));return detail(actor,id);}

    @Transactional public Map<String,Object> attachDocument(GovCarePrincipal actor,UUID transferId,AttachDocumentRequest input){attachDocumentInternal(actor,transferId,input.patientDocumentId(),input.purpose());return detail(actor,transferId);}
    @Transactional public void revokeDocument(GovCarePrincipal actor,UUID transferId,UUID documentId){Map<String,Object> t=locked(transferId);requireSource(actor,t);int changed=sql.update("update patient_transfer_documents set revoked_at=now() where transfer_id=:transfer and patient_document_id=:document and revoked_at is null",Map.of("transfer",transferId,"document",documentId));if(changed==0)throw ApiException.notFound("Transfer document link not found.");support.audit(actor,"TRANSFER_DOCUMENT_REVOKED","inter_hospital_transfers",transferId,null,Map.of("documentId",documentId));}
    public List<Map<String,Object>> documents(GovCarePrincipal actor,UUID transferId){Map<String,Object> t=sql.required("select * from inter_hospital_transfers where id=:id",Map.of("id",transferId),"Transfer not found.");requireParty(actor,t);return sql.list("""
      select d.id::text id,d.document_type "documentType",d.title,d.original_file_name "originalFileName",d.mime_type "mimeType",
        d.file_size_bytes "fileSizeBytes",d.document_status "documentStatus",d.created_at "createdAt",x.document_purpose "purpose",x.shared_at "sharedAt"
      from patient_transfer_documents x join patient_documents d on d.id=x.patient_document_id
      where x.transfer_id=:id and x.revoked_at is null order by x.shared_at desc
      """,Map.of("id",transferId));}
    public List<Map<String,Object>> movements(GovCarePrincipal actor,UUID patientId){if(!support.isSuper(actor)&&actor.hospitalId()==null)throw ApiException.forbidden("Hospital assignment required.");Map<String,Object> params=new HashMap<>();params.put("patient",patientId);params.put("super",support.isSuper(actor));params.put("hospital",actor.hospitalId());return sql.list("""
      select m.id::text id,m.patient_id::text "patientId",m.admission_id::text "admissionId",m.transfer_id::text "transferId",
        m.movement_type "movementType",m.source_hospital_id::text "sourceHospitalId",sh.name "sourceHospitalName",
        m.destination_hospital_id::text "destinationHospitalId",dh.name "destinationHospitalName",m.source_ward_id::text "sourceWardId",
        sw.name "sourceWardName",m.destination_ward_id::text "destinationWardId",dw.name "destinationWardName",
        m.source_bed_id::text "sourceBedId",sb.bed_code "sourceBedCode",m.destination_bed_id::text "destinationBedId",
        db.bed_code "destinationBedCode",m.moved_at "movedAt",m.notes,u.full_name "movedByName"
      from patient_movement_history m left join hospitals sh on sh.id=m.source_hospital_id left join hospitals dh on dh.id=m.destination_hospital_id
        left join wards sw on sw.id=m.source_ward_id left join wards dw on dw.id=m.destination_ward_id left join beds sb on sb.id=m.source_bed_id
        left join beds db on db.id=m.destination_bed_id left join app_users u on u.id=m.moved_by
      where m.patient_id=:patient and (:super=true or m.source_hospital_id=:hospital or m.destination_hospital_id=:hospital)
      order by m.moved_at desc
      """,params);}
    public List<Map<String,Object>> audit(GovCarePrincipal actor,UUID transferId){Map<String,Object> t=sql.required("select * from inter_hospital_transfers where id=:id",Map.of("id",transferId),"Transfer not found.");requireParty(actor,t);return sql.list("select id::text id,action,before_state \"beforeState\",after_state \"afterState\",ip_address \"ipAddress\",created_at \"createdAt\" from audit_logs where entity_type='inter_hospital_transfers' and entity_id=:id order by created_at desc",Map.of("id",transferId));}

    private void attachDocumentInternal(GovCarePrincipal actor,UUID transferId,UUID documentId,String purpose){Map<String,Object> t=locked(transferId);requireSource(actor,t);Map<String,Object> doc=sql.required("select patient_id,document_status from patient_documents where id=:id",Map.of("id",documentId),"Patient document not found.");if(!Objects.equals(t.get("patient_id"),doc.get("patient_id")))throw ApiException.badRequest("The document belongs to another patient.");if(!"VERIFIED".equals(Objects.toString(doc.get("document_status"),"")))throw ApiException.conflict("Only verified documents can be shared in an inter-hospital transfer.");sql.update("insert into patient_transfer_documents(transfer_id,patient_document_id,document_purpose,shared_by) values(:transfer,:document,:purpose,:actor) on conflict(transfer_id,patient_document_id) do update set document_purpose=excluded.document_purpose,shared_by=excluded.shared_by,shared_at=now(),revoked_at=null",Map.of("transfer",transferId,"document",documentId,"purpose",purpose,"actor",actor.id()));support.audit(actor,"TRANSFER_DOCUMENT_SHARED","inter_hospital_transfers",transferId,null,Map.of("documentId",documentId,"purpose",purpose));}
    private Map<String,Object> locked(UUID id){return sql.required("select * from inter_hospital_transfers where id=:id for update",Map.of("id",id),"Inter-hospital transfer not found.");}
    private void requireParty(GovCarePrincipal actor,Map<String,Object> t){if(support.isSuper(actor))return;UUID h=actor.hospitalId();if(h==null||(!h.equals(support.uuid(t.get("source_hospital_id")))&&!h.equals(support.uuid(t.get("destination_hospital_id")))))throw ApiException.forbidden("You are not a party to this inter-hospital transfer.");}
    private void requireSource(GovCarePrincipal actor,Map<String,Object> t){if(!support.isSuper(actor)&&!Objects.equals(actor.hospitalId(),support.uuid(t.get("source_hospital_id"))))throw ApiException.forbidden("Only the sending hospital can perform this action.");}
    private void requireDestination(GovCarePrincipal actor,Map<String,Object> t){if(!support.isSuper(actor)&&!Objects.equals(actor.hospitalId(),support.uuid(t.get("destination_hospital_id"))))throw ApiException.forbidden("Only the receiving hospital can perform this action.");}
    private String status(Map<String,Object> t){return Objects.toString(t.get("status"),"");}
    private ApiException state(String current,String next){return ApiException.conflict("Invalid transfer state transition from "+current+" to "+next+".");}
    private String priority(String value){String p=support.upper(value,"ROUTINE");return Set.of("ROUTINE","URGENT","EMERGENCY","ICU_PRIORITY","ISOLATION_PRIORITY").contains(p)?p:"ROUTINE";}
    private String baseQuery(){return """
      select t.id::text id,t.transfer_number "transferNumber",t.patient_id::text "patientId",p.patient_no "patientNumber",p.full_name "patientName",
        p.date_of_birth "dateOfBirth",p.gender::text gender,t.source_hospital_id::text "sourceHospitalId",sh.name "sourceHospitalName",
        t.destination_hospital_id::text "destinationHospitalId",dh.name "destinationHospitalName",t.source_admission_id::text "sourceAdmissionId",
        sa.admission_no "sourceAdmissionNumber",t.destination_admission_id::text "destinationAdmissionId",da.admission_no "destinationAdmissionNumber",
        t.source_department_id::text "sourceDepartmentId",t.source_ward_id::text "sourceWardId",sw.name "sourceWardName",
        t.source_bed_id::text "sourceBedId",sb.bed_code "sourceBedCode",t.requested_destination_department_id::text "requestedDestinationDepartmentId",
        t.requested_ward_type "requestedWardType",t.requested_specialty "requestedSpecialty",t.destination_ward_id::text "destinationWardId",
        dw.name "destinationWardName",t.destination_bed_id::text "destinationBedId",db.bed_code "destinationBedCode",
        t.transfer_reason "transferReason",t.clinical_summary "clinicalSummary",t.current_diagnosis "currentDiagnosis",t.current_condition "currentCondition",
        t.allergies,t.current_medication "currentMedication",t.infection_status "infectionStatus",t.isolation_required "isolationRequired",
        t.oxygen_required "oxygenRequired",t.ventilator_required "ventilatorRequired",t.mobility_status "mobilityStatus",t.risk_level "riskLevel",
        t.required_equipment "requiredEquipment",t.priority,t.status,t.transport_type "transportType",t.ambulance_provider "ambulanceProvider",
        t.vehicle_number "vehicleNumber",t.driver_name "driverName",t.driver_contact "driverContact",t.estimated_departure "estimatedDeparture",
        t.estimated_arrival "estimatedArrival",t.actual_departure "actualDeparture",t.actual_arrival "actualArrival",t.transport_notes "transportNotes",
        t.rejection_reason "rejectionReason",t.information_request "informationRequest",t.created_at "createdAt",t.updated_at "updatedAt",t.completed_at "completedAt"
      from inter_hospital_transfers t join patients p on p.id=t.patient_id join hospitals sh on sh.id=t.source_hospital_id
        join hospitals dh on dh.id=t.destination_hospital_id join admissions sa on sa.id=t.source_admission_id left join admissions da on da.id=t.destination_admission_id
        left join wards sw on sw.id=t.source_ward_id left join beds sb on sb.id=t.source_bed_id left join wards dw on dw.id=t.destination_ward_id
        left join beds db on db.id=t.destination_bed_id
      """;}
}
