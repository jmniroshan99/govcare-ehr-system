import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const patientsRouter = Router();

const createPatientSchema = z.object({
  fullName: z.string().min(2),
  dateOfBirth: z.string().date(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  nic: z.string().optional(),
  passportNo: z.string().optional(),
  birthCertificateNo: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  guardianId: z.string().uuid().optional(),
});

patientsRouter.use(requireAuth);

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
    const patientNo = `PT-${String((counter.rows[0]?.total ?? 0) + 1).padStart(6, "0")}`;
    const result = await client.query(
      `insert into patients (
        hospital_id, patient_no, guardian_id, nic, passport_no, birth_certificate_no,
        full_name, date_of_birth, gender, phone, address, created_by, updated_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
      returning id, patient_no, full_name, created_at`,
      [
        hospitalId,
        patientNo,
        input.guardianId ?? null,
        input.nic ?? null,
        input.passportNo ?? null,
        input.birthCertificateNo ?? null,
        input.fullName,
        input.dateOfBirth,
        input.gender ?? null,
        input.phone ?? null,
        input.address ?? null,
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

