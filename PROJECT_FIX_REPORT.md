# GovCare EHR v2.0 Fix Report

## Fixed items

1. Maven wrapper correction
- Removed the broken wrapper behaviour that immediately failed even when Maven was available.
- Added executable permission to mvnw.

2. Frontend dependency validation
- Existing package.json already contains required TypeScript/Vite type packages.
- Build failures caused by incomplete local node_modules installation, not missing package declarations.
- Run `npm install` before building.

3. Deployment notes
- Configure JWT_SECRET and database credentials using environment variables before production deployment.

## Required validation commands

Frontend:
```
npm install
npm run build
```

Backend:
```
cd spring-api
./mvnw clean install
```
