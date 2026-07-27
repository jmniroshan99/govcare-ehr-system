import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../db.js";

export const authRouter = Router();

const localLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const patientRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(2).max(150),
});

function toCamelProfile(row: Record<string, unknown>) {
  return {
    id: row.id,
    uid: row.auth_uid ?? row.id,
    email: row.email,
    displayName: row.full_name,
    role: row.role,
    hospitalId: row.hospital_id,
    hospitalName: row.hospital_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    phone: row.phone,
    address: row.address,
    photoURL: row.profile_photo_url,
    permissions: row.permissions ?? [],
    mfaEnabled: row.mfa_enabled,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: "postgres",
    updatedBy: "postgres",
  };
}


authRouter.post("/register-patient", async (request, response) => {
  const input = patientRegisterSchema.parse(request.body);
  const hospital = await query<{ id: string }>("select id::text from hospitals where status = 'active' order by created_at limit 1");
  if (!hospital.rowCount) return response.status(503).json({ message: "No active hospital is configured in PostgreSQL." });

  const duplicate = await query("select id from app_users where lower(email) = lower($1) limit 1", [input.email]);
  if (duplicate.rowCount) return response.status(409).json({ message: "An account with this email already exists." });

  const created = await query(
    `insert into app_users (auth_uid, hospital_id, role, full_name, email, password_hash, permissions, mfa_enabled, status)
     values ('pg-' || gen_random_uuid()::text, $1, 'patient', $2, lower($3), crypt($4, gen_salt('bf')), '["portal:read","profile:self","reports:self","appointments:self"]'::jsonb, false, 'active')
     returning *`,
    [hospital.rows[0].id, input.displayName, input.email, input.password],
  );
  const user = created.rows[0];
  const profileResult = await query(
    `select u.*, h.name as hospital_name, d.name as department_name
     from app_users u
     left join hospitals h on h.id = u.hospital_id
     left join departments d on d.id = u.department_id
     where u.id = $1`,
    [user.id],
  );
  const token = jwt.sign({ id: user.id, role: user.role, hospitalId: user.hospital_id }, process.env.JWT_SECRET ?? "dev-secret", { expiresIn: "8h" });
  response.status(201).json({ token, user: toCamelProfile(profileResult.rows[0]) });
});

authRouter.post("/local-login", async (request, response) => {
  const input = localLoginSchema.parse(request.body);

  const result = await query(
    `select u.*, h.name as hospital_name, d.name as department_name
     from app_users u
     left join hospitals h on h.id = u.hospital_id
     left join departments d on d.id = u.department_id
     where lower(u.email) = lower($1)
       and u.password_hash = crypt($2, u.password_hash)
     limit 1`,
    [input.email, input.password],
  );

  const user = result.rows[0];
  if (!user) return response.status(401).json({ message: "Invalid email or password." });
  if (user.status !== "active") return response.status(403).json({ message: `This account is ${user.status}.` });

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      hospitalId: user.hospital_id,
      departmentId: user.department_id,
    },
    process.env.JWT_SECRET ?? "dev-secret",
    { expiresIn: "8h" },
  );

  await query("update app_users set last_login_at = now() where id = $1", [user.id]);

  return response.json({ token, user: toCamelProfile(user) });
});
