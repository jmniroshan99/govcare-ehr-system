# GovCare Backend Port 4002 Fix

Backend API port changed from **4001** to **4002** consistently across Spring Boot, frontend environment/fallbacks, Windows launchers, and full-stack readiness checks.

## Runtime endpoints
- Frontend: http://127.0.0.1:5300
- Spring Boot API: http://127.0.0.1:4002

Use `start-backend-windows.bat` to start the backend. It checks port 4002 before launch and keeps the terminal open on failure.
