package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.springframework.stereotype.Service;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;
import java.io.*;

/** Immutable synthetic fixtures; each import goes through normal authorized patient-scoped upload. */
@Service public class ClinicalTestDocumentLibrary {
 private static final Map<String,String> CATALOG=new LinkedHashMap<>();
 static {CATALOG.put("comprehensive","Comprehensive CKD laboratory report");CATALOG.put("renal","Renal function report");CATALOG.put("cbc","Complete blood count");CATALOG.put("electrolytes","Electrolyte report");CATALOG.put("hemodialysis","Hemodialysis report");CATALOG.put("urine-acr","Urine ACR report");CATALOG.put("multipage","Multi-page laboratory report");CATALOG.put("scanned","Scanned / image-only report");}
 private final ClinicalPatientAccess access;private final SqlSupport sql;private final ClinicalPdfImportService imports;
 public ClinicalTestDocumentLibrary(ClinicalPatientAccess access,SqlSupport sql,ClinicalPdfImportService imports){this.access=access;this.sql=sql;this.imports=imports;}
 private GovCarePrincipal require(GovCarePrincipal actor,UUID patient,boolean write){var scoped=access.clinicalScope(actor,patient,write);if(!ClinicalTestPatientPolicy.synthetic(sql,scoped,patient))throw ApiException.forbidden("The clinical test library is available only for designated synthetic patients.");return scoped;}
 public Map<String,Object> list(GovCarePrincipal actor,UUID patient){var scoped=require(actor,patient,false);return Map.of("patientId",patient,"hospitalId",scoped.hospitalId(),"synthetic",true,"items",CATALOG.entrySet().stream().map(e->Map.of("id",e.getKey(),"title",e.getValue(),"fileName",e.getKey()+".pdf","imageOnly",e.getKey().equals("scanned"))).toList());}
 public byte[] content(GovCarePrincipal actor,UUID patient,String key)throws IOException{require(actor,patient,false);return bytes(key);}
 @org.springframework.transaction.annotation.Transactional(rollbackFor=IOException.class)
 public Map<String,Object> use(GovCarePrincipal actor,UUID patient,String key)throws IOException{
  var scoped=require(actor,patient,true);byte[] bytes=bytes(key);var output=imports.upload(actor,patient,new Fixture(key+".pdf",bytes));
  sql.update("insert into audit_logs(hospital_id,actor_id,actor_role,module,action,entity_type,entity_id,after_state) values(:h,:actor,cast(:role as user_role),'ai_cdss','CLINICAL_TEST_LIBRARY_USED','patients',:p,cast(:data as jsonb))",Map.of("h",scoped.hospitalId(),"p",patient,"actor",actor.id(),"role",actor.role(),"data","{\"fixture\":\""+key+"\",\"classification\":\"TEST_DOCUMENT\"}"));return output;
 }
 private byte[] bytes(String key)throws IOException{if(!CATALOG.containsKey(key))throw ApiException.notFound("Test document not found.");try(var input=new ClassPathResource("clinical-test-documents/"+key+".pdf").getInputStream()){return input.readAllBytes();}}
 private record Fixture(String filename,byte[] bytes)implements MultipartFile{
  public String getName(){return "file";}public String getOriginalFilename(){return filename;}public String getContentType(){return "application/pdf";}public boolean isEmpty(){return bytes.length==0;}public long getSize(){return bytes.length;}public byte[] getBytes(){return bytes;}public InputStream getInputStream(){return new ByteArrayInputStream(bytes);}public void transferTo(File target)throws IOException{java.nio.file.Files.write(target.toPath(),bytes);}
 }
}
