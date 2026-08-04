# GovCare EHR Ward, Bed Allocation and Patient Transfer Module

## Scope

This extension adds integrated ward configuration, room and bed management, admission bed allocation, internal transfers, and inter-hospital transfers to the existing React + Spring Boot + PostgreSQL GovCare EHR application.

## Main routes

- `/wards` — ward operations dashboard
- `/admin/wards` — ward configuration
- `/wards/bed-board` — live bed board
- `/admissions/bed-allocation` — bed matching, reservation and allocation
- `/transfers/internal` — internal bed/room/ward transfers
- `/transfers/inter-hospital/incoming` — receiving-hospital queue
- `/transfers/inter-hospital/outgoing` — sending-hospital queue

## Backend APIs

The Spring Boot API provides ward, room, bed, reservation, allocation, internal-transfer, inter-hospital-transfer, document-link, movement-history and transfer-PDF endpoints under `/api`.

Every sensitive endpoint uses Spring Security authorities. Hospital-scoped actions are checked again in the service layer using the authenticated JWT principal.

## Database migration

`V11__ward_bed_allocation_and_patient_transfers.sql` safely extends the existing schema. It does not delete existing patient, admission, ward or bed data.

It adds:

- richer ward operational attributes
- `ward_rooms`
- extended canonical `beds`
- `bed_reservations`
- `patient_bed_assignments`
- `internal_transfer_requests`
- `inter_hospital_transfers`
- `patient_transfer_documents`
- `patient_movement_history`
- new RBAC permissions and role mappings

Partial unique indexes prevent more than one active bed assignment or active reservation for the same bed. Service transactions lock bed rows before reservation and allocation.

## Transfer safety rules

- The source bed remains occupied during an internal transfer until completion.
- Internal transfer completion sets the source bed to `CLEANING` and the destination bed to `OCCUPIED`.
- An inter-hospital destination bed is reserved by the receiving hospital.
- The sending bed is released only when departure is confirmed.
- The receiving bed is occupied only after arrival and receiving admission confirmation.
- Only verified patient documents can be linked to an inter-hospital transfer.
- Transfer PDFs are generated through an authenticated endpoint.

## Local startup

```cmd
copy spring-api\.env.example spring-api\.env
npm install
npm run build
npm run spring:build
npm run dev:full
```

Frontend: `http://127.0.0.1:5300`

Spring Boot API: `http://127.0.0.1:4001`
