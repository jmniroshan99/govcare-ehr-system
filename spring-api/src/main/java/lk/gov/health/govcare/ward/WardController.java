package lk.gov.health.govcare.ward;

import jakarta.validation.Valid;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

import static lk.gov.health.govcare.ward.WardDtos.*;

@RestController
@RequestMapping("/api")
public class WardController {
    private final WardBedService wards;
    private final BedAllocationService allocation;
    private final InternalTransferService internalTransfers;
    private final CurrentUser current;

    public WardController(WardBedService wards, BedAllocationService allocation, InternalTransferService internalTransfers, CurrentUser current) {
        this.wards=wards;this.allocation=allocation;this.internalTransfers=internalTransfers;this.current=current;
    }

    @GetMapping("/wards/dashboard") @PreAuthorize("hasAuthority('WARD_VIEW')")
    public Map<String,Object> dashboard(@RequestParam(required=false) UUID hospitalId){return wards.dashboard(current.get(),hospitalId);}
    @GetMapping("/wards") @PreAuthorize("hasAuthority('WARD_VIEW')")
    public Map<String,Object> wards(@RequestParam(required=false) UUID hospitalId){return Map.of("items",wards.listWards(current.get(),hospitalId));}
    @PostMapping("/wards") @PreAuthorize("hasAuthority('WARD_MANAGE')")
    public ResponseEntity<Map<String,Object>> createWard(@Valid @RequestBody WardRequest input){return ResponseEntity.status(HttpStatus.CREATED).body(wards.createWard(current.get(),input));}
    @GetMapping("/wards/{wardId}") @PreAuthorize("hasAuthority('WARD_VIEW')")
    public Map<String,Object> ward(@PathVariable UUID wardId){return wards.wardDetail(current.get(),wardId);}
    @PutMapping("/wards/{wardId}") @PreAuthorize("hasAuthority('WARD_MANAGE')")
    public Map<String,Object> updateWard(@PathVariable UUID wardId,@Valid @RequestBody WardRequest input){return wards.updateWard(current.get(),wardId,input);}
    @GetMapping("/wards/{wardId}/summary") @PreAuthorize("hasAuthority('WARD_VIEW')")
    public Map<String,Object> wardSummary(@PathVariable UUID wardId){return wards.wardDetail(current.get(),wardId);}

    @GetMapping("/wards/{wardId}/rooms") @PreAuthorize("hasAuthority('WARD_VIEW')")
    public Map<String,Object> rooms(@PathVariable UUID wardId){return Map.of("items",wards.listRooms(current.get(),wardId));}
    @PostMapping("/wards/{wardId}/rooms") @PreAuthorize("hasAuthority('ROOM_MANAGE')")
    public ResponseEntity<Map<String,Object>> createRoom(@PathVariable UUID wardId,@Valid @RequestBody RoomRequest input){return ResponseEntity.status(HttpStatus.CREATED).body(wards.createRoom(current.get(),wardId,input));}
    @PutMapping("/wards/{wardId}/rooms/{roomId}") @PreAuthorize("hasAuthority('ROOM_MANAGE')")
    public Map<String,Object> updateRoom(@PathVariable UUID wardId,@PathVariable UUID roomId,@Valid @RequestBody RoomRequest input){return wards.updateRoom(current.get(),wardId,roomId,input);}

    @GetMapping("/beds") @PreAuthorize("hasAuthority('BED_VIEW')")
    public Map<String,Object> beds(@RequestParam(required=false) UUID hospitalId,@RequestParam(required=false) UUID wardId,@RequestParam(required=false) UUID roomId,@RequestParam(required=false) String status,@RequestParam(required=false) String bedType,@RequestParam(defaultValue="false") boolean availableOnly){return Map.of("items",wards.listBeds(current.get(),hospitalId,wardId,roomId,status,bedType,availableOnly));}
    @GetMapping("/beds/available") @PreAuthorize("hasAuthority('BED_VIEW')")
    public Map<String,Object> availableBeds(@RequestParam(required=false) UUID hospitalId,@RequestParam(required=false) UUID wardId){return Map.of("items",wards.listBeds(current.get(),hospitalId,wardId,null,null,null,true));}
    @GetMapping("/beds/{bedId}") @PreAuthorize("hasAuthority('BED_VIEW')")
    public Map<String,Object> bed(@PathVariable UUID bedId){return wards.bedDetail(current.get(),bedId);}
    @PostMapping("/wards/{wardId}/beds") @PreAuthorize("hasAuthority('BED_MANAGE')")
    public ResponseEntity<Map<String,Object>> createBed(@PathVariable UUID wardId,@Valid @RequestBody BedRequest input){return ResponseEntity.status(HttpStatus.CREATED).body(wards.createBed(current.get(),wardId,input));}
    @PutMapping("/beds/{bedId}") @PreAuthorize("hasAuthority('BED_MANAGE')")
    public Map<String,Object> updateBed(@PathVariable UUID bedId,@Valid @RequestBody BedRequest input){return wards.updateBed(current.get(),bedId,input);}
    @PatchMapping("/beds/{bedId}/status") @PreAuthorize("hasAuthority('BED_MANAGE')")
    public Map<String,Object> status(@PathVariable UUID bedId,@Valid @RequestBody BedStatusRequest input){return wards.changeBedStatus(current.get(),bedId,input);}
    @PostMapping("/beds/{bedId}/block") @PreAuthorize("hasAuthority('BED_BLOCK')")
    public Map<String,Object> block(@PathVariable UUID bedId,@RequestBody(required=false) Map<String,String> input){return wards.changeBedStatus(current.get(),bedId,new BedStatusRequest("BLOCKED",input==null?null:input.get("reason")));}
    @PostMapping("/beds/{bedId}/release-block") @PreAuthorize("hasAuthority('BED_BLOCK')")
    public Map<String,Object> releaseBlock(@PathVariable UUID bedId){return wards.changeBedStatus(current.get(),bedId,new BedStatusRequest("AVAILABLE",null));}
    @PostMapping("/beds/{bedId}/mark-clean") @PreAuthorize("hasAuthority('BED_RELEASE')")
    public Map<String,Object> markClean(@PathVariable UUID bedId){return wards.changeBedStatus(current.get(),bedId,new BedStatusRequest("CLEANING",null));}
    @PostMapping("/beds/{bedId}/mark-available") @PreAuthorize("hasAuthority('BED_RELEASE')")
    public Map<String,Object> markAvailable(@PathVariable UUID bedId){return wards.changeBedStatus(current.get(),bedId,new BedStatusRequest("AVAILABLE",null));}

