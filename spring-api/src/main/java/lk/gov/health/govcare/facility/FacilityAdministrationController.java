package lk.gov.health.govcare.facility;

import jakarta.validation.Valid;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static lk.gov.health.govcare.facility.FacilityDtos.HospitalRequest;

@RestController
@RequestMapping("/api/admin/facilities")
@PreAuthorize("hasRole('SUPER_ADMIN') and hasAuthority('HOSPITAL_MANAGE')")
public class FacilityAdministrationController {
    private final FacilityAdministrationService facilities;
    private final CurrentUser current;

    public FacilityAdministrationController(FacilityAdministrationService facilities, CurrentUser current) {
        this.facilities = facilities;
        this.current = current;
    }

    @GetMapping
    public Map<String, Object> overview() {
        return facilities.overview(current.get());
    }

    @PostMapping("/hospitals")
    public ResponseEntity<Map<String, Object>> createHospital(@Valid @RequestBody HospitalRequest input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(facilities.createHospital(current.get(), input));
    }
}
