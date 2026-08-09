import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BarChart3, ChevronDown, ChevronUp, Download, FileSpreadsheet, FileText, Filter, LoaderCircle, Printer, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { z } from "zod";
import { Badge } from "../components/ui/badge";
import type { BadgeTone } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SmartSearch } from "../components/search/SmartSearch";
import { AsyncSearchableSelect, SearchableSelect } from "../components/forms";
import { DiagnosisSearchSelector, MedicineSearchSelector, StaffSearchSelector } from "../components/selectors";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { reportDefinitions, reportRows } from "../data/adminReports";
import { GENDER_OPTIONS, PRIORITY_OPTIONS, type SelectOption } from "../data/referenceOptions";
import type { ReportCategory } from "../data/adminReports";
import { createAdminReportJob } from "../services/reportService";
import { searchLaboratoryTests, searchRadiologyStudies } from "../services/referenceDataService";
import type { ReportFilters } from "../services/reportService";
import { useAuthStore } from "../stores/authStore";
import { downloadTextFile, timestampedFilename, toCsv } from "../utils/download";

const filterSchema = z.object({
  category: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  hospitalId: z.string().min(1),
  department: z.string(),
  staff: z.string(),
  patientId: z.string(),
  nic: z.string(),
  gender: z.string(),
  ageGroup: z.string(),
  diagnosis: z.string(),
  status: z.string(),
  ward: z.string(),
  medicine: z.string(),
  testType: z.string(),
  priority: z.string(),
}).refine((value) => value.from <= value.to, { message: "End date must be on or after the start date.", path: ["to"] });

type FilterForm = z.infer<typeof filterSchema>;
type SortKey = "date" | "subject" | "department" | "status" | "value";
type KpiCard = [string, number, LucideIcon, BadgeTone];

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;
const pageSize = 8;

function statusTone(status: string) {
  if (["critical", "urgent", "low-stock", "reorder"].includes(status)) return "danger" as const;
  if (["pending", "admitted", "occupied"].includes(status)) return "warning" as const;
  if (["completed", "approved", "issued", "released", "paid", "healthy", "on-target"].includes(status)) return "success" as const;
  return "info" as const;
}

