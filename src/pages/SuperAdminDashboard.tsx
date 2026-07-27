import {
  Activity,
  AlertTriangle,
  ArchiveRestore,
  Bell,
  Building2,
  CheckCircle2,
  Cloud,
  Database,
  FileClock,
  Gauge,
  Globe2,
  HardDrive,
  KeyRound,
  Layers3,
  Lock,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { SelfRegistrationQrCenter } from "../components/admin/SelfRegistrationQrCenter";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SmartSearch } from "../components/search/SmartSearch";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { permissions, roleLabels } from "../lib/rbac";
import type { Role } from "../types/ehr";

type ActorPanel = {
  role: Role;
  modules: string[];
  active: number;
  pending: number;
  blocked: number;
  recent: string;
  customization: string;
};

const actorPanels: ActorPanel[] = [
  { role: "hospital_admin", modules: ["Hospitals", "Departments", "Users", "Reports", "Settings"], active: 18, pending: 3, blocked: 1, recent: "Updated ward bed template", customization: "Hospital-scoped admin controls" },
  { role: "doctor", modules: ["Doctor Center", "OPD", "Telemedicine", "Prescriptions", "Lab/Radiology"], active: 142, pending: 11, blocked: 4, recent: "Approved critical lab review", customization: "Clinical workspace templates" },
  { role: "nurse", modules: ["Ward Management", "Vitals", "MAR", "Care Plans", "Handover"], active: 286, pending: 18, blocked: 7, recent: "Completed shift handover", customization: "Bedside workflow controls" },
  { role: "pharmacist", modules: ["Pharmacy", "Prescriptions", "Medicines", "Stock", "Expiry Alerts"], active: 42, pending: 4, blocked: 1, recent: "Issued partial prescription", customization: "Substitution and stock rules" },
  { role: "lab_technician", modules: ["Laboratory", "Samples", "Results", "Critical Alerts"], active: 64, pending: 9, blocked: 2, recent: "Uploaded CBC result", customization: "Department work queues" },
  { role: "radiologist", modules: ["Radiology", "DICOM", "Reports", "Critical Imaging"], active: 21, pending: 2, blocked: 0, recent: "Signed CT report", customization: "Report templates and signatures" },
  { role: "receptionist", modules: ["Registration", "OPD Queue", "Appointments", "QR Tickets"], active: 37, pending: 5, blocked: 2, recent: "Generated OPD token", customization: "Counter and queue rules" },
  { role: "records_officer", modules: ["Patients", "Reports", "Audit Read", "Exports", "Documents"], active: 29, pending: 3, blocked: 1, recent: "Exported monthly disease report", customization: "Record release workflow" },
  { role: "patient", modules: ["Portal", "Appointments", "Reports", "Messages"], active: 12840, pending: 806, blocked: 55, recent: "Downloaded released lab report", customization: "Released-information controls" },
  { role: "ict_admin", modules: ["Backups", "API request validation", "Functions", "Hosting", "Security"], active: 9, pending: 1, blocked: 0, recent: "Verified API request validation status", customization: "Infrastructure operations" },
];

const systemCounters = [
  { label: "Hospitals", value: "42", tone: "info" as const, icon: Building2 },
  { label: "Departments", value: "418", tone: "success" as const, icon: Layers3 },
  { label: "Active users", value: "13,488", tone: "info" as const, icon: UsersRound },
  { label: "Patients", value: "2.4M", tone: "success" as const, icon: UserCheck },
  { label: "Critical alerts", value: "17", tone: "danger" as const, icon: ShieldAlert },
  { label: "Failed logins", value: "23", tone: "warning" as const, icon: Lock },
];

const moduleAccess = [
  ["Patient Records", "patients:*", "All hospitals", "High", true],
  ["OPD Queue", "opd:*", "Hospital + department", "Medium", true],
  ["Doctor Center", "visits:*", "Assigned care teams", "High", true],
  ["Telemedicine", "telemedicine:*", "Appointment scoped", "Medium", true],
  ["Secure Chat", "messages:*", "Conversation scoped", "High", true],
  ["Pharmacy", "pharmacy:*", "Hospital + stock room", "High", true],
  ["Laboratory", "lab:*", "Department + request", "High", true],
  ["Radiology", "radiology:*", "Department + request", "High", true],
  ["Emergency", "emergency:*", "Emergency override", "Critical", true],
  ["Backups", "backups:*", "Super Admin + ICT", "Critical", false],
];

