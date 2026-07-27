import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const loginActivitiesRouter = Router();

const createSchema = z.object({
  email: z.string().trim().email(),
  loginStatus: z.enum(["success", "failed"]),
  authenticationMethod: z.string().trim().min(1).max(50),
  failureReason: z.string().max(300).optional(),
  sessionId: z.string().trim().min(1).max(150),
  deviceBrowser: z.string().max(250).optional(),
  operatingSystem: z.string().max(100).optional(),
  location: z.string().max(150).optional(),
  ipAddress: z.string().max(100).optional(),
});

const closeSchema = z.object({
  sessionId: z.string().trim().min(1).max(150),
  logoutStatus: z.enum(["logged_out", "timed_out", "forced_logout"]),
  deviceBrowser: z.string().max(250).optional(),
  operatingSystem: z.string().max(100).optional(),
});

function activityColumns() {
  return `
    la.id::text as id,
    la.session_id as "sessionId",
    la.user_id::text as "userId",
    la.full_name as "fullName",
    la.role::text as role,
    la.hospital_id::text as "hospitalId",
    h.name as "hospitalName",
    u.department_id::text as "departmentId",
    la.department_name as "departmentName",
    la.email,
    la.login_status as "loginStatus",
    la.logout_status as "logoutStatus",
    la.login_time as "loginTime",
    la.logout_time as "logoutTime",
    la.session_duration_seconds as "sessionDurationSeconds",
    la.ip_address as "ipAddress",
    la.device_browser as "deviceBrowser",
    la.operating_system as "operatingSystem",
    la.location,
    la.authentication_method as "authenticationMethod",
    la.failure_reason as "failureReason",
    la.last_activity_time as "lastActivityTime",
    la.created_at as timestamp,
    la.created_at as "createdAt",
    coalesce(la.logout_time, la.last_activity_time, la.login_time) as "updatedAt",
    coalesce(la.user_id::text, 'anonymous') as "createdBy",
    coalesce(la.user_id::text, 'anonymous') as "updatedBy",
    'active'::text as status
  `;
}

loginActivitiesRouter.post("/", async (request, response) => {
  const input = createSchema.parse(request.body);
  const account = await query(
    `select u.id, u.hospital_id, u.role, u.full_name, u.email, d.name as department_name
     from app_users u
     left join departments d on d.id = u.department_id
     where lower(u.email) = lower($1)
     limit 1`,
    [input.email],
  );
  const user = account.rows[0];

  const inserted = await query(
    `insert into login_activities (
      hospital_id, user_id, session_id, full_name, role, department_name, email,
      login_status, logout_status, login_time, ip_address, device_browser,
      operating_system, location, authentication_method, failure_reason, last_activity_time
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,$11,$12,$13,$14,$15,now())
    returning id::text`,
    [
      user?.hospital_id ?? null,
      user?.id ?? null,
      input.sessionId,
      user?.full_name ?? "Unknown user",
      user?.role ?? null,
      user?.department_name ?? null,
      input.email.toLowerCase(),
      input.loginStatus,
      input.loginStatus === "success" ? "active" : "unknown",
      request.ip || input.ipAddress || null,
      input.deviceBrowser ?? request.get("user-agent") ?? null,
      input.operatingSystem ?? null,
      input.location ?? null,
      input.authenticationMethod,
      input.failureReason ?? null,
    ],
  );
  response.status(201).json({ id: inserted.rows[0].id });
});

loginActivitiesRouter.use(requireAuth);

loginActivitiesRouter.get(
  "/",
  requireRole(["super_admin", "hospital_admin", "ict_admin"]),
  async (request, response) => {
    const result = await query(
      `select ${activityColumns()}
       from login_activities la
       left join app_users u on u.id = la.user_id
       left join hospitals h on h.id = la.hospital_id
       where ($1 = 'super_admin' or la.hospital_id = $2)
       order by la.login_time desc
       limit 1000`,
      [request.user?.role, request.user?.hospitalId],
    );
    response.json({ items: result.rows });
  },
);

loginActivitiesRouter.post("/session/close", async (request, response) => {
  const input = closeSchema.parse(request.body);
  const result = await query(
    `update login_activities
     set logout_status = $1,
         logout_time = now(),
         last_activity_time = now(),
         session_duration_seconds = greatest(0, extract(epoch from (now() - login_time))::int),
         device_browser = coalesce($2, device_browser),
         operating_system = coalesce($3, operating_system)
     where session_id = $4 and user_id = $5 and logout_time is null
     returning id::text`,
    [input.logoutStatus, input.deviceBrowser ?? null, input.operatingSystem ?? null, input.sessionId, request.user?.id],
  );
  if (!result.rowCount) return response.status(404).json({ message: "Active login session was not found." });
  response.json({ ok: true });
});
