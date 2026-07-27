import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../db.js";

export const authRouter = Router();

const localLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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

authRouter.post("/local-login", async (request, response) => {
  const input = localLoginSchema.parse(request.body);

  // Development bridge for the local PostgreSQL API. Production authentication
  // should be handled by Keycloak/OIDC or another identity provider.
  if (input.password !== "GovCare@123") {
    return response.status(401).json({ message: "Invalid email or password." });
  }

  const result = await query(
    `select u.*, h.name as hospital_name, d.name as department_name
     from app_users u
     left join hospitals h on h.id = u.hospital_id
     left join departments d on d.id = u.department_id
     where lower(u.email) = lower($1)
     limit 1`,
    [input.email],
  );

  const user = result.rows[0];
  if (!user) return response.status(404).json({ message: "User account was not found in PostgreSQL." });
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
