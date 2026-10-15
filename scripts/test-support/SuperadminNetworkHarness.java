import lk.gov.health.govcare.ai.*;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.documents.*;
import lk.gov.health.govcare.draft.*;
import lk.gov.health.govcare.facility.*;
import lk.gov.health.govcare.patient.NetworkPatientDirectory;
import lk.gov.health.govcare.security.*;

import java.math.BigDecimal;
import java.util.*;

/** Executes the real production services with a recording database boundary. */
public class SuperadminNetworkHarness {
    static final UUID HOME = UUID.fromString("00000000-0000-4000-8000-000000000001");
    static final UUID OTHER = UUID.fromString("00000000-0000-4000-8000-000000000002");
    static final UUID OWN_PATIENT = UUID.fromString("00000000-0000-4000-8000-000000000003");
    static final UUID FOREIGN_PATIENT = UUID.fromString("00000000-0000-4000-8000-000000000004");
    static final UUID USER = UUID.fromString("00000000-0000-4000-8000-000000000005");
    static final UUID DEPARTMENT = UUID.fromString("00000000-0000-4000-8000-000000000006");
    static final UUID ASSESSMENT = UUID.fromString("00000000-0000-4000-8000-000000000007");
    static int passed;
    static GovCarePrincipal actor(String role, UUID hospital, Set<String> permissions) {
        return new GovCarePrincipal(USER, hospital, DEPARTMENT, OWN_PATIENT, "unit@govcare.test", "Unit test",
                role, permissions, true, false, 3);
    }
    static void check(String name, Runnable action) {
        action.run(); passed++; System.out.println("PASS " + name);
    }
    static void equal(Object expected, Object actual) {
        if (!Objects.equals(expected, actual)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }
    static void denied(Runnable action) {
        try { action.run(); } catch (ApiException expected) { return; }
        throw new AssertionError("Expected an access denial.");
    }
    public static void main(String[] args) {
        var sql = new RecordingSql();
        var access = new ClinicalPatientAccess(sql);
        var admin = actor("super_admin", HOME, Set.of("*"));
        var doctor = actor("doctor", HOME, Set.of("*"));
        var directory = new NetworkPatientDirectory(sql, access);
        check("Super Admin resolves a foreign patient's stored hospital and preserves operator identity", () -> {
            var scoped = access.clinicalScope(admin, FOREIGN_PATIENT, true);
            equal(OTHER, scoped.hospitalId()); equal(USER, scoped.id()); equal(null, scoped.departmentId());
            equal(admin.permissions(), scoped.permissions()); equal(3L, scoped.credentialsVersion());
            equal(HOME, admin.hospitalId());
        });
        check("network access works without a home hospital", () -> equal(OTHER,
                access.clinicalScope(actor("super_admin", null, Set.of("*")), FOREIGN_PATIENT, true).hospitalId()));
        check("only Super Admin can create an audited hospital with core departments", () -> {
            var service = new FacilityAdministrationService(sql, new lk.gov.health.govcare.audit.AuditService());
            var request = new FacilityDtos.HospitalRequest("DGH-UNIT", "District General Hospital Unit", "district_general_hospital",
                    "Matara", "Matara", "Southern Province", "Unit Road", "0410000000", "unit@govcare.test", "Unit Director", true);
            denied(() -> service.createHospital(actor("hospital_admin", HOME, Set.of("*")), request));
            sql.calls.clear();
            var result = service.createHospital(admin, request);
            equal(1, result.get("coreDepartmentsCreated"));
            equal(true, sql.calls.stream().anyMatch(c -> c.sql.startsWith("insert into hospitals")));
            equal(true, sql.calls.stream().anyMatch(c -> c.sql.contains("insert into departments")));
        });
        check("Hospital Admin, IT Admin, doctor and nurse cannot claim network access", () -> {
            for (String role : List.of("hospital_admin", "ict_admin", "doctor", "nurse", "ward_manager", "patient", "guardian")) {
                var user = actor(role, HOME, Set.of("*"));
                equal(false, access.canAccessNetwork(user));
                denied(() -> access.scopeToPatient(user, FOREIGN_PATIENT));
                denied(() -> directory.hospitals(user));
            }
        });
        check("doctor access requires both its hospital and an assigned clinical relationship", () -> {
            access.requireClinical(doctor, OWN_PATIENT);
            denied(() -> access.requireClinical(doctor, FOREIGN_PATIENT));
            sql.related = false;
            denied(() -> access.requireClinical(doctor, OWN_PATIENT));
            sql.related = true;
        });
        check("patient and guardian demographics remain linked-record only", () -> {
            for (String role : List.of("patient", "guardian")) {
                var user = actor(role, HOME, Set.of("PATIENT_VIEW_SELF"));
                access.requireDemographics(user, OWN_PATIENT);
                denied(() -> access.requireDemographics(user, FOREIGN_PATIENT));
                denied(() -> access.requireClinical(user, OWN_PATIENT));
            }
        });
        check("inactive and temporary-password accounts cannot enter the clinical or network directory", () -> {
            for (boolean active : List.of(true, false)) {
                var user = new GovCarePrincipal(USER, HOME, DEPARTMENT, null, "unit@test", "Unit", "super_admin", Set.of("*"), active, true, 3);
                equal(false, access.canAccessNetwork(user));
                denied(() -> access.requireClinical(user, FOREIGN_PATIENT));
                denied(() -> directory.browse(user, "", null, null, 0, 50, true));
            }
            var inactive = new GovCarePrincipal(USER, HOME, DEPARTMENT, null, "unit@test", "Unit", "super_admin", Set.of("*"), false, false, 3);
            denied(() -> access.requireClinical(inactive, FOREIGN_PATIENT));
        });
        check("revoked patient, clinical and write permissions remain enforced for Super Admin", () -> {
            denied(() -> directory.hospitals(actor("super_admin", HOME, Set.of("PATIENT_VIEW_CLINICAL"))));
            var demographics = actor("super_admin", HOME, Set.of("PATIENT_VIEW"));
            access.requireDemographics(demographics, FOREIGN_PATIENT);
            denied(() -> access.requireClinical(demographics, FOREIGN_PATIENT));
            denied(() -> directory.browse(demographics, "", null, null, 0, 50, true));
            denied(() -> access.requireClinicalWrite(actor("super_admin", HOME, Set.of("PATIENT_VIEW", "PATIENT_VIEW_CLINICAL")), FOREIGN_PATIENT));
        });
        check("directory paging is bounded and a foreign-hospital ward filter is rejected", () -> {
            for (int size : List.of(0, 201)) denied(() -> directory.browse(admin, "", null, null, 0, size, false));
            denied(() -> directory.browse(admin, "", null, null, -1, 50, false));
            denied(() -> directory.browse(admin, "", HOME, DEPARTMENT, 0, 50, false));
            var page = directory.browse(admin, "", OTHER, null, 0, 50, true);
            equal("network", page.get("scope")); equal(52L, page.get("total")); equal(true, page.get("hasNext"));
        });
        check("demographics-only directory removes clinical arrays", () -> {
            var page = directory.browse(actor("super_admin", HOME, Set.of("PATIENT_VIEW")), "", null, null, 0, 50, false);
            var item = (Map<?,?>) ((List<?>) page.get("items")).getFirst();
            equal(false, item.containsKey("allergies")); equal(false, item.containsKey("risk_flags"));
        });
        var predictions = new CkdPredictionService(sql, new JsonSupport(), new CkdStageClassificationService(), access);
        check("deep-link loading resolves the selected patient beyond directory paging", () -> {
            var patient = predictions.patient(admin, FOREIGN_PATIENT);
            equal(FOREIGN_PATIENT.toString(), patient.get("id")); equal(OTHER.toString(), patient.get("hospital_id"));
        });
        check("CKD prediction, clinical observations and all FHIR writes use the patient's hospital", () -> {
            sql.calls.clear();
            var features = new LinkedHashMap<String,BigDecimal>();
            String[] names = {"Age","BMI","SystolicBP","DiastolicBP","FastingBloodSugar","HbA1c","SerumCreatinine","BUNLevels","GFR","ProteinInUrine","ACR","SerumElectrolytesPotassium","HemoglobinLevels","Edema","FamilyHistoryKidneyDisease","PreviousAcuteKidneyInjury","NSAIDsUse"};
            double[] values = {54,27,134,89,132,7,2.7,27,66,2.4,150,4.5,14,0,0,0,5};
            for (int i=0;i<names.length;i++) features.put(names[i], BigDecimal.valueOf(values[i]));
            var result = predictions.predict(admin, new CkdDtos.PredictionRequest(FOREIGN_PATIENT.toString(), "unit-request", features, Map.of()));
            equal(FOREIGN_PATIENT.toString(), result.get("patientId"));
            equal("GOVCARE-CKD-LOGISTIC-1.0", result.get("modelVersion"));
            sql.assertTenantWrites(OTHER);
            equal(3L, sql.calls.stream().filter(c -> c.sql.startsWith("insert into fhir_resource")).count());
            equal(17L, sql.calls.stream().filter(c -> c.sql.startsWith("insert into clinical_observations")).count());
        });
        check("assessment and history lookup recheck clinical access under the selected patient", () -> {
            equal(OTHER, predictions.assessmentScope(admin, ASSESSMENT, false).hospitalId());
            denied(() -> predictions.assessmentScope(doctor, ASSESSMENT, false));
            sql.calls.clear(); predictions.history(admin, FOREIGN_PATIENT.toString());
            var query = sql.calls.getLast(); equal(OTHER, query.params.get("hospital"));
        });
        check("other AI prediction persistence preserves patient tenant and operator", () -> {
            sql.calls.clear();
            var service = new AIIntelligenceService(sql, new JsonSupport(), access);
            service.predict(admin, "ckd", new AIIntelligenceDtos.PredictionRequest(FOREIGN_PATIENT.toString(), Map.of("creatinine", 2.7)));
            sql.assertTenantWrites(OTHER);
        });
        check("deterioration assessments preserve the selected patient's tenant", () -> {
            sql.calls.clear();
            var service = new AiRiskService(sql, new JsonSupport(), new DeteriorationRiskEngine(), access);
            var q = new AiRiskDtos.AssessmentRequest(FOREIGN_PATIENT.toString(), BigDecimal.valueOf(16), BigDecimal.valueOf(98), BigDecimal.valueOf(120), BigDecimal.valueOf(78), BigDecimal.valueOf(36.8), null, null, null, false, false);
            service.assess(admin, q); sql.assertTenantWrites(OTHER);
        });
        var request = new jakarta.servlet.http.HttpServletRequest() {
            public String getHeader(String name) { return "unit-test"; }
            public String getRemoteAddr() { return "127.0.0.1"; }
        };
        var docs = new DocumentAccessService(sql, new DocumentAuditService(sql, request), access);
        var document = new HashMap<String,Object>();
        document.put("id", ASSESSMENT.toString()); document.put("hospitalId", OTHER.toString());
        document.put("patientId", FOREIGN_PATIENT.toString()); document.put("documentType", "LABORATORY_RESULT");
        document.put("documentStatus", "VERIFIED"); document.put("patientReleaseStatus", "NOT_RELEASED");
        check("Super Admin can view clinical documents; other governance roles retain restrictions", () -> {
            equal(true, docs.canView(admin, document));
            docs.requireDownload(admin, document); docs.requirePrint(admin, document);
            for (String role : List.of("hospital_admin", "ict_admin", "nurse", "doctor")) equal(false, docs.canView(actor(role, HOME, Set.of("*")), document));
            for (String role : List.of("hospital_admin", "ict_admin")) equal(false, docs.canView(actor(role, OTHER, Set.of("*")), document));
            equal(false, docs.canView(actor("super_admin", HOME, Set.of("PATIENT_VIEW", "PATIENT_VIEW_CLINICAL", "DOCUMENT_VIEW")), document));
        });
        check("Super Admin AI upload is permitted without granting clinical verification authority", () -> {
            docs.requireCreate(admin, "OTHER_CLINICAL_DOCUMENT");
            equal(false, docs.roleCanCreateType("hospital_admin", "OTHER_CLINICAL_DOCUMENT"));
            denied(() -> docs.requireVerify(admin, document));
        });
        check("clinical upload permission cannot substitute for revoked clinical patient access", () -> {
            denied(() -> docs.requireCreate(actor("super_admin", HOME, Set.of("PATIENT_VIEW", "DOCUMENT_CREATE")), "OTHER_CLINICAL_DOCUMENT"));
        });
        check("a portal account sees only its own verified released documents", () -> {
            var portal = actor("patient", OTHER, Set.of("*"));
            equal(false, docs.canView(portal, document));
            var own = new HashMap<>(document); own.put("patientId", OWN_PATIENT.toString());
            equal(false, docs.canView(portal, own)); own.put("patientReleaseStatus", "RELEASED_TO_PATIENT");
            equal(true, docs.canView(portal, own));
        });
        check("CKD draft uses the target hospital and restores only the operator's own draft", () -> {
            sql.calls.clear();
            var drafts = new DraftService(sql, new JsonSupport(), access);
            drafts.save(admin, new DraftDtos.SaveRequest(null, FOREIGN_PATIENT.toString(), "CKD_AI_ASSESSMENT", "CKD", Map.of("reviewed", true), "DRAFT", 0, "unit-draft"));
            sql.assertTenantWrites(OTHER);
            var draftRead = sql.calls.stream().filter(c -> c.sql.contains("from workflow_drafts")).findFirst().orElseThrow();
            equal(USER, draftRead.params.get("user")); equal(true, draftRead.params.get("network"));
            denied(() -> drafts.get(actor("super_admin", HOME, Set.of("PATIENT_VIEW")), ASSESSMENT.toString()));
        });
        System.out.println("Java production-service checks passed: " + passed);
    }

    record Call(String sql, Map<String,Object> params) {}
    static class RecordingSql extends SqlSupport {
        final List<Call> calls = new ArrayList<>();
        boolean related = true;
        UUID uuidValue(Object v) { return v instanceof UUID u ? u : UUID.fromString(String.valueOf(v)); }
        @Override public Map<String,Object> required(String q, Map<String,?> p, String message) {
            calls.add(new Call(q, new HashMap<>(p)));
            if (q.contains(" related")) return Map.of("related", related);
            if (q.contains("count(*) total")) return Map.of("total", 52L);
            if (q.startsWith("select id from hospitals")) return Map.of("id", p.get("id"));
            if (q.contains("from hospitals h where id=:id")) return Map.of("id",p.get("id").toString(),"code","DGH-UNIT","name","District General Hospital Unit","type","district_general_hospital","status","active","createdAt","2026-10-04");
            if (q.startsWith("select hospital_id from wards")) return Map.of("hospital_id", OTHER);
            if (q.contains("from patients where") || q.contains("from patients p join hospitals")) {
                Object id = p.containsKey("p") ? p.get("p") : p.containsKey("patient") ? p.get("patient") : p.get("id");
                UUID patient = uuidValue(id);
                UUID hospital = patient.equals(FOREIGN_PATIENT) ? OTHER : patient.equals(OWN_PATIENT) ? HOME : null;
                Object scope = p.containsKey("h") ? p.get("h") : p.get("hospital");
                if (hospital == null || scope != null && !hospital.equals(scope)) throw ApiException.notFound(message);
                return q.contains("p.id::text") ? Map.of("id",patient.toString(),"hospital_id",hospital.toString())
                        : Map.of("id",patient,"hospital_id",hospital,"full_name","Unit test patient","patient_no","UNIT-001");
            }
            if (q.startsWith("select patient_id from ai_")) {
                Object scope = p.containsKey("h") ? p.get("h") : p.get("hospital");
                if (!Boolean.TRUE.equals(p.get("network")) && !OTHER.equals(scope)) throw ApiException.notFound(message);
                return Map.of("patient_id", FOREIGN_PATIENT);
            }
            if (q.startsWith("insert into")) return Map.of("id", ASSESSMENT.toString());
            if (q.contains("from workflow_drafts")) return Map.of("workflowType","CKD_AI_ASSESSMENT","patientId",FOREIGN_PATIENT.toString(),"draftId",ASSESSMENT.toString());
            if (q.contains("from ai_deterioration_assessments")) return Map.of("id", ASSESSMENT.toString());
            throw new AssertionError("Unhandled production SQL: " + q);
        }
        @Override public List<Map<String,Object>> list(String q, Map<String,?> p) {
            calls.add(new Call(q, new HashMap<>(p)));
            if (q.contains("from patients p join hospitals")) return List.of(Map.of("id", FOREIGN_PATIENT, "hospital_id", OTHER, "allergies", List.of("Test"), "risk_flags", List.of("Test")));
            return List.of();
        }
        @Override public Optional<Map<String,Object>> one(String q, Map<String,?> p) {
            calls.add(new Call(q, new HashMap<>(p))); return Optional.empty();
        }
        @Override public int update(String q, Map<String,?> p) { calls.add(new Call(q, new HashMap<>(p))); return 1; }
        void assertTenantWrites(UUID hospital) {
            boolean tenantWrite = false;
            for (Call c : calls) if (c.sql.startsWith("insert into") || c.sql.startsWith("update ")) {
                for (String key : List.of("h", "hospital")) if (c.params.containsKey(key)) {
                    tenantWrite = true; equal(hospital, c.params.get(key));
                }
                if (c.params.containsKey("actor")) equal(USER, c.params.get("actor"));
            }
            equal(true, tenantWrite);
        }
    }
}
