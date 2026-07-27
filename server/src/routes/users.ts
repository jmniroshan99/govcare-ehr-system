import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const usersRouter = Router();

const roles = [
  "super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse", "pharmacist",
  "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician",
  "receptionist", "mortuary_officer", "records_officer", "patient", "guardian", "ict_admin",
] as const;

const statuses = ["active", "inactive", "pending", "completed", "cancelled", "suspended", "blocked", "archived", "deleted"] as const;

const listSchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  role: z.enum(roles).optional(),
  status: z.enum(statuses).optional(),
  limit: z.coerce.number().int().min(1).max(250).optional().default(100),
});

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email(),
  role: z.enum(roles),
  departmentId: z.string().uuid().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  permissions: z.array(z.string().trim().min(1).max(100)).max(200).optional().default([]),
  mfaEnabled: z.boolean().optional().default(false),
  status: z.enum(statuses).optional().default("active"),
});

const updateSchema = createSchema.partial();

function userColumns() {
  return `
    u.id::text as id,
    coalesce(u.auth_uid, u.id::text) as uid,
    u.email,
    u.full_name as "displayName",
    u.role::text as role,
    u.hospital_id::text as "hospitalId",
    h.name as "hospitalName",
    u.department_id::text as "departmentId",
    d.name as "departmentName",
    u.phone,
    u.address,
    u.profile_photo_url as "photoURL",
    u.permissions,
    u.mfa_enabled as "mfaEnabled",
    u.status::text as status,
    u.last_login_at as "lastLoginAt",
    u.created_at as "createdAt",
    u.updated_at as "updatedAt",
    'postgresql'::text as "createdBy",
    'postgresql'::text as "updatedBy"
  `;
}

usersRouter.use(requireAuth);

usersRouter.get(
  "/departments",
  requireRole(["super_admin", "hospital_admin", "ict_admin"]),
  async (request, response) => {
    const result = await query(
      `select id::text, code, name, type, status::text
       from departments
       where hospital_id = $1 and status <> 'deleted'
       order by name`,
      [request.user?.hospitalId],
    );
    response.json({ items: result.rows });
  },
);

usersRouter.get(
  "/by-auth/:uid",
  async (request, response) => {
    const result = await query(
      `select ${userColumns()}
       from app_users u
       left join hospitals h on h.id = u.hospital_id
       left join departments d on d.id = u.department_id
       where (u.auth_uid = $1 or u.id::text = $1)
         and (u.hospital_id = $2 or $3 = 'super_admin')
       limit 1`,
      [request.params.uid, request.user?.hospitalId, request.user?.role],
    );
    if (!result.rowCount) return response.status(404).json({ message: "User account not found." });
    response.json(result.rows[0]);
  },
);

usersRouter.get(
  "/",
  requireRole(["super_admin", "hospital_admin", "ict_admin"]),
  async (request, response) => {
    const input = listSchema.parse(request.query);
    const params: unknown[] = [request.user?.hospitalId];
    const conditions = [request.user?.role === "super_admin" ? "1=1" : "u.hospital_id = $1", "u.status <> 'deleted'"];

    if (input.search) {
      params.push(`%${input.search}%`);
      conditions.push(`(u.full_name ilike $${params.length} or u.email ilike $${params.length} or coalesce(u.phone, '') ilike $${params.length} or u.role::text ilike $${params.length} or coalesce(d.name, '') ilike $${params.length})`);
    }
    if (input.role) {
      params.push(input.role);
      conditions.push(`u.role::text = $${params.length}`);
    }
    if (input.status) {
      params.push(input.status);
      conditions.push(`u.status::text = $${params.length}`);
    }
    params.push(input.limit);

    const result = await query(
      `select ${userColumns()}
       from app_users u
       left join hospitals h on h.id = u.hospital_id
       left join departments d on d.id = u.department_id
       where ${conditions.join(" and ")}
       order by u.updated_at desc, u.full_name
       limit $${params.length}`,
      params,
    );
    response.json({ items: result.rows });
  },
);

usersRouter.post(
  "/",
  requireRole(["super_admin", "hospital_admin", "ict_admin"]),
  async (request, response) => {
    const input = createSchema.parse(request.body);
    const hospitalId = request.user?.hospitalId;
    const actorId = request.user?.id;

    const created = await withTransaction(async (client) => {
      const duplicate = await client.query("select id from app_users where lower(email) = lower($1) limit 1", [input.email]);
      if (duplicate.rowCount) return { duplicate: true as const };

      const inserted = await client.query(
        `insert into app_users (
          auth_uid, hospital_id, department_id, role, full_name, email, phone, address,
          permissions, mfa_enabled, status
        ) values (
          'pg-' || gen_random_uuid()::text, $1, $2, $3, $4, lower($5), $6, $7, $8::jsonb, $9, $10
        ) returning id::text`,
        [hospitalId, input.departmentId ?? null, input.role, input.fullName, input.email, input.phone ?? null, input.address ?? null, JSON.stringify(input.permissions), input.mfaEnabled, input.status],
      );

      await client.query(
        `insert into audit_logs (hospital_id, actor_id, actor_role, module, action, entity_type, entity_id, after_state)
         values ($1,$2,$3,'user-management','create_account','app_users',$4,$5)`,
        [hospitalId, actorId, request.user?.role, inserted.rows[0].id, input],
      );
      return { duplicate: false as const, id: inserted.rows[0].id as string };
    });

    if (created.duplicate) return response.status(409).json({ message: "An account with this email already exists." });
    const result = await query(
      `select ${userColumns()} from app_users u
       left join hospitals h on h.id = u.hospital_id
       left join departments d on d.id = u.department_id
       where u.id = $1`,
      [created.id],
    );
    response.status(201).json({ user: result.rows[0] });
  },
);