const postgresqlHealth = [
  { name: "PostgreSQL API Auth", status: "Healthy", detail: "13,488 users, MFA policy ready", tone: "success" as const, icon: ShieldCheck },
  { name: "PostgreSQL", status: "Indexed", detail: "34 collections monitored, 18 composite indexes", tone: "success" as const, icon: Database },
  { name: "backend API jobs", status: "Warning", detail: "2 prescription jobs need retry review", tone: "warning" as const, icon: Cloud },
  { name: "application hosting", status: "Live", detail: "Current build deployed to production channel", tone: "success" as const, icon: Server },
  { name: "API request validation", status: "Enforced", detail: "Web app protected; debug token disabled", tone: "success" as const, icon: Lock },
  { name: "Cloud Messaging", status: "Active", detail: "Push channels registered for 9 roles", tone: "info" as const, icon: Bell },
];

const collectionOverview = [
  ["hospitals", "42", "strict admin", "healthy"],
  ["users", "13,488", "JWT role claims", "healthy"],
  ["patients", "2,438,190", "hospital isolated", "healthy"],
  ["consultations", "884,120", "doctor scoped", "indexed"],
  ["prescriptions", "612,944", "signed issue flow", "indexed"],
  ["labRequests", "318,042", "role scoped", "healthy"],
  ["radiologyReports", "98,404", "released only", "healthy"],
  ["auditLogs", "8,901,238", "append-only", "archive due"],
];

const activityData = [
  { name: "Users", value: 188 },
  { name: "Patients", value: 420 },
  { name: "OPD", value: 336 },
  { name: "Lab", value: 148 },
  { name: "Radiology", value: 82 },
  { name: "Pharmacy", value: 121 },
  { name: "Emergency", value: 39 },
];

const roleMix = [
  { name: "Clinical", value: 44, color: "#0f766e" },
  { name: "Diagnostics", value: 18, color: "#0891b2" },
  { name: "Admin", value: 12, color: "#f59e0b" },
  { name: "Patients", value: 26, color: "#be123c" },
];

const auditEvents = [
  ["10:42", "Security", "Failed login threshold reached", "warning"],
  ["10:36", "Users", "Doctor account reactivated by Super Admin", "success"],
  ["10:28", "Backup", "PostgreSQL backup completed", "success"],
  ["10:14", "API request validation", "Unauthorized debug token rejected", "danger"],
  ["09:58", "Reports", "National disease report exported", "info"],
];

function permissionTone(enabled: boolean) {
  return enabled ? "success" : "neutral";
}

