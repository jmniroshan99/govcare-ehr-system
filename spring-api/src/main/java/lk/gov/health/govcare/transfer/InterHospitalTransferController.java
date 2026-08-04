package lk.gov.health.govcare.transfer;

import jakarta.validation.Valid;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

import static lk.gov.health.govcare.transfer.TransferDtos.*;

@RestController
@RequestMapping("/api")
public class InterHospitalTransferController {
    private final InterHospitalTransferService service;private final TransferPdfService pdf;private final CurrentUser current;
    public InterHospitalTransferController(InterHospitalTransferService service,TransferPdfService pdf,CurrentUser current){this.service=service;this.pdf=pdf;this.current=current;}

    @GetMapping("/transfers/inter-hospital/options") @PreAuthorize("hasAnyAuthority('INTER_HOSPITAL_TRANSFER_CREATE','INTER_HOSPITAL_TRANSFER_REVIEW')")
    public Map<String,Object> options(){return service.options(current.get());}
    @GetMapping("/transfers/inter-hospital") @PreAuthorize("hasAnyAuthority('INTER_HOSPITAL_TRANSFER_CREATE','INTER_HOSPITAL_TRANSFER_REVIEW')")
    public Map<String,Object> list(@RequestParam(required=false) String status){return Map.of("items",service.list(current.get(),"all",status));}
    @GetMapping("/transfers/inter-hospital/incoming") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_REVIEW')")
    public Map<String,Object> incoming(@RequestParam(required=false) String status){return Map.of("items",service.list(current.get(),"incoming",status));}
    @GetMapping("/transfers/inter-hospital/outgoing") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_CREATE')")
    public Map<String,Object> outgoing(@RequestParam(required=false) String status){return Map.of("items",service.list(current.get(),"outgoing",status));}
    @PostMapping("/transfers/inter-hospital") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_CREATE')")
    public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody CreateInterHospitalTransferRequest input){return ResponseEntity.status(HttpStatus.CREATED).body(service.create(current.get(),input));}
    @GetMapping("/transfers/inter-hospital/{id}") @PreAuthorize("hasAnyAuthority('INTER_HOSPITAL_TRANSFER_CREATE','INTER_HOSPITAL_TRANSFER_REVIEW')")
    public Map<String,Object> detail(@PathVariable UUID id){return service.detail(current.get(),id);}
    @PatchMapping("/transfers/inter-hospital/{id}/submit") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_CREATE')") public Map<String,Object> submit(@PathVariable UUID id){return service.submit(current.get(),id);}
    @PatchMapping("/transfers/inter-hospital/{id}/request-information") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_REVIEW')") public Map<String,Object> info(@PathVariable UUID id,@Valid @RequestBody InformationRequest input){return service.requestInformation(current.get(),id,input);}
    @PatchMapping("/transfers/inter-hospital/{id}/accept") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_ACCEPT')") public Map<String,Object> accept(@PathVariable UUID id){return service.accept(current.get(),id);}
    @PatchMapping("/transfers/inter-hospital/{id}/reject") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_REJECT')") public Map<String,Object> reject(@PathVariable UUID id,@Valid @RequestBody RejectionRequest input){return service.reject(current.get(),id,input);}
    @PatchMapping("/transfers/inter-hospital/{id}/reserve-bed") @PreAuthorize("hasAuthority('BED_RESERVE')") public Map<String,Object> reserve(@PathVariable UUID id,@Valid @RequestBody DestinationBedRequest input){return service.reserveBed(current.get(),id,input);}
    @PatchMapping("/transfers/inter-hospital/{id}/schedule-transport") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_CREATE')") public Map<String,Object> schedule(@PathVariable UUID id,@Valid @RequestBody TransportRequest input){return service.scheduleTransport(current.get(),id,input);}
    @PatchMapping("/transfers/inter-hospital/{id}/depart") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_DEPART')") public Map<String,Object> depart(@PathVariable UUID id){return service.depart(current.get(),id);}
    @PatchMapping("/transfers/inter-hospital/{id}/arrive") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_ARRIVE')") public Map<String,Object> arrive(@PathVariable UUID id){return service.arrive(current.get(),id);}
    @PatchMapping("/transfers/inter-hospital/{id}/confirm-admission") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_ARRIVE')") public Map<String,Object> confirm(@PathVariable UUID id){return service.confirmAdmission(current.get(),id);}
    @PatchMapping("/transfers/inter-hospital/{id}/complete") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_COMPLETE')") public Map<String,Object> complete(@PathVariable UUID id){return service.complete(current.get(),id);}
    @PatchMapping("/transfers/inter-hospital/{id}/cancel") @PreAuthorize("hasAuthority('INTER_HOSPITAL_TRANSFER_CREATE')") public Map<String,Object> cancel(@PathVariable UUID id,@Valid @RequestBody CancelRequest input){return service.cancel(current.get(),id,input);}

    @PostMapping("/transfers/inter-hospital/{id}/documents") @PreAuthorize("hasAuthority('TRANSFER_DOCUMENT_CREATE')") public Map<String,Object> attach(@PathVariable UUID id,@Valid @RequestBody AttachDocumentRequest input){return service.attachDocument(current.get(),id,input);}
    @GetMapping("/transfers/inter-hospital/{id}/documents") @PreAuthorize("hasAuthority('TRANSFER_DOCUMENT_VIEW')") public Map<String,Object> documents(@PathVariable UUID id){return Map.of("items",service.documents(current.get(),id));}
    @DeleteMapping("/transfers/inter-hospital/{id}/documents/{documentId}") @PreAuthorize("hasAuthority('TRANSFER_DOCUMENT_SHARE')") public ResponseEntity<Void> revoke(@PathVariable UUID id,@PathVariable UUID documentId){service.revokeDocument(current.get(),id,documentId);return ResponseEntity.noContent().build();}
    @GetMapping("/transfers/inter-hospital/{id}/transfer-package") @PreAuthorize("hasAuthority('TRANSFER_DOCUMENT_VIEW')") public ResponseEntity<byte[]> transferPackage(@PathVariable UUID id){byte[] bytes=pdf.packagePdf(current.get(),id);return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=govcare-transfer-"+id+".pdf").body(bytes);}
    @GetMapping("/transfers/{id}/audit") @PreAuthorize("hasAuthority('TRANSFER_AUDIT_VIEW')") public Map<String,Object> audit(@PathVariable UUID id){return Map.of("items",service.audit(current.get(),id));}
    @GetMapping("/patients/{patientId}/movements") @PreAuthorize("hasAuthority('PATIENT_VIEW_CLINICAL')") public Map<String,Object> movements(@PathVariable UUID patientId){return Map.of("items",service.movements(current.get(),patientId));}
}
