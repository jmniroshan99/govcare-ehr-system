import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const patientsRouter = Router();

const createPatientSchema = z.object({
  patientId: z.string().min(2).optional(),
  fullName: z.string().min(2),
  dateOfBirth: z.string().date(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  title: z.string().optional(),
  preferredName: z.string().optional(),
  nic: z.string().optional(),
  passportNo: z.string().optional(),
  birthCertificateNo: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  district: z.string().optional(),
  province: z.string().optional(),
  languagePreference: z.string().optional(),
  emergencyContact: z.record(z.string(), z.unknown()).optional(),
  allergies: z.array(z.string()).optional(),
  chronicDiseases: z.array(z.string()).optional(),
  disabilities: z.array(z.string()).optional(),
  familyHistory: z.array(z.string()).optional(),
  riskFlags: z.array(z.string()).optional(),
  guardianId: z.string().uuid().optional(),
});

// Every field is optional on update - the client only sends the fields the user actually changed.
const updatePatientSchema = createPatientSchema.omit({ patientId: true }).partial();

const patientColumns = `
  id, hospital_id, patient_no, guardian_id, nic, passport_no, birth_certificate_no,
  title, full_name, preferred_name, date_of_birth, age_years, gender, blood_group, nationality,
  phone, email, address, district, province, emergency_contact, language_preference,
  allergies, chronic_diseases, disabilities, family_history, risk_flags,
  status, created_at, updated_at
`;

// Maps camelCase API field names to their snake_case PostgreSQL column names for the patients table.
const columnMap: Record<string, string> = {
  fullName: "full_name",
  dateOfBirth: "date_of_birth",
  gender: "gender",
  title: "title",
  preferredName: "preferred_name",
  nic: "nic",
  passportNo: "passport_no",
  birthCertificateNo: "birth_certificate_no",
  bloodGroup: "blood_group",
  nationality: "nationality",
  phone: "phone",
  email: "email",
  address: "address",
  district: "district",
  province: "province",
  languagePreference: "language_preference",
  emergencyContact: "emergency_contact",
  allergies: "allergies",
  chronicDiseases: "chronic_diseases",
  disabilities: "disabilities",
  familyHistory: "family_history",
  riskFlags: "risk_flags",
  guardianId: "guardian_id",
};

const jsonColumns = new Set(["emergency_contact", "allergies", "chronic_diseases", "disabilities", "family_history", "risk_flags"]);

patientsRouter.use(requireAuth);

// List / search patients for the logged-in user's hospital.
patientsRouter.get("/", requireRole(["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer"]), async (request, response) => {
  const hospitalId = request.user?.hospitalId;
  const search = String(request.query.search ?? "").trim();
  const params: unknown[] = [hospitalId];
  let where = "where hospital_id = $1 and status <> 'deleted'";

  if (search) {
    params.push(`%${search}%`);
    where += ` and (full_name ilike $${params.length} or patient_no ilike $${params.length} or nic ilike $${params.length} or phone ilike $${params.length})`;
  }

  const result = await query(
    `select id, patient_no, full_name, nic, phone, gender, age_years, status, created_at
     from patients
     ${where}
     order by created_at desc
     limit 50`,
    params,
  );
  response.json({ items: result.rows });
});

// Fetch one patient's full record, e.g. to prefill an edit form or generate a PDF.
patientsRouter.get(
  "/:id",
  requireRole(["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer"]),
  async (request, response) => {
    const hospitalId = request.user?.hospitalId;
    const result = await query(
      `select ${patientColumns} from patients where id = $1 and hospital_id = $2 and status <> 'deleted' limit 1`,
      [request.params.id, hospitalId],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Patient not found." });
    response.json({ patient: result.rows[0] });
  },
);

// Create a new patient. Returns { duplicate: true, patient } if one already exists for this NIC.
patientsRouter.post("/", requireRole(["super_admin", "hospital_admin", "receptionist", "records_officer"]), async (request, response) => {
  const input = createPatientSchema.parse(request.body);
  const hospitalId = request.user?.hospitalId;
  const actorId = request.user?.id;

  const created = await withTransaction(async (client) => {
    if (input.nic) {
      const existing = await client.query("select id, patient_no, full_name from patients where hospital_id = $1 and nic = $2 limit 1", [hospitalId, input.nic]);
      if (existing.rowCount) return { duplicate: true, patient: existing.rows[0] };
    }

    const counter = await client.query("select count(*)::integer as total from patients where hospital_id = $1", [hospitalId]);
    const patientNo = input.patientId ?? `PT-${String((counter.rows[0]?.total ?? 0) + 1).padStart(6, "0")}`;
    const result = await client.query(
      `insert into patients (
        hospital_id, patient_no, guardian_id, nic, passport_no, birth_certificate_no,
        title, full_name, preferred_name, date_of_birth, gender, blood_group, nationality,
        phone, email, address, district, province, emergency_contact, language_preference,
        allergies, chronic_diseases, disabilities, family_history, risk_flags,
        qr_payload, created_by, updated_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
      returning ${patientColumns}`,
      [
        hospitalId,
        patientNo,
        input.guardianId ?? null,
        input.nic ?? null,
        input.passportNo ?? null,
        input.birthCertificateNo ?? null,
        input.title ?? null,
        input.fullName,
        input.preferredName ?? null,
        input.dateOfBirth,
        input.gender ?? null,
        input.bloodGroup ?? null,
        input.nationality ?? null,
        input.phone ?? null,
        input.email || null,
        input.address ?? null,
        input.district ?? null,
        input.province ?? null,
        JSON.stringify(input.emergencyContact ?? {}),
        input.languagePreference ?? "en",
        JSON.stringify(input.allergies ?? []),
        JSON.stringify(input.chronicDiseases ?? []),
        JSON.stringify(input.disabilities ?? []),
        JSON.stringify(input.familyHistory ?? []),
        JSON.stringify(input.riskFlags ?? []),
        JSON.stringify({ patientId: patientNo, hospitalId }),
        actorId,
        actorId,
      ],
    );

    await client.query(
      `insert into audit_logs (hospital_id, actor_id, actor_role, module, action, entity_type, entity_id, after_state)
       values ($1,$2,$3,'patients','create','patients',$4,$5)`,
      [hospitalId, actorId, request.user?.role, result.rows[0].id, result.rows[0]],
    );

    return { duplicate: false, patient: result.rows[0] };
  });

  response.status(created.duplicate ? 200 : 201).json(created);
});

// Update an existing patient's details (e.g. after an edit form submit). Only changed fields
// need to be sent. Returns the before/after state so the client can render a "what changed" PDF.
patientsRouter.patch(
  "/:id",
  requireRole(["super_admin", "hospital_admin", "receptionist", "records_officer"]),
  async (request, response) => {
    const input = updatePatientSchema.parse(request.body);
    const hospitalId = request.user?.hospitalId;
    const actorId = request.user?.id;
    const patientId = request.params.id;

    const fieldsToUpdate = Object.entries(input).filter(([, value]) => value !== undefined);
    if (fieldsToUpdate.length === 0) {
      return response.status(400).json({ message: "No fields to update were provided." });
    }

    const result = await withTransaction(async (client) => {
      const before = await client.query(`select ${patientColumns} from patients where id = $1 and hospital_id = $2 limit 1`, [patientId, hospitalId]);
      if (!before.rowCount) return { notFound: true as const };

      const setClauses: string[] = [];
      const values: unknown[] = [];
      for (const [field, value] of fieldsToUpdate) {
        const column = columnMap[field];
        if (!column) continue;
        values.push(jsonColumns.has(column) ? JSON.stringify(value) : value === "" ? null : value);
        setClauses.push(`${column} = $${values.length}`);
      }
      setClauses.push(`updated_by = $${values.length + 1}`, "updated_at = now()");
      values.push(actorId);
      values.push(patientId, hospitalId);

      const after = await client.query(
        `update patients set ${setClauses.join(", ")}
         where id = $${values.length - 1} and hospital_id = $${values.length}
         returning ${patientColumns}`,
        values,
      );

      await client.query(
        `insert into audit_logs (hospital_id, actor_id, actor_role, module, action, entity_type, entity_id, before_state, after_state)
         values ($1,$2,$3,'patients','update','patients',$4,$5,$6)`,
        [hospitalId, actorId, request.user?.role, patientId, before.rows[0], after.rows[0]],
      );

      return { notFound: false as const, before: before.rows[0], after: after.rows[0] };
    });

    if (result.notFound) return response.status(404).json({ message: "Patient not found." });
    response.json({ patient: result.after, previous: result.before });
  },
);

// Soft-delete: keeps the row (and its history) but hides it from normal list/search results.
patientsRouter.delete(
  "/:id",
  requireRole(["super_admin", "hospital_admin", "records_officer"]),
  async (request, response) => {
    const hospitalId = request.user?.hospitalId;
    const actorId = request.user?.id;
    const result = await withTransaction(async (client) => {
      const updated = await client.query(
        `update patients set status = 'deleted', updated_by = $1, updated_at = now()
         where id = $2 and hospital_id = $3
         returning id`,
        [actorId, request.params.id, hospitalId],
      );
      if (!updated.rowCount) return { notFound: true as const };

      await client.query(
        `insert into audit_logs (hospital_id, actor_id, actor_role, module, action, entity_type, entity_id)
         values ($1,$2,$3,'patients','delete','patients',$4)`,
        [hospitalId, actorId, request.user?.role, request.params.id],
      );
      return { notFound: false as const };
    });

    if (result.notFound) return response.status(404).json({ message: "Patient not found." });
    response.status(204).send();
  },
);
