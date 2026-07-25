import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const searchRouter = Router();

const searchSchema = z.object({
  q: z.string().trim().min(2).max(80),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

type SearchSuggestionRow = {
  id: string;
  label: string;
  description: string;
  category: string;
  href: string;
};

searchRouter.use(requireAuth);

searchRouter.get(
  "/suggestions",
  requireRole(["super_admin", "hospital_admin", "doctor", "nurse", "pharmacist", "lab_technician", "radiologist", "receptionist", "records_officer", "ict_admin"]),
  async (request, response) => {
    const input = searchSchema.parse(request.query);
    const hospitalId = request.user?.hospitalId;
    const like = `%${input.q}%`;
    const perSourceLimit = Math.min(input.limit, 8);

    const [patients, users, visits] = await Promise.all([
      query<SearchSuggestionRow>(
        `select
          id::text as id,
          patient_no || ' - ' || full_name as label,
          concat_ws(' | ', 'Patient', nullif(gender::text, ''), nullif(phone, ''), nullif(nic, '')) as description,
          'Patient' as category,
          '/patients/' || patient_no as href
        from patients
        where hospital_id = $1
          and status <> 'deleted'
          and (full_name ilike $2 or patient_no ilike $2 or coalesce(nic, '') ilike $2 or coalesce(phone, '') ilike $2)
        order by updated_at desc
        limit $3`,
        [hospitalId, like, perSourceLimit],
      ),
      query<SearchSuggestionRow>(
        `select
          id::text as id,
          full_name as label,
          concat_ws(' | ', initcap(replace(role::text, '_', ' ')), email, status::text) as description,
          case when role::text = 'doctor' then 'Doctor' else 'User' end as category,
          case when role::text = 'doctor' then '/doctor' else '/admin/users' end as href
        from app_users
        where hospital_id = $1
          and status <> 'deleted'
          and (full_name ilike $2 or email ilike $2 or role::text ilike $2)
        order by updated_at desc
        limit $3`,
        [hospitalId, like, perSourceLimit],
      ),
      query<SearchSuggestionRow>(
        `select
          v.id::text as id,
          v.visit_no || ' - ' || p.full_name as label,
          concat_ws(' | ', 'Visit', v.visit_type, v.priority, v.status::text) as description,
          'Appointment' as category,
          '/opd' as href
        from visits v
        join patients p on p.id = v.patient_id
        where v.hospital_id = $1
          and (v.visit_no ilike $2 or p.full_name ilike $2 or p.patient_no ilike $2 or coalesce(v.reason, '') ilike $2)
        order by v.updated_at desc
        limit $3`,
        [hospitalId, like, perSourceLimit],
      ),
    ]);

    response.json([...patients.rows, ...users.rows, ...visits.rows].slice(0, input.limit));
  },
);
