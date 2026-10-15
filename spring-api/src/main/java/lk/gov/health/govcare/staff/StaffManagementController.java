package lk.gov.health.govcare.staff;

import jakarta.validation.Valid;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static lk.gov.health.govcare.staff.StaffDtos.*;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAuthority('USER_MANAGE')")
public class StaffManagementController {
    private final StaffManagementService service;
    private final CurrentUser current;

    public StaffManagementController(StaffManagementService service, CurrentUser current) {
        this.service = service;
        this.current = current;
    }

    @GetMapping("/staff")
    public Map<String, Object> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID hospitalId,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(current.get(), search, hospitalId, departmentId, role, status, page, size);
    }

    @GetMapping("/staff/options")
    public Map<String, Object> options() {
        return service.options(current.get());
    }

    @GetMapping("/hospitals/{hospitalId}/departments")
    public Map<String, Object> departments(@PathVariable UUID hospitalId) {
        List<Map<String, Object>> items = service.departments(current.get(), hospitalId);
        return Map.of("items", items);
    }

    @PostMapping("/staff")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateStaffRequest input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("staff", service.create(current.get(), input)));
    }

    @GetMapping("/staff/{id}")
    public Map<String, Object> detail(@PathVariable UUID id) {
        return Map.of("staff", service.detail(current.get(), id));
    }

    @PutMapping("/staff/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody UpdateStaffRequest input) {
        return Map.of("staff", service.update(current.get(), id, input));
    }

    @PatchMapping("/staff/{id}/role")
    public Map<String, Object> changeRole(@PathVariable UUID id, @Valid @RequestBody RoleChangeRequest input) {
        return Map.of("staff", service.changeRole(current.get(), id, input));
    }

    @PatchMapping("/staff/{id}/department")
    public Map<String, Object> changeDepartment(@PathVariable UUID id, @Valid @RequestBody DepartmentChangeRequest input) {
        return Map.of("staff", service.changeDepartment(current.get(), id, input));
    }

    @PatchMapping("/staff/{id}/status")
    public Map<String, Object> changeStatus(@PathVariable UUID id, @Valid @RequestBody StatusChangeRequest input) {
        return Map.of("staff", service.changeStatus(current.get(), id, input));
    }

    @PatchMapping("/staff/{id}/transfer")
    @PreAuthorize("hasRole('SUPER_ADMIN') and hasAuthority('USER_MANAGE')")
    public Map<String, Object> transfer(@PathVariable UUID id, @Valid @RequestBody TransferRequest input) {
        return Map.of("staff", service.transfer(current.get(), id, input));
    }

    @PostMapping("/staff/{id}/reset-password")
    public Map<String, Object> resetPassword(@PathVariable UUID id, @Valid @RequestBody ResetPasswordRequest input) {
        return service.resetPassword(current.get(), id, input);
    }

    @GetMapping("/staff/{id}/audit")
    public Map<String, Object> audit(@PathVariable UUID id) {
        return Map.of("items", service.audit(current.get(), id));
    }
}
