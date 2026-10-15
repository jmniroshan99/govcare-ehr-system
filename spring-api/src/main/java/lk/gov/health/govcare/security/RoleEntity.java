package lk.gov.health.govcare.security;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "roles")
public class RoleEntity {
    @Id
    @GeneratedValue
    private UUID id;
    @Column(nullable = false, unique = true)
    private String code;
    @Column(nullable = false)
    private String name;
    private String description;
    @Column(name = "default_route", nullable = false)
    private String defaultRoute;

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getDefaultRoute() { return defaultRoute; }
}
