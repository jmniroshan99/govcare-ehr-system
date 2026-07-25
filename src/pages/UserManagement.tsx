import { KeyRound, Lock, Save, ShieldCheck, UserCog, UserPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { permissions, roleLabels } from "../lib/rbac";
import type { Role } from "../types/ehr";
import { refreshAndRedirectToMainMenu } from "../utils/navigation";

const privilegeGroups = [
  { key: "users", label: "Users and roles", permissions: ["users:*", "roles:*", "admin:*"] },
  { key: "patients", label: "Patient records", permissions: ["patients:*", "patients:read", "patients:create"] },
  { key: "clinical", label: "Clinical operations", permissions: ["opd:*", "visits:*", "wards:*", "vitals:update", "emergency:update"] },
  { key: "diagnostics", label: "Diagnostics", permissions: ["lab:*", "lab:read", "lab:approve", "lab:sign", "radiology:*", "radiology:read"] },
  { key: "hospital", label: "Hospital setup", permissions: ["departments:*", "wards:*", "beds:*", "settings:*"] },
  { key: "reports", label: "Reports and audit", permissions: ["reports:*", "reports:export", "reports:lab", "audit:read"] },
];

const staffRows = [
  { id: "USR-001", name: "Dr. Anjali Perera", email: "doctor@govcare.gov.lk", role: "doctor" as Role, status: "active" },
  { id: "USR-002", name: "Nurse Silva", email: "nurse@govcare.gov.lk", role: "nurse" as Role, status: "active" },
  { id: "USR-003", name: "Lab Manager", email: "lab.manager@govcare.gov.lk", role: "lab_manager" as Role, status: "active" },
  { id: "USR-004", name: "Pathologist", email: "pathologist@govcare.gov.lk", role: "pathologist" as Role, status: "pending MFA" },
  { id: "USR-005", name: "Hospital Admin", email: "admin@govcare.gov.lk", role: "hospital_admin" as Role, status: "active" },
];

const adminRoles: Role[] = ["super_admin", "hospital_admin"];

function roleHasPermission(role: Role, permission: string) {
  const allowed = permissions[role] ?? [];
  return allowed.includes("*") || allowed.includes(permission) || allowed.some((item) => item.endsWith(":*") && permission.startsWith(item.replace("*", "")));
}

export function UserManagement() {
  const { showToast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role>("hospital_admin");
  const selectedPermissions = permissions[selectedRole] ?? [];
  const accessSummary = useMemo(() => privilegeGroups.map((group) => ({
    ...group,
    granted: group.permissions.some((permission) => roleHasPermission(selectedRole, permission)),
  })), [selectedRole]);

  function savePrivileges() {
    showToast(`${roleLabels[selectedRole]} privileges saved. Deploy Spring Boot service custom claims to enforce in Firebase.`, "success");
    refreshAndRedirectToMainMenu();
  }

  function grantAdmin() {
    showToast("Admin privilege grant queued for secure Spring Boot service approval.", "warning");
  }

  function inviteStaff() {
    showToast("Staff invitation workflow opened. In production this sends an email invite through Spring Boot services.", "info");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Admin privileges</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Control roles, staff access, and Firebase custom claims</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Super Admin has full platform access. Hospital Admin can manage hospital users, roles, departments, wards, reports, settings, and hospital-scoped patient administration.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={grantAdmin}><KeyRound className="h-4 w-4" />Grant admin</Button>
            <Button onClick={savePrivileges}><Save className="h-4 w-4" />Save privileges</Button>
          </div>
        </div>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-3">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />Admin actions require Spring Boot services</div>
          <div className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" />Spring Boot API authorization enforce hospital isolation</div>
          <div className="flex items-center gap-2 font-semibold"><UserCog className="h-4 w-4" />Custom claims control module access</div>
        </div>

        <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" />Role template</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="block text-sm font-medium">
                Select role
                <Select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Role)}>
                  {(Object.keys(roleLabels) as Role[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                </Select>
              </label>
              <div className="selection-panel p-3 text-sm">
                <p className="font-bold text-slate-950">{roleLabels[selectedRole]}</p>
                <p className="mt-1 text-muted-foreground">{adminRoles.includes(selectedRole) ? "Administrative role with elevated hospital privileges." : "Operational role with limited least-privilege access."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPermissions.map((permission) => <Badge key={permission} tone={permission === "*" || permission.includes("admin") ? "danger" : "info"}>{permission}</Badge>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Privilege matrix</CardTitle></CardHeader>
            <CardContent>
              <Stagger>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {accessSummary.map((group) => (
                    <Reveal key={group.key}>
                      <div className={`rounded-md border p-4 ${group.granted ? "border-teal-200 bg-teal-50" : "border-border bg-white"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-950">{group.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{group.permissions.join(", ")}</p>
                          </div>
                          <Badge tone={group.granted ? "success" : "neutral"}>{group.granted ? "allowed" : "blocked"}</Badge>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </Stagger>
            </CardContent>
          </Card>
        </section>

        <SectionReveal>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />Staff access</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap justify-between gap-3">
                <p className="text-sm text-muted-foreground">Role changes must be written through a secure Spring Boot service that updates Firebase Auth custom claims and creates an audit log.</p>
                <Button variant="outline" onClick={inviteStaff}><UserPlus className="h-4 w-4" />Invite staff</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <thead><tr><Th>User</Th><Th>Email</Th><Th>Role</Th><Th>Admin</Th><Th>Status</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {staffRows.map((user) => (
                      <tr key={user.id}>
                        <Td className="font-semibold">{user.name}<br /><span className="text-xs text-muted-foreground">{user.id}</span></Td>
                        <Td>{user.email}</Td>
                        <Td><Badge tone={adminRoles.includes(user.role) ? "danger" : "info"}>{roleLabels[user.role]}</Badge></Td>
                        <Td><Badge tone={adminRoles.includes(user.role) ? "success" : "neutral"}>{adminRoles.includes(user.role) ? "yes" : "no"}</Badge></Td>
                        <Td><Badge tone={user.status === "active" ? "success" : "warning"}>{user.status}</Badge></Td>
                        <Td><Button variant="outline" onClick={grantAdmin}>Change role</Button></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </SectionReveal>
      </div>
    </PageTransition>
  );
}

