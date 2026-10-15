package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** Opt-in JDBC integration against the disposable schema created by the submission QA runner. */
@EnabledIfSystemProperty(named="govcare.ckd.persistence.jdbc",matches="true")
@Execution(ExecutionMode.SAME_THREAD)
class CkdSubmissionPersistenceJdbcTest {
    private static SingleConnectionDataSource ds;
    private SqlSupport sql;
    private TransactionTemplate transaction;
    private ClinicalPredictionFeatureService features;
    private CkdPredictionService predictions;
    private UUID hospital,patient,user;
    private GovCarePrincipal actor;

    @BeforeAll static void connect() throws Exception {
        String url=System.getProperty("govcare.ckd.persistence.url","");
        assertTrue(url.startsWith("jdbc:postgresql://127.0.0.1:"),"QA JDBC must use the loopback disposable database");
        // One real JDBC session keeps the single-backend PGlite socket adapter deterministic.
        // This fixture does not replace the production Hikari datasource or its connection settings.
        ds=new SingleConnectionDataSource(url,"postgres","postgres",true);ds.initConnection();
    }
    @AfterAll static void disconnect(){if(ds!=null)ds.destroy();}
    @BeforeEach void setup(){
        var mapper=new ObjectMapper().findAndRegisterModules();
        sql=new SqlSupport(new NamedParameterJdbcTemplate(ds),mapper);
        // Fail before any writes if accidentally pointed at a normal patient database.
        assertEquals("DISPOSABLE_CKD_SUBMISSION_QA",sql.required("select purpose from govcare_ckd_submission_qa_marker",Map.of(),"QA marker required").get("purpose"));
        transaction=new TransactionTemplate(new DataSourceTransactionManager(ds));
        var access=new ClinicalPatientAccess(sql);
        features=new ClinicalPredictionFeatureService(sql,access,mapper);
        predictions=new CkdPredictionService(sql,new JsonSupport(mapper),new CkdStageClassificationService(),access,features);
        hospital=UUID.randomUUID();patient=UUID.randomUUID();user=UUID.randomUUID();
        sql.update("insert into hospitals(id,code,name) values(:id,:code,'Operational submission QA')",Map.of("id",hospital,"code","SUBMISSION-"+hospital));
        sql.update("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth) values(:id,:h,:number,'Operational fixture; not a clinical subject','1970-01-01')",Map.of("id",patient,"h",hospital,"number","SUBMISSION-"+patient));
        sql.update("insert into app_users(id,hospital_id,full_name,email,password_hash,role) values(:id,:h,'Operational administrator',:email,'NOT_A_LOGIN_HASH',cast('super_admin' as user_role))",Map.of("id",user,"h",hospital,"email",user+"@govcare.test"));
        actor=new GovCarePrincipal(user,hospital,null,null,user+"@govcare.test","Operational administrator","super_admin",Set.of("*"),true,false,1);
    }

    private CkdDtos.PredictionRequest request(String id,boolean dated){
        var values=new LinkedHashMap<String,BigDecimal>();
        Map<String,Double> raw=Map.ofEntries(
            Map.entry("Age",56d),Map.entry("BMI",28d),Map.entry("SystolicBP",148d),Map.entry("DiastolicBP",92d),
            Map.entry("FastingBloodSugar",140d),Map.entry("HbA1c",7.1d),Map.entry("SerumCreatinine",2d),
            Map.entry("BUNLevels",30d),Map.entry("GFR",35d),Map.entry("ProteinInUrine",21d),Map.entry("ACR",21d),
            Map.entry("SerumElectrolytesPotassium",2d),Map.entry("HemoglobinLevels",3d),Map.entry("Edema",1d),
            Map.entry("FamilyHistoryKidneyDisease",1d),Map.entry("PreviousAcuteKidneyInjury",1d),Map.entry("NSAIDsUse",3d));
        raw.forEach((k,v)->values.put(k,BigDecimal.valueOf(v)));
        var sources=new LinkedHashMap<String,Map<String,Object>>();
        raw.forEach((k,v)->sources.put(k,dated?Map.of("source","MANUAL","clinicalDate","2026-01-01T00:00:00Z"):Map.of("source","MANUAL")));
        return new CkdDtos.PredictionRequest(patient.toString(),id,values,sources);
    }
    private Map<String,Object> save(CkdDtos.PredictionRequest q){return transaction.execute(s->predictions.predict(actor,q));}
    private int count(String table){
        return ((Number)sql.required("select count(*) total from "+table+" where hospital_id=:h and patient_id=:p",Map.of("h",hospital,"p",patient),"Count required").get("total")).intValue();
    }
    private int audits(){return ((Number)sql.required("select count(*) total from audit_logs where actor_id=:u and action='CKD_CLINICAL_FEATURES_NORMALIZED'",Map.of("u",user),"Audit count required").get("total")).intValue();}

