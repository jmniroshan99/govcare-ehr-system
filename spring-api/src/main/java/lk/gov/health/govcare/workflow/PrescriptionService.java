package lk.gov.health.govcare.workflow;

import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.JsonSupport;
import lk.gov.health.govcare.common.SequenceService;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
public class PrescriptionService {
    private final SqlSupport sql; private final SequenceService sequences; private final JsonSupport json; private final AuditService audit;
    public PrescriptionService(SqlSupport sql,SequenceService sequences,JsonSupport json,AuditService audit){this.sql=sql;this.sequences=sequences;this.json=json;this.audit=audit;}

    public static final String SELECT="""
      select rx.id::text,rx.prescription_no,rx.patient_id::text,rx.visit_id::text,rx.consultation_id::text,rx.doctor_id::text,rx.diagnosis,rx.priority::text,
      rx.digital_signature,rx.workflow_status,rx.pharmacy_status,rx.signed_at,rx.sent_to_pharmacy_at,rx.pharmacy_verified_by::text,rx.pharmacy_verified_at,
      rx.pharmacy_verification_notes,rx.dispensed_by::text,rx.dispensed_at,rx.created_at,rx.updated_at,p.patient_no,p.full_name as patient_name,p.nic,
      p.date_of_birth,govcare_patient_age_years(p.date_of_birth) as age_years,p.gender::text,p.blood_group,p.phone,p.allergies,u.full_name as doctor_name,ph.full_name as pharmacist_name,
      coalesce(jsonb_agg(jsonb_build_object('id',pi.id::text,'medicineId',pi.medicine_id::text,'medicineName',pi.medicine_name,'genericName',pi.generic_name,
      'strength',pi.strength,'dosage',pi.dosage,'route',pi.route,'frequency',pi.frequency,'duration',pi.duration,'quantity',pi.quantity,'instructions',pi.instructions,
      'substitutionAllowed',pi.substitution_allowed,'notes',pi.notes,'status',pi.status::text) order by pi.id) filter(where pi.id is not null),'[]'::jsonb) as lines
      from prescriptions rx join patients p on p.id=rx.patient_id join app_users u on u.id=rx.doctor_id left join app_users ph on ph.id=rx.pharmacy_verified_by
      left join prescription_items pi on pi.prescription_id=rx.id
      """;

    public List<Map<String,Object>> medicines(GovCarePrincipal a){return sql.list("""
      select m.id::text,m.name,m.generic_name,m.category,m.dosage_form,m.strength,m.reorder_level,coalesce(sum(ps.quantity),0)::numeric as available_stock
      from medicines m left join pharmacy_stock ps on ps.medicine_id=m.id and ps.status='active' and (ps.expiry_date is null or ps.expiry_date>=current_date)
      where m.hospital_id=:hospital and m.status='active' group by m.id order by m.name
    """,Map.of("hospital",a.hospitalId()));}

