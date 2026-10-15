package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.ai.predictive.*;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PredictiveIntelligenceSecurityTest {
    private final UUID hospital=UUID.randomUUID(), patient=UUID.randomUUID(), user=UUID.randomUUID();
    private GovCarePrincipal actor(String role,Set<String> permissions) {
        return new GovCarePrincipal(user,hospital,null,null,"test@govcare.test","Test",role,permissions,true,false,1);
    }
    @Test void deniedReadCannotReachClinicalDataQueries() {
        SqlSupport sql=mock(SqlSupport.class); ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);
        GovCarePrincipal doctor=actor("doctor",Set.of("PATIENT_VIEW_CLINICAL"));
        when(access.clinicalScope(doctor,patient,false)).thenThrow(ApiException.forbidden("Not assigned"));
        PredictiveIntelligenceService service=new PredictiveIntelligenceService(
                sql,
                mock(JsonSupport.class),
                new ObjectMapper(),
                access,
                mock(CkdProgressionForecastService.class),
                mock(KidneyFailureRiskCalculator.class)
        );
        assertThrows(ApiException.class,()->service.overview(doctor,patient));
        verifyNoInteractions(sql);
    }
    @Test void reviewRequiresClinicalWriteBeforeClinicalDataQueries() {
        SqlSupport sql=mock(SqlSupport.class); ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);
        GovCarePrincipal doctor=actor("doctor",Set.of("PATIENT_VIEW_CLINICAL"));
        when(access.clinicalScope(doctor,patient,true)).thenThrow(ApiException.forbidden("Write permission required"));
        PredictiveIntelligenceService service=new PredictiveIntelligenceService(
                sql,
                mock(JsonSupport.class),
                new ObjectMapper(),
                access,
                mock(CkdProgressionForecastService.class),
                mock(KidneyFailureRiskCalculator.class)
        );
        var request=new PredictiveIntelligenceService.ReviewRequest(patient,UUID.randomUUID(),0,"evidence","ACCEPT","Reviewed",null);
        assertThrows(ApiException.class,()->service.review(doctor,UUID.randomUUID(),request));
        verifyNoInteractions(sql);
    }
    @Test void assignedDoctorRelationshipAndHospitalAreBothRequired() {
        SqlSupport sql=mock(SqlSupport.class);ClinicalPatientAccess access=new ClinicalPatientAccess(sql);
        GovCarePrincipal doctor=actor("doctor",Set.of("PATIENT_VIEW_CLINICAL","CONSULTATION_UPDATE"));
        when(sql.required(anyString(),anyMap(),anyString())).thenAnswer(call->call.getArgument(0,String.class).contains(" related")?Map.of("related",false):Map.of("id",patient,"hospital_id",hospital));
        assertThrows(ApiException.class,()->access.clinicalScope(doctor,patient,false));
        when(sql.required(anyString(),anyMap(),anyString())).thenAnswer(call->call.getArgument(0,String.class).contains(" related")?Map.of("related",true):Map.of("id",patient,"hospital_id",hospital));
        assertEquals(hospital,access.clinicalScope(doctor,patient,true).hospitalId());
        when(sql.required(contains("from patients"),anyMap(),anyString())).thenThrow(ApiException.notFound("Patient not found"));
        assertThrows(ApiException.class,()->access.clinicalScope(doctor,patient,false));
    }
    @Test void verifiedMeasurementStillRequiresAssignedClinicalWrite() {
        SqlSupport sql=mock(SqlSupport.class);ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);
        GovCarePrincipal doctor=actor("doctor",Set.of("PATIENT_VIEW_CLINICAL"));
        when(access.clinicalScope(doctor,patient,true)).thenThrow(ApiException.forbidden("Write permission required"));
        PredictiveIntelligenceService service=new PredictiveIntelligenceService(
                sql,
                mock(JsonSupport.class),
                new ObjectMapper(),
                access,
                mock(CkdProgressionForecastService.class),
                mock(KidneyFailureRiskCalculator.class)
        );
        var request=new PredictiveIntelligenceService.MeasurementRequest(UUID.randomUUID(),"egfr",60.0,"mL/min/1.73m2",java.time.Instant.parse("2026-01-01T12:00:00Z"),null,null,"Verified source",true);
        assertThrows(ApiException.class,()->service.recordMeasurement(doctor,patient,request));verifyNoInteractions(sql);
    }
    @Test void administrativeAndPatientRolesDoNotGainClinicalWorkspaceAccess() {
        for(String role:List.of("hospital_admin","nurse","patient","guardian","receptionist","pathologist","ict_admin")) {
            SqlSupport sql=mock(SqlSupport.class);when(sql.required(anyString(),anyMap(),anyString())).thenReturn(Map.of("id",patient,"hospital_id",hospital));
            assertThrows(ApiException.class,()->new ClinicalPatientAccess(sql).clinicalScope(actor(role,Set.of("*")),patient,false),role);
        }
    }
    @Test void authorizedNetworkSuperAdminUsesStoredPatientHospital() {
        SqlSupport sql=mock(SqlSupport.class);UUID other=UUID.randomUUID();
        when(sql.required(anyString(),anyMap(),anyString())).thenReturn(Map.of("id",patient,"hospital_id",other));
        GovCarePrincipal scoped=new ClinicalPatientAccess(sql).clinicalScope(actor("super_admin",Set.of("*")),patient,true);
        assertEquals(other,scoped.hospitalId());assertEquals(user,scoped.id());assertNull(scoped.departmentId());
    }

    @Test void inactiveTrajectoryRegistryFailsClosedBeforeCalculation() {
        SqlSupport sql=mock(SqlSupport.class);
        ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);
        LongitudinalClinicalFeatureService longitudinal=mock(LongitudinalClinicalFeatureService.class);
        CkdProgressionForecastService forecast=mock(CkdProgressionForecastService.class);
        GovCarePrincipal doctor=actor("doctor",Set.of("PATIENT_VIEW_CLINICAL"));
        var quality=new ClinicalIntelligenceEngine.Quality(0,0,0,7,null,"Test policy",
                ClinicalDataQualityService.REQUIRED,List.of());
        var analysis=new ClinicalIntelligenceEngine.Analysis(java.time.Instant.parse("2026-10-01T00:00:00Z"),
                ClinicalIntelligenceEngine.RULE_VERSION,List.of(),quality,
                new ClinicalIntelligenceEngine.Classification(null,null,"NOT_ESTABLISHED","No data"),
                new ClinicalIntelligenceEngine.Safety("INSUFFICIENT_DATA",true,List.of("No renal history"),"Test policy"),List.of());
        var medications=new LongitudinalClinicalFeatureService.MedicationContext(List.of(),List.of(),false,false,"Unavailable");
        when(longitudinal.load(doctor,patient,false)).thenReturn(new LongitudinalClinicalFeatureService.LoadedClinicalData(
                doctor,Map.of("id",patient,"gender","female"),analysis,false,medications,java.time.LocalDate.of(1970,1,1)));
        when(sql.one(anyString(),anyMap())).thenReturn(Optional.empty());
        PredictiveIntelligenceService service=new PredictiveIntelligenceService(sql,mock(JsonSupport.class),new ObjectMapper(),
                access,forecast,new KidneyFailureRiskCalculator(),longitudinal,new HyperkalemiaRiskService(),
                new AnemiaRiskService(),new CardiovascularRiskCalculator());

        var result=service.risk(doctor,patient,"ckd_progression");

        assertEquals("NOT_INSTALLED",result.status());
        assertEquals("NOT_INSTALLED",result.runtimeStatus());
        assertNull(result.probability());
        verifyNoInteractions(forecast);
    }
}
