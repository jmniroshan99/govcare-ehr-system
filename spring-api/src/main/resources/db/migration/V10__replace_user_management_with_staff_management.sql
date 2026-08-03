-- Staff Management is now the canonical administrative account interface.
-- Keep app_users, roles, permissions and legacy APIs unchanged for compatibility.

update roles
set default_route = '/admin/staff',
    updated_at = now()
where code = 'hospital_admin'
  and default_route is distinct from '/admin/staff';
