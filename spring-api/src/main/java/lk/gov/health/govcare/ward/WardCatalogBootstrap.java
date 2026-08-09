package lk.gov.health.govcare.ward;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Runtime safety net for the demo/reference hospital ward catalog.
 *
 * Flyway V18 is the authoritative migration. This runner deliberately verifies
 * the same database state on every Spring startup so an old/edited Flyway
 * history cannot leave the admission UI with the legacy one-ward/one-bed data.
 */
@Component
public class WardCatalogBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(WardCatalogBootstrap.class);

    private final JdbcTemplate jdbc;

    public WardCatalogBootstrap(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Map<String, Object>> hospitals = jdbc.queryForList("""
            select id, code, name
            from hospitals
            where upper(code)='NHSL' and status='active'::record_status
            order by created_at nulls last, id
            limit 1
            """);
        if (hospitals.isEmpty()) {
            log.warn("Ward catalog bootstrap skipped because NHSL is not configured.");
            return;
        }

        UUID hospitalId = (UUID) hospitals.getFirst().get("id");
        String hospitalName = String.valueOf(hospitals.getFirst().get("name"));
        ensureDepartments(hospitalId);
        for (WardTemplate template : WardTemplate.ALL) {
            UUID departmentId = departmentId(hospitalId, template.departmentCode());
            UUID wardId = upsertWard(hospitalId, departmentId, template);
            UUID roomId = upsertRoom(wardId, template);
            preserveLegacyBedAsBed01(hospitalId, wardId, roomId, template);
            ensureBeds(hospitalId, wardId, roomId, template);
        }

        Integer wardCount = jdbc.queryForObject("""
            select count(*) from wards
            where hospital_id=? and ward_code ~ '^W-(0[1-9]|10)$'
              and status='active'::record_status and operational_status='ACTIVE'
            """, Integer.class, hospitalId);
        Integer bedCount = jdbc.queryForObject("""
            select count(*)
            from beds b join wards w on w.id=b.ward_id
            where w.hospital_id=? and w.ward_code ~ '^W-(0[1-9]|10)$'
              and b.bed_no ~ '^(0[1-9]|1[0-9]|2[0-5])$'
            """, Integer.class, hospitalId);

        if (wardCount == null || wardCount != 10 || bedCount == null || bedCount != 250) {
            throw new IllegalStateException("Ward catalog bootstrap verification failed: wards=" + wardCount + ", beds=" + bedCount);
        }
        log.info("Ward catalog ready for {}: {} active wards and {} canonical beds.", hospitalName, wardCount, bedCount);
    }

    private void ensureDepartments(UUID hospitalId) {
        Object[][] departments = {
            {"MED", "General Medicine"},
            {"SURG", "General Surgery"},
            {"PED", "Paediatrics"},
            {"MAT", "Maternity and Obstetrics"},
            {"ICU", "Intensive Care"},
            {"HDU", "High Dependency Unit"},
            {"ISO", "Isolation Services"},
            {"OBS", "Observation Unit"}
        };
        for (Object[] d : departments) {
            jdbc.update("""
                insert into departments(hospital_id,code,name,type,status)
                values(?,?,?,'clinical','active'::record_status)
                on conflict(hospital_id,code) do update set
                  name=excluded.name,type='clinical',status='active'::record_status,updated_at=now()
                """, hospitalId, d[0], d[1]);
        }
    }

    private UUID departmentId(UUID hospitalId, String code) {
        return jdbc.queryForObject("select id from departments where hospital_id=? and upper(code)=? limit 1", UUID.class, hospitalId, code);
    }

    private UUID upsertWard(UUID hospitalId, UUID departmentId, WardTemplate t) {
        return jdbc.queryForObject("""
            insert into wards(hospital_id,department_id,ward_no,ward_code,name,ward_type,category,
                              building,floor,capacity,gender_restriction,age_restriction,isolation_capable,
                              status,operational_status)
            values(?,?,?,?,?,?,?,'Main Building','Main Building',25,?,?,?,'active'::record_status,'ACTIVE')
            on conflict(hospital_id,ward_code) do update set
              department_id=excluded.department_id,ward_no=excluded.ward_no,name=excluded.name,
              ward_type=excluded.ward_type,category=excluded.category,capacity=25,
              gender_restriction=excluded.gender_restriction,age_restriction=excluded.age_restriction,
              isolation_capable=excluded.isolation_capable,status='active'::record_status,
              operational_status='ACTIVE',updated_at=now()
            returning id
            """, UUID.class,
            hospitalId, departmentId, t.code(), t.code(), t.name(), t.type(), t.category(),
            t.gender(), t.age(), t.isolation());
    }

    private UUID upsertRoom(UUID wardId, WardTemplate t) {
        return jdbc.queryForObject("""
            insert into ward_rooms(ward_id,room_number,room_name,room_type,floor,maximum_beds,
                                   gender_restriction,isolation_room,oxygen_available,ventilator_support,status)
            values(?,'GENERAL',?,?,'Main Building',25,?,?,?,?, 'ACTIVE')
            on conflict(ward_id,room_number) do update set
              room_name=excluded.room_name,room_type=excluded.room_type,maximum_beds=25,
              gender_restriction=excluded.gender_restriction,isolation_room=excluded.isolation_room,
              oxygen_available=excluded.oxygen_available,ventilator_support=excluded.ventilator_support,
              status='ACTIVE',updated_at=now()
            returning id
            """, UUID.class, wardId, t.name() + " - Main Room", t.roomType(), t.gender(), t.isolation(), t.highCare(), t.icu());
    }

    private void preserveLegacyBedAsBed01(UUID hospitalId, UUID wardId, UUID roomId, WardTemplate t) {
        Integer canonical = jdbc.queryForObject("select count(*) from beds where ward_id=? and bed_no='01'", Integer.class, wardId);
        if (canonical != null && canonical > 0) return;

        List<UUID> legacy = jdbc.query("""
            select id from beds where ward_id=?
            order by case when current_patient_id is not null or current_admission_id is not null then 0 else 1 end,
                     created_at nulls last,id
            limit 1
            """, (rs, rowNum) -> rs.getObject("id", UUID.class), wardId);
        if (legacy.isEmpty()) return;

        jdbc.update("""
            update beds set hospital_id=?,room_id=?,bed_no='01',bed_code=?,bed_type=?,
              gender_restriction=?,age_restriction=?,isolation_support=?,updated_at=now()
            where id=?
            """, hospitalId, roomId, t.code() + "-B01", t.bedType(), t.gender(), t.age(), t.isolation(), legacy.getFirst());
    }

    private void ensureBeds(UUID hospitalId, UUID wardId, UUID roomId, WardTemplate t) {
        for (int i = 1; i <= 25; i++) {
            String number = "%02d".formatted(i);
            jdbc.update("""
                insert into beds(hospital_id,ward_id,room_id,bed_no,bed_code,bed_type,room_no,floor,status,
                                 gender_restriction,age_restriction,isolation_support,oxygen_support,
                                 ventilator_support,monitor_support,electric_bed,accessible_bed)
                values(?,?,?,?,?,?,'GENERAL','Main Building','AVAILABLE',?,?,?,?,?,?,?,?)
                on conflict(ward_id,bed_no) do update set
                  hospital_id=excluded.hospital_id,room_id=excluded.room_id,bed_code=excluded.bed_code,
                  bed_type=excluded.bed_type,gender_restriction=excluded.gender_restriction,
                  age_restriction=excluded.age_restriction,isolation_support=excluded.isolation_support,
                  oxygen_support=excluded.oxygen_support,ventilator_support=excluded.ventilator_support,
                  monitor_support=excluded.monitor_support,electric_bed=excluded.electric_bed,
                  accessible_bed=excluded.accessible_bed,updated_at=now()
                """,
                hospitalId, wardId, roomId, number, t.code() + "-B" + number, t.bedType(),
                t.gender(), t.age(), t.isolation(), t.highCare(), t.icu(), t.highCare(), t.highCare(), i == 1);
        }
    }

    private record WardTemplate(
        String code, String name, String departmentCode, String type, String category,
        String gender, String age, boolean isolation, String bedType
    ) {
        boolean highCare() { return "ICU".equals(bedType) || "HDU".equals(bedType); }
        boolean icu() { return "ICU".equals(bedType); }
        String roomType() {
            return switch (bedType) {
                case "ICU" -> "ICU";
                case "HDU" -> "HDU";
                case "ISOLATION" -> "ISOLATION";
                case "OBSERVATION" -> "OBSERVATION";
                default -> "GENERAL";
            };
        }

        static final List<WardTemplate> ALL = List.of(
            new WardTemplate("W-01","Male Medical Ward","MED","GENERAL_MEDICAL_WARD","male","MALE","ADULT",false,"STANDARD"),
            new WardTemplate("W-02","Female Medical Ward","MED","GENERAL_MEDICAL_WARD","female","FEMALE","ADULT",false,"STANDARD"),
            new WardTemplate("W-03","Male Surgical Ward","SURG","SURGICAL_WARD","male","MALE","ADULT",false,"STANDARD"),
            new WardTemplate("W-04","Female Surgical Ward","SURG","SURGICAL_WARD","female","FEMALE","ADULT",false,"STANDARD"),
            new WardTemplate("W-05","Paediatric Ward","PED","PAEDIATRIC_WARD","children","ANY","PAEDIATRIC",false,"PAEDIATRIC"),
            new WardTemplate("W-06","Maternity Ward","MAT","MATERNITY_WARD","female","FEMALE","ADULT",false,"MATERNITY"),
            new WardTemplate("W-07","Intensive Care Unit","ICU","INTENSIVE_CARE_UNIT","icu","ANY","ANY",false,"ICU"),
            new WardTemplate("W-08","High Dependency Unit","HDU","HIGH_DEPENDENCY_UNIT","hdu","ANY","ANY",false,"HDU"),
            new WardTemplate("W-09","Isolation Ward","ISO","ISOLATION_WARD","isolation","ANY","ANY",true,"ISOLATION"),
            new WardTemplate("W-10","Observation Ward","OBS","OBSERVATION_WARD","male","ANY","ANY",false,"OBSERVATION")
        );
    }
}
