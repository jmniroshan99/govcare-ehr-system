package lk.gov.health.govcare.patient;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientRepository extends JpaRepository<PatientEntity, UUID> {
    @Query(value = """
        select p.* from patients p
         where p.hospital_id = :hospitalId
           and p.status <> 'deleted'
           and (
                p.id::text = :identifier
                or upper(p.patient_no) = upper(:identifier)
                or upper(coalesce(p.nic,'')) = upper(:identifier)
                or upper(coalesce(p.passport_no,'')) = upper(:identifier)
                or coalesce(p.phone,'') = :identifier
           )
         limit 1
        """, nativeQuery = true)
    Optional<PatientEntity> findAccessible(@Param("hospitalId") UUID hospitalId,
                                           @Param("identifier") String identifier);

    @Query("""
        select p from PatientEntity p
         where p.hospitalId=:hospitalId
           and p.status<>lk.gov.health.govcare.patient.RecordStatus.deleted
           and (
                lower(p.fullName) like lower(concat('%',:search,'%'))
                or lower(p.patientNo) like lower(concat('%',:search,'%'))
                or lower(coalesce(p.nic,'')) like lower(concat('%',:search,'%'))
                or lower(coalesce(p.passportNo,'')) like lower(concat('%',:search,'%'))
                or lower(coalesce(p.phone,'')) like lower(concat('%',:search,'%'))
           )
         order by p.createdAt desc
        """)
    List<PatientEntity> search(@Param("hospitalId") UUID hospitalId,
                               @Param("search") String search,
                               Pageable pageable);

    @Query("""
        select p from PatientEntity p
         where p.hospitalId=:hospitalId
           and p.status<>lk.gov.health.govcare.patient.RecordStatus.deleted
         order by p.createdAt desc
        """)
    List<PatientEntity> recent(@Param("hospitalId") UUID hospitalId, Pageable pageable);

    boolean existsByHospitalIdAndPatientNoIgnoreCase(UUID hospitalId, String patientNo);
}
