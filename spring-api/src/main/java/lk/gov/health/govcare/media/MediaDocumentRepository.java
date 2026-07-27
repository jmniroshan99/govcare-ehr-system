package lk.gov.health.govcare.media;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaDocumentRepository extends JpaRepository<MediaDocument, UUID> {
  List<MediaDocument> findTop100ByHospitalIdAndStatusOrderByCreatedAtDesc(UUID hospitalId, String status);
  List<MediaDocument> findTop100ByHospitalIdAndPatientIdAndStatusOrderByCreatedAtDesc(UUID hospitalId, UUID patientId, String status);
  Optional<MediaDocument> findByIdAndHospitalId(UUID id, UUID hospitalId);
}

