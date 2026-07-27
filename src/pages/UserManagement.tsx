import { Activity, KeyRound, Loader2, RefreshCw, Save, Search, ShieldCheck, UserCog, UserPlus, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageTransition, SectionReveal } from "../components/motion/PageTransition";
import { SmartSearch } from "../components/search/SmartSearch";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { permissions, roleLabels } from "../lib/rbac";
import {
  createUserAccount,
  getUserAccount,
  listDepartments,
  listUserAccounts,
  updateUserAccount,
  type DepartmentOption,
  type UserAccountDetail,
  type UpdateUserAccountInput,
} from "../services/userService";
import type { AppUser, Role } from "../types/ehr";

const adminRoles: Role[] = ["super_admin", "hospital_admin", "ict_admin"];
const accountStatuses = ["active", "pending", "inactive", "suspended", "blocked", "archived"] as const;

const emptySummary = {
  loginCount: 0,
  auditCount: 0,
  visitCount: 0,
  appointmentCount: 0,
  prescriptionCount: 0,
  labRequestCount: 0,
  radiologyRequestCount: 0,
  admissionCount: 0,
};

function toEditor(user: AppUser): UpdateUserAccountInput {
  return {
    fullName: user.displayName,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId ?? null,
    phone: user.phone ?? "",
    address: user.address ?? "",
    permissions: user.permissions ?? [],
    mfaEnabled: user.mfaEnabled,
    status: accountStatuses.includes(user.status as (typeof accountStatuses)[number])
      ? user.status as (typeof accountStatuses)[number]
      : "active",
  };
}

