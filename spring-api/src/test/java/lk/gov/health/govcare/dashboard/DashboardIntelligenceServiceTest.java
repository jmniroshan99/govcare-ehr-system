package lk.gov.health.govcare.dashboard;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DashboardIntelligenceServiceTest {
    private final SqlSupport sql = mock(SqlSupport.class);
    private final DashboardIntelligenceService service = new DashboardIntelligenceService(sql);
    private final UUID hospitalId = UUID.randomUUID();

    @Test
    void rejectsRoleWithoutDashboardPermission() {
        GovCarePrincipal actor = actor("opd_officer", Set.of("QUEUE_VIEW"), hospitalId, null, null);
        assertEquals(403, assertThrows(ApiException.class, () -> service.dashboard(actor, null)).status().value());
        verify(sql, never()).required(anyString(), anyMap(), anyString());
    }

    @Test
    void rejectsCrossHospitalOverrideBeforeDashboardQueries() {
        GovCarePrincipal actor = actor("opd_officer", Set.of("DASHBOARD_VIEW", "QUEUE_VIEW"), hospitalId, null, null);
        assertEquals(403, assertThrows(ApiException.class,
                () -> service.dashboard(actor, UUID.randomUUID())).status().value());
        verify(sql, never()).required(anyString(), anyMap(), anyString());
    }

    @Test
    void superAdminWithoutSelectionReceivesNetworkScope() {
        when(sql.required(anyString(), anyMap(), anyString())).thenReturn(Map.of(
                "total_hospitals", 2, "total_users", 12, "active_doctors", 4, "active_nurses", 5,
                "total_patients", 100, "daily_visits", 8, "security_alerts", 1));
        when(sql.list(anyString(), anyMap())).thenReturn(List.of());

        Map<String, Object> response = service.dashboard(actor("super_admin", Set.of("*"), null, null, null), null);
        Map<?, ?> scope = (Map<?, ?>) response.get("scope");

        assertEquals("network", scope.get("level"));
        assertNull(scope.get("hospitalId"));
        assertEquals("super_admin", response.get("dashboardKey"));
        verify(sql, never()).required(org.mockito.ArgumentMatchers.contains("from hospitals where id="), anyMap(), anyString());
    }

    @Test
    void doctorQueriesAreBoundToAuthenticatedClinician() {
        UUID doctorId = UUID.randomUUID();
        when(sql.required(anyString(), anyMap(), anyString())).thenAnswer(call -> {
            String query = call.getArgument(0);
            if (query.contains("from hospitals where id=")) return Map.of("id", hospitalId.toString(), "name", "Hospital A");
            return Map.of("appointments_today", 1, "waiting_patients", 2, "completed_consultations", 3,
                    "pending_reports", 4, "critical_patients", 1, "ckd_high_risk", 1);
        });
        when(sql.list(anyString(), anyMap())).thenReturn(List.of());
        GovCarePrincipal doctor = new GovCarePrincipal(doctorId, hospitalId, UUID.randomUUID(), null,
                "doctor@example.test", "Doctor", "doctor", Set.of("*"), true, false, 0);

        Map<String, Object> response = service.dashboard(doctor, null);

        assertEquals("doctor", response.get("dashboardKey"));
        verify(sql).required(org.mockito.ArgumentMatchers.contains("doctor_id=:actorId"),
                org.mockito.ArgumentMatchers.argThat(params -> doctorId.equals(params.get("actorId"))), anyString());
    }

    @Test
    void patientDashboardUsesOnlyPrincipalPatientIdAndReleasedSources() {
        UUID patientId = UUID.randomUUID();
        when(sql.required(anyString(), anyMap(), anyString())).thenAnswer(call -> {
            String query = call.getArgument(0);
            if (query.contains("from hospitals where id=")) return Map.of("id", hospitalId.toString(), "name", "Hospital A");
            return Map.of("upcoming_appointments", 1, "released_prescriptions", 2,
                    "released_lab_reports", 3, "released_radiology_reports", 4);
        });
        when(sql.list(anyString(), anyMap())).thenReturn(List.of());
        GovCarePrincipal patient = actor("patient", Set.of("DASHBOARD_VIEW", "PATIENT_VIEW_SELF", "APPOINTMENT_VIEW",
                "PRESCRIPTION_VIEW", "LAB_REQUEST_VIEW", "RADIOLOGY_REQUEST_VIEW"), hospitalId, null, patientId);

        Map<String, Object> response = service.dashboard(patient, null);

        assertEquals("patient", response.get("dashboardKey"));
        verify(sql).required(org.mockito.ArgumentMatchers.contains("patient_id=:patientId"),
                org.mockito.ArgumentMatchers.argThat(params -> patientId.equals(params.get("patientId"))), anyString());
        verify(sql).required(org.mockito.ArgumentMatchers.contains("release_status='released'"), anyMap(), anyString());
    }

    @Test
    void nurseDoesNotReceiveHospitalPatientDataWithoutAssignmentModel() {
        when(sql.required(org.mockito.ArgumentMatchers.contains("from hospitals where id="), anyMap(), anyString()))
                .thenReturn(Map.of("id", hospitalId.toString(), "name", "Hospital A"));
        GovCarePrincipal nurse = actor("nurse", Set.of("DASHBOARD_VIEW"), hospitalId, null, null);

        Map<String, Object> response = service.dashboard(nurse, null);
        List<?> metrics = (List<?>) response.get("metrics");
        Map<?, ?> first = (Map<?, ?>) metrics.getFirst();

        assertEquals("nurse", response.get("dashboardKey"));
        assertFalse((Boolean) first.get("available"));
        assertEquals("no_source", first.get("reason"));
        verify(sql, never()).list(org.mockito.ArgumentMatchers.contains("join patients"), anyMap());
    }

    @Test
    void financeDashboardNeverInventsZerosWhenNoLedgerExists() {
        when(sql.required(org.mockito.ArgumentMatchers.contains("from hospitals where id="), anyMap(), anyString()))
                .thenReturn(Map.of("id", hospitalId.toString(), "name", "Hospital A"));
        Map<String, Object> response = service.dashboard(actor("finance_officer", Set.of("DASHBOARD_VIEW", "FINANCE_VIEW"), hospitalId, null, null), null);
        List<?> metrics = (List<?>) response.get("metrics");

        assertEquals("finance", response.get("dashboardKey"));
        assertTrue(metrics.stream().map(item -> (Map<?, ?>) item).allMatch(item -> Boolean.FALSE.equals(item.get("available"))));
        assertTrue(metrics.stream().map(item -> (Map<?, ?>) item).allMatch(item -> item.get("value") == null));
        verify(sql, never()).list(anyString(), anyMap());
    }

    private GovCarePrincipal actor(String role, Set<String> permissions, UUID hospital, UUID department, UUID patient) {
        return new GovCarePrincipal(UUID.randomUUID(), hospital, department, patient,
                role + "@example.test", "Test User", role, permissions, true, false, 0);
    }
}
