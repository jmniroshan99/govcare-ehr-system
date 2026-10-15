package lk.gov.health.govcare.security;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUserEntity, UUID> {
    @Query("select u from AppUserEntity u left join fetch u.roleDefinition where lower(u.email)=lower(:email)")
    Optional<AppUserEntity> findByEmailIgnoreCaseWithRole(@Param("email") String email);

    @Query("select u from AppUserEntity u left join fetch u.roleDefinition where u.id=:id")
    Optional<AppUserEntity> findByIdWithRole(@Param("id") UUID id);

    Optional<AppUserEntity> findByAuthUid(String authUid);

    boolean existsByEmailIgnoreCase(String email);
    boolean existsByEmployeeNo(String employeeNo);
}
