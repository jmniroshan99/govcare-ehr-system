package lk.gov.health.govcare.ward;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static lk.gov.health.govcare.ward.WardDtos.*;

@Service
public class InternalTransferService {
    private final SqlSupport sql;
    private final WardWorkflowSupport support;
    private final BedAllocationService allocation;

    public InternalTransferService(SqlSupport sql, WardWorkflowSupport support, BedAllocationService allocation) {
        this.sql = sql;
        this.support = support;
        this.allocation = allocation;
    }

    public List<Map<String,Object>> list(GovCarePrincipal actor, String status) {
        UUID hospital=support.scopedHospital(actor,null);
        Map<String,Object> p=new HashMap<>();p.put("hospital",hospital);p.put("status",status==null?null:support.upper(status,null));
        String filter=status==null||status.isBlank()?"":" and t.status=:status";
        return sql.list(baseQuery()+" where t.hospital_id=:hospital"+filter+" order by t.requested_at desc",p);
    }

    public Map<String,Object> detail(GovCarePrincipal actor, UUID transferId) {
        Map<String,Object> row=sql.required(baseQuery()+" where t.id=:id",Map.of("id",transferId),"Internal transfer not found.");
        support.requireHospitalAccess(actor,UUID.fromString(row.get("hospitalId").toString()));return row;
    }

    @Transactional
    public Map<String,Object> create(GovCarePrincipal actor, InternalTransferRequest input) {
        Map<String,Object> assignment=sql.required("""
            select x.*,a.department_id source_department_id from patient_bed_assignments x
              join admissions a on a.id=x.admission_id
            where x.admission_id=:admission and x.active=true for update
            """,Map.of("admission",input.admissionId()),"The admission has no active bed assignment.");
        UUID hospital=support.uuid(assignment.get("hospital_id"));support.requireHospitalAccess(actor,hospital);
        Map<String,Object> destinationWard=support.ward(input.destinationWardId());
        if(!hospital.equals(support.uuid(destinationWard.get("hospital_id"))))throw ApiException.badRequest("Internal transfers must remain within the same hospital.");
        UUID sourceWard=support.uuid(assignment.get("ward_id"));if(sourceWard.equals(input.destinationWardId())&&input.destinationBedId()==null)throw ApiException.badRequest("Select a destination bed for a same-ward transfer.");
        if(input.destinationBedId()!=null){Map<String,Object> bed=support.bed(input.destinationBedId(),true);if(!input.destinationWardId().equals(support.uuid(bed.get("ward_id"))))throw ApiException.badRequest("Destination bed does not belong to the selected ward.");}
        UUID id=UUID.randomUUID();Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("hospital",hospital);p.put("patient",assignment.get("patient_id"));p.put("admission",input.admissionId());p.put("sourceDepartment",assignment.get("source_department_id"));p.put("sourceWard",sourceWard);p.put("sourceBed",assignment.get("bed_id"));p.put("destinationDepartment",input.destinationDepartmentId());p.put("destinationWard",input.destinationWardId());p.put("destinationBed",input.destinationBedId());p.put("reason",input.transferReason().trim());p.put("priority",priority(input.priority()));p.put("notes",support.clean(input.clinicalNotes()));p.put("isolation",input.isolationRequired());p.put("transport",input.transportAssistanceRequired());p.put("actor",actor.id());
        sql.update("""
            insert into internal_transfer_requests(id,hospital_id,patient_id,admission_id,source_department_id,source_ward_id,source_bed_id,
              destination_department_id,destination_ward_id,destination_bed_id,transfer_reason,priority,clinical_notes,isolation_required,
              transport_assistance_required,status,requested_by)
            values(:id,:hospital,:patient,:admission,:sourceDepartment,:sourceWard,:sourceBed,:destinationDepartment,:destinationWard,
              :destinationBed,:reason,:priority,:notes,:isolation,:transport,'REQUESTED',:actor)
            """,p);
        support.audit(actor,"INTERNAL_TRANSFER_CREATED","internal_transfer_requests",id,null,p);
        support.notifyRole(hospital,"nurse","Internal transfer requested","A ward transfer request requires review.","/transfers/internal",actor);
        return detail(actor,id);
    }

    @Transactional public Map<String,Object> approve(GovCarePrincipal actor,UUID id){return transition(actor,id,Set.of("REQUESTED","UNDER_REVIEW"),"APPROVED","approved_by","approved_at","INTERNAL_TRANSFER_APPROVED");}
    @Transactional public Map<String,Object> accept(GovCarePrincipal actor,UUID id){return transition(actor,id,Set.of("APPROVED","REQUESTED"),"ACCEPTED","accepted_by","accepted_at","INTERNAL_TRANSFER_ACCEPTED");}

