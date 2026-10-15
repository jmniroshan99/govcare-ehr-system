package lk.gov.health.govcare;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EntityScan(basePackages = "lk.gov.health.govcare")
@EnableJpaRepositories(basePackages = "lk.gov.health.govcare")
public class GovcareEhrApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(GovcareEhrApiApplication.class, args);
    }
}