    @Test void undatedManualSubmissionPersistsInputsFeaturesAuditAndFhir(){
        var output=save(request(UUID.randomUUID().toString(),false));var id=UUID.fromString(output.get("predictionId").toString());
        assertEquals(1,count("ai_ckd_predictions"));assertEquals(1,count("ai_assessments"));assertEquals(17,count("clinical_observations"));assertEquals(1,count("clinical_prediction_features"));assertEquals(3,count("fhir_resource"));assertEquals(1,audits());
        var row=sql.required("select potassium,hemoglobin,observation_date from clinical_prediction_features where source_assessment_id=:a",Map.of("a",id),"Projection required");
        assertEquals(2,((Number)row.get("potassium")).doubleValue());assertEquals(3,((Number)row.get("hemoglobin")).doubleValue());assertNull(row.get("observation_date"));
        var audit=sql.required("select module,actor_role::text role,after_state from audit_logs where actor_id=:u and entity_id=:a",Map.of("u",user,"a",id),"Audit required");
        assertEquals("ai_cdss",audit.get("module"));assertEquals("super_admin",audit.get("role"));assertEquals(id.toString(),((Map<?,?>)audit.get("after_state")).get("assessmentId"));
        var loaded=features.load(actor,patient,id);assertEquals(1,loaded.snapshots().size());assertEquals(0,loaded.observations().size());assertFalse(loaded.truncated());
        assertEquals(3,loaded.snapshots().getFirst().path("features").path("hemoglobin").path("value").asDouble());
    }

    @Test void explicitMeasurementDatesSurviveTheRealJdbcRoundTrip(){
        var output=save(request(UUID.randomUUID().toString(),true));var id=UUID.fromString(output.get("predictionId").toString());
        var row=sql.required("select observation_date from clinical_prediction_features where source_assessment_id=:a",Map.of("a",id),"Projection required");
        assertEquals(Instant.parse("2026-01-01T00:00:00Z"),((Timestamp)row.get("observation_date")).toInstant());
        assertEquals(1,audits());assertEquals(1,features.load(actor,patient,id).snapshots().size());
    }

    @Test void retryOfTheSameRequestDoesNotCreateAnotherAssessmentOrAudit(){
        var q=request(UUID.randomUUID().toString(),false);save(q);
        var failure=assertThrows(ApiException.class,()->save(q));assertEquals(409,failure.status().value());
        assertEquals(1,count("ai_ckd_predictions"));assertEquals(1,count("clinical_prediction_features"));assertEquals(17,count("clinical_observations"));assertEquals(3,count("fhir_resource"));assertEquals(1,audits());
    }

    @Test void genuineAuditFailureRollsBackAllAssessmentRecords(){
        String function="qa_reject_audit_"+user.toString().replace("-","");String trigger=function+"_trigger";
        sql.update("create function "+function+"() returns trigger language plpgsql as $$begin raise exception 'Operational QA injected audit failure';end$$",Map.of());
        sql.update("create trigger "+trigger+" before insert on audit_logs for each row when (new.actor_id='"+user+"'::uuid) execute function "+function+"()",Map.of());
        try{
            var failure=assertThrows(DataAccessException.class,()->save(request(UUID.randomUUID().toString(),false)));
            assertTrue(failure.getMostSpecificCause().getMessage().contains("Operational QA injected audit failure"));
            assertEquals(0,count("ai_ckd_predictions"));assertEquals(0,count("ai_assessments"));assertEquals(0,count("clinical_prediction_features"));assertEquals(0,count("clinical_observations"));assertEquals(0,count("fhir_resource"));assertEquals(0,audits());
        }finally{sql.update("drop trigger "+trigger+" on audit_logs",Map.of());sql.update("drop function "+function+"()",Map.of());}
    }

    @Test void networkSuperAdminAuditAndProjectionUseTheSelectedPatientsHospital(){
        var target=UUID.randomUUID();sql.update("insert into hospitals(id,code,name) values(:id,:code,'Operational network tenant')",Map.of("id",target,"code","NETWORK-"+target));
        sql.update("update patients set hospital_id=:h where id=:p",Map.of("h",target,"p",patient));
        var output=save(request(UUID.randomUUID().toString(),false));var id=UUID.fromString(output.get("predictionId").toString());
        var projection=sql.required("select hospital_id from clinical_prediction_features where source_assessment_id=:a",Map.of("a",id),"Projection required");
        var audit=sql.required("select hospital_id from audit_logs where actor_id=:u and entity_id=:a",Map.of("u",user,"a",id),"Audit required");
        assertEquals(target,projection.get("hospital_id"));assertEquals(target,audit.get("hospital_id"));assertEquals(1,audits());
    }
}
