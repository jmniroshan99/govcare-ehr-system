import { motion } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Activity, Clock3, Download, FileSpreadsheet, FileText, LogIn, MonitorCheck, Printer, ShieldAlert, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SmartSearch } from "../components/search/SmartSearch";
import { Badge, StatusBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { seedLoginActivitiesForDemo, subscribeToLoginActivities } from "../services/loginActivityService";
import { useAuthStore } from "../stores/authStore";
import type { LoginActivity } from "../types/ehr";
import { downloadTextFile, timestampedFilename, toCsv } from "../utils/download";

const PAGE_SIZE = 10;
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
const formatDuration = (seconds?: number) => seconds === undefined ? "Active" : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

export function LoginActivityReport() {
  const profile = useAuthStore((state) => state.profile);
  const { showToast } = useToast();
  const [rows, setRows] = useState<LoginActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [department, setDepartment] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: keyof LoginActivity; direction: "asc" | "desc" }>({ key: "timestamp", direction: "desc" });

  useEffect(() => {
    if (!profile) return;
    if (window.sessionStorage.getItem("govcare-auth-mode") === "demo") seedLoginActivitiesForDemo(profile.hospitalId);
    return subscribeToLoginActivities(profile.hospitalId, profile.role, (items) => { setRows(items); setLoading(false); }, (reason) => { setError(reason.message); setLoading(false); });
  }, [profile]);

  const options = useMemo(() => ({
    roles: [...new Set(rows.map((row) => row.role).filter(Boolean))].sort(),
    departments: [...new Set(rows.map((row) => row.departmentName).filter(Boolean))].sort(),
  }), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const haystack = [row.fullName, row.email, row.userId, row.role, row.departmentName, row.hospitalName, row.ipAddress].filter(Boolean).join(" ").toLowerCase();
    const date = row.loginTime.slice(0, 10);
    return (!term || haystack.includes(term)) && (role === "all" || row.role === role) && (status === "all" || row.loginStatus === status)
      && (method === "all" || row.authenticationMethod === method) && (department === "all" || row.departmentName === department)
      && (!from || date >= from) && (!to || date <= to);
  }).sort((a, b) => {
    const result = String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""));
    return sort.direction === "asc" ? result : -result;
  }), [rows, search, role, status, method, department, from, to, sort]);

  const today = new Date().toISOString().slice(0, 10);
  const metrics = {
    today: rows.filter((row) => row.loginStatus === "success" && row.loginTime.startsWith(today)).length,
    active: rows.filter((row) => row.logoutStatus === "active").length,
    failed: rows.filter((row) => row.loginStatus === "failed").length,
    online: new Set(rows.filter((row) => row.logoutStatus === "active").map((row) => row.userId)).size,
    total: rows.length,
  };
  const metricCards: Array<[string, number, LucideIcon]> = [
    ["Today's logins", metrics.today, LogIn], ["Active sessions", metrics.active, MonitorCheck],
    ["Failed logins", metrics.failed, ShieldAlert], ["Online users", metrics.online, Users], ["Total logins", metrics.total, Activity],
  ];
  const trend = useMemo(() => {
    const days = new Map<string, { day: string; success: number; failed: number }>();
    rows.forEach((row) => { const day = row.loginTime.slice(5, 10); const item = days.get(day) ?? { day, success: 0, failed: 0 }; item[row.loginStatus] += 1; days.set(day, item); });
    return [...days.values()].slice(-14);
  }, [rows]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeSort(key: keyof LoginActivity) {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  }
  const exportRows = () => filtered.map((row) => [row.fullName, row.email, row.role ?? "Unknown", row.hospitalName ?? row.hospitalId, row.departmentName ?? "-", row.loginStatus, row.logoutStatus, formatDate(row.loginTime), formatDate(row.logoutTime), formatDuration(row.sessionDurationSeconds), row.ipAddress ?? "Unavailable", row.deviceBrowser, row.operatingSystem, row.authenticationMethod, row.failureReason ?? ""]);
  function exportCsv() {
    downloadTextFile(timestampedFilename("govcare-login-activity", "csv"), toCsv([["Name", "Email", "Role", "Hospital", "Department", "Login", "Logout", "Login time", "Logout time", "Duration", "IP", "Device", "OS", "Method", "Failure reason"], ...exportRows()]), "text/csv;charset=utf-8");
    showToast("Login activity CSV downloaded.", "success");
  }
  function exportExcel() {
    const table = `<table><tr>${["Name","Email","Role","Hospital","Department","Login","Logout","Login time","Logout time","Duration","IP","Device","OS","Method","Failure reason"].map((v) => `<th>${v}</th>`).join("")}</tr>${exportRows().map((row) => `<tr>${row.map((v) => `<td>${String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>`).join("")}</tr>`).join("")}</table>`;
    downloadTextFile(timestampedFilename("govcare-login-activity", "xls"), table, "application/vnd.ms-excel;charset=utf-8");
    showToast("Excel-compatible report downloaded.", "success");
  }
  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16); doc.text("GovCare EHR - User Login Activity", 14, 16);
    autoTable(doc, { startY: 22, head: [["Name", "Role", "Department", "Login", "Logout", "Time", "Duration", "Device", "Method"]], body: filtered.map((r) => [r.fullName, r.role ?? "Unknown", r.departmentName ?? "-", r.loginStatus, r.logoutStatus, formatDate(r.loginTime), formatDuration(r.sessionDurationSeconds), r.deviceBrowser, r.authenticationMethod]), styles: { fontSize: 7 }, headStyles: { fillColor: [15, 118, 110] } });
    doc.save(timestampedFilename("govcare-login-activity", "pdf"));
    showToast("PDF report downloaded.", "success");
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-80 w-full" /></div>;
  return (
    <div className="space-y-5">
      <header className="page-hero flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-primary">Security and access intelligence</p><h1 className="mt-1 text-2xl font-bold text-slate-950">User login activity</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Monitor authentication outcomes, active sessions, access methods, and account failures across your permitted hospitals.</p></div>
        <div className="flex flex-wrap gap-2 print:hidden"><Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button><Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button><Button onClick={exportPdf}><FileText className="h-4 w-4" />PDF</Button></div>
      </header>
      {error && <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-800">Unable to load live activity: {error}</div>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metricCards.map(([label, value, Icon], index) => <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }}><Card className="kpi-card"><CardContent className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div><div className="rounded-md bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div></CardContent></Card></motion.div>)}</section>
      <section className="grid gap-4 xl:grid-cols-[1.4fr_.6fr]">
        <Card className="min-w-0"><CardHeader><CardTitle>Login trend</CardTitle></CardHeader><CardContent className="h-64 min-w-0 overflow-hidden"><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="success" fill="#0f766e" radius={[4,4,0,0]} /><Bar dataKey="failed" fill="#be123c" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Active sessions</CardTitle></CardHeader><CardContent className="space-y-3">{rows.filter((r) => r.logoutStatus === "active").slice(0,5).map((r) => <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-950">{r.fullName}</p><p className="truncate text-xs text-muted-foreground">{r.role?.replaceAll("_", " ")} · {r.deviceBrowser}</p></div><Badge tone="success">Online</Badge></div>)}{!metrics.active && <p className="py-8 text-center text-sm text-muted-foreground">No active sessions.</p>}</CardContent></Card>
      </section>
      <Card>
        <CardHeader><CardTitle>Search and filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="xl:col-span-2"><SmartSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} navigateOnSelect={false} placeholder="Name, email, user, IP..." scope="users" /></div>
          <Select value={role} onChange={(e) => setRole(e.target.value)}><option value="all">All roles</option>{options.roles.map((v) => <option key={v} value={v}>{v?.replaceAll("_", " ")}</option>)}</Select>
          <Select value={department} onChange={(e) => setDepartment(e.target.value)}><option value="all">All departments</option>{options.departments.map((v) => <option key={v} value={v}>{v}</option>)}</Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="success">Success</option><option value="failed">Failed</option></Select>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}><option value="all">All methods</option><option value="email_password">Email/password</option><option value="google">Google</option><option value="demo">Demo</option></Select>
          <div className="flex gap-2"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" /></div>
        </CardContent>
      </Card>
      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Authentication records</CardTitle><Badge tone="info">{filtered.length} records</Badge></CardHeader><CardContent className="overflow-x-auto">
        <Table className="min-w-[1450px]"><thead><tr>{[["fullName","User"],["role","Role"],["departmentName","Hospital / department"],["loginStatus","Login"],["logoutStatus","Session"],["loginTime","Login time"],["sessionDurationSeconds","Duration"],["deviceBrowser","Device / OS"],["authenticationMethod","Method"],["failureReason","Details"]].map(([key,label]) => <Th key={key}><button className="font-bold" onClick={() => changeSort(key as keyof LoginActivity)}>{label}</button></Th>)}</tr></thead>
          <tbody>{visible.map((row) => <tr key={row.id}><Td><p className="font-bold text-slate-950">{row.fullName}</p><p className="text-xs text-muted-foreground">{row.email}</p><p className="text-xs text-muted-foreground">{row.userId ?? "Unidentified"}</p></Td><Td><Badge tone="info">{row.role?.replaceAll("_", " ") ?? "Unknown"}</Badge></Td><Td><p>{row.hospitalName ?? row.hospitalId}</p><p className="text-xs text-muted-foreground">{row.departmentName ?? "Not assigned"}</p></Td><Td><StatusBadge status={row.loginStatus} /></Td><Td><StatusBadge status={row.logoutStatus} /></Td><Td>{formatDate(row.loginTime)}<p className="text-xs text-muted-foreground">Last: {formatDate(row.lastActivityTime)}</p></Td><Td><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDuration(row.sessionDurationSeconds)}</span></Td><Td><p>{row.deviceBrowser}</p><p className="text-xs text-muted-foreground">{row.operatingSystem} · {row.ipAddress ?? "IP unavailable"}</p></Td><Td>{row.authenticationMethod.replaceAll("_", " ")}</Td><Td className="max-w-52">{row.failureReason ?? row.location ?? "-"}</Td></tr>)}</tbody>
        </Table>{!visible.length && <div className="py-14 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold text-slate-950">No login activity matches these filters.</p></div>}
        <div className="mt-4 flex items-center justify-between print:hidden"><p className="text-sm text-muted-foreground">Page {page} of {pageCount}</p><div className="flex gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage((v) => v - 1)}>Previous</Button><Button variant="outline" disabled={page === pageCount} onClick={() => setPage((v) => v + 1)}>Next</Button></div></div>
      </CardContent></Card>
    </div>
  );
}