    @Transactional
    public Map<String,Object> reserveBed(GovCarePrincipal actor, UUID id, TransferBedRequest input) {
        Map<String,Object> t=locked(id);UUID hospital=support.uuid(t.get("hospital_id"));support.requireHospitalAccess(actor,hospital);
        String status=Objects.toString(t.get("status"),"");if(!Set.of("ACCEPTED","APPROVED").contains(status))throw ApiException.conflict("The transfer must be accepted before reserving a bed.");
        Map<String,Object> bed=support.bed(input.bedId(),true);if(!support.uuid(t.get("destination_ward_id")).equals(support.uuid(bed.get("ward_id"))))throw ApiException.badRequest("The bed does not belong to the destination ward.");
        Map<String,Object> reservation=allocation.reserve(actor,support.uuid(t.get("admission_id")),new ReserveBedRequest(input.bedId(),Objects.toString(t.get("priority"),"ROUTINE"),input.reservationMinutes(),null));
        sql.update("update internal_transfer_requests set destination_bed_id=:bed,status='BED_RESERVED' where id=:id",Map.of("bed",input.bedId(),"id",id));
        support.audit(actor,"INTERNAL_TRANSFER_BED_RESERVED","internal_transfer_requests",id,Map.of("status",status),Map.of("status","BED_RESERVED","bedId",input.bedId()));
        Map<String,Object> result=new LinkedHashMap<>(detail(actor,id));result.put("reservation",reservation);return result;
    }

    @Transactional
    public Map<String,Object> start(GovCarePrincipal actor, UUID id) {
        Map<String,Object> t=locked(id);support.requireHospitalAccess(actor,support.uuid(t.get("hospital_id")));
        String status=Objects.toString(t.get("status"),"");if(!Set.of("BED_RESERVED","READY_FOR_TRANSFER").contains(status))throw ApiException.conflict("Reserve the destination bed before starting the transfer.");
        sql.update("update internal_transfer_requests set status='IN_TRANSIT',started_at=now() where id=:id",Map.of("id",id));
        support.audit(actor,"INTERNAL_TRANSFER_STARTED","internal_transfer_requests",id,Map.of("status",status),Map.of("status","IN_TRANSIT"));return detail(actor,id);
    }

    @Transactional
    public Map<String,Object> complete(GovCarePrincipal actor, UUID id) {
        Map<String,Object> t=locked(id);UUID hospital=support.uuid(t.get("hospital_id"));support.requireHospitalAccess(actor,hospital);
        if(!"IN_TRANSIT".equals(Objects.toString(t.get("status"),"")))throw ApiException.conflict("The transfer must be in transit before completion.");
        UUID sourceBedId=support.uuid(t.get("source_bed_id"));UUID destinationBedId=support.uuid(t.get("destination_bed_id"));if(destinationBedId==null)throw ApiException.conflict("A destination bed has not been reserved.");
        Map<String,Object> sourceBed=support.bed(sourceBedId,true);Map<String,Object> destinationBed=support.bed(destinationBedId,true);
        UUID patient=support.uuid(t.get("patient_id"));UUID admission=support.uuid(t.get("admission_id"));
        if(!"OCCUPIED".equals(Objects.toString(sourceBed.get("status"),""))||!admission.equals(support.uuid(sourceBed.get("current_admission_id"))))throw ApiException.conflict("The source bed is no longer assigned to this admission.");
        if(!"RESERVED".equals(Objects.toString(destinationBed.get("status"),""))||!patient.equals(support.uuid(destinationBed.get("reserved_patient_id"))))throw ApiException.conflict("The destination bed reservation is no longer valid.");
        UUID destinationWard=support.uuid(t.get("destination_ward_id"));UUID destinationRoom=support.uuid(destinationBed.get("room_id"));Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("patient",patient);p.put("admission",admission);p.put("sourceBed",sourceBedId);p.put("destinationBed",destinationBedId);p.put("destinationWard",destinationWard);p.put("destinationRoom",destinationRoom);p.put("actor",actor.id());
        sql.update("update patient_bed_assignments set active=false,released_by=:actor,released_at=now(),release_reason='internal_transfer' where admission_id=:admission and active=true",p);
        UUID assignmentId=UUID.randomUUID();p.put("assignment",assignmentId);
        sql.update("""
            insert into patient_bed_assignments(id,hospital_id,patient_id,admission_id,ward_id,room_id,bed_id,assigned_by,active)
            values(:assignment,:hospital,:patient,:admission,:destinationWard,:destinationRoom,:destinationBed,:actor,true)
            """,new HashMap<>(p){{put("hospital",hospital);}});
        sql.update("update beds set status='CLEANING',current_patient_id=null,current_admission_id=null,reserved_patient_id=null,reserved_until=null,updated_by=:actor,version=version+1 where id=:sourceBed",p);
        sql.update("update beds set status='OCCUPIED',current_patient_id=:patient,current_admission_id=:admission,reserved_patient_id=null,reserved_until=null,updated_by=:actor,version=version+1 where id=:destinationBed",p);
        sql.update("update admissions set ward_id=:destinationWard,bed_id=:destinationBed,updated_by=:actor,updated_at=now() where id=:admission",p);
        sql.update("update bed_reservations set status='CONFIRMED',confirmed_at=now() where bed_id=:destinationBed and patient_id=:patient and status='ACTIVE'",p);
        sql.update("update internal_transfer_requests set status='COMPLETED',completed_by=:actor,completed_at=now() where id=:id",p);
        support.movement(patient,admission,id,"INTERNAL_TRANSFER",hospital,hospital,support.uuid(t.get("source_ward_id")),destinationWard,sourceBedId,destinationBedId,actor,Objects.toString(t.get("transfer_reason"),""));
        support.audit(actor,"INTERNAL_TRANSFER_COMPLETED","internal_transfer_requests",id,Map.of("status","IN_TRANSIT"),Map.of("status","COMPLETED","destinationBedId",destinationBedId));
        support.notifyRole(hospital,"nurse","Patient arrived at destination ward","The internal transfer has been completed.","/wards/bed-board",actor);return detail(actor,id);
    }

