# Spring Boot main-class startup fix

## What the reported log establishes

Maven reached `spring-boot:run` but could not identify a main class in the
compiled output. Spring Boot did not reach application initialization in this
run. The frontend then stopped because `concurrently -k` stops the other service
when the backend exits.

The supplied source already contains the correct entry point:

```text
lk.gov.health.govcare.GovcareEhrApiApplication
spring-api/src/main/java/lk/gov/health/govcare/GovcareEhrApiApplication.java
```

The POM previously relied on automatic discovery. The log's "Nothing to
compile" followed by the missing-main error is consistent with stale or
incomplete `target` output. That exact local state cannot be proved from this
ZIP, which contains no `target` folder. The fix removes reliance on that output
and explicitly selects the existing entry point.

The Windows wrapper also read `%errorlevel%` inside the same parenthesized block
as `where mvn`, and invoked the Maven batch script without `call`. It could
therefore lose the actual Maven failure status. This explains why the launcher
must be corrected as well as the Maven configuration.

## Changes

| File | Behavior |
| --- | --- |
| `spring-api/pom.xml` | Explicit Spring Boot `mainClass` for running and executable JAR packaging. |
| `scripts/run-spring.mjs` | Runs `clean spring-boot:run`; resolves the backend relative to the script; invokes Windows `cmd.exe` explicitly without `shell:true`; reports spawn errors and preserves exit status. |
| `spring-api/mvnw.cmd` | Calls Maven and captures its exit code after it finishes, outside a parenthesized block. |
| `start-backend-windows.bat` | Uses the same Node launcher, including the clean build and loading `spring-api/.env`; checks that Node is available. |
| `package.json` and `scripts/run-spring.test.mjs` | Adds dependency-free launcher regression checks via `npm run test:startup`. |

The frontend port is still 5300 and the API default is still 4002. Java source,
JPA discovery settings, application configuration, dependencies, lockfile, and
all existing Flyway migrations are unchanged. Cleaning removes Maven's generated
`spring-api/target` output, so each development startup takes longer to compile.
It does not remove the PostgreSQL database or uploaded documents. Existing
Flyway startup behavior still applies when the application eventually starts.

## Apply on Windows

1. Stop the previous project processes.
2. Extract the ZIP into a new folder. Open PowerShell in the folder containing
   `package.json`.
3. Copy your existing `spring-api\.env` into the new project's `spring-api`
   folder. Preserve your current database connection and JWT secret. If you
   customized the root `.env`, copy that too. If no backend `.env` exists,
   copy `spring-api\.env.example` to `spring-api\.env` and enter your PostgreSQL
   settings.
4. Preserve existing uploaded files. With the default relative storage setting,
   copy `spring-api\govcare-storage` from the previous project when it exists.
   If `STORAGE_ROOT` is customized, keep using that existing storage location.
5. Confirm PostgreSQL is running and that Maven uses JDK 21:

   ```powershell
   java -version
   mvn -version
   ```

6. Install the locked frontend dependencies and start both services:

   ```powershell
   npm ci
   npm run dev:full
   ```

The backend launcher should first print:

```text
[GovCare] Maven: clean spring-boot:run
```

Wait for the application to report `Started GovcareEhrApiApplication`, then
open <http://127.0.0.1:5300/>. Verify the backend at
<http://127.0.0.1:4002/actuator/health>.

For backend-only diagnosis, use `npm run spring:api` or
`start-backend-windows.bat`. These load `.env`; a direct `mvnw.cmd` invocation
does not load it. A long-running `spring-boot:run` command does not normally
print Maven's final BUILD SUCCESS until the application exits.

## Verification completed in the repair environment

- `npm run test:startup`: **8 passed, 0 failed** on Linux with Node 24.19.0.
  The checks execute the real launcher and wrapper with a temporary Maven
  executable fixture. They cover clean/run arguments, nonzero exit propagation,
  ZIP permission loss on Linux, build arguments, paths containing spaces and
  parentheses, `.env` loading from another working directory, invalid modes,
  missing Maven, and controlled spawn failure. The same tests select the real
  `.cmd` wrapper when run on Windows; that branch has not been executed here.
- Before the launcher fix, the same checks had **3 passed, 5 failed**, including
  a failure showing that startup did not request `clean`.
- `node --check` passed for the launcher and test file.
- Parsed `pom.xml` and confirmed that the configured fully qualified main class
  maps to the existing Java source and its `public static void main` method.
- Confirmed `package.json` dependency declarations still match the unchanged
  lockfile and compared the changed files against the supplied archive.
- `npm run spring:build`: **blocked**, exit 1 with "Maven is not installed."
  The environment has Java 17 runtime only, no JDK 21 compiler, no Maven, and no
  PostgreSQL. A Maven Central network check timed out. No successful Java
  compilation, executable JAR, Windows runtime, database migration, health
  response, or complete application startup is claimed.

If startup still fails on Windows, capture the first `[ERROR]` or `Caused by:`
section from the clean build. A database or migration error after the Spring
banner would be a later failure than the main-class error shown in the original
log.

## Official references

- Spring Boot Maven `mainClass` configuration:
  <https://docs.spring.io/spring-boot/3.5/maven-plugin/run.html>
- Node.js Windows batch process invocation:
  <https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows>
- Windows `call` command:
  <https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/call>