export function UserManagement() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState(searchParams.get("selected") ?? "");
  const [detail, setDetail] = useState<UserAccountDetail | null>(null);
  const [editor, setEditor] = useState<UpdateUserAccountInput>({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedRole = editor.role ?? detail?.user.role ?? "hospital_admin";
  const selectedPermissions = editor.permissions ?? permissions[selectedRole] ?? [];

  const summaryCards = useMemo(() => {
    const summary = detail?.summary ?? emptySummary;
    return [
      ["Logins", summary.loginCount],
      ["Audit actions", summary.auditCount],
      ["Visits", summary.visitCount],
      ["Appointments", summary.appointmentCount],
      ["Prescriptions", summary.prescriptionCount],
      ["Lab requests", summary.labRequestCount],
      ["Radiology", summary.radiologyRequestCount],
      ["Admissions", summary.admissionCount],
    ] as const;
  }, [detail]);

  async function loadUsers(nextQuery = query, nextRole = roleFilter, nextStatus = statusFilter) {
    setLoading(true);
    try {
      const result = await listUserAccounts({ search: nextQuery, role: nextRole, status: nextStatus, limit: 150 });
      setUsers(result.items);
      if (!selectedId && result.items[0]) setSelectedId(result.items[0].id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load PostgreSQL accounts.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadSelected(id: string) {
    if (!id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const result = await getUserAccount(id);
      setDetail(result);
      setEditor(toEditor(result.user));
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("selected", id);
        return next;
      }, { replace: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load the selected account.", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([
      listUserAccounts({ limit: 150 }).then((result) => {
        setUsers(result.items);
        if (!selectedId && result.items[0]) setSelectedId(result.items[0].id);
      }),
      listDepartments().then((result) => setDepartments(result.items)),
    ]).catch((error: unknown) => {
      showToast(error instanceof Error ? error.message : "Unable to connect to the PostgreSQL user database.", "error");
    }).finally(() => setLoading(false));
  // Initial database load only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) void loadSelected(selectedId);
  // Selected account is the only dependency; loadSelected intentionally uses current setters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 300);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, roleFilter, statusFilter]);

  async function saveSelectedAccount() {
    if (!selectedId || !detail) return;
    setSaving(true);
    try {
      const result = await updateUserAccount(selectedId, editor);
      showToast(`${result.user.displayName} was updated in PostgreSQL and the change was audit-logged.`, "success");
      await Promise.all([loadUsers(), loadSelected(selectedId)]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Account update failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function createBlankAccount() {
    setCreating(true);
    try {
      const suffix = Date.now().toString().slice(-6);
      const result = await createUserAccount({
        fullName: `New Staff ${suffix}`,
        email: `new.staff.${suffix}@govcare.lk`,
        role: "receptionist",
        status: "pending",
        permissions: permissions.receptionist,
        mfaEnabled: false,
      });
      await loadUsers();
      setSelectedId(result.user.id);
      showToast("A pending PostgreSQL staff account was created. Update the selected record before activation.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to create the staff account.", "error");
    } finally {
      setCreating(false);
    }
  }

  function applyRole(role: Role) {
    setEditor((current) => ({ ...current, role, permissions: permissions[role] ?? [] }));
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">PostgreSQL account administration</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Search, select, inspect, and update real staff accounts</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Every account, role, department, permission, status change, login record, and audit action on this page is loaded from or written to PostgreSQL.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={loading} onClick={() => void loadUsers()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
            <Button variant="outline" disabled={creating} onClick={createBlankAccount}><UserPlus className="h-4 w-4" />{creating ? "Creating..." : "Create staff account"}</Button>
            <Button disabled={!selectedId || saving} onClick={saveSelectedAccount}><Save className="h-4 w-4" />{saving ? "Saving..." : "Save selected account"}</Button>
          </div>
        </div>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-3">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />JWT and role middleware protect account writes</div>
          <div className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" />Hospital isolation is enforced in SQL queries</div>
          <div className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4" />Each change creates a PostgreSQL audit record</div>
        </div>

        <section className="grid gap-4 xl:grid-cols-[470px_1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />Accounts</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <SmartSearch
                value={query}
                onChange={setQuery}
                onSelect={(suggestion) => {
                  if (suggestion.category === "User" || suggestion.category === "Doctor") setSelectedId(suggestion.id);
                }}
                navigateOnSelect={false}
                placeholder="Search account name, email, role, phone, department"
                scope="users"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as Role | "")}>
                  <option value="">All roles</option>
                  {(Object.keys(roleLabels) as Role[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                </Select>
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  {accountStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </Select>
              </div>
              <div className="max-h-[620px] overflow-auto rounded-md border">
                <Table>
                  <thead><tr><Th>User</Th><Th>Role</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {loading ? (
                      <tr><Td colSpan={3}><span className="flex items-center gap-2 py-4"><Loader2 className="h-4 w-4 animate-spin" />Loading PostgreSQL accounts...</span></Td></tr>
                    ) : users.length ? users.map((user) => (
                      <tr key={user.id} className={selectedId === user.id ? "bg-teal-50 dark:bg-teal-950/30" : "cursor-pointer hover:bg-muted/50"} onClick={() => setSelectedId(user.id)}>
                        <Td className="font-semibold">{user.displayName}<br /><span className="text-xs font-normal text-muted-foreground">{user.email}</span></Td>
                        <Td><Badge tone={adminRoles.includes(user.role) ? "danger" : "info"}>{roleLabels[user.role]}</Badge></Td>
                        <Td><Badge tone={user.status === "active" ? "success" : user.status === "suspended" ? "danger" : "warning"}>{user.status}</Badge></Td>
                      </tr>
                    )) : <tr><Td colSpan={3}>No PostgreSQL accounts match this search.</Td></tr>}
                  </tbody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" />Selected account</CardTitle></CardHeader>
              <CardContent>
                {detailLoading ? <div className="flex items-center gap-2 py-10"><Loader2 className="h-5 w-5 animate-spin" />Loading account and linked records...</div> : detail ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm font-medium">Full name<Input value={editor.fullName ?? ""} onChange={(event) => setEditor((current) => ({ ...current, fullName: event.target.value }))} /></label>
                      <label className="text-sm font-medium">Email<Input type="email" value={editor.email ?? ""} onChange={(event) => setEditor((current) => ({ ...current, email: event.target.value }))} /></label>
                      <label className="text-sm font-medium">Role<Select value={editor.role ?? detail.user.role} onChange={(event) => applyRole(event.target.value as Role)}>{(Object.keys(roleLabels) as Role[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</Select></label>
                      <label className="text-sm font-medium">Department<Select value={editor.departmentId ?? ""} onChange={(event) => setEditor((current) => ({ ...current, departmentId: event.target.value || null }))}><option value="">No department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}</Select></label>
                      <label className="text-sm font-medium">Phone<Input value={editor.phone ?? ""} onChange={(event) => setEditor((current) => ({ ...current, phone: event.target.value }))} /></label>
                      <label className="text-sm font-medium">Status<Select value={editor.status ?? "active"} onChange={(event) => setEditor((current) => ({ ...current, status: event.target.value as UpdateUserAccountInput["status"] }))}>{accountStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</Select></label>
                    </div>
                    <label className="block text-sm font-medium">Address<Input value={editor.address ?? ""} onChange={(event) => setEditor((current) => ({ ...current, address: event.target.value }))} /></label>
                    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={Boolean(editor.mfaEnabled)} onChange={(event) => setEditor((current) => ({ ...current, mfaEnabled: event.target.checked }))} />Require multi-factor authentication</label>
                    <div>
                      <p className="mb-2 text-sm font-medium">Role permissions</p>
                      <div className="flex max-h-36 flex-wrap gap-2 overflow-auto rounded-md border p-3">
                        {selectedPermissions.map((permission) => <Badge key={permission} tone={permission === "*" || permission.includes("admin") ? "danger" : "info"}>{permission}</Badge>)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                      PostgreSQL account ID: {detail.user.id} · Last login: {detail.user.lastLoginAt ? new Date(detail.user.lastLoginAt).toLocaleString() : "No recorded login"}
                    </div>
                  </div>
                ) : <p className="py-10 text-sm text-muted-foreground">Select an account to view and update its PostgreSQL record.</p>}
              </CardContent>
            </Card>

            <SectionReveal>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" />Selected account records</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map(([label, value]) => <div key={label} className="rounded-md border p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <thead><tr><Th>Time</Th><Th>Record</Th><Th>Details</Th></tr></thead>
                      <tbody>
                        {detail?.activity.length ? detail.activity.map((record) => (
                          <tr key={`${record.type}-${record.id}`}>
                            <Td className="whitespace-nowrap">{new Date(record.createdAt).toLocaleString()}</Td>
                            <Td><Badge tone={record.type === "login" ? "info" : "neutral"}>{record.title}</Badge></Td>
                            <Td>{record.detail || "—"}</Td>
                          </tr>
                        )) : <tr><Td colSpan={3}>No login or audit records are linked to the selected account.</Td></tr>}
                      </tbody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </SectionReveal>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
