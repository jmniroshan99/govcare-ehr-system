package lk.gov.health.govcare.security;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "permissions")
public class PermissionEntity {
    @Id
    @GeneratedValue
    private UUID id;
    @Column(nullable = false, unique = true)
    private String code;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String module;
    @Column(nullable = false)
    private String action;

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getModule() { return module; }
    public String getAction() { return action; }
}
