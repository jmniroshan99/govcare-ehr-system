package lk.gov.health.govcare.reference;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ReferenceDataController {
    private final ReferenceDataService service;
    private final CurrentUser current;

    public ReferenceDataController(ReferenceDataService service, CurrentUser current) {
        this.service = service;
        this.current = current;
    }

    @GetMapping("/reference/provinces") public Map<String,Object> provinces(){ return items(service.provinces()); }
    @GetMapping("/reference/districts") public Map<String,Object> districts(){ return items(service.districts(null)); }
    @GetMapping("/reference/provinces/{province}/districts") public Map<String,Object> districts(@PathVariable String province){ return items(service.districts(province)); }
    @GetMapping("/reference/blood-groups") public Map<String,Object> bloodGroups(){ return items(service.values(List.of("A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"))); }
    @GetMapping("/reference/languages") public Map<String,Object> languages(){ return items(service.values(List.of("Sinhala","Tamil","English","Other"))); }
    @GetMapping("/reference/titles") public Map<String,Object> titles(){ return items(service.values(List.of("Mr","Mrs","Ms","Miss","Dr","Prof","Rev","Other","Not stated"))); }
    @GetMapping("/reference/genders") public Map<String,Object> genders(){ return items(service.values(List.of("Male","Female","Other","Unknown","Not stated"))); }
    @GetMapping("/reference/marital-statuses") public Map<String,Object> maritalStatuses(){ return items(service.values(List.of("Single","Married","Divorced","Widowed","Separated","Not stated"))); }
    @GetMapping("/reference/specimen-types") public Map<String,Object> specimenTypes(){ return items(service.values(List.of("Blood","Serum","Plasma","Urine","Stool","Sputum","Swab","CSF","Tissue","Other"))); }
    @GetMapping("/reference/radiology-modalities") public Map<String,Object> modalities(){ return items(service.values(List.of("X-ray","Ultrasound","CT","MRI","Mammography","Fluoroscopy","Other"))); }
    @GetMapping("/reference/countries") public Map<String,Object> countries(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="250") int limit){ return items(service.countries(q,limit)); }

    @GetMapping("/hospitals/search") public Map<String,Object> hospitals(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="30") int limit){ return items(service.hospitals(current.get(),q,limit)); }
    @GetMapping("/hospitals/{hospitalId}/departments") public Map<String,Object> departments(@PathVariable UUID hospitalId){ return items(service.departments(current.get(),hospitalId)); }
    @GetMapping("/departments/{departmentId}/wards") public Map<String,Object> wards(@PathVariable UUID departmentId){ return items(service.wards(current.get(),departmentId)); }
    @GetMapping("/patients/search") public Map<String,Object> patients(@RequestParam String q,@RequestParam(defaultValue="30") int limit){ return items(service.patients(current.get(),q,limit)); }
    @GetMapping("/admissions/search") public Map<String,Object> admissions(@RequestParam String q,@RequestParam(defaultValue="30") int limit){ return items(service.admissions(current.get(),q,limit)); }
    @GetMapping("/staff/search") public Map<String,Object> staff(@RequestParam(defaultValue="") String q,@RequestParam(required=false) UUID hospitalId,@RequestParam(required=false) UUID departmentId,@RequestParam(required=false) String role,@RequestParam(required=false) String permission,@RequestParam(defaultValue="30") int limit){ return items(service.staff(current.get(),q,hospitalId,departmentId,role,permission,limit)); }
    @GetMapping("/medicines/search") public Map<String,Object> medicines(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="30") int limit){ return items(service.medicines(current.get(),q,limit)); }
    @GetMapping("/diagnoses/search") public Map<String,Object> diagnoses(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="30") int limit){ return items(service.diagnoses(q,limit)); }
    @GetMapping("/laboratory-tests/search") public Map<String,Object> laboratoryTests(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="30") int limit){ return items(service.laboratoryTests(q,limit)); }
    @GetMapping("/radiology-studies/search") public Map<String,Object> radiologyStudies(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="30") int limit){ return items(service.radiologyStudies(q,limit)); }

    private static Map<String,Object> items(List<Map<String,Object>> items){ return Map.of("items",items); }
}
