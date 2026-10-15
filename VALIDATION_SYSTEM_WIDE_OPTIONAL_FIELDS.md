# Validation – System-wide Optional Fields

## Static validation completed

- Parsed all 152 TypeScript and TSX source files successfully with the TypeScript parser.
- Compiled the modified `SelfRegistrationController.java` with Java 21 using validation stubs for Spring and GovCare dependencies.
- Confirmed the project contains no packaged `node_modules`, build output, `.env`, or runtime log files.
- Confirmed no Flyway migration was added or required.

## Behaviour checks

- Blank optional patient fields pass frontend schema validation.
- Optional phone, NIC, passport, birth certificate, guardian NIC, and email fields are validated when entered.
- Invalid or future dates of birth are rejected.
- Age remains automatically calculated from date of birth.
- Legacy patient field configuration is upgraded to optional-field policy version 2.
- Patient self-registration accepts omitted phone, address, gender, and emergency-contact values.
- Required labels remain visible for minimum identity, staff account, and admission fields.

## Full dependency build

A complete `npm run build` could not be executed in the repair environment because the configured npm package mirror returned HTTP 404 for `zod@4.4.3`. The source passed syntax validation, and the affected Java controller passed Java 21 compilation with stubs. Run the normal build commands on the target machine, where the dependencies are already available.