usersRouter.get(
  "/:id",
  requireRole(["super_admin", "hospital_admin", "ict_admin"]),
  async (request, response) => {
    const hospitalId = request.user?.hospitalId;
    const role = request.user?.role;
    const account = await query(
      `select ${userColumns()}
       from app_users u
       left join hospitals h on h.id = u.hospital_id
       left join departments d on d.id = u.department_id
       where u.id = $1 and (u.hospital_id = $2 or $3 = 'super_admin') and u.status <> 'deleted'
       limit 1`,
      [request.params.id, hospitalId, role],
    );
    if (!account.rowCount) return response.status(404).json({ message: "User account not found." });

    const [summary, activity] = await Promise.all([
      query(
        `select
          (select count(*)::int from login_activities where user_id = $1) as "loginCount",
          (select count(*)::int from audit_logs where actor_id = $1) as "auditCount",
          (select count(*)::int from visits where doctor_id = $1) as "visitCount",
          (select count(*)::int from appointments where doctor_id = $1) as "appointmentCount",
          (select count(*)::int from prescriptions where doctor_id = $1) as "prescriptionCount",
          (select count(*)::int from lab_requests where requested_by = $1) as "labRequestCount",
          (select count(*)::int from radiology_requests where requested_by = $1) as "radiologyRequestCount",
          (select count(*)::int from admissions where consultant_id = $1) as "admissionCount"`,
        [request.params.id],
      ),
      query(
        `select * from (
          select id::text, 'audit'::text as type, action as title,
            concat_ws(' | ', module, entity_type) as detail, created_at as "createdAt"
          from audit_logs where actor_id = $1
          union all
          select id::text, 'login'::text as type,
            case when login_status = 'success' then 'Successful login' else 'Failed login' end as title,
            concat_ws(' | ', authentication_method, ip_address, device_browser) as detail,
            login_time as "createdAt"
          from login_activities where user_id = $1
        ) activity
        order by "createdAt" desc
        limit 20`,
        [request.params.id],
      ),
    ]);

    response.json({ user: account.rows[0], summary: summary.rows[0], activity: activity.rows });
  },
);

usersRouter.patch(
  "/:id",
  requireRole(["super_admin", "hospital_admin", "ict_admin"]),
  async (request, response) => {
    const input = updateSchema.parse(request.body);
    const hospitalId = request.user?.hospitalId;
    const actorId = request.user?.id;
    const actorRole = request.user?.role;
    const targetId = request.params.id;

    if (!Object.keys(input).length) return response.status(400).json({ message: "No account changes were provided." });
    if (targetId === actorId && input.status && input.status !== "active") {
      return response.status(400).json({ message: "You cannot disable your own active session account." });
    }

    const columnMap: Record<string, string> = {
      fullName: "full_name",
      email: "email",
      role: "role",
      departmentId: "department_id",
      phone: "phone",
      address: "address",
      permissions: "permissions",
      mfaEnabled: "mfa_enabled",
      status: "status",
    };
    const jsonFields = new Set(["permissions"]);

    const updated = await withTransaction(async (client) => {
      const before = await client.query(
        `select * from app_users where id = $1 and (hospital_id = $2 or $3 = 'super_admin') and status <> 'deleted' limit 1`,
        [targetId, hospitalId, actorRole],
      );
      if (!before.rowCount) return { notFound: true as const };

      const values: unknown[] = [];
      const clauses: string[] = [];
      for (const [key, rawValue] of Object.entries(input)) {
        const column = columnMap[key];
        if (!column) continue;
        values.push(jsonFields.has(key) ? JSON.stringify(rawValue) : rawValue === "" ? null : rawValue);
        clauses.push(`${column} = $${values.length}${jsonFields.has(key) ? "::jsonb" : ""}`);
      }
      clauses.push("updated_at = now()");
      values.push(targetId, hospitalId, actorRole);

      const after = await client.query(
        `update app_users set ${clauses.join(", ")}
         where id = $${values.length - 2} and (hospital_id = $${values.length - 1} or $${values.length} = 'super_admin')
         returning id::text`,
        values,
      );
      if (!after.rowCount) return { notFound: true as const };

      await client.query(
        `insert into audit_logs (hospital_id, actor_id, actor_role, module, action, entity_type, entity_id, before_state, after_state)
         values ($1,$2,$3,'user-management','update_account','app_users',$4,$5,$6)`,
        [before.rows[0].hospital_id, actorId, actorRole, targetId, before.rows[0], input],
      );
      return { notFound: false as const };
    });

    if (updated.notFound) return response.status(404).json({ message: "User account not found." });
    const result = await query(
      `select ${userColumns()} from app_users u
       left join hospitals h on h.id = u.hospital_id
       left join departments d on d.id = u.department_id
       where u.id = $1`,
      [targetId],
    );
    response.json({ user: result.rows[0] });
  },
);
