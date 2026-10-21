package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.documents.PatientDocumentService;
import lk.gov.health.govcare.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Repeatable extraction is read-only clinical evidence; explicit source save is atomic and idempotent. */
@Service
public class ClinicalPdfImportService {
    private final SqlSupport sql;private final JsonSupport json;private final ClinicalPatientAccess access;
    private final ClinicalPdfExtractionService extraction;private final PatientDocumentService documents;private final ClinicalPersistenceService persistence;
    public ClinicalPdfImportService(SqlSupport sql,JsonSupport json,ClinicalPatientAccess access,ClinicalPdfExtractionService extraction,PatientDocumentService documents,ClinicalPersistenceService persistence){this.sql=sql;this.json=json;this.access=access;this.extraction=extraction;this.documents=documents;this.persistence=persistence;}
    public Map<String,Object> context(GovCarePrincipal actor,UUID patient){
        var scoped=access.clinicalScope(actor,patient,false);boolean synthetic=ClinicalTestPatientPolicy.synthetic(sql,scoped,patient);
        return Map.of("patientId",patient.toString(),"syntheticPatient",synthetic,"documentClassification",synthetic?"TEST_DOCUMENT":"CLINICAL_DOCUMENT","measurements",ClinicalFeatureNormalizer.DEFINITIONS.stream().filter(d->!Set.of("Age","Edema","FamilyHistoryKidneyDisease","PreviousAcuteKidneyInjury","NSAIDsUse").contains(d.input())).toList());
    }
    /** File acceptance is durable even when a valid PDF has no extractable measurements. */
    @Transactional(rollbackFor=IOException.class) public Map<String,Object> upload(GovCarePrincipal actor,UUID patient,MultipartFile file)throws IOException{
        var scoped=access.clinicalScope(actor,patient,true);validate(file);byte[] bytes=file.getBytes();
        lk.gov.health.govcare.documents.ClinicalPdfFileValidation.validate(bytes);
        boolean synthetic=ClinicalTestPatientPolicy.synthetic(sql,scoped,patient);String classification=synthetic?"TEST_DOCUMENT":"CLINICAL_DOCUMENT",fingerprint=hash(bytes);
        var p=params(scoped,patient,fingerprint);sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",Map.of("lock","clinical-pdf|"+scoped.hospitalId()+"|"+patient+"|"+fingerprint),"Cannot serialize source upload.");
        Map<String,Object> preview=null;
        if(!synthetic){try{preview=read(scoped,patient,bytes,name(file),"UPLOADED_PDF",null);}catch(IOException|ApiException failure){if(failure instanceof ApiException api&&(api.status().value()==401||api.status().value()==403))throw api;preview=failedRead(patient,name(file),fingerprint,failure);}
            if("MISMATCH".equals(preview.get("identityStatus")))throw ApiException.unprocessable("This report belongs to another patient. It cannot be associated with a real clinical patient.");}
        var prior=find(scoped,patient,fingerprint);UUID document,report;boolean reusedAttachment=false;
        if(prior.isPresent()&&prior.get().get("patient_document_id")!=null){document=UUID.fromString(prior.get().get("patient_document_id").toString());documents.get(scoped,patient,document);report=UUID.fromString(prior.get().get("id").toString());}
        else{
            var attached=sql.one("select id from patient_documents where hospital_id=:h and patient_id=:p and sha256_checksum=:hash and document_status not in ('ARCHIVED','CANCELLED','REJECTED') order by created_at limit 1",p);
            if(attached.isPresent()){document=UUID.fromString(attached.get().get("id").toString());documents.get(scoped,patient,document);reusedAttachment=true;}
            else{var uploaded=documents.upload(scoped,patient,file,"OTHER_CLINICAL_DOCUMENT",name(file),synthetic?"TEST_DOCUMENT: synthetic patient source; original printed identity is unverified.":"Clinical PDF source awaiting review.","SUBMITTED","CARE_TEAM",null,null,null,null,null,null);document=UUID.fromString(uploaded.get("id").toString());}
            report=persistence.persistExtraction(scoped,patient,document,name(file),"UPLOADED_PDF",fingerprint,file.getSize(),Map.of("status","PENDING_EXTRACTION","workflowStatus","PENDING_EXTRACTION","documentClassification",classification,"extractionMethod","NOT_STARTED","sourceVerified",false));
        }
        p.put("id",report);p.put("document",document);p.put("classification",classification);
        sql.update("update patient_documents set document_classification=:classification where id=:document and hospital_id=:h and patient_id=:p",p);
        sql.update("update clinical_reports set document_classification=:classification,workflow_status='PENDING_EXTRACTION' where id=:id and hospital_id=:h and patient_id=:p",p);
        if(preview==null)try{preview=read(scoped,patient,bytes,name(file),"UPLOADED_PDF",document);}catch(IOException|ApiException failure){if(failure instanceof ApiException api&&(api.status().value()==401||api.status().value()==403))throw api;preview=failedRead(patient,name(file),fingerprint,failure);}
        String workflow=prior.isPresent()&&"CLINICAL_DATA_VERIFIED".equals(prior.get().get("workflow_status"))?"CLINICAL_DATA_VERIFIED":workflowStatus(Objects.toString(preview.get("status"),"EXTRACTION_FAILED"));
        preview.put("documentId",document.toString());preview.put("clinicalReportId",report.toString());preview.put("saved",true);preview.put("duplicate",prior.isPresent()||reusedAttachment);preview.put("fileAccepted",true);preview.put("uploadStatus","UPLOADED");preview.put("workflowStatus",workflow);preview.put("syntheticPatient",synthetic);preview.put("documentClassification",classification);preview.put("identityReviewRequired",!"MATCHED".equals(preview.get("identityStatus")));
        p.put("metadata",json.write(preview));p.put("workflow",workflow);p.put("processing",workflow.equals("EXTRACTION_FAILED")?"FAILED":workflow.equals("MANUAL_REVIEW_REQUIRED")?"PARTIAL":"PROCESSED");
        sql.update("update clinical_reports set workflow_status=:workflow,processing_status=:processing,extraction_metadata=cast(:metadata as jsonb),updated_at=now() where id=:id and hospital_id=:h and patient_id=:p",p);
        sourceFhir(scoped,patient,report,document,name(file),fingerprint,null);
        audit(scoped,patient,"CLINICAL_PDF_ACCEPTED",Map.of("reportId",report.toString(),"documentClassification",classification,"workflowStatus",workflow,"duplicate",prior.isPresent()));
        return preview;
    }
    static String workflowStatus(String status){return switch(status){case "COMPLETED"->"EXTRACTION_COMPLETED";case "PARTIAL"->"PARTIAL_EXTRACTION";case "EXTRACTION_FAILED"->"EXTRACTION_FAILED";default->"MANUAL_REVIEW_REQUIRED";};}
    private static Map<String,Object> failedRead(UUID patient,String name,String fingerprint,Exception error){var out=new LinkedHashMap<String,Object>();out.put("success",false);out.put("patientId",patient.toString());out.put("fileName",name);out.put("fingerprint",fingerprint);out.put("source","UPLOADED_PDF");out.put("status","EXTRACTION_FAILED");out.put("identityStatus","UNVERIFIED");out.put("extractionMethod","NOT_COMPLETED");out.put("extractedValues",Map.of());out.put("detectedCount",0);out.put("warnings",List.of("The PDF was accepted. Automatic extraction could not be completed; enter values manually."));out.put("unrecognizedResults",List.of());return out;}
    public List<Map<String,Object>> sources(GovCarePrincipal actor,UUID patient){
        var scoped=access.clinicalScope(actor,patient,false);var visible=new ArrayList<Map<String,Object>>();
        for(var report:persistence.reports(scoped,patient)){
            if(report.get("documentId")==null)continue;
            try{documents.get(scoped,patient,UUID.fromString(report.get("documentId").toString()));visible.add(report);}
            catch(ApiException failure){if(failure.status().value()!=403&&failure.status().value()!=404)throw failure;}
        }return visible;
    }

