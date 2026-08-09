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
                or upper(coalesce(p.birth_certificate_no,'')) = upper(:identifier)
                or coalesce(p.phone,'') = :identifier
                or coalesce(p.qr_payload,'') = :identifier
           )
         limit 1
        """, nativeQuery = true)
    Optional<PatientEntity> findAccessible(@Param("hospitalId") UUID hospitalId,
                                           @Param("identifier") String identifier);

    @Query(value = """
        select p.* from patients p
         where p.hospital_id=:hospitalId
           and p.status<>'deleted'
           and (
                p.id::text=:search
                or lower(p.full_name) like lower(concat('%',:search,'%'))
                or lower(p.patient_no) like lower(concat('%',:search,'%'))
                or lower(coalesce(p.nic,'')) like lower(concat('%',:search,'%'))
                or lower(coalesce(p.passport_no,'')) like lower(concat('%',:search,'%'))
                or lower(coalesce(p.birth_certificate_no,'')) like lower(concat('%',:search,'%'))
                or lower(coalesce(p.phone,'')) like lower(concat('%',:search,'%'))
                or lower(coalesce(p.qr_payload,'')) like lower(concat('%',:search,'%'))
           )
         order by p.created_at desc
        """, nativeQuery = true)
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

    @Query(value = """
        select distinct p.* from patients p
        join admissions a on a.patient_id=p.id
         and a.hospital_id=:hospitalId
         and a.ward_id=:wardId
         and a.status='active'
         and a.discharged_at is null
        where p.hospital_id=:hospitalId
          and p.status<>'deleted'
          and (
               p.id::text=:search
               or lower(p.full_name) like lower(concat('%',:search,'%'))
               or lower(p.patient_no) like lower(concat('%',:search,'%'))
               or lower(coalesce(p.nic,'')) like lower(concat('%',:search,'%'))
               or lower(coalesce(p.passport_no,'')) like lower(concat('%',:search,'%'))
               or lower(coalesce(p.birth_certificate_no,'')) like lower(concat('%',:search,'%'))
               or lower(coalesce(p.phone,'')) like lower(concat('%',:search,'%'))
               or lower(coalesce(p.qr_payload,'')) like lower(concat('%',:search,'%'))
          )
        order by p.created_at desc
        """, nativeQuery = true)
    List<PatientEntity> searchByWard(@Param("hospitalId") UUID hospitalId,
                                     @Param("wardId") UUID wardId,
                                     @Param("search") String search,
                                     Pageable pageable);

    @Query(value = """
        select distinct p.* from patients p
        join admissions a on a.patient_id=p.id
         and a.hospital_id=:hospitalId
         and a.ward_id=:wardId
         and a.status='active'
         and a.discharged_at is null
        where p.hospital_id=:hospitalId
          and p.status<>'deleted'
        order by p.created_at desc
        """, nativeQuery = true)
    List<PatientEntity> recentByWard(@Param("hospitalId") UUID hospitalId,
                                     @Param("wardId") UUID wardId,
                                     Pageable pageable);

    boolean existsByHospitalIdAndPatientNoIgnoreCase(UUID hospitalId, String patientNo);
}