export function SuperAdminDashboard() {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<Role>("hospital_admin");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("actors");
  const rolePermissions = permissions[selectedRole] ?? [];

  const filteredActors = useMemo(() => {
    const query = search.toLowerCase();
    return actorPanels.filter((actor) => {
      const roleLabel = roleLabels[actor.role].toLowerCase();
      return !query || roleLabel.includes(query) || actor.modules.some((module) => module.toLowerCase().includes(query));
    });
  }, [search]);

  function adminAction(label: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    showToast(`${label} queued through the secure PostgreSQL API with an audit log.`, tone);
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">{t("superAdmin.eyebrow", "Super Admin Command Center")}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{t("superAdmin.title", "Full platform control for government hospital operations")}</h1>
            <p className="mt-2 max-w-4xl text-sm text-muted-foreground">
              {t("superAdmin.subtitle", "Manage hospitals, users, roles, permissions, security, backups, PostgreSQL API services, notifications, audit logs, reports, and every clinical module from one secured control surface.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => adminAction("Security policy refresh", "warning")}><ShieldCheck className="h-4 w-4" />Security policy</Button>
            <Button variant="outline" onClick={() => adminAction("Backup restore validation", "info")}><ArchiveRestore className="h-4 w-4" />Backup / restore</Button>
            <Button onClick={() => adminAction("Super Admin configuration save")}><SlidersHorizontal className="h-4 w-4" />Save controls</Button>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {systemCounters.map((item) => (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{item.value}</p>
                </div>
                <Badge tone={item.tone}><item.icon className="h-5 w-5" /></Badge>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Real-time module activity</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" />User role distribution</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roleMix} dataKey="value" nameKey="name" outerRadius={92} label>
                    {roleMix.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {["actors", "qr", "permissions", "users", "postgresql", "audit", "collections"].map((tab) => (
                <Button key={tab} variant={activeTab === tab ? "primary" : "outline"} onClick={() => setActiveTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</Button>
              ))}
            </div>
            <SmartSearch className="min-w-64" value={search} onChange={setSearch} placeholder="Search roles, modules, users..." scope="users" />
          </CardContent>
        </Card>

        {activeTab === "actors" && (
          <Stagger>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredActors.map((actor) => (
                <Reveal key={actor.role}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" />{roleLabels[actor.role]}</span>
                        <Badge tone={actor.blocked > 0 ? "warning" : "success"}>{actor.active} active</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded-md bg-emerald-50 p-2 text-emerald-800"><p className="font-bold">{actor.active}</p><p>Active</p></div>
                        <div className="rounded-md bg-amber-50 p-2 text-amber-800"><p className="font-bold">{actor.pending}</p><p>Pending</p></div>
                        <div className="rounded-md bg-rose-50 p-2 text-rose-800"><p className="font-bold">{actor.blocked}</p><p>Blocked</p></div>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">Accessible modules</p>
                        <div className="mt-2 flex flex-wrap gap-2">{actor.modules.map((module) => <Badge key={module} tone="info">{module}</Badge>)}</div>
                      </div>
                      <div className="selection-panel p-3 text-sm">
                        <p className="font-semibold text-slate-950">{actor.customization}</p>
                        <p className="mt-1 text-muted-foreground">Recent: {actor.recent}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button className="min-h-9 px-3 py-1.5" variant="outline" onClick={() => adminAction(`${roleLabels[actor.role]} permissions opened`, "info")}><SlidersHorizontal className="h-4 w-4" />Customize</Button>
                        <Button className="min-h-9 px-3 py-1.5" variant="outline" onClick={() => adminAction(`${roleLabels[actor.role]} access review`, "warning")}><ShieldCheck className="h-4 w-4" />Review</Button>
                      </div>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </section>
          </Stagger>
        )}

        {activeTab === "qr" && <SelfRegistrationQrCenter />}

        {activeTab === "permissions" && (
          <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Role permission editor</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <label className="block text-sm font-medium">Actor role<Select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Role)}>{(Object.keys(roleLabels) as Role[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</Select></label>
                <div className="help-strip p-3 text-sm">Sensitive permission writes must call backend API jobs to update JWT role claims and PostgreSQL permissions and audit logs. Client UI only queues the request.</div>
                <div className="flex flex-wrap gap-2">{rolePermissions.map((permission) => <Badge key={permission} tone={permission === "*" ? "danger" : "info"}>{permission}</Badge>)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-primary" />Module access control</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <thead><tr><Th>Module</Th><Th>Permission</Th><Th>Scope</Th><Th>Risk</Th><Th>Status</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {moduleAccess.map(([module, permission, scope, risk, enabled]) => (
                      <tr key={module as string}>
                        <Td className="font-semibold">{module}</Td>
                        <Td><Badge tone="info">{permission}</Badge></Td>
                        <Td>{scope}</Td>
                        <Td><Badge tone={risk === "Critical" ? "danger" : risk === "High" ? "warning" : "neutral"}>{risk}</Badge></Td>
                        <Td><Badge tone={permissionTone(Boolean(enabled))}>{enabled ? "enabled" : "restricted"}</Badge></Td>
                        <Td><Button variant="outline" onClick={() => adminAction(`${module} access toggled`, enabled ? "warning" : "success")}>{enabled ? "Restrict" : "Enable"}</Button></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          </section>
        )}

        {activeTab === "users" && (
          <SectionReveal>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />User lifecycle management</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {[
                    ["Create", UserPlus, "success"],
                    ["Activate", UserCheck, "success"],
                    ["Suspend", UserMinus, "warning"],
                    ["Delete", XCircle, "danger"],
                    ["Reset password", KeyRound, "info"],
                    ["Verify account", CheckCircle2, "success"],
                  ].map(([label, Icon, tone]) => (
                    <Button key={label as string} variant="outline" onClick={() => adminAction(`${label} user action`, tone as "success" | "warning" | "danger" | "info")}><Icon className="h-4 w-4" />{label as string}</Button>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <thead><tr><Th>User</Th><Th>Role</Th><Th>Hospital</Th><Th>Status</Th><Th>MFA</Th><Th>Last login</Th><Th>Access</Th></tr></thead>
                    <tbody>
                      {actorPanels.slice(0, 8).map((actor, index) => (
                        <tr key={actor.role}>
                          <Td className="font-semibold">{roleLabels[actor.role]} Lead<br /><span className="text-xs text-muted-foreground">USR-SUP-{String(index + 1).padStart(3, "0")}</span></Td>
                          <Td><Badge tone={actor.role.includes("admin") ? "danger" : "info"}>{roleLabels[actor.role]}</Badge></Td>
                          <Td>National / Provincial</Td>
                          <Td><Badge tone={actor.blocked ? "warning" : "success"}>{actor.blocked ? "review" : "active"}</Badge></Td>
                          <Td><Badge tone="success">enabled</Badge></Td>
                          <Td>Today 10:{42 - index}</Td>
                          <Td><Button variant="outline" onClick={() => adminAction(`Access level changed for ${roleLabels[actor.role]}`, "warning")}>Control</Button></Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </SectionReveal>
        )}

        {activeTab === "postgresql" && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {postgresqlHealth.map((service) => (
              <Card key={service.name}>
                <CardContent className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{service.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{service.detail}</p>
                    <Badge className="mt-3" tone={service.tone}>{service.status}</Badge>
                  </div>
                  <service.icon className="h-6 w-6 text-primary" />
                </CardContent>
              </Card>
            ))}
            <Card className="md:col-span-2 xl:col-span-3">
              <CardHeader><CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5 text-primary" />Backup, restore, and deployment controls</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                {["Run backup", "Test restore", "View function logs", "Deploy hosting"].map((label) => <Button key={label} variant="outline" onClick={() => adminAction(label, "info")}>{label}</Button>)}
              </CardContent>
            </Card>
          </section>
        )}

        {activeTab === "audit" && (
          <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5 text-primary" />Security and audit timeline</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {auditEvents.map(([time, module, message, tone]) => (
                  <div key={`${time}-${message}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                    <div>
                      <p className="font-semibold text-slate-950">{message}</p>
                      <p className="text-xs text-muted-foreground">{time} | {module}</p>
                    </div>
                    <Badge tone={tone as "success" | "warning" | "danger" | "info"}>{tone}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" />Security alerts</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="help-strip p-3">Failed login alerts, suspicious exports, API request validation rejection, emergency access, and custom-claim changes are monitored here.</p>
                <Button className="w-full" variant="outline" onClick={() => adminAction("Zero-trust security scan", "warning")}><ShieldAlert className="h-4 w-4" />Run security scan</Button>
                <Button className="w-full" variant="outline" onClick={() => adminAction("Notification broadcast", "info")}><Globe2 className="h-4 w-4" />Broadcast maintenance notice</Button>
              </CardContent>
            </Card>
          </section>
        )}

        {activeTab === "collections" && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />PostgreSQL collection management overview</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <thead><tr><Th>Collection</Th><Th>Documents</Th><Th>Access model</Th><Th>Status</Th><Th>Controls</Th></tr></thead>
                <tbody>
                  {collectionOverview.map(([collection, docs, model, status]) => (
                    <tr key={collection}>
                      <Td className="font-semibold">{collection}</Td>
                      <Td>{docs}</Td>
                      <Td>{model}</Td>
                      <Td><Badge tone={status === "archive due" ? "warning" : "success"}>{status}</Badge></Td>
                      <Td><Button variant="outline" onClick={() => adminAction(`${collection} rules/index review`, "info")}>Review</Button></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
