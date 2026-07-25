import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const selfRegistrationRouter = Router();

const tokenTtlDays = 14;

const generateSchema = z.object({
  hospitalId: z.string().uuid().optional(),
  label: z.string().trim().max(120).optional(),
  maxUses: z.coerce.number().int().min(1).max(1000).default(100),
});

const submitSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  nic: z.string().trim().max(20).optional(),
  passportNo: z.string().trim().max(30).optional(),
  dateOfBirth: z.string().date(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  phone: z.string().trim().min(7).max(30),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().trim().min(3).max(300),
  district: z.string().trim().max(80).optional(),
  province: z.string().trim().max(80).optional(),
  emergencyContactName: z.string().trim().min(2).max(160),
  emergencyContactPhone: z.string().trim().min(7).max(30),
  bloodGroup: z.string().trim().max(10).optional(),
  allergies: z.string().trim().max(500).optional(),
  chronicDiseases: z.string().trim().max(500).optional(),
  languagePreference: z.enum(["en", "si", "ta"]).default("en"),
});

type RegistrationTokenRow = {
  id: string;
  hospital_id: string;
  hospital_name: string;
  hospital_city: string | null;
  token_hash: string;
  label: string | null;
  expires_at: string;
  uses_count: number;
  max_uses: number;
  status: string;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicBaseUrl(request: { headers: { origin?: string }; protocol: string; get: (name: string) => string | undefined }) {
  return process.env.PUBLIC_APP_URL ?? request.headers.origin ?? `${request.protocol}://${request.get("host")}`;
}

async function ensureRegistrationTable() {
  await query(`
    create table if not exists patient_registration_tokens (
      id uuid primary key default gen_random_uuid(),
      hospital_id uuid not null references hospitals(id) on delete cascade,
      token_hash text not null unique,
      label text,
      expires_at timestamptz not null,
      max_uses integer not null default 100,
      uses_count integer not null default 0,
      status record_status not null default 'active',
      created_by uuid references app_users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query("create index if not exists idx_patient_registration_tokens_hospital_status on patient_registration_tokens(hospital_id, status, expires_at)");
}

async function findToken(token: string) {
  await ensureRegistrationTable();
  const tokenHash = hashToken(token);
  const result = await query<RegistrationTokenRow>(
    `select prt.id::text, prt.hospital_id::text, h.name as hospital_name, h.city as hospital_city,
      prt.token_hash, prt.label, prt.expires_at::text, prt.uses_count, prt.max_uses, prt.status::text
     from patient_registration_tokens prt
     join hospitals h on h.id = prt.hospital_id
     where prt.token_hash = $1
     limit 1`,
    [tokenHash],
  );
  return result.rows[0];
}

selfRegistrationRouter.get("/tokens", requireAuth, requireRole(["super_admin", "hospital_admin", "ict_admin", "receptionist", "records_officer"]), async (request, response) => {
  await ensureRegistrationTable();
  const hospitalId = request.user?.hospitalId;
  const result = await query(
    `select prt.id, prt.label, h.name as hospital_name, prt.expires_at, prt.uses_count, prt.max_uses, prt.status, prt.created_at
     from patient_registration_tokens prt
     join hospitals h on h.id = prt.hospital_id
     where prt.hospital_id = $1
     order by prt.created_at desc
     limit 20`,
    [hospitalId],
  );
  response.json({ items: result.rows });
});

selfRegistrationRouter.get("/submissions", requireAuth, requireRole(["super_admin", "hospital_admin", "ict_admin", "receptionist", "records_officer"]), async (request, response) => {
  const hospitalId = request.user?.hospitalId;
  const result = await query(
    `select id::text, patient_no, full_name, nic, passport_no, phone, gender::text, status::text, created_at
     from patients
     where hospital_id = $1 and status in ('pending','active')
     order by created_at desc
     limit 30`,
    [hospitalId],
  );
  response.json({ items: result.rows });
});

selfRegistrationRouter.post("/submissions/:patientId/approve", requireAuth, requireRole(["super_admin", "hospital_admin", "receptionist", "records_officer"]), async (request, response) => {
  const hospitalId = request.user?.hospitalId;
  const actorId = request.user?.id;
  const updated = await query(
    `update patients
     set status = 'active', release_status = 'internal', updated_by = $1, updated_at = now()
     where id = $2 and hospital_id = $3
     returning id::text, patient_no, full_name, status::text, updated_at`,
    [actorId, request.params.patientId, hospitalId],
  );
  if (!updated.rowCount) return response.status(404).json({ message: "Patient registration not found." });
  await query(
    `insert into audit_logs (hospital_id, actor_id, actor_role, module, action, entity_type, entity_id, after_state)
     values ($1,$2,$3,'patient-registration','approve_self_registration','patients',$4,$5)`,
    [hospitalId, actorId, request.user?.role, request.params.patientId, updated.rows[0]],
  );
  response.json(updated.rows[0]);
});

selfRegistrationRouter.post("/tokens", requireAuth, requireRole(["super_admin", "hospital_admin", "ict_admin", "receptionist", "records_officer"]), async (request, response) => {
  await ensureRegistrationTable();
  const input = generateSchema.parse(request.body);
  const token = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  const hospitalId = input.hospitalId ?? request.user?.hospitalId;
  const actorId = request.user?.id;
  const expiresAt = new Date(Date.now() + tokenTtlDays * 24 * 60 * 60 * 1000);

  const inserted = await query<{ id: string; hospital_name: string; expires_at: string }>(
    `insert into patient_registration_tokens (hospital_id, token_hash, label, expires_at, max_uses, created_by)
     values ($1,$2,$3,$4,$5,$6)
     returning id::text, (select name from hospitals where id = $1) as hospital_name, expires_at::text`,
    [hospitalId, tokenHash, input.label ?? "Patient self-registration QR", expiresAt.toISOString(), input.maxUses, actorId],
  );

  await query(
    `insert into audit_logs (hospital_id, actor_id, actor_role, module, action, entity_type, after_state)
     values ($1,$2,$3,'patient-registration','generate_qr_token','patient_registration_tokens',$4)`,
    [hospitalId, actorId, request.user?.role, inserted.rows[0]],
  );

  const registrationUrl = `${publicBaseUrl(request)}/self-register/${encodeURIComponent(token)}`;
  response.status(201).json({ token, registrationUrl, ...inserted.rows[0] });
});

selfRegistrationRouter.get("/tokens/:token", async (request, response) => {
  const token = await findToken(request.params.token);
  if (!token) return response.status(404).json({ message: "Invalid registration QR code." });
  if (token.status !== "active") return response.status(410).json({ message: "Registration QR code is no longer active." });
  if (new Date(token.expires_at).getTime() < Date.now()) return response.status(410).json({ message: "Registration QR code has expired." });
  if (token.uses_count >= token.max_uses) return response.status(410).json({ message: "Registration QR code usage limit reached." });
  response.json({
    hospitalId: token.hospital_id,
    hospitalName: token.hospital_name,
    hospitalCity: token.hospital_city,
    label: token.label,
    expiresAt: token.expires_at,
  });
});

selfRegistrationRouter.post("/tokens/:token/register", async (request, response) => {
  const input = submitSchema.parse(request.body);
  const token = await findToken(request.params.token);
  if (!token) return response.status(404).json({ message: "Invalid registration QR code." });
  if (token.status !== "active" || new Date(token.expires_at).getTime() < Date.now() || token.uses_count >= token.max_uses) {
    return response.status(410).json({ message: "Registration QR code is expired or inactive." });
  }

  const created = await withTransaction(async (client) => {
    const duplicate = await client.query(
      `select id::text, patient_no, full_name
       from patients
       where hospital_id = $1
         and (
           ($2::text is not null and nic = $2)
           or ($3::text is not null and passport_no = $3)
           or (phone = $4 and full_name ilike $5)
         )
       limit 1`,
      [token.hospital_id, input.nic || null, input.passportNo || null, input.phone, input.fullName],
    );
    if (duplicate.rowCount) return { duplicate: true, patient: duplicate.rows[0] };

    const counter = await client.query("select count(*)::integer as total from patients where hospital_id = $1", [token.hospital_id]);
    const patientNo = `PT-${String((counter.rows[0]?.total ?? 0) + 1).padStart(6, "0")}`;
    const birthDate = new Date(input.dateOfBirth);
    const age = Number.isNaN(birthDate.getTime()) ? null : new Date().getFullYear() - birthDate.getFullYear();
    const qrPayload = `govcare://patients/${patientNo}`;
    const patient = await client.query(
      `insert into patients (
        hospital_id, patient_no, nic, passport_no, full_name, date_of_birth, age_years, gender,
        blood_group, address, district, province, phone, email, emergency_contact, language_preference,
        allergies, chronic_diseases, qr_payload, release_status, status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending_review','pending')
      returning id::text, patient_no, full_name, status, created_at`,
      [
        token.hospital_id,
        patientNo,
        input.nic || null,
        input.passportNo || null,
        input.fullName,
        input.dateOfBirth,
        age,
        input.gender,
        input.bloodGroup || null,
        input.address,
        input.district || null,
        input.province || null,
        input.phone,
        input.email || null,
        { name: input.emergencyContactName, phone: input.emergencyContactPhone },
        input.languagePreference,
        input.allergies ? input.allergies.split(",").map((item) => item.trim()).filter(Boolean) : [],
        input.chronicDiseases ? input.chronicDiseases.split(",").map((item) => item.trim()).filter(Boolean) : [],
        qrPayload,
      ],
    );

    await client.query("update patient_registration_tokens set uses_count = uses_count + 1, updated_at = now() where id = $1", [token.id]);
    await client.query(
      `insert into audit_logs (hospital_id, module, action, entity_type, entity_id, after_state, ip_address, device_info)
       values ($1,'patient-registration','self_register','patients',$2,$3,$4,$5)`,
      [token.hospital_id, patient.rows[0].id, patient.rows[0], request.ip, request.get("user-agent") ?? null],
    );

    return { duplicate: false, patient: patient.rows[0] };
  });

  response.status(created.duplicate ? 200 : 201).json(created);
});