    @PostMapping("/admissions/{admissionId}/bed-suggestions") @PreAuthorize("hasAuthority('BED_VIEW')")
    public Map<String,Object> suggestions(@PathVariable UUID admissionId,@RequestBody BedSuggestionRequest input){return Map.of("items",allocation.suggestions(current.get(),admissionId,input));}
    @PostMapping("/admissions/{admissionId}/reserve-bed") @PreAuthorize("hasAuthority('BED_RESERVE')")
    public Map<String,Object> reserve(@PathVariable UUID admissionId,@Valid @RequestBody ReserveBedRequest input){return allocation.reserve(current.get(),admissionId,input);}
    @PostMapping("/admissions/{admissionId}/allocate-bed") @PreAuthorize("hasAuthority('BED_ALLOCATE')")
    public Map<String,Object> allocate(@PathVariable UUID admissionId,@Valid @RequestBody AllocateBedRequest input){return allocation.allocate(current.get(),admissionId,input);}
    @GetMapping("/admissions/{admissionId}/bed-assignment") @PreAuthorize("hasAuthority('ADMISSION_VIEW')")
    public Map<String,Object> assignment(@PathVariable UUID admissionId){return allocation.assignment(current.get(),admissionId);}
    @PostMapping("/admissions/{admissionId}/release-bed") @PreAuthorize("hasAuthority('BED_RELEASE')")
    public Map<String,Object> release(@PathVariable UUID admissionId,@RequestBody ReleaseBedRequest input){return allocation.release(current.get(),admissionId,input);}

    @GetMapping("/transfers/internal") @PreAuthorize("hasAuthority('WARD_VIEW')")
    public Map<String,Object> internalList(@RequestParam(required=false) String status){return Map.of("items",internalTransfers.list(current.get(),status));}
    @PostMapping("/transfers/internal") @PreAuthorize("hasAuthority('INTERNAL_TRANSFER_CREATE')")
    public ResponseEntity<Map<String,Object>> createInternal(@Valid @RequestBody InternalTransferRequest input){return ResponseEntity.status(HttpStatus.CREATED).body(internalTransfers.create(current.get(),input));}
    @GetMapping("/transfers/internal/{id}") @PreAuthorize("hasAuthority('WARD_VIEW')")
    public Map<String,Object> internalDetail(@PathVariable UUID id){return internalTransfers.detail(current.get(),id);}
    @PatchMapping("/transfers/internal/{id}/approve") @PreAuthorize("hasAuthority('INTERNAL_TRANSFER_APPROVE')")
    public Map<String,Object> approveInternal(@PathVariable UUID id){return internalTransfers.approve(current.get(),id);}
    @PatchMapping("/transfers/internal/{id}/accept") @PreAuthorize("hasAuthority('INTERNAL_TRANSFER_ACCEPT')")
    public Map<String,Object> acceptInternal(@PathVariable UUID id){return internalTransfers.accept(current.get(),id);}
    @PatchMapping("/transfers/internal/{id}/reserve-bed") @PreAuthorize("hasAuthority('BED_RESERVE')")
    public Map<String,Object> reserveInternal(@PathVariable UUID id,@Valid @RequestBody TransferBedRequest input){return internalTransfers.reserveBed(current.get(),id,input);}
    @PatchMapping("/transfers/internal/{id}/start") @PreAuthorize("hasAuthority('INTERNAL_TRANSFER_COMPLETE')")
    public Map<String,Object> startInternal(@PathVariable UUID id){return internalTransfers.start(current.get(),id);}
    @PatchMapping("/transfers/internal/{id}/complete") @PreAuthorize("hasAuthority('INTERNAL_TRANSFER_COMPLETE')")
    public Map<String,Object> completeInternal(@PathVariable UUID id){return internalTransfers.complete(current.get(),id);}
    @PatchMapping("/transfers/internal/{id}/cancel") @PreAuthorize("hasAuthority('INTERNAL_TRANSFER_CANCEL')")
    public Map<String,Object> cancelInternal(@PathVariable UUID id,@RequestBody TransferReasonRequest input){return internalTransfers.cancel(current.get(),id,input);}
}