    @Transactional
    public Map<String,Object> cancel(GovCarePrincipal actor, UUID id, TransferReasonRequest input) {
        Map<String,Object> t=locked(id);support.requireHospitalAccess(actor,support.uuid(t.get("hospital_id")));String status=Objects.toString(t.get("status"),"");if(Set.of("COMPLETED","CANCELLED").contains(status))throw ApiException.conflict("This transfer can no longer be cancelled.");
        UUID destinationBed=support.uuid(t.get("destination_bed_id"));if(destinationBed!=null){sql.update("update bed_reservations set status='CANCELLED',cancelled_at=now(),cancellation_reason=:reason where bed_id=:bed and status='ACTIVE'",Map.of("reason",Objects.toString(input.reason(),"Cancelled"),"bed",destinationBed));sql.update("update beds set status='AVAILABLE',reserved_patient_id=null,reserved_until=null,version=version+1 where id=:bed and status='RESERVED'",Map.of("bed",destinationBed));}
        sql.update("update internal_transfer_requests set status='CANCELLED',cancelled_at=now(),cancellation_reason=:reason where id=:id",Map.of("reason",Objects.toString(input.reason(),"Cancelled"),"id",id));support.audit(actor,"INTERNAL_TRANSFER_CANCELLED","internal_transfer_requests",id,Map.of("status",status),Map.of("status","CANCELLED","reason",Objects.toString(input.reason(),"")));return detail(actor,id);
    }

    private Map<String,Object> transition(GovCarePrincipal actor,UUID id,Set<String> allowed,String next,String actorColumn,String dateColumn,String auditAction){Map<String,Object> t=locked(id);support.requireHospitalAccess(actor,support.uuid(t.get("hospital_id")));String current=Objects.toString(t.get("status"),"");if(!allowed.contains(current))throw ApiException.conflict("Invalid transfer state transition from "+current+" to "+next+".");sql.update("update internal_transfer_requests set status=:next,"+actorColumn+"=:actor,"+dateColumn+"=now() where id=:id",Map.of("next",next,"actor",actor.id(),"id",id));support.audit(actor,auditAction,"internal_transfer_requests",id,Map.of("status",current),Map.of("status",next));return detail(actor,id);}
    private Map<String,Object> locked(UUID id){return sql.required("select * from internal_transfer_requests where id=:id for update",Map.of("id",id),"Internal transfer not found.");}
    private String priority(String value){String p=support.upper(value,"ROUTINE");return Set.of("ROUTINE","URGENT","EMERGENCY","ICU_PRIORITY","ISOLATION_PRIORITY").contains(p)?p:"ROUTINE";}
    private String baseQuery(){return """
        select t.id::text id,t.hospital_id::text "hospitalId",t.patient_id::text "patientId",p.patient_no "patientNumber",p.full_name "patientName",
          t.admission_id::text "admissionId",a.admission_no "admissionNumber",t.source_department_id::text "sourceDepartmentId",
          t.source_ward_id::text "sourceWardId",sw.name "sourceWardName",t.source_bed_id::text "sourceBedId",sb.bed_code "sourceBedCode",
          t.destination_department_id::text "destinationDepartmentId",t.destination_ward_id::text "destinationWardId",dw.name "destinationWardName",
          t.destination_bed_id::text "destinationBedId",db.bed_code "destinationBedCode",t.transfer_reason "transferReason",t.priority,
          t.clinical_notes "clinicalNotes",t.isolation_required "isolationRequired",t.transport_assistance_required "transportAssistanceRequired",
          t.status,t.requested_by::text "requestedBy",requester.full_name "requestedByName",t.requested_at "requestedAt",t.approved_at "approvedAt",
          t.accepted_at "acceptedAt",t.started_at "startedAt",t.completed_at "completedAt",t.cancellation_reason "cancellationReason"
        from internal_transfer_requests t join patients p on p.id=t.patient_id join admissions a on a.id=t.admission_id
          join wards sw on sw.id=t.source_ward_id join beds sb on sb.id=t.source_bed_id join wards dw on dw.id=t.destination_ward_id
          left join beds db on db.id=t.destination_bed_id left join app_users requester on requester.id=t.requested_by
        """;}
}
