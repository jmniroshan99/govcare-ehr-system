package lk.gov.health.govcare.dashboard;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import lk.gov.health.govcare.security.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DashboardRoleAccessTest {
    private final UUID hospital = UUID.randomUUID();
    private final SqlSupport sql = mock(SqlSupport.class);
    private final DashboardIntelligenceService service = new DashboardIntelligenceService(sql);
    private static final Map<String,String> DASHBOARDS = Map.ofEntries(
            Map.entry("super_admin","super_admin"),Map.entry("hospital_admin","hospital_admin"),
            Map.entry("doctor","doctor"),Map.entry("surgeon","doctor"),Map.entry("anesthetist","doctor"),
            Map.entry("nurse","nurse"),Map.entry("receptionist","front_desk"),Map.entry("opd_officer","opd"),
            Map.entry("ward_manager","ward"),Map.entry("lab_technician","laboratory"),Map.entry("lab_manager","laboratory"),
            Map.entry("pathologist","laboratory"),Map.entry("radiology_technician","radiology"),Map.entry("radiologist","radiology"),
            Map.entry("pharmacist","pharmacy"),Map.entry("inventory_officer","inventory"),Map.entry("finance_officer","finance"),
            Map.entry("records_officer","records"),Map.entry("patient","patient"),Map.entry("guardian","guardian"),
            Map.entry("emergency_staff","emergency"),Map.entry("quality_officer","quality"),Map.entry("ict_admin","it"),
            Map.entry("mortuary_officer","mortuary"));

    @ParameterizedTest
    @EnumSource(UserRole.class)
    void eachRoleSelectsItsOwnDashboard(UserRole role) {
        when(sql.required(anyString(),anyMap(),anyString())).thenReturn(Map.of("id",hospital.toString(),"name","Local hospital"));
        when(sql.list(anyString(),anyMap())).thenReturn(List.of());
        Map<String,Object> result=service.dashboard(actor(role.name(),Set.of("*"),true,false),null);
        assertEquals(role.name(),result.get("role"));
        assertEquals(DASHBOARDS.get(role.name()),result.get("dashboardKey"));
    }

    @ParameterizedTest
    @EnumSource(value=UserRole.class,names="super_admin",mode=EnumSource.Mode.EXCLUDE)
    void everyNonSuperRoleRejectsCrossHospitalOverrideBeforeDatabaseRead(UserRole role) {
        assertEquals(403,assertThrows(ApiException.class,()->service.dashboard(
                actor(role.name(),Set.of("*"),true,false),UUID.randomUUID())).status().value());
        verifyNoInteractions(sql);
    }

    @Test
    void doctorWithRevokedClinicalPermissionsReceivesNoClinicalQueries() {
        when(sql.required(anyString(),anyMap(),anyString())).thenReturn(Map.of("id",hospital.toString(),"name","Local hospital"));
        Map<String,Object> result=service.dashboard(actor("doctor",Set.of("DASHBOARD_VIEW","APPOINTMENT_VIEW"),true,false),null);
        Map<?,?> metric=(Map<?,?>)((List<?>)result.get("metrics")).getFirst();
        assertEquals(false,metric.get("available"));
        assertEquals("not_authorized",metric.get("reason"));
        verify(sql,never()).list(anyString(),anyMap());
        verify(sql,never()).required(contains("doctor_id=:actorId"),anyMap(),anyString());
    }

    @Test
    void reportPermissionDoesNotGrantInventoryData() {
        when(sql.required(anyString(),anyMap(),anyString())).thenReturn(Map.of("id",hospital.toString(),"name","Local hospital"));
        Map<String,Object> result=service.dashboard(actor("inventory_officer",Set.of("DASHBOARD_VIEW","REPORT_VIEW"),true,false),null);
        Map<?,?> metric=(Map<?,?>)((List<?>)result.get("metrics")).getFirst();
        assertEquals("not_authorized",metric.get("reason"));
        verify(sql,never()).list(anyString(),anyMap());
    }

    @Test
    void inactiveAndTemporaryPasswordAccountsCannotReadDashboardData() {
        assertThrows(ApiException.class,()->service.dashboard(actor("doctor",Set.of("*"),false,false),null));
        assertThrows(ApiException.class,()->service.dashboard(actor("doctor",Set.of("*"),true,true),null));
        verifyNoInteractions(sql);
    }

    @Test
    void nurseCannotBypassAssignmentScopeThroughLegacyOverview() {
        DashboardService legacy=new DashboardService(sql);
        assertEquals(403,assertThrows(ApiException.class,()->legacy.overview(
                actor("nurse",Set.of("*"),true,false),null)).status().value());
        verifyNoInteractions(sql);
    }

    private GovCarePrincipal actor(String role,Set<String> permissions,boolean active,boolean temporary) {
        return new GovCarePrincipal(UUID.randomUUID(),hospital,null,null,role+"@example.test","Test account",
                role,permissions,active,temporary,0);
    }
}