    @Transactional public Map<String,Object> preview(GovCarePrincipal actor,UUID patient,MultipartFile file)throws IOException{
        var scoped=access.clinicalScope(actor,patient,false);validate(file);return read(scoped,patient,file.getBytes(),name(file),"UPLOADED_PDF",null);
    }
    @Transactional public Map<String,Object> previewDocument(GovCarePrincipal actor,UUID patient,UUID document)throws IOException{
        var scoped=access.clinicalScope(actor,patient,false);var content=documents.content(scoped,patient,document,false,false);
        if(!"application/pdf".equalsIgnoreCase(Objects.toString(content.document().get("mimeType"),"")))throw ApiException.badRequest("The selected document is not a PDF.");
        try(var input=content.resource().getInputStream()){return read(scoped,patient,input.readAllBytes(),Objects.toString(content.document().get("originalFileName"),"ehr-report.pdf"),"EHR_REPORT",document);}
    }
    public Map<String,Object> previewContent(GovCarePrincipal actor,UUID patient,UUID document)throws IOException{
        var scoped=access.clinicalScope(actor,patient,false);var content=documents.content(scoped,patient,document,false,false);
        if(!"application/pdf".equalsIgnoreCase(Objects.toString(content.document().get("mimeType"),"")))throw ApiException.badRequest("The selected document is not a PDF.");
        try(var input=content.resource().getInputStream()){
            byte[] bytes=input.readNBytes(15*1024*1024+1);
            if(bytes.length>15*1024*1024)throw ApiException.badRequest("PDF preview exceeds the 15 MB limit.");
            return Map.of("patientId",patient.toString(),"documentId",document.toString(),"contentType","application/pdf","fileName",Objects.toString(content.document().get("originalFileName"),"clinical-report.pdf"),"contentBase64",Base64.getEncoder().encodeToString(bytes));
        }
    }
    public Map<String,Object> previewPage(GovCarePrincipal actor,UUID patient,UUID document,int page)throws IOException{
        var scoped=access.clinicalScope(actor,patient,false);var source=documents.content(scoped,patient,document,false,false);
        if(!"application/pdf".equalsIgnoreCase(Objects.toString(source.document().get("mimeType"),"")))throw ApiException.badRequest("The selected document is not a PDF.");
        try(var input=source.resource().getInputStream()){
            byte[] bytes=input.readNBytes(15*1024*1024+1);if(bytes.length>15*1024*1024)throw ApiException.badRequest("PDF preview exceeds 15 MB.");
            try(var pdf=org.apache.pdfbox.Loader.loadPDF(bytes)){
                if(page<1||page>pdf.getNumberOfPages())throw ApiException.badRequest("Select a valid PDF page.");
                var box=pdf.getPage(page-1).getCropBox();double pixels=box.getWidth()*110d/72*box.getHeight()*110d/72;
                if(!Double.isFinite(pixels)||pixels<=0||pixels>6000000)throw ApiException.badRequest("This PDF page exceeds the bounded preview size. Open the original PDF.");
                var rendered=new org.apache.pdfbox.rendering.PDFRenderer(pdf).renderImageWithDPI(page-1,110);
                var output=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(rendered,"png",output);
                return Map.of("patientId",patient.toString(),"documentId",document.toString(),"page",page,"totalPages",pdf.getNumberOfPages(),"contentType","image/png","imageBase64",Base64.getEncoder().encodeToString(output.toByteArray()));
            }
        }
    }
    @Transactional public Map<String,Object> previewMultiple(GovCarePrincipal actor,UUID patient,List<MultipartFile> files){
        var scoped=access.clinicalScope(actor,patient,false);if(files==null||files.isEmpty()||files.size()>10)throw ApiException.badRequest("Select between one and ten PDF reports.");
        var reports=new ArrayList<Map<String,Object>>();
        for(var file:files)try{validate(file);reports.add(read(scoped,patient,file.getBytes(),name(file),"UPLOADED_PDF",null));}
        catch(IOException|ApiException failure){
            if(failure instanceof ApiException api&&(api.status().value()==401||api.status().value()==403))throw api;
            var failed=new LinkedHashMap<String,Object>();failed.put("success",false);failed.put("patientId",patient.toString());failed.put("fileName",file==null?"Unknown report":name(file));failed.put("status","EXTRACTION_FAILED");failed.put("message",failure.getMessage());failed.put("extractionMethod","NOT_COMPLETED");failed.put("extractedValues",Map.of());failed.put("detectedCount",0);failed.put("warnings",List.of("This file could not be read. Other files remain available."));failed.put("unrecognizedResults",List.of());reports.add(failed);
        }
        var grouped=new LinkedHashMap<String,List<Map<String,Object>>>();var seen=new HashSet<String>();
        for(var report:reports){if(!Boolean.TRUE.equals(report.get("success"))||"MISMATCH".equals(report.get("identityStatus"))&&!Boolean.TRUE.equals(report.get("syntheticPatient")))continue;
            var values=(Map<String,List<Map<String,Object>>>)report.getOrDefault("measurementCandidates",Map.of());
            for(var entry:values.entrySet())for(var measurement:entry.getValue()){
                String key=report.get("fingerprint")+"|"+entry.getKey()+"|"+measurement.get("value")+"|"+measurement.get("unit")+"|"+measurement.get("clinicalDate");if(!seen.add(key))continue;
                var candidate=new LinkedHashMap<>(measurement);candidate.put("sourceReport",report.get("fileName"));candidate.put("fingerprint",report.get("fingerprint"));grouped.computeIfAbsent(entry.getKey(),unused->new ArrayList<>()).add(candidate);
            }
        }
        var conflicts=new ArrayList<Map<String,Object>>();grouped.forEach((feature,values)->{if(values.stream().map(value->value.get("value")+"|"+value.get("unit")).distinct().count()>1)conflicts.add(Map.of("feature",feature,"candidates",values,"message","Compare source values and dates before approving a result."));});
        var out=new LinkedHashMap<String,Object>();out.put("patientId",patient.toString());out.put("success",true);out.put("reports",reports);out.put("mergedClinicalData",Map.of());out.put("conflicts",conflicts);out.put("warnings",List.of("Review and explicitly approve source values before changing the assessment form."));return out;
    }
    private Map<String,Object> read(GovCarePrincipal scoped,UUID patient,byte[] bytes,String filename,String source,UUID document)throws IOException{
        String fingerprint=hash(bytes);var out=new LinkedHashMap<>(extraction.extract(bytes,source));
        out.put("patientId",patient.toString());out.put("fileName",filename);out.put("fingerprint",fingerprint);out.put("reportId",fingerprint);out.put("verificationStatus","UNVERIFIED_EXTRACTION");
        String identity=identityStatus(scoped,patient,out);out.put("identityStatus",identity);
        boolean synthetic=ClinicalTestPatientPolicy.synthetic(sql,scoped,patient);out.put("syntheticPatient",synthetic);out.put("documentClassification",synthetic?"TEST_DOCUMENT":"CLINICAL_DOCUMENT");out.put("identityReviewRequired",!identity.equals("MATCHED"));
        var existing=find(scoped,patient,fingerprint);UUID foundDocument=document;
        if(existing.isPresent()){
            var saved=existing.get();out.put("clinicalReportId",saved.get("id").toString());out.put("savedVersion",saved.get("version"));if(saved.get("patient_document_id")!=null)foundDocument=UUID.fromString(saved.get("patient_document_id").toString());
            if("TEST_DOCUMENT".equals(saved.get("document_classification"))&&!synthetic)throw ApiException.forbidden("Test documents cannot be reassigned to a real clinical patient.");
        }else if(foundDocument==null){
            var attached=sql.one("select id from patient_documents where hospital_id=:h and patient_id=:p and sha256_checksum=:hash and document_status not in ('ARCHIVED','CANCELLED','REJECTED') order by created_at limit 1",params(scoped,patient,fingerprint));
            if(attached.isPresent())foundDocument=UUID.fromString(attached.get().get("id").toString());
        }
        if(foundDocument!=null){var doc=documents.get(scoped,patient,foundDocument);out.put("documentId",foundDocument.toString());out.put("report",doc);}
        out.put("saved",existing.isPresent());out.put("duplicate",existing.isPresent()||foundDocument!=null);
        if(identity.equals("MISMATCH")&&!synthetic){out.put("status","PATIENT_MISMATCH");out.put("success",false);out.put("extractedValues",Map.of());out.put("measurementCandidates",Map.of());out.put("conflicts",List.of());out.put("detectedCount",0);out.put("message","This report belongs to another patient. Select the correct patient; its values cannot be applied or saved here.");}
        else if(synthetic&&!identity.equals("MATCHED"))out.put("message","TEST_DOCUMENT: associated with the selected synthetic patient. Printed identifiers remain unverified; confirm every measurement before saving observations.");
        var stages=new ArrayList<Map<String,Object>>((List<Map<String,Object>>)out.getOrDefault("processingStages",List.of()));
        stages.addFirst(Map.of("stage","PATIENT_ACCESS","status","SUCCESS","message","Patient and document access checked before reading."));
        stages.add(Map.of("stage","PATIENT_IDENTITY","status",synthetic?"REVIEW_REQUIRED":identity.equals("MISMATCH")?"BLOCKED":identity.equals("MATCHED")?"SUCCESS":"REVIEW_REQUIRED","message",synthetic?"TEST_DOCUMENT: source identity is unverified; explicit synthetic-patient association is required.":identity.equals("MISMATCH")?"This report belongs to another patient.":identity.equals("MATCHED")?"Printed identity matches the selected patient.":"No identity match is assumed; clinician confirmation is required."));
        out.put("workflowStatus",existing.isPresent()?Objects.toString(existing.get().get("workflow_status"),workflowStatus(out.get("status").toString())):workflowStatus(out.get("status").toString()));
        stages.add(Map.of("stage","DUPLICATE_CHECK","status","SUCCESS","message",Boolean.TRUE.equals(out.get("duplicate"))?"Previously saved source available for reuse.":"No matching saved source found for this patient."));out.put("processingStages",stages);
        audit(scoped,patient,"CLINICAL_PDF_PREVIEWED",Map.of("fingerprint",fingerprint,"status",out.get("status"),"detectedCount",out.get("detectedCount"),"duplicate",out.get("duplicate")));
        return out;
    }
    @Transactional(rollbackFor=IOException.class) public Map<String,Object> save(GovCarePrincipal actor,UUID patient,MultipartFile file,UUID document,boolean identityConfirmed,UUID replaces,String reason)throws IOException{
        var scoped=access.clinicalScope(actor,patient,true);
        if(!identityConfirmed)throw ApiException.badRequest("Confirm the selected patient against the source before saving.");
        Map<String,Object> preview;
        if(document!=null)preview=previewDocument(scoped,patient,document);else{validate(file);preview=preview(scoped,patient,file);}
        if("MISMATCH".equals(preview.get("identityStatus"))&&!ClinicalTestPatientPolicy.synthetic(sql,scoped,patient))throw ApiException.unprocessable("Patient mismatch: the source cannot be attached to this patient.");
        if("EXTRACTION_FAILED".equals(preview.get("status")))throw ApiException.badRequest("Read the source successfully before saving.");
        String fingerprint=preview.get("fingerprint").toString();var p=params(scoped,patient,fingerprint);
        sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",Map.of("lock","clinical-pdf|"+scoped.hospitalId()+"|"+patient+"|"+fingerprint),"Cannot serialize source save.");
        var existing=find(scoped,patient,fingerprint);
        if(Boolean.TRUE.equals(preview.get("syntheticPatient"))){p.put("classification","TEST_DOCUMENT");sql.update("update clinical_reports set document_classification=:classification where hospital_id=:h and patient_id=:p and sha256_hash=:hash",p);sql.update("update patient_documents set document_classification=:classification where hospital_id=:h and patient_id=:p and sha256_checksum=:hash",p);}
        if(existing.isPresent()){
            var row=existing.get();if(row.get("patient_document_id")!=null)documents.get(scoped,patient,UUID.fromString(row.get("patient_document_id").toString()));
            audit(scoped,patient,"CLINICAL_PDF_SAVE_REUSED",Map.of("reportId",row.get("id").toString(),"fingerprint",fingerprint));
            return Map.of("saved",true,"duplicate",true,"patientId",patient.toString(),"clinicalReportId",row.get("id").toString(),"documentId",Objects.toString(row.get("patient_document_id"),""),"version",row.get("version"));
        }
        int version=1;
        if(replaces!=null){
            if(reason==null||reason.isBlank()||reason.length()>2000)throw ApiException.badRequest("Document a reviewed revision reason (1-2000 characters).");
            p.put("previous",replaces);var previous=sql.required("select version,sha256_hash,patient_document_id from clinical_reports where id=:previous and hospital_id=:h and patient_id=:p for update",p,"Previous report is not available for this patient.");
            if(previous.get("patient_document_id")!=null)documents.get(scoped,patient,UUID.fromString(previous.get("patient_document_id").toString()));
            version=((Number)previous.get("version")).intValue()+1;
        }
        if(preview.get("documentId")!=null)document=UUID.fromString(preview.get("documentId").toString());
        if(document==null){var uploaded=documents.upload(scoped,patient,file,"OTHER_CLINICAL_DOCUMENT",name(file),"Reviewed clinical PDF source; extracted values remain unverified.","SUBMITTED","CARE_TEAM",null,null,null,null,null,null);document=UUID.fromString(uploaded.get("id").toString());}
        var sourceDoc=documents.get(scoped,patient,document);preview.put("identityConfirmed",true);preview.put("sourceVerified",false);
        UUID report=persistence.persistExtraction(scoped,patient,document,Objects.toString(preview.get("fileName"),"clinical-report.pdf"),Objects.toString(preview.get("source"),"UPLOADED_PDF"),fingerprint,((Number)sourceDoc.getOrDefault("fileSizeBytes",file==null?0L:file.getSize())).longValue(),preview);
        if(Boolean.TRUE.equals(preview.get("syntheticPatient")))sql.update("update clinical_reports set document_classification='TEST_DOCUMENT' where id=:r and hospital_id=:h and patient_id=:p",Map.of("r",report,"h",scoped.hospitalId(),"p",patient));
        p.put("id",report);p.put("previous",replaces);p.put("reason",reason);p.put("version",version);
        sql.update("update clinical_reports set replaces_report_id=:previous,revision_reason=:reason,version=:version where id=:id and hospital_id=:h and patient_id=:p",p);
        sourceFhir(scoped,patient,report,document,Objects.toString(preview.get("fileName"),"clinical-report.pdf"),fingerprint,replaces);
        audit(scoped,patient,"CLINICAL_PDF_SOURCE_SAVED",Map.of("reportId",report.toString(),"fingerprint",fingerprint,"version",version,"sourceVerified",false,"replaces",Objects.toString(replaces,"")));
        return Map.of("saved",true,"duplicate",false,"patientId",patient.toString(),"clinicalReportId",report.toString(),"documentId",document.toString(),"version",version);
    }
    private Optional<Map<String,Object>> find(GovCarePrincipal actor,UUID patient,String hash){return sql.one("select id,patient_document_id,version,workflow_status,document_classification from clinical_reports where hospital_id=:h and patient_id=:p and sha256_hash=:hash",params(actor,patient,hash));}
    @SuppressWarnings("unchecked") private String identityStatus(GovCarePrincipal actor,UUID patient,Map<String,Object> out){
        if(Boolean.TRUE.equals(out.get("identityConflict")))return "MISMATCH";
        var declared=(Map<String,Object>)out.getOrDefault("patientIdentity",Map.of());if(declared.isEmpty())return "UNVERIFIED";
        var record=sql.required("select patient_no,nic,full_name from patients where hospital_id=:h and id=:p",Map.of("h",actor.hospitalId(),"p",patient),"Patient not found.");
        for(String key:List.of("patientNumber","nic","patientName"))if(declared.containsKey(key)){
            String column=key.equals("patientNumber")?"patient_no":key.equals("patientName")?"full_name":"nic";
            if(!identifier(declared.get(key)).equals(identifier(record.get(column))))return "MISMATCH";
        }return "MATCHED";
    }
    private void sourceFhir(GovCarePrincipal actor,UUID patient,UUID report,UUID document,String filename,String fingerprint,UUID previous){
        String id="clinical-report-"+report;var body=new LinkedHashMap<String,Object>();body.put("resourceType","DocumentReference");body.put("id",id);body.put("status","current");body.put("docStatus","preliminary");body.put("subject",Map.of("identifier",Map.of("system","urn:govcare:patient-id","value",patient.toString())));body.put("date",Instant.now().toString());
        body.put("content",List.of(Map.of("attachment",Map.of("contentType","application/pdf","title",filename,"url","/api/patients/"+patient+"/documents/"+document+"/content"))));
        body.put("description","Source PDF; extracted text is unverified. SHA-256: "+fingerprint);
        body.put("meta",Map.of("tag",List.of(Map.of("system","urn:govcare:document-classification","code",ClinicalTestPatientPolicy.synthetic(sql,actor,patient)?"TEST_DOCUMENT":"CLINICAL_DOCUMENT"))));
        if(previous!=null)body.put("relatesTo",List.of(Map.of("code","replaces","target",Map.of("reference","DocumentReference/clinical-report-"+previous))));
        storeFhir(actor,patient,"DocumentReference",id,body);
        var provenance=Map.of("resourceType","Provenance","id","clinical-source-"+report,"target",List.of(Map.of("reference","DocumentReference/"+id)),"recorded",Instant.now().toString(),"agent",List.of(Map.of("who",Map.of("identifier",Map.of("system","urn:govcare:user","value",actor.id().toString())))));
        storeFhir(actor,patient,"Provenance","clinical-source-"+report,provenance);
    }
    private void storeFhir(GovCarePrincipal actor,UUID patient,String type,String id,Map<String,?> body){sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values(:type,:id,:p,:h,cast(:body as jsonb)) on conflict(hospital_id,resource_type,resource_id) do nothing",Map.of("type",type,"id",id,"p",patient,"h",actor.hospitalId(),"body",json.write(body)));}
    private void audit(GovCarePrincipal actor,UUID patient,String action,Map<String,Object> details){var p=new HashMap<String,Object>();p.put("h",actor.hospitalId());p.put("p",patient);p.put("actor",actor.id());p.put("role",actor.role());p.put("action",action);p.put("details",json.write(details));sql.update("insert into audit_logs(hospital_id,actor_id,actor_role,module,action,entity_type,entity_id,after_state) values(:h,:actor,cast(:role as user_role),'ai_cdss',:action,'patients',:p,cast(:details as jsonb))",p);}
    private static Map<String,Object> params(GovCarePrincipal actor,UUID patient,String hash){var p=new HashMap<String,Object>();p.put("h",actor.hospitalId());p.put("p",patient);p.put("hash",hash);return p;}
    private static String identifier(Object value){return Objects.toString(value,"").replaceAll("[^\\p{L}\\p{N}]","").toUpperCase(Locale.ROOT);}
    private static String name(MultipartFile file){return Objects.toString(file.getOriginalFilename(),"clinical-report.pdf");}
    private static void validate(MultipartFile file){if(file==null||file.isEmpty())throw ApiException.badRequest("Select a PDF report.");if(file.getSize()>15*1024*1024)throw ApiException.badRequest("PDF exceeds the 15 MB limit.");}
    private static String hash(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException("SHA-256 unavailable",e);}}
}
