package lk.gov.health.govcare;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class GovcareEhrApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(GovcareEhrApiApplication.class, args);
    }
}
