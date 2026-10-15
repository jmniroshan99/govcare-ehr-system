package lk.gov.health.govcare.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Development upgrade compatibility for GovCare databases created by earlier
 * project archives whose already-applied migration files were later edited.
 *
 * Flyway repair updates schema-history checksums to the migration files shipped
 * with this build, then normal validation/migration continues. Disable with
 * GOVCARE_FLYWAY_REPAIR_ON_STARTUP=false once all environments have been
 * normalized. This does not re-run an already-applied migration.
 */
@Configuration
public class FlywayRepairConfiguration {

    private static final Logger log = LoggerFactory.getLogger(FlywayRepairConfiguration.class);

    @Bean
    @ConditionalOnProperty(
        name = "govcare.flyway.repair-on-startup",
        havingValue = "true",
        matchIfMissing = true
    )
    FlywayMigrationStrategy flywayMigrationStrategy() {
        return (Flyway flyway) -> {
            log.warn("GovCare Flyway compatibility repair enabled: repairing schema history before validation/migration.");
            flyway.repair();
            flyway.migrate();
        };
    }
}
