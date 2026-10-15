package lk.gov.health.govcare.security;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class UserRoleTest {
    @Test
    void publicLabelsResolveToExistingCanonicalRoleCodes() {
        assertEquals("super_admin",UserRole.canonicalCode("superadmin"));
        assertEquals("receptionist",UserRole.canonicalCode("Front Desk Officer"));
        assertEquals("ict_admin",UserRole.canonicalCode("IT Administrator"));
        assertEquals("lab_technician",UserRole.canonicalCode("laboratory_technician"));
        assertEquals("ward_manager",UserRole.canonicalCode("Ward Manager"));
    }

    @Test
    void operationalStaffRolesAreAssignableWithoutPromotingPortalAccounts() {
        for (UserRole role:UserRole.values()) {
            assertEquals(role!=UserRole.super_admin && role!=UserRole.patient && role!=UserRole.guardian,
                    role.isAssignableStaff());
        }
    }
}