export function Reports() {
  const profile = useAuthStore((state) => state.profile);
  const { showToast } = useToast();
  const isFullAdmin = profile?.role === "super_admin" || profile?.role === "hospital_admin";
  const availableReports = useMemo(
    () => reportDefinitions.filter((report) => profile && report.roles.includes(profile.role)),
    [profile],
  );
  const defaultCategory = availableReports[0]?.id ?? "patients";
  const [activeFilters, setActiveFilters] = useState<ReportFilters>({
    category: defaultCategory,
    from: monthStart,
    to: today,
    hospitalId: profile?.hospitalId ?? "hosp-colombo-national",
    department: isFullAdmin ? "" : profile?.departmentName ?? profile?.departmentId ?? "",
    staff: "",
    patientId: "",
    nic: "",
    gender: "",
    ageGroup: "",
    diagnosis: "",
    status: "",
    ward: "",
    medicine: "",
    testType: "",
    priority: "",
  });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "date", direction: "desc" });
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FilterForm>({
    resolver: zodResolver(filterSchema),
    defaultValues: activeFilters,
  });

  const reportQuery = useQuery({
    queryKey: ["admin-report-preview", activeFilters],
    queryFn: async () => {
      const scopedDepartment = isFullAdmin ? activeFilters.department : profile?.departmentName ?? profile?.departmentId ?? "";
      return reportRows.filter((row) => {
        if (row.category !== activeFilters.category) return false;
        if (row.date < activeFilters.from || row.date > activeFilters.to) return false;
        if (scopedDepartment && row.department !== scopedDepartment) return false;
        if (activeFilters.patientId && !row.patientId.toLowerCase().includes(activeFilters.patientId.toLowerCase())) return false;
        if (activeFilters.status && row.status !== activeFilters.status) return false;
        if (activeFilters.staff && !row.owner.toLowerCase().includes(activeFilters.staff.toLowerCase())) return false;
        return true;
      });
    },
    staleTime: 60_000,
  });

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (reportQuery.data ?? []).filter((row) =>
      !term || [row.id, row.patientId, row.subject, row.department, row.status, row.owner].some((value) => value.toLowerCase().includes(term)),
    );
    return [...rows].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const result = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
      return sort.direction === "asc" ? result : -result;
    });
  }, [reportQuery.data, search, sort]);

  const selectedDefinition = reportDefinitions.find((report) => report.id === activeFilters.category);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const total = filteredRows.reduce((sum, row) => sum + row.value, 0);
  const critical = filteredRows.filter((row) => ["critical", "urgent", "low-stock", "reorder"].includes(row.status)).length;
  const chartData = filteredRows.map((row) => ({ name: row.date.slice(5), count: row.value }));
  const kpiCards: KpiCard[] = [
    ["Matching records", filteredRows.length, BarChart3, "info"],
    ["Total activity", total, Download, "success"],
    ["Attention required", critical, ShieldCheck, critical ? "danger" : "success"],
    ["Available templates", availableReports.length, FileText, "warning"],
  ];

  async function applyFilters(values: FilterForm) {
    const next = {
      ...values,
      category: values.category as ReportCategory,
      hospitalId: profile?.role === "super_admin" ? values.hospitalId : profile?.hospitalId ?? values.hospitalId,
      department: isFullAdmin ? values.department : profile?.departmentName ?? profile?.departmentId ?? values.department,
    };
    setActiveFilters(next);
    setPage(1);
    try {
      await createAdminReportJob(next, "view");
    } catch {
      showToast("Report loaded locally; the server view audit could not be recorded.", "warning");
      return;
    }
    showToast("Report filters applied.", "success");
  }

  function changeSort(key: SortKey) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  }

  async function auditExport(format: "pdf" | "csv" | "print" | "view") {
    try {
      await createAdminReportJob(activeFilters, format);
    } catch {
      showToast("The local export is ready, but the server audit job could not be created.", "warning");
    }
  }

  async function exportCsv() {
    await auditExport("csv");
    downloadTextFile(
      timestampedFilename(`govcare-${activeFilters.category}`, "csv"),
      toCsv([
        ["GovCare EHR Admin Report"],
        ["Category", selectedDefinition?.label ?? activeFilters.category],
        ["Hospital", activeFilters.hospitalId],
        ["Department", activeFilters.department || "All permitted departments"],
        ["Date range", `${activeFilters.from} to ${activeFilters.to}`],
        [],
        ["Record ID", "Patient ID", "Subject", "Department", "Status", "Owner", "Date", "Count"],
        ...filteredRows.map((row) => [row.id, row.patientId, row.subject, row.department, row.status, row.owner, row.date, row.value]),
      ]),
      "text/csv;charset=utf-8",
    );
    showToast("CSV report downloaded and audit request recorded.", "success");
  }

  async function exportPdf() {
    await auditExport("pdf");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(`GovCare EHR - ${selectedDefinition?.label ?? "Admin Report"}`, 14, 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Hospital: ${activeFilters.hospitalId} | Department: ${activeFilters.department || "All permitted"} | ${activeFilters.from} to ${activeFilters.to}`, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [["Record", "Patient", "Subject", "Department", "Status", "Owner", "Date", "Count"]],
      body: filteredRows.map((row) => [row.id, row.patientId, row.subject, row.department, row.status, row.owner, row.date, row.value]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 118, 110] },
    });
    doc.save(timestampedFilename(`govcare-${activeFilters.category}`, "pdf"));
    showToast("PDF report downloaded and audit request recorded.", "success");
  }

  async function printReport() {
    await auditExport("print");
    window.print();
    showToast("Print dialog opened.", "success");
  }

  return (
    <div className="space-y-5">
      <header className="page-hero flex flex-wrap items-start justify-between gap-4 print:border-0 print:bg-white">
        <div>
          <p className="text-sm font-semibold text-primary">Admin report generation center</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Hospital-wide reporting and analytics</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Generate secure operational, clinical, financial, workforce, and compliance reports with hospital and department isolation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4" />CSV</Button>
          <Button variant="outline" onClick={printReport}><Printer className="h-4 w-4" />Print</Button>
          <Button onClick={exportPdf}><FileText className="h-4 w-4" />PDF</Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map(([label, value, Icon, tone]) => (
          <Card key={String(label)}>
            <CardContent className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{String(value)}</p></div>
              <Badge tone={tone}><Icon className="h-5 w-5" /></Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" />Report filters</span>
            <Button type="button" variant="ghost" onClick={() => setFiltersOpen((value) => !value)}>
              {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {filtersOpen ? "Hide" : "Show"}
            </Button>
          </CardTitle>
        </CardHeader>
        {filtersOpen && <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit(applyFilters)}>
            <Field label="Report category"><Select {...register("category")}>{availableReports.map((report) => <option key={report.id} value={report.id}>{report.label}</option>)}</Select></Field>
            <Field label="From"><Input type="date" {...register("from")} /></Field>
            <Field label="To" error={errors.to?.message}><Input type="date" {...register("to")} /></Field>
            <Field label="Hospital"><Input readOnly={profile?.role !== "super_admin"} {...register("hospitalId")} /></Field>
            <Field label="Department"><Select disabled={!isFullAdmin} {...register("department")}><option value="">All permitted departments</option>{["Medical OPD", "Medical Clinic", "Antenatal", "Obstetrics", "Pharmacy", "Hematology", "Radiology", "Medical Ward", "ETU", "Finance", "Stores", "ICT Unit"].map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field label="Doctor / staff"><Controller control={control} name="staff" render={({ field }) => <StaffSearchSelector value={field.value} hospitalId={profile?.hospitalId} onChange={(value, option) => field.onChange(option?.label ?? value)} />} /></Field>
            <Field label="Patient ID"><Input placeholder="PAT-2026-000001" autoCapitalize="characters" {...register("patientId")} /></Field>
            <Field label="NIC / passport"><Input placeholder="Identifier" autoCapitalize="characters" {...register("nic")} /></Field>
            <Field label="Gender"><Controller control={control} name="gender" render={({ field }) => <SearchableSelect value={field.value} options={[{ value: "", label: "All genders" }, ...GENDER_OPTIONS]} onChange={field.onChange} clearable={false} />} /></Field>
            <Field label="Age group"><Select {...register("ageGroup")}><option value="">All age groups</option><option>Under 10</option><option>10-15</option><option>16-39</option><option>40-59</option><option>60+</option></Select></Field>
            <Field label="Diagnosis"><Controller control={control} name="diagnosis" render={({ field }) => <DiagnosisSearchSelector value={field.value} onChange={(value, option) => field.onChange(option?.label ?? value)} />} /></Field>
            <Field label="Status"><Select {...register("status")}><option value="">All statuses</option><option>Pending</option><option>Completed</option><option>Approved</option><option>Admitted</option><option>Discharged</option><option>Cancelled</option><option>Critical</option></Select></Field>
            <Field label="Ward / bed"><Input placeholder="Ward code, name or bed number" {...register("ward")} /></Field>
            <Field label="Medicine"><Controller control={control} name="medicine" render={({ field }) => <MedicineSearchSelector value={field.value} onChange={(value, option) => field.onChange(option?.label ?? value)} />} /></Field>
            <Field label="Lab / radiology type"><Controller control={control} name="testType" render={({ field }) => <AsyncSearchableSelect value={field.value} onChange={(value, option) => field.onChange(option?.label ?? value)} loadOptions={async (query) => { const [laboratory, radiology] = await Promise.all([searchLaboratoryTests(query), searchRadiologyStudies(query)]); const tagged: SelectOption[] = [...laboratory.map((item) => ({ ...item, description: ["Laboratory", item.description].filter(Boolean).join(" · ") })), ...radiology.map((item) => ({ ...item, description: ["Radiology", item.description].filter(Boolean).join(" · ") }))]; return tagged; }} placeholder="Search test, code or imaging study" />} /></Field>
            <Field label="Priority"><Controller control={control} name="priority" render={({ field }) => <SearchableSelect value={field.value} options={[{ value: "", label: "All priorities" }, ...PRIORITY_OPTIONS, { value: "STAT", label: "STAT" }, { value: "Critical", label: "Critical" }]} onChange={field.onChange} clearable={false} />} /></Field>
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
              <Button type="submit"><Filter className="h-4 w-4" />Generate report</Button>
              <Button type="button" variant="outline" onClick={() => {
                const base = { ...activeFilters, category: defaultCategory, from: monthStart, to: today, department: isFullAdmin ? "" : profile?.departmentName ?? profile?.departmentId ?? "" };
                reset(base);
                setActiveFilters(base);
                setPage(1);
              }}>Reset</Button>
              {!isFullAdmin && <p className="ml-auto text-xs font-semibold text-muted-foreground">Department scope enforced: {profile?.departmentName ?? profile?.departmentId ?? "assigned department"}</p>}
            </div>
          </form>
        </CardContent>}
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader><CardTitle>Trend visualization</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              <span>{selectedDefinition?.label ?? "Report results"}</span>
              <SmartSearch className="w-full max-w-xs print:hidden" value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search report results..." scope="reports" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportQuery.isLoading ? <div className="flex min-h-52 items-center justify-center gap-2 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />Loading report...</div>
              : filteredRows.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center text-center"><FileText className="h-10 w-10 text-muted-foreground" /><p className="mt-3 font-bold text-slate-950">No matching report records</p><p className="text-sm text-muted-foreground">Adjust the date range or filters and generate the report again.</p></div>
              : <div className="overflow-x-auto">
                <Table>
                  <thead><tr>
                    <Th>Record</Th><Th>Patient</Th><SortableTh label="Subject" column="subject" sort={sort} onSort={changeSort} />
                    <SortableTh label="Department" column="department" sort={sort} onSort={changeSort} />
                    <SortableTh label="Status" column="status" sort={sort} onSort={changeSort} />
                    <Th>Owner</Th><SortableTh label="Date" column="date" sort={sort} onSort={changeSort} />
                    <SortableTh label="Count" column="value" sort={sort} onSort={changeSort} />
                  </tr></thead>
                  <tbody>{visibleRows.map((row) => <tr key={row.id}>
                    <Td className="font-bold text-slate-950">{row.id}</Td><Td>{row.patientId}</Td><Td>{row.subject}</Td><Td>{row.department}</Td>
                    <Td><Badge tone={statusTone(row.status)}>{row.status}</Badge></Td><Td>{row.owner}</Td><Td>{row.date}</Td><Td className="font-bold">{row.value}</Td>
                  </tr>)}</tbody>
                </Table>
              </div>}
            <div className="mt-4 flex items-center justify-between gap-3 print:hidden">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {filteredRows.length} records</p>
              <div className="flex gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="help-strip flex items-start gap-3 p-4 text-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p><strong>Protected reporting:</strong> report jobs validate role, hospitalId, department scope, date range, and export format. Production exports are registered in <code>reports</code> and every view, PDF, CSV, and print action is written to <code>auditLogs</code>.</p>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-800">{label}{children}<span className="mt-1 block min-h-4 text-xs text-destructive">{error}</span></label>;
}

function SortableTh({ label, column, sort, onSort }: { label: string; column: SortKey; sort: { key: SortKey; direction: "asc" | "desc" }; onSort: (key: SortKey) => void }) {
  return <Th><button className="inline-flex items-center gap-1" type="button" onClick={() => onSort(column)}>{label}{sort.key === column && (sort.direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</button></Th>;
}
