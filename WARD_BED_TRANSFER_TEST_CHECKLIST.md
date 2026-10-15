# Ward, Bed and Transfer Test Checklist

## Database and startup

- [ ] Existing Flyway migrations V1–V10 remain successful.
- [ ] Flyway V11 applies without deleting existing records.
- [ ] Frontend production build succeeds.
- [ ] Spring Boot build succeeds.
- [ ] `/actuator/health` reports `UP`.

## Ward and bed configuration

- [ ] Hospital Admin can create and edit a ward in their own hospital.
- [ ] Hospital Admin cannot manage another hospital's ward.
- [ ] Rooms can be created only inside the selected ward.
- [ ] Bed codes are unique within the hospital.
- [ ] Bed board counts match database statuses.
- [ ] Blocked, maintenance and occupied beds cannot be allocated.

## Reservation and allocation

- [ ] Suitable-bed results apply gender, age, isolation, oxygen, ventilator and accessibility requirements.
- [ ] A reservation changes the bed to `RESERVED`.
- [ ] Expired reservations return the bed to `AVAILABLE`.
- [ ] Confirmed allocation changes the bed to `OCCUPIED`.
- [ ] One admission cannot have two active bed assignments.
- [ ] Two concurrent requests cannot allocate the same bed.
- [ ] Conflicts return HTTP 409.

## Internal transfers

- [ ] Doctor or Nurse can create an internal transfer with permission.
- [ ] Destination ward can approve and accept it.
- [ ] Destination bed is reserved before movement.
- [ ] Source bed stays occupied before completion.
- [ ] Completion changes source bed to `CLEANING`.
- [ ] Completion changes destination bed to `OCCUPIED`.
- [ ] Patient movement history records source and destination.
- [ ] Sending and receiving ward notifications are created.

## Inter-hospital transfers

- [ ] Sending hospital can create and submit a transfer.
- [ ] Receiving hospital sees the request in the incoming queue.
- [ ] Receiving hospital can request more information.
- [ ] Receiving hospital can accept or reject with correct permissions.
- [ ] Accepted transfer can reserve a bed only in the receiving hospital.
- [ ] Sending hospital can schedule transport and confirm departure.
- [ ] Source bed releases only after departure.
- [ ] Receiving hospital can confirm arrival.
- [ ] Receiving admission is created only after arrival.
- [ ] Destination bed becomes occupied only after receiving admission confirmation.
- [ ] Transfer completes only after destination admission confirmation.
- [ ] Source/destination hospital boundaries return 403 for unauthorized requests.

## Documents and audit

- [ ] Only verified patient documents can be attached.
- [ ] Receiving hospital can see only transfer-linked documents.
- [ ] Revoked document links are no longer returned.
- [ ] Transfer package PDF requires a valid JWT and permission.
- [ ] Bed, movement and transfer actions create audit records.