    public List<Map<String,Object>> list(GovCarePrincipal a,String status,String patient,String pharmacy){
        StringBuilder q=new StringBuilder(SELECT+" where rx.hospital_id=:hospital and rx.status<>'deleted'");
        Map<String,Object>p=new HashMap<>();p.put("hospital",a.hospitalId());
        if (Set.of("patient","guardian").contains(a.role())) {
            if (a.patientId()==null) return List.of();
            q.append(" and rx.patient_id=:selfPatient and rx.workflow_status<>'draft'");
            p.put("selfPatient",a.patientId());
        } else if(clean(patient)!=null){
            q.append(" and rx.patient_id=cast(:patient as uuid)");p.put("patient",patient);
        }
        if(clean(status)!=null){q.append(" and rx.pharmacy_status=:status");p.put("status",status);}
        if(a.role().equals("doctor")){q.append(" and rx.doctor_id=:doctor");p.put("doctor",a.id());}
        q.append(" group by rx.id,p.id,u.id,ph.id order by rx.created_at desc limit 250");
        return sql.list(q.toString(),p);
    }
    public Map<String,Object> get(GovCarePrincipal a,String id){
        StringBuilder q=new StringBuilder(SELECT+" where rx.id=cast(:id as uuid) and rx.hospital_id=:hospital and rx.status<>'deleted'");
        Map<String,Object>p=new HashMap<>();p.put("id",id);p.put("hospital",a.hospitalId());
        if(Set.of("patient","guardian").contains(a.role())){
            if(a.patientId()==null) throw ApiException.notFound("Prescription not found.");
            q.append(" and rx.patient_id=:selfPatient and rx.workflow_status<>'draft'");p.put("selfPatient",a.patientId());
        }
        q.append(" group by rx.id,p.id,u.id,ph.id limit 1");
        return sql.required(q.toString(),p,"Prescription not found.");
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String,Object> create(GovCarePrincipal a,Map<String,Object> in){String patient=req(in,"patientUuid"),diagnosis=req(in,"diagnosis");if(sql.one("select id from patients where id=cast(:id as uuid) and hospital_id=:hospital and status<>'deleted'",Map.of("id",patient,"hospital",a.hospitalId())).isEmpty())throw ApiException.notFound("Patient not found.");String visit=clean(in.get("visitUuid")),consultation=clean(in.get("consultationUuid"));if(visit!=null&&sql.one("select id from visits where id=cast(:id as uuid) and patient_id=cast(:patient as uuid) and hospital_id=:hospital",map("id",visit,"patient",patient,"hospital",a.hospitalId())).isEmpty())throw ApiException.conflict("Visit does not belong to the selected patient.");if(consultation!=null&&sql.one("select id from consultations where id=cast(:id as uuid) and patient_id=cast(:patient as uuid) and hospital_id=:hospital",map("id",consultation,"patient",patient,"hospital",a.hospitalId())).isEmpty())throw ApiException.conflict("Consultation does not belong to the selected patient.");Object linesObj=in.get("lines");if(!(linesObj instanceof List<?> raw)||raw.isEmpty())throw ApiException.badRequest("At least one medicine is required.");List<Map<String,Object>>lines=(List<Map<String,Object>>)(List<?>)raw;for(Map<String,Object>line:lines){if(clean(line.get("medicineName"))==null||clean(line.get("dosage"))==null||clean(line.get("frequency"))==null||clean(line.get("duration"))==null)throw ApiException.badRequest("Every medicine requires name, dosage, frequency and duration.");String medicine=clean(line.get("medicineId"));if(medicine!=null&&sql.one("select id from medicines where id=cast(:id as uuid) and hospital_id=:hospital and status='active'",Map.of("id",medicine,"hospital",a.hospitalId())).isEmpty())throw ApiException.notFound("Medicine "+line.get("medicineName")+" was not found.");}
        sequences.lock("govcare:"+a.hospitalId()+":prescriptions");String no=sequences.daily(a.hospitalId(),"prescriptions","prescription_no","RX-");String signature=clean(in.get("digitalSignature"));boolean submit=Boolean.parseBoolean(String.valueOf(in.getOrDefault("submitToPharmacy",true)));boolean signed=signature!=null;boolean sent=submit&&signed;String workflow=sent?"sent_to_pharmacy":signed?"signed":"draft",pharmacyStatus=sent?"pending":"draft";String priority=String.valueOf(in.getOrDefault("priority","routine"));if(priority.equals("stat"))priority="critical";Map<String,Object>p=map("hospital",a.hospitalId(),"patient",patient,"visit",visit,"consultation",consultation,"doctor",a.id(),"no",no,"diagnosis",diagnosis,"priority",priority,"signature",signature,"qr",json.write(Map.of("prescriptionNo",no,"patientUuid",patient)),"workflow",workflow,"pharmacy",pharmacyStatus);Map<String,Object>rx=sql.required("""
          insert into prescriptions(hospital_id,patient_id,visit_id,consultation_id,doctor_id,prescription_no,diagnosis,priority,digital_signature,qr_payload,workflow_status,pharmacy_status,signed_at,sent_to_pharmacy_at,release_status,status,created_by,updated_by)
          values(:hospital,cast(:patient as uuid),cast(:visit as uuid),cast(:consultation as uuid),:doctor,:no,:diagnosis,cast(:priority as priority_level),:signature,:qr,:workflow,:pharmacy,case when :signature is not null then now() else null end,case when :workflow='sent_to_pharmacy' then now() else null end,'internal','active',:doctor,:doctor) returning id::text
        """,p,"Unable to create prescription.");String rxId=String.valueOf(rx.get("id"));for(Map<String,Object>line:lines){Map<String,Object>lp=map("rx",rxId,"medicine",clean(line.get("medicineId")),"name",req(line,"medicineName"),"generic",value(line,"genericName",line.get("medicineName")),"strength",clean(line.get("strength")),"dosage",req(line,"dosage"),"route",value(line,"route","oral"),"frequency",req(line,"frequency"),"duration",req(line,"duration"),"quantity",number(line.get("quantity")),"instructions",clean(line.get("instructions")),"substitution",!Boolean.FALSE.equals(line.get("substitutionAllowed")),"notes",clean(line.get("notes")));sql.update("""
            insert into prescription_items(prescription_id,medicine_id,medicine_name,generic_name,strength,dosage,route,frequency,duration,quantity,instructions,substitution_allowed,notes,status)
            values(cast(:rx as uuid),cast(:medicine as uuid),:name,:generic,:strength,:dosage,:route,:frequency,:duration,:quantity,:instructions,:substitution,:notes,'active')
          """,lp);}Map<String,Object>out=get(a,rxId);audit.record(a,"prescriptions","prescription_created","prescriptions",UUID.fromString(rxId),null,out);return out;}

    @Transactional public Map<String,Object> sign(GovCarePrincipal a,String id,Map<String,Object>in){String signature=req(in,"digitalSignature");int n=sql.update("update prescriptions set digital_signature=:signature,signed_at=now(),workflow_status='signed',updated_by=:actor where id=cast(:id as uuid) and hospital_id=:hospital and doctor_id=:actor",map("signature",signature,"actor",a.id(),"id",id,"hospital",a.hospitalId()));if(n==0)throw ApiException.notFound("Prescription not found.");return get(a,id);}
    @Transactional public Map<String,Object> send(GovCarePrincipal a,String id){Map<String,Object>rx=get(a,id);if(clean(rx.get("digital_signature"))==null)throw ApiException.conflict("Prescription must be digitally signed before sending to pharmacy.");sql.update("update prescriptions set workflow_status='sent_to_pharmacy',pharmacy_status='pending',sent_to_pharmacy_at=now(),updated_by=:actor where id=cast(:id as uuid) and hospital_id=:hospital",map("actor",a.id(),"id",id,"hospital",a.hospitalId()));return get(a,id);}
    @Transactional public Map<String,Object> pharmacyStatus(GovCarePrincipal a,String id,Map<String,Object>in){String status=req(in,"status");sql.update("update prescriptions set pharmacy_status=:status,workflow_status=:status,updated_by=:actor where id=cast(:id as uuid) and hospital_id=:hospital",map("status",status,"actor",a.id(),"id",id,"hospital",a.hospitalId()));return get(a,id);}

    @Transactional
    public Map<String,Object> verify(GovCarePrincipal a,String id,Map<String,Object>in){
        String status=req(in,"status").toLowerCase(Locale.ROOT);
        if(!Set.of("verified","rejected").contains(status)) throw ApiException.badRequest("Verification status must be verified or rejected.");
        Map<String,Object> before=get(a,id);
        if(clean(before.get("digital_signature"))==null) throw ApiException.conflict("An unsigned prescription cannot be reviewed by Pharmacy.");
        String current=String.valueOf(before.getOrDefault("pharmacy_status","")).toLowerCase(Locale.ROOT);
        if(!Set.of("pending","pending_verification").contains(current)) throw ApiException.conflict("Only pending prescriptions can be verified or rejected. Current status: "+current+".");
        String notes=clean(in.get("notes"));
        if("rejected".equals(status)&&notes==null) throw ApiException.badRequest("A pharmacy rejection reason is required.");
        int changed=sql.update("update prescriptions set pharmacy_status=:status,workflow_status=:status,pharmacy_verified_by=:actor,pharmacy_verified_at=now(),pharmacy_verification_notes=:notes,updated_by=:actor where id=cast(:id as uuid) and hospital_id=:hospital and pharmacy_status in ('pending','pending_verification')",map("status",status,"actor",a.id(),"notes",notes,"id",id,"hospital",a.hospitalId()));
        if(changed==0) throw ApiException.conflict("The prescription status changed before this review was completed. Refresh the pharmacy queue and try again.");
        sql.update("insert into pharmacy_verifications(hospital_id,prescription_id,pharmacist_id,verification_status,notes) values(:hospital,cast(:id as uuid),:actor,:status,:notes)",map("hospital",a.hospitalId(),"id",id,"actor",a.id(),"status",status,"notes",notes));
        Map<String,Object> after=get(a,id);
        audit.record(a,"pharmacy","verified".equals(status)?"prescription_verified":"prescription_rejected","prescriptions",UUID.fromString(id),before,after);
        return after;
    }

    @SuppressWarnings("unchecked") @Transactional public Map<String,Object> dispense(GovCarePrincipal a,String id,Map<String,Object>in){Map<String,Object>rx=get(a,id);if(!"verified".equals(String.valueOf(rx.get("pharmacy_status"))))throw ApiException.conflict("Prescription must be verified before dispensing. Current status: "+rx.get("pharmacy_status")+".");Object io=in.get("items");if(!(io instanceof List<?> raw)||raw.isEmpty())throw ApiException.badRequest("At least one dispensing item is required.");List<Map<String,Object>>items=(List<Map<String,Object>>)(List<?>)raw;List<Map<String,Object>>issued=new ArrayList<>();boolean partial=false;for(Map<String,Object>item:items){String lineId=req(item,"prescriptionItemUuid");BigDecimal qty=number(item.get("quantity"));if(qty==null||qty.signum()<=0)throw ApiException.badRequest("Dispensed quantity must be positive.");Map<String,Object>line=sql.required("select id::text,medicine_id::text,medicine_name,quantity from prescription_items where id=cast(:id as uuid) and prescription_id=cast(:rx as uuid) and status='active' for update",Map.of("id",lineId,"rx",id),"Prescription item not found.");String medicine=clean(item.get("medicineUuid"));if(medicine==null)medicine=clean(line.get("medicine_id"));BigDecimal prescribed=number(line.get("quantity"));if(prescribed!=null&&qty.compareTo(prescribed)<0)partial=true;if(medicine!=null){List<Map<String,Object>>batches=sql.list("select id::text,quantity from pharmacy_stock where hospital_id=:hospital and medicine_id=cast(:medicine as uuid) and status='active' and quantity>0 and (expiry_date is null or expiry_date>=current_date) order by expiry_date nulls last,received_date for update",Map.of("hospital",a.hospitalId(),"medicine",medicine));BigDecimal available=batches.stream().map(b->number(b.get("quantity"))).filter(Objects::nonNull).reduce(BigDecimal.ZERO,BigDecimal::add);if(available.compareTo(qty)<0)throw ApiException.conflict("Insufficient stock for "+line.get("medicine_name")+". Available: "+available+".");BigDecimal remaining=qty;for(Map<String,Object>b:batches){if(remaining.signum()<=0)break;BigDecimal bq=number(b.get("quantity"));BigDecimal take=bq.min(remaining);sql.update("update pharmacy_stock set quantity=quantity-:take,updated_by=:actor where id=cast(:id as uuid)",map("take",take,"actor",a.id(),"id",b.get("id")));remaining=remaining.subtract(take);}}sql.update("update prescription_items set status=cast(:status as record_status) where id=cast(:id as uuid)",Map.of("status",prescribed==null||qty.compareTo(prescribed)>=0?"completed":"active","id",lineId));Map<String,Object>entry=new LinkedHashMap<>();entry.put("prescriptionItemUuid",lineId);entry.put("medicineUuid",medicine);entry.put("medicineName",line.get("medicine_name"));entry.put("prescribedQuantity",prescribed);entry.put("issuedQuantity",qty);issued.add(entry);}String receiptNo=sequences.daily(a.hospitalId(),"pharmacy_receipts","receipt_no","PHR-");String finalStatus=partial?"partially_dispensed":"dispensed";Map<String,Object>receipt=sql.required("""
          insert into pharmacy_receipts(hospital_id,prescription_id,patient_id,pharmacist_id,receipt_no,issued_items,total_items,notes,status,created_by,updated_by)
          values(:hospital,cast(:rx as uuid),cast(:patient as uuid),:actor,:receipt,cast(:issued as jsonb),:total,:notes,'completed',:actor,:actor) returning id::text
        """,map("hospital",a.hospitalId(),"rx",id,"patient",rx.get("patient_id"),"actor",a.id(),"receipt",receiptNo,"issued",json.write(issued),"total",issued.size(),"notes",clean(in.get("notes"))),"Unable to create pharmacy receipt.");sql.update("update prescriptions set pharmacy_status=:status,workflow_status=:status,dispensed_by=:actor,dispensed_at=now(),updated_by=:actor where id=cast(:id as uuid) and hospital_id=:hospital",map("status",finalStatus,"actor",a.id(),"id",id,"hospital",a.hospitalId()));Map<String,Object>receiptOut=new LinkedHashMap<>();receiptOut.put("id",receipt.get("id"));receiptOut.put("receiptNo",receiptNo);receiptOut.put("issuedItems",issued);return Map.of("prescription",get(a,id),"receipt",receiptOut);}

    private static String clean(Object o){if(o==null)return null;String s=String.valueOf(o).trim();return s.isEmpty()||s.equals("null")?null:s;}private static String req(Map<String,Object>m,String k){String s=clean(m.get(k));if(s==null)throw ApiException.badRequest(k+" is required.");return s;}private static String value(Map<String,Object>m,String k,Object d){String s=clean(m.get(k));return s==null?String.valueOf(d):s;}private static BigDecimal number(Object o){if(o==null||String.valueOf(o).isBlank()||String.valueOf(o).equals("null"))return null;try{return new BigDecimal(String.valueOf(o));}catch(Exception e){throw ApiException.badRequest("Invalid numeric value.");}}private static Map<String,Object>map(Object...v){Map<String,Object>m=new HashMap<>();for(int i=0;i<v.length;i+=2)m.put(String.valueOf(v[i]),v[i+1]);return m;}
}
