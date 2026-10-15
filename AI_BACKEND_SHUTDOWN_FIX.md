# Backend shutdown fix

The AI Intelligence Center service contained invalid Java enhanced-switch syntax in `AIIntelligenceService.score(...)`. Multiple statements were written after arrow (`->`) cases without block braces, which prevents the Spring Boot module from compiling and makes the backend process exit during startup.

Fixed by converting every prediction case to a valid Java 21 switch block. The sepsis SpO2 calculation was also made explicit.

A `start-backend-windows.bat` launcher is included at project root. It:
- keeps the terminal open after a startup failure;
- verifies Java is available;
- creates `spring-api/.env` from the example when absent;
- checks whether port 4002 is already occupied;
- starts the Spring Boot backend from the correct directory;
- displays and preserves the backend exit code/error instead of allowing the CMD window to disappear.

For normal development, start the backend with `start-backend-windows.bat`, then run `npm run dev` in a second CMD for the frontend.
