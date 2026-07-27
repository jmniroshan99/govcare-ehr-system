import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const searchRouter = Router();

const scopes = [
  "all", "patients", "guardians", "users", "clinical", "appointments", "pharmacy", "laboratory",
  "radiology", "admissions", "wards", "notifications", "reports",
] as const;

const searchSchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(30).default(10),
  scope: z.enum(scopes).default("all"),
});

type SearchSuggestionRow = {
  id: string;
  label: string;
  description: string;
  category: string;
  href: string;
};

type SearchScope = (typeof scopes)[number];

function includesScope(scope: SearchScope, ...accepted: SearchScope[]) {
  return scope === "all" || accepted.includes(scope);
}

searchRouter.use(requireAuth);

searchRouter.get(
  "/suggestions",
  requireRole([
    "super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse", "pharmacist",
    "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician",
    "receptionist", "records_officer", "ict_admin", "patient", "guardian",
  ]),
  async (request, response) => {
    const input = searchSchema.parse(request.query);
    const hospitalId = request.user?.hospitalId;
    const requesterRole = request.user?.role;
    const limitedPortalSearch = requesterRole === "patient" || requesterRole === "guardian";
    const effectiveScope: SearchScope = limitedPortalSearch ? "users" : input.scope;
    const like = `%${input.q}%`;
    const perSourceLimit = Math.min(input.limit, 8);
    const jobs: Array<Promise<{ rows: SearchSuggestionRow[] }>> = [];

    if (includesScope(effectiveScope, "patients", "clinical", "appointments", "pharmacy", "laboratory", "radiology", "admissions", "reports")) {
      jobs.push(query<SearchSuggestionRow>(
        `select id::text as id,
          patient_no || ' - ' || full_name as label,
          concat_ws(' | ', 'Patient', nullif(gender::text, ''), nullif(phone, ''), nullif(nic, '')) as description,
          'Patient' as category,
          '/patients/' || id::text as href
        from patients
        where hospital_id = $1 and status <> 'deleted'
          and (full_name ilike $2 or patient_no ilike $2 or coalesce(nic, '') ilike $2
            or coalesce(passport_no, '') ilike $2 or coalesce(birth_certificate_no, '') ilike $2
            or coalesce(phone, '') ilike $2 or coalesce(email, '') ilike $2)
        order by updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "guardians")) {
      jobs.push(query<SearchSuggestionRow>(
        `select g.id::text as id,
          g.guardian_no || ' - ' || g.full_name as label,
          concat_ws(' | ', 'Guardian', g.relationship, g.nic, g.phone, g.email) as description,
          'Guardian' as category,
          '/guardians' as href
        from guardians g
        where g.hospital_id = $1 and g.status <> 'deleted'
          and (g.guardian_no ilike $2 or g.full_name ilike $2 or g.nic ilike $2
            or coalesce(g.phone, '') ilike $2 or coalesce(g.email, '') ilike $2)
        order by g.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "users", "appointments", "clinical", "laboratory", "radiology", "admissions")) {
      jobs.push(query<SearchSuggestionRow>(
        `select u.id::text as id,
          u.full_name as label,
          concat_ws(' | ', initcap(replace(u.role::text, '_', ' ')), u.email, d.name, u.status::text) as description,
          case when u.role::text in ('doctor','surgeon','anesthetist','radiologist','pathologist') then 'Doctor' else 'User' end as category,
          case when $4::boolean then '/portal/appointments' else '/admin/users?selected=' || u.id::text end as href
        from app_users u
        left join departments d on d.id = u.department_id
        where u.hospital_id = $1 and u.status <> 'deleted'
          and ($4::boolean = false or u.role::text in ('doctor','surgeon','radiologist','pathologist'))
          and (u.full_name ilike $2 or u.email ilike $2 or coalesce(u.phone, '') ilike $2
            or u.role::text ilike $2 or coalesce(d.name, '') ilike $2)
        order by u.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit, limitedPortalSearch],
      ));
    }

    if (includesScope(effectiveScope, "clinical")) {
      jobs.push(query<SearchSuggestionRow>(
        `select v.id::text as id,
          v.visit_no || ' - ' || p.full_name as label,
          concat_ws(' | ', 'Visit', v.visit_type, q.token_no, v.priority::text, v.status::text) as description,
          'Appointment' as category,
          '/opd' as href
        from visits v
        join patients p on p.id = v.patient_id
        left join opd_queue q on q.visit_id = v.id
        where v.hospital_id = $1
          and (v.visit_no ilike $2 or p.full_name ilike $2 or p.patient_no ilike $2
            or coalesce(v.reason, '') ilike $2 or coalesce(v.diagnosis_summary, '') ilike $2
            or coalesce(q.token_no, '') ilike $2)
        order by v.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "appointments")) {
      jobs.push(query<SearchSuggestionRow>(
        `select a.id::text as id,
          coalesce(a.queue_no, 'Appointment') || ' - ' || p.full_name as label,
          concat_ws(' | ', a.appointment_type, d.name, u.full_name, a.scheduled_at::text, a.status::text) as description,
          'Appointment' as category,
          '/appointments' as href
        from appointments a
        join patients p on p.id = a.patient_id
        left join departments d on d.id = a.department_id
        left join app_users u on u.id = a.doctor_id
        where a.hospital_id = $1
          and (p.full_name ilike $2 or p.patient_no ilike $2 or coalesce(a.queue_no, '') ilike $2
            or a.appointment_type ilike $2 or coalesce(d.name, '') ilike $2 or coalesce(u.full_name, '') ilike $2)
        order by a.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "pharmacy")) {
      jobs.push(query<SearchSuggestionRow>(
        `select rx.id::text as id,
          rx.prescription_no || ' - ' || p.full_name as label,
          concat_ws(' | ', 'Prescription', u.full_name, rx.diagnosis, rx.pharmacy_status, rx.priority::text) as description,
          'Prescription' as category,
          '/pharmacy' as href
        from prescriptions rx
        join patients p on p.id = rx.patient_id
        left join app_users u on u.id = rx.doctor_id
        where rx.hospital_id = $1 and rx.status <> 'deleted'
          and (rx.prescription_no ilike $2 or p.full_name ilike $2 or p.patient_no ilike $2
            or coalesce(p.nic, '') ilike $2 or coalesce(rx.diagnosis, '') ilike $2
            or coalesce(u.full_name, '') ilike $2 or rx.pharmacy_status ilike $2)
        order by rx.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
      jobs.push(query<SearchSuggestionRow>(
        `select m.id::text as id,
          m.name as label,
          concat_ws(' | ', 'Medicine', m.generic_name, m.category, m.strength, m.status::text) as description,
          'Medicine' as category,
          '/pharmacy' as href
        from medicines m
        where m.hospital_id = $1 and m.status <> 'deleted'
          and (m.name ilike $2 or coalesce(m.generic_name, '') ilike $2 or coalesce(m.category, '') ilike $2
            or coalesce(m.strength, '') ilike $2 or coalesce(m.manufacturer, '') ilike $2)
        order by m.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "laboratory", "reports")) {
      jobs.push(query<SearchSuggestionRow>(
        `select lr.id::text as id,
          'LAB-' || upper(left(replace(lr.id::text, '-', ''), 8)) || ' - ' || p.full_name as label,
          concat_ws(' | ', lr.test_type, lr.sample_status, lr.test_status, lr.priority::text) as description,
          'Laboratory' as category,
          '/laboratory' as href
        from lab_requests lr
        join patients p on p.id = lr.patient_id
        where lr.hospital_id = $1 and lr.status <> 'deleted'
          and (lr.id::text ilike $2 or lr.test_type ilike $2 or p.full_name ilike $2
            or p.patient_no ilike $2 or coalesce(p.nic, '') ilike $2
            or coalesce(lr.clinical_reason, '') ilike $2 or coalesce(lr.sample_status, '') ilike $2
            or coalesce(lr.test_status, '') ilike $2)
        order by lr.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "radiology", "reports")) {
      jobs.push(query<SearchSuggestionRow>(
        `select rr.id::text as id,
          rr.imaging_type || ' - ' || p.full_name as label,
          concat_ws(' | ', 'Radiology', rr.scan_status, rr.room, rr.priority::text, u.full_name) as description,
          'Radiology' as category,
          '/radiology' as href
        from radiology_requests rr
        join patients p on p.id = rr.patient_id
        left join app_users u on u.id = rr.requested_by
        where rr.hospital_id = $1 and rr.status <> 'deleted'
          and (rr.imaging_type ilike $2 or p.full_name ilike $2 or p.patient_no ilike $2
            or coalesce(p.nic, '') ilike $2 or coalesce(rr.clinical_reason, '') ilike $2
            or coalesce(rr.room, '') ilike $2 or coalesce(u.full_name, '') ilike $2)
        order by rr.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "admissions", "wards")) {
      jobs.push(query<SearchSuggestionRow>(
        `select a.id::text as id,
          a.admission_no || ' - ' || p.full_name as label,
          concat_ws(' | ', w.name, b.bed_no, a.provisional_diagnosis, a.status::text) as description,
          'Admission' as category,
          '/admissions' as href
        from admissions a
        join patients p on p.id = a.patient_id
        left join wards w on w.id = a.ward_id
        left join beds b on b.id = a.bed_id
        where a.hospital_id = $1
          and (a.admission_no ilike $2 or p.full_name ilike $2 or p.patient_no ilike $2
            or coalesce(p.nic, '') ilike $2 or coalesce(a.reason, '') ilike $2
            or coalesce(a.provisional_diagnosis, '') ilike $2 or coalesce(w.name, '') ilike $2
            or coalesce(b.bed_no, '') ilike $2)
        order by a.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "wards")) {
      jobs.push(query<SearchSuggestionRow>(
        `select w.id::text as id,
          coalesce(w.ward_no || ' - ', '') || w.name as label,
          concat_ws(' | ', 'Ward', w.category, w.floor, w.capacity::text, w.status::text) as description,
          'Ward' as category,
          '/wards' as href
        from wards w
        where w.hospital_id = $1 and w.status <> 'deleted'
          and (w.name ilike $2 or coalesce(w.ward_no, '') ilike $2 or w.category ilike $2
            or coalesce(w.floor, '') ilike $2 or coalesce(w.nurse_station, '') ilike $2)
        order by w.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "notifications")) {
      jobs.push(query<SearchSuggestionRow>(
        `select n.id::text as id,
          n.title as label,
          concat_ws(' | ', n.module, n.priority::text, left(n.message, 120)) as description,
          'Notification' as category,
          coalesce(n.action_url, '/notifications') as href
        from notifications n
        where n.hospital_id = $1 and n.status <> 'deleted'
          and (n.title ilike $2 or n.message ilike $2 or coalesce(n.module, '') ilike $2
            or coalesce(n.group_key, '') ilike $2)
        order by n.updated_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    if (includesScope(effectiveScope, "reports")) {
      jobs.push(query<SearchSuggestionRow>(
        `select gm.id::text as id,
          coalesce(gm.original_file_name, gm.file_name, 'Clinical report') as label,
          concat_ws(' | ', gm.module, p.full_name, gm.mime_type, gm.release_status) as description,
          'Report' as category,
          '/reports' as href
        from global_media gm
        left join patients p on p.id = gm.patient_id
        where gm.hospital_id = $1 and gm.status <> 'deleted'
          and (coalesce(gm.original_file_name, '') ilike $2 or coalesce(gm.file_name, '') ilike $2
            or gm.module ilike $2 or coalesce(p.full_name, '') ilike $2 or coalesce(p.patient_no, '') ilike $2)
        order by gm.created_at desc limit $3`,
        [hospitalId, like, perSourceLimit],
      ));
    }

    const results = await Promise.all(jobs);
    const seen = new Set<string>();
    const items = results
      .flatMap((result) => result.rows)
      .filter((item) => {
        const key = `${item.category}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, input.limit);

    response.json(items);
  },
);
