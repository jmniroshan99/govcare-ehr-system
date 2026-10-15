import fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Dependency-independent service checks. Test doubles exist only in this temporary
// compilation directory, never on the Spring application's classpath.
const root = fileURLToPath(new URL("../", import.meta.url));
const temp = await fs.mkdtemp(join(tmpdir(), "govcare-network-tests-"));
const bin = name => process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? `${name}.exe` : name) : name;
const declarations = {
  "org/springframework/stereotype/Service.java": "package org.springframework.stereotype; public @interface Service {}",
  "org/springframework/stereotype/Component.java": "package org.springframework.stereotype; public @interface Component {}",
  "org/springframework/dao/DataAccessException.java": "package org.springframework.dao; public abstract class DataAccessException extends RuntimeException { protected DataAccessException(String message) { super(message); } }",
  "org/slf4j/Logger.java": "package org.slf4j; public interface Logger { void warn(String format, Object... arguments); }",
  "org/slf4j/LoggerFactory.java": "package org.slf4j; public final class LoggerFactory { public static Logger getLogger(Class<?> type) { return (format, arguments) -> {}; } }",
  "org/springframework/transaction/annotation/Transactional.java": "package org.springframework.transaction.annotation; public @interface Transactional { boolean readOnly() default false; }",
  "org/springframework/http/HttpStatus.java": "package org.springframework.http; public enum HttpStatus { BAD_REQUEST,UNAUTHORIZED,FORBIDDEN,NOT_FOUND,CONFLICT,PAYLOAD_TOO_LARGE,UNPROCESSABLE_ENTITY }",
  "org/springframework/security/core/GrantedAuthority.java": "package org.springframework.security.core; public interface GrantedAuthority {}",
  "org/springframework/security/core/authority/SimpleGrantedAuthority.java": "package org.springframework.security.core.authority; public record SimpleGrantedAuthority(String authority) implements org.springframework.security.core.GrantedAuthority {}",
  "org/springframework/security/core/userdetails/UserDetails.java": "package org.springframework.security.core.userdetails; public interface UserDetails { java.util.Collection<? extends org.springframework.security.core.GrantedAuthority> getAuthorities(); String getPassword();String getUsername();boolean isAccountNonExpired();boolean isAccountNonLocked();boolean isCredentialsNonExpired();boolean isEnabled(); }",
  "jakarta/servlet/http/HttpServletRequest.java": "package jakarta.servlet.http; public interface HttpServletRequest { String getHeader(String name); String getRemoteAddr(); }",
  "jakarta/validation/constraints/NotBlank.java": "package jakarta.validation.constraints; public @interface NotBlank {}",
  "jakarta/validation/constraints/NotNull.java": "package jakarta.validation.constraints; public @interface NotNull {}",
  "jakarta/validation/constraints/Email.java": "package jakarta.validation.constraints; public @interface Email {}",
  "jakarta/validation/constraints/Pattern.java": "package jakarta.validation.constraints; public @interface Pattern { String regexp(); String message() default \"\"; }",
  "jakarta/validation/constraints/Size.java": "package jakarta.validation.constraints; public @interface Size { int min() default 0; int max() default 2147483647; }",
  "jakarta/validation/constraints/Min.java": "package jakarta.validation.constraints; public @interface Min { long value(); }",
  "jakarta/validation/constraints/Max.java": "package jakarta.validation.constraints; public @interface Max { long value(); }",
  "lk/gov/health/govcare/audit/AuditService.java": "package lk.gov.health.govcare.audit; public class AuditService { public void record(lk.gov.health.govcare.security.GovCarePrincipal actor,String module,String action,String entityType,java.util.UUID entityId,Object before,Object after) {} }",
  "lk/gov/health/govcare/common/JsonSupport.java": 'package lk.gov.health.govcare.common; public class JsonSupport { public String write(Object value) { return "{}"; } }',
  "lk/gov/health/govcare/common/SqlSupport.java": `package lk.gov.health.govcare.common;
    public class SqlSupport {
      public java.util.Map<String,Object> required(String sql,java.util.Map<String,?> params,String message){throw new UnsupportedOperationException();}
      public java.util.List<java.util.Map<String,Object>> list(String sql,java.util.Map<String,?> params){throw new UnsupportedOperationException();}
      public java.util.Optional<java.util.Map<String,Object>> one(String sql,java.util.Map<String,?> params){throw new UnsupportedOperationException();}
      public int update(String sql,java.util.Map<String,?> params){throw new UnsupportedOperationException();}
      public java.util.UUID uuid(Object value,String field){if(value==null||value.toString().isBlank())return null;try{return java.util.UUID.fromString(value.toString());}catch(IllegalArgumentException e){throw ApiException.badRequest(field+" must be a UUID");}}
    }`,
};
try {
  const sources = [];
  for (const [file, source] of Object.entries(declarations)) {
    const path = join(temp, file); await fs.mkdir(join(path, ".."), { recursive: true }); await fs.writeFile(path, source); sources.push(path);
  }
  const javaRoot = join(root, "spring-api/src/main/java/lk/gov/health/govcare");
  for (const file of ["common/ApiException", "common/SriLankaLocationPolicy", "security/GovCarePrincipal", "security/ClinicalPatientAccess", "patient/NetworkPatientDirectory", "dashboard/DashboardIntelligenceService",
    "facility/FacilityDtos", "facility/FacilityAdministrationService", "ward/WardDtos", "ward/WardWorkflowSupport", "ward/WardBedService",
    "ai/ClinicalMeasurementDates", "ai/DiseaseProbabilitySnapshot", "ai/CkdPredictionService", "ai/CkdDtos", "ai/CkdStageClassificationService", "ai/AiRiskService", "ai/AiRiskDtos", "ai/DeteriorationRiskEngine",
    "ai/AIIntelligenceService", "ai/AIIntelligenceDtos", "documents/DocumentAccessService", "documents/DocumentPolicy", "documents/DocumentAuditService", "draft/DraftService", "draft/DraftDtos"])
    sources.push(join(javaRoot, file + ".java"));
  sources.push(join(root, "scripts/test-support/SuperadminNetworkHarness.java"));
  const classes = join(temp, "classes");
  await fs.mkdir(classes);
  const compile = spawnSync(bin("javac"), ["--release", "21", "-proc:none", "-d", classes, ...sources], { encoding: "utf8" });
  if (compile.error) throw compile.error;
  process.stdout.write(compile.stdout); process.stderr.write(compile.stderr);
  if (compile.status !== 0) throw new Error("Production-service compilation failed.");
  console.log("DashboardIntelligenceService and clinical services compiled with Java 21 using isolated framework and SQL/JSON adapter test doubles.");
  const run = spawnSync(bin("java"), ["-cp", classes, "SuperadminNetworkHarness"], { encoding: "utf8" });
  if (run.error) throw run.error;
  process.stdout.write(run.stdout); process.stderr.write(run.stderr);
  if (run.status !== 0) throw new Error("Production-service access checks failed.");
} finally { await fs.rm(temp, { recursive: true, force: true }); }
