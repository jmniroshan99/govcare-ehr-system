package lk.gov.health.govcare.dashboard;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DashboardServiceTest {
    private final SqlSupport sql = mock(SqlSupport.class);
    private final DashboardService dashboard = new DashboardService(sql);
    private final UUID assigned = UUID.randomUUID();

    @Test
    void rejectsAnotherHospitalBeforeAnyDataQuery() {
        GovCarePrincipal nurse = actor("nurse", Set.of("QUEUE_VIEW"));
        assertEquals(403, assertThrows(ApiException.class,
                () -> dashboard.overview(nurse, UUID.randomUUID())).status().value());
        verify(sql, never()).required(anyString(), anyMap(), anyString());
    }

    @Test
    void patientCannotObtainAggregateOrQueueDataEvenWithAnOverride() {
        GovCarePrincipal patient = actor("patient", Set.of("QUEUE_VIEW", "PATIENT_VIEW"));
        assertEquals(403, assertThrows(ApiException.class,
                () -> dashboard.overview(patient, null)).status().value());
        verify(sql, never()).required(anyString(), anyMap(), anyString());
    }

    @Test
    void boundsHospitalAdminDashboardToTheColomboCalendarDay() {
        when(sql.required(anyString(), anyMap(), anyString())).thenAnswer(call -> {
            String query = call.getArgument(0);
            return query.contains("from hospitals")
                    ? Map.of("id", assigned.toString(), "name", "Hospital A")
                    : Map.of("value", 0);
        });
        when(sql.list(anyString(), anyMap())).thenReturn(List.of());
        GovCarePrincipal admin = actor("hospital_admin", Set.of("QUEUE_VIEW"));
        Map<String, Object> result = dashboard.overview(admin, null);

        assertEquals(assigned.toString(), result.get("hospitalId"));
        assertTrue(((Map<?, ?>) ((Map<?, ?>) result.get("metrics")).get("opdToday")).containsKey("value"));
        verify(sql).required(org.mockito.ArgumentMatchers.contains("count(distinct patient_id)"),
                org.mockito.ArgumentMatchers.argThat(params -> {
                    OffsetDateTime start = (OffsetDateTime) params.get("startAt");
                    OffsetDateTime end = (OffsetDateTime) params.get("endAt");
                    return start.getOffset().getTotalSeconds() == 5 * 3600 + 30 * 60
                            && Duration.between(start, end).toHours() == 24;
                }), anyString());
    }

    @Test
    void doctorCannotObtainHospitalAggregatesEvenWithAllPermissions() {
        GovCarePrincipal doctor = actor("doctor", Set.of("*"));
        assertEquals(403, assertThrows(ApiException.class,
                () -> dashboard.overview(doctor, null)).status().value());
        org.mockito.Mockito.verifyNoInteractions(sql);
    }

    @Test
    void aFailedLabReadDoesNotReplaceOtherMetricsWithDemoData() {
        when(sql.required(anyString(), anyMap(), anyString())).thenAnswer(call -> {
            String query = call.getArgument(0);
            if (query.contains("from lab_requests")) throw new DataAccessResourceFailureException("Lab unavailable");
            return query.contains("from hospitals")
                    ? Map.of("id", assigned.toString(), "name", "Hospital A")
                    : Map.of("value", 0);
        });
        when(sql.list(anyString(), anyMap())).thenReturn(List.of());
        GovCarePrincipal admin = actor("hospital_admin", Set.of("QUEUE_VIEW", "ADMISSION_VIEW", "LAB_REQUEST_VIEW", "PRESCRIPTION_VIEW"));

        Map<?, ?> metrics = (Map<?, ?>) dashboard.overview(admin, null).get("metrics");
        assertEquals(0, ((Map<?, ?>) metrics.get("opdToday")).get("value"));
        assertEquals("data_error", ((Map<?, ?>) metrics.get("labPending")).get("reason"));
        assertEquals(false, ((Map<?, ?>) metrics.get("labPending")).get("available"));
    }

    private GovCarePrincipal actor(String role, Set<String> permissions) {
        return new GovCarePrincipal(UUID.randomUUID(), assigned, null, null,
                "user@example.test", "Test User", role, permissions, true, false, 0);
    }
}
