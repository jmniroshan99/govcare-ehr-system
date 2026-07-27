# Spring Boot + PostgreSQL Media and Document Management

GovCare EHR should manage documents, images, reports, scans, profile photos, emergency images, pharmacy receipts, lab PDFs, radiology files, and other uploads through a backend API.

## Recommended Architecture

```text
React frontend
   |
   | multipart upload / JSON API
   v
Spring Boot API
   |
   | metadata, permissions, audit logs
   v
PostgreSQL
   |
   | controlled file path
   v
Managed file storage folder
```

PostgreSQL stores metadata:

- hospitalId
- patientId
- uploadedBy
- role
- module
- fileUrl
- filePath
- file name
- MIME type
- file size
- SHA-256 checksum
- visibility level
- release status
- timestamps

The actual file is stored in a controlled folder such as:

```text
C:\govcare-ehr-storage
```

This avoids storing large image/PDF/video blobs inside PostgreSQL rows, which is usually better for performance and backup management. PostgreSQL still controls ownership, access, metadata, audit, and release workflow.

## Added Spring Boot API

Folder:

```text
spring-api
```

Main endpoints:

```text
GET  /api/health
POST /api/media
GET  /api/media?patientId={patientId}
GET  /api/media/{id}/download
PATCH /api/media/{id}/release
```

## Run PostgreSQL Schema

```powershell
cd "C:\wamp64\www\wholesale vegetable\govcare-ehr-system"
psql "postgres://postgres:postgres@localhost:5432/govcare_ehr" -f database/postgresql/schema.sql
psql "postgres://postgres:postgres@localhost:5432/govcare_ehr" -f database/postgresql/seed.sql
```

## Run Spring Boot API

Install Maven first if `mvn` is not available.

```powershell
cd "C:\wamp64\www\wholesale vegetable\govcare-ehr-system\spring-api"
mvn spring-boot:run
```

Default API:

```text
http://127.0.0.1:4002
```

## Development Authentication Headers

The starter API currently accepts development headers:

```text
X-User-Id: user uuid
X-Hospital-Id: hospital uuid
X-Role: doctor
X-Patient-Id: patient uuid, only for patient users
X-Full-Name: Dr Test User
```

For production, replace these headers with JWT authentication or JWT verification in Spring Security.

## Example Upload

```powershell
curl.exe -X POST "http://127.0.0.1:4002/api/media" `
  -H "X-User-Id: 00000000-0000-0000-0000-000000000001" `
  -H "X-Hospital-Id: 00000000-0000-0000-0000-000000000010" `
  -H "X-Role: doctor" `
  -F "file=@C:\path\to\report.pdf" `
  -F "patientId=00000000-0000-0000-0000-000000000020" `
  -F "module=laboratory" `
  -F "visibilityLevel=private"
```

## Access Rules

- Patients can upload only to their own patient profile.
- Patients can download only released documents for their own profile.
- Doctors/admin/records users can release documents to patient portal.
- Every file should be linked to hospitalId and patientId when patient-specific.
- Add audit logging before production.

## Next Steps

1. Replace `src/services/mediaService.ts` remote storage calls with Spring API calls.
2. Add JWT or JWT verification in Spring Boot.
3. Add audit log writes for upload, download, release, delete.
4. Add virus scanning or file type validation before production.
5. Add object storage support later if files grow very large.

