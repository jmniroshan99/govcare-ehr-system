package lk.gov.health.govcare.security;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PermissionRepository extends JpaRepository<PermissionEntity, UUID> {
    @Query(value = "select p.code from permissions p join role_permissions rp on rp.permission_id=p.id join roles r on r.id=rp.role_id where r.code=:role order by p.code", nativeQuery = true)
    List<String> findCodesByRole(@Param("role") String role);
}
