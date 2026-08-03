import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { KeyRound, Pencil, Plus, RefreshCcw, Search, UserCheck, UserRoundCog, UserX, X } from "lucide-react";
import { Badge, StatusBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useToast } from "../../components/ui/toast-context";
import {
  changeStaffDepartment,
  changeStaffRole,
  changeStaffStatus,
  createStaff,
  getStaff,
  getStaffAuditHistory,
  getStaffOptions,
  listHospitalDepartments,
  listStaff,
  resetStaffPassword,
  transferStaff,
  updateStaff,
} from "../../services/staffService";
import { useAuthStore } from "../../stores/authStore";
import type {
  CreateStaffInput,
  DepartmentOption,
  HospitalOption,
  StaffMember,
  StaffOptionsResponse,
  StaffRole,
  StaffRoleOption,
  StaffSummary,
  StaffAuditRecord,
} from "../../types/staff";

const roleLabels: Record<StaffRole, string> = {
  hospital_admin: "Hospital Admin",
  records_officer: "Records Officer",
  receptionist: "Receptionist",
  doctor: "Doctor",
  nurse: "Nurse",
  lab_technician: "Laboratory Technician",
  pathologist: "Laboratory Pathologist",
  radiology_technician: "Radiology Technician",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
};

const emptySummary: StaffSummary = {
  totalStaff: 0,
  activeStaff: 0,
  inactiveStaff: 0,
  doctors: 0,
  nurses: 0,
  laboratoryStaff: 0,
  pharmacyStaff: 0,
  radiologyStaff: 0,
};

const initialForm: CreateStaffInput = {
  title: "",
  firstName: "",
  lastName: "",
  fullName: "",
  nationalId: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  hospitalId: "",
  departmentId: null,
  roleCode: "records_officer",
  professionalRegistrationNo: "",
  jobTitle: "",
  employmentType: "permanent",
  joiningDate: new Date().toISOString().slice(0, 10),
  temporaryPassword: "",
  mustChangePassword: true,
  active: true,
};

function generatePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%!";
  const all = upper + lower + digits + symbols;
  const pick = (source: string) => source[Math.floor(Math.random() * source.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 12) chars.push(pick(all));
  return chars.sort(() => Math.random() - 0.5).join("");
}

function recommendedDepartment(role: StaffRole) {
  if (role === "lab_technician" || role === "pathologist") return "laboratory";
  if (role === "pharmacist") return "pharmacy";
  if (role === "radiologist" || role === "radiology_technician") return "radiology";
  if (role === "records_officer") return "records";
  if (role === "receptionist") return "reception";
  if (role === "hospital_admin") return "administration";
  return "";
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="rounded-md p-2 hover:bg-slate-800" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-sm font-semibold text-slate-200"><span>{label}</span>{children}</label>;
}

export function StaffManagement() {
  const profile = useAuthStore((state) => state.profile);
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const legacySelectedHandled = useRef<string | null>(null);
  const isSuper = profile?.role === "super_admin";
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<StaffSummary>(emptySummary);
  const [options, setOptions] = useState<StaffOptionsResponse>({ hospitals: [], roles: [] });
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [search, setSearch] = useState("");
  const [hospitalId, setHospitalId] = useState(isSuper ? "" : profile?.hospitalId ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [created, setCreated] = useState<StaffMember | null>(null);

  async function loadOptions() {
    try {
      const value = await getStaffOptions();
      setOptions(value);
      const initialHospital = isSuper ? hospitalId || value.hospitals[0]?.id || "" : profile?.hospitalId ?? value.hospitals[0]?.id ?? "";
      if (!hospitalId && initialHospital) setHospitalId(initialHospital);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load staff options.", "danger");
    }
  }

  async function loadDepartments(targetHospitalId = hospitalId) {
    if (!targetHospitalId) {
      setDepartments([]);
      return;
    }
    try {
      const result = await listHospitalDepartments(targetHospitalId);
      setDepartments(result.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load departments.", "danger");
    }
  }

  async function loadStaff() {
    setLoading(true);
    try {
      const result = await listStaff({ search, hospitalId: isSuper ? hospitalId || undefined : undefined, departmentId: departmentId || undefined, role, status, page, size: 20 });
      setStaff(result.items);
      setSummary(result.summary);
      setTotalPages(result.totalPages);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load staff accounts.", "danger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOptions(); }, []);
  useEffect(() => { void loadDepartments(); setDepartmentId(""); }, [hospitalId]);
  useEffect(() => { void loadStaff(); }, [page, hospitalId, departmentId, role, status]);

  useEffect(() => {
    const selectedId = searchParams.get("selected");
    if (!selectedId || legacySelectedHandled.current === selectedId) return;
    legacySelectedHandled.current = selectedId;

    void getStaff(selectedId)
      .then((result) => {
        setSelected(result.staff);
        const next = new URLSearchParams(searchParams);
        next.delete("selected");
        setSearchParams(next, { replace: true });
      })
      .catch((error) => {
        showToast(error instanceof Error ? error.message : "Unable to open the selected staff account.", "danger");
      });
  }, [searchParams, setSearchParams, showToast]);

  const summaryCards = [
    ["Total Staff", summary.totalStaff], ["Active Staff", summary.activeStaff], ["Inactive Staff", summary.inactiveStaff],
    ["Doctors", summary.doctors], ["Nurses", summary.nurses], ["Laboratory", summary.laboratoryStaff],
    ["Pharmacy", summary.pharmacyStaff], ["Radiology", summary.radiologyStaff],
  ] as const;

  async function handleToggle(member: StaffMember) {
    const action = member.active ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${member.fullName}?`)) return;
    try {
      const result = await changeStaffStatus(member.id, !member.active);
      setStaff((items) => items.map((item) => item.id === member.id ? result.staff : item));
      showToast(`Staff account ${action}d successfully.`, "success");
      void loadStaff();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to change staff status.", "danger");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3"><UserRoundCog className="h-8 w-8 text-cyan-600" /><h1 className="text-3xl font-bold text-slate-950 dark:text-white">Staff Management</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">Create, assign and manage hospital staff accounts.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add New Staff</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {summaryCards.map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{value}</p></CardContent></Card>)}
      </div>

      <Card>
        <CardHeader><CardTitle>Search and filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by staff name, email, phone or employee number" onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); void loadStaff(); } }} /></div>
          {isSuper && <Select value={hospitalId} onChange={(e) => { setPage(0); setHospitalId(e.target.value); }}><option value="">All hospitals</option>{options.hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select>}
          <Select value={departmentId} onChange={(e) => { setPage(0); setDepartmentId(e.target.value); }}><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          <Select value={role} onChange={(e) => { setPage(0); setRole(e.target.value as StaffRole | ""); }}><option value="">All roles</option>{options.roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</Select>
          <Select value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option><option value="suspended">Suspended</option></Select>
          <Button variant="outline" onClick={() => { setPage(0); void loadStaff(); }}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hospital staff</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300"><tr><th className="px-4 py-3">Staff member</th><th className="px-4 py-3">Employee No.</th><th className="px-4 py-3">Hospital / Department</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last login</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-border">
                {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Loading staff accounts...</td></tr> : staff.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No staff accounts matched the selected filters.</td></tr> : staff.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 font-bold text-cyan-800">{member.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div><div><p className="font-semibold text-slate-950 dark:text-white">{member.fullName}</p><p className="text-xs text-muted-foreground">{member.email}<br />{member.phone || "No phone"}</p></div></div></td>
                    <td className="px-4 py-3 font-mono text-xs">{member.employeeNo}</td>
                    <td className="px-4 py-3"><p className="font-medium">{member.hospitalName || "—"}</p><p className="text-xs text-muted-foreground">{member.departmentName || "Unassigned"}</p></td>
                    <td className="px-4 py-3"><Badge tone="info">{roleLabels[member.role] ?? member.role}</Badge></td>
                    <td className="px-4 py-3"><StatusBadge status={member.active ? "active" : member.workStatus || member.status} /></td>
                    <td className="px-4 py-3 text-xs">{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : "Never"}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Button className="min-h-9 px-3 py-1" variant="outline" onClick={() => setSelected(member)}><Pencil className="h-3.5 w-3.5" /> Manage</Button><Button className="min-h-9 px-3 py-1" variant={member.active ? "destructive" : "secondary"} onClick={() => void handleToggle(member)}>{member.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}{member.active ? "Deactivate" : "Activate"}</Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3"><p className="text-sm text-muted-foreground">Page {page + 1} of {Math.max(totalPages, 1)}</p><div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button><Button variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
        </CardContent>
      </Card>

      {showCreate && <CreateStaffModal profileHospitalId={profile?.hospitalId ?? ""} isSuper={isSuper} options={options} onClose={() => setShowCreate(false)} onCreated={(member) => { setShowCreate(false); setCreated(member); void loadStaff(); }} showToast={showToast} />}
      {selected && <ManageStaffModal member={selected} roles={options.roles} hospitals={options.hospitals} isSuper={isSuper} onClose={() => setSelected(null)} onUpdated={(member) => { setSelected(member); setStaff((items) => items.map((item) => item.id === member.id ? member : item)); }} showToast={showToast} />}
      {created && <CreatedSummary member={created} onClose={() => setCreated(null)} showToast={showToast} />}
    </div>
  );
}

function CreateStaffModal({ profileHospitalId, isSuper, options, onClose, onCreated, showToast }: { profileHospitalId: string; isSuper: boolean; options: StaffOptionsResponse; onClose: () => void; onCreated: (member: StaffMember) => void; showToast: (message: string, tone?: "success" | "info" | "warning" | "danger") => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CreateStaffInput>({ ...initialForm, hospitalId: isSuper ? options.hospitals[0]?.id ?? "" : profileHospitalId || options.hospitals[0]?.id || "", temporaryPassword: generatePassword() });
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [confirmPassword, setConfirmPassword] = useState(form.temporaryPassword);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.hospitalId) return;
    void listHospitalDepartments(form.hospitalId).then((result) => setDepartments(result.items)).catch((error) => showToast(error instanceof Error ? error.message : "Unable to load departments.", "danger"));
  }, [form.hospitalId]);

  const roleOption = options.roles.find((item) => item.code === form.roleCode);
  const selectedDepartment = departments.find((item) => item.id === form.departmentId);
  const expected = recommendedDepartment(form.roleCode);
  const mismatch = expected && selectedDepartment && !selectedDepartment.name.toLowerCase().includes(expected);

  function set<K extends keyof CreateStaffInput>(key: K, value: CreateStaffInput[K]) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.temporaryPassword !== confirmPassword) { showToast("Temporary passwords do not match.", "danger"); return; }
    if (!form.hospitalId || !form.fullName.trim() || !form.email.trim()) { showToast("Full name, email and hospital are required.", "danger"); return; }
    setSaving(true);
    try {
      const result = await createStaff({ ...form, departmentId: form.departmentId || null });
      showToast("Staff account created successfully.", "success");
      onCreated(result.staff);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to create staff account.", "danger");
    } finally { setSaving(false); }
  }

  return <Modal title="Add New Staff" onClose={onClose} wide><form onSubmit={submit} className="space-y-5">
    <div className="grid grid-cols-3 gap-2">{["Personal Information", "Employment Information", "Account & Security"].map((label, index) => <div key={label} className={`rounded-md px-3 py-2 text-center text-xs font-bold ${step === index + 1 ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300"}`}>{index + 1}. {label}</div>)}</div>
    {step === 1 && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Field label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Mr / Ms / Dr" /></Field><Field label="First name"><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field><Field label="Last name"><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field><Field label="Full name *"><Input required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field><Field label="NIC / Passport"><Input value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} /></Field><Field label="Date of birth"><Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} /></Field><Field label="Gender"><Select value={form.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select></Field><Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field><Field label="Email *"><Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} /></Field><Field label="Residential address"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field></div>}
    {step === 2 && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Field label="Hospital *"><Select disabled={!isSuper} value={form.hospitalId} onChange={(e) => set("hospitalId", e.target.value)}>{options.hospitals.map((hospital: HospitalOption) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</Select></Field><Field label="Department"><Select value={form.departmentId ?? ""} onChange={(e) => set("departmentId", e.target.value || null)}><option value="">Unassigned</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select></Field><Field label="Staff role *"><Select value={form.roleCode} onChange={(e) => set("roleCode", e.target.value as StaffRole)}>{options.roles.map((option: StaffRoleOption) => <option key={option.code} value={option.code}>{option.name}</option>)}</Select></Field><Field label="Professional registration no."><Input value={form.professionalRegistrationNo} onChange={(e) => set("professionalRegistrationNo", e.target.value)} /></Field><Field label="Job title"><Input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} /></Field><Field label="Employment type"><Select value={form.employmentType} onChange={(e) => set("employmentType", e.target.value as CreateStaffInput["employmentType"])}><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="temporary">Temporary</option><option value="visiting">Visiting</option></Select></Field><Field label="Joining date"><Input type="date" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} /></Field><div className="md:col-span-2 rounded-md border border-cyan-800 bg-cyan-950/40 p-3 text-sm"><p className="font-bold text-cyan-200">Default privileges</p><p className="mt-1 text-cyan-100">{roleOption?.description || "Permissions are assigned automatically from the selected role."}</p>{mismatch && <p className="mt-2 font-semibold text-amber-300">Warning: this role is normally assigned to the {expected} department.</p>}</div></div>}
    {step === 3 && <div className="grid gap-4 md:grid-cols-2"><Field label="Login email"><Input disabled value={form.email} /></Field><div /><Field label="Temporary password *"><Input required value={form.temporaryPassword} onChange={(e) => set("temporaryPassword", e.target.value)} /></Field><Field label="Confirm password *"><Input required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></Field><div className="flex flex-wrap gap-2 md:col-span-2"><Button variant="outline" onClick={() => { const value = generatePassword(); set("temporaryPassword", value); setConfirmPassword(value); }}><KeyRound className="h-4 w-4" /> Generate Secure Password</Button><Button variant="outline" onClick={() => void navigator.clipboard.writeText(form.temporaryPassword)}>Copy Password</Button></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.mustChangePassword} onChange={(e) => set("mustChangePassword", e.target.checked)} /> Require password change on first login</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Enable account immediately</label></div>}
    <div className="flex items-center justify-between border-t border-slate-800 pt-4"><Button variant="outline" onClick={step === 1 ? onClose : () => setStep((value) => value - 1)}>{step === 1 ? "Cancel" : "Previous"}</Button>{step < 3 ? <Button onClick={() => setStep((value) => value + 1)}>Next</Button> : <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Staff Account"}</Button>}</div>
  </form></Modal>;
}

function ManageStaffModal({ member, roles, hospitals, isSuper, onClose, onUpdated, showToast }: { member: StaffMember; roles: StaffRoleOption[]; hospitals: HospitalOption[]; isSuper: boolean; onClose: () => void; onUpdated: (member: StaffMember) => void; showToast: (message: string, tone?: "success" | "info" | "warning" | "danger") => void }) {
  const [role, setRole] = useState(member.role);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [departmentId, setDepartmentId] = useState(member.departmentId ?? "");
  const [password, setPassword] = useState(generatePassword());
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(member.fullName);
  const [email, setEmail] = useState(member.email);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [address, setAddress] = useState(member.address ?? "");
  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? "");
  const [employmentType, setEmploymentType] = useState(member.employmentType ?? "permanent");
  const [auditRecords, setAuditRecords] = useState<StaffAuditRecord[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [transferHospitalId, setTransferHospitalId] = useState(member.hospitalId);
  const [transferDepartments, setTransferDepartments] = useState<DepartmentOption[]>([]);
  const [transferDepartmentId, setTransferDepartmentId] = useState(member.departmentId ?? "");

  useEffect(() => {
    void listHospitalDepartments(member.hospitalId)
      .then((result) => setDepartments(result.items))
      .catch((error) => showToast(error instanceof Error ? error.message : "Unable to load departments.", "danger"));
  }, [member.hospitalId, showToast]);

  useEffect(() => {
    if (!isSuper || !transferHospitalId) return;
    void listHospitalDepartments(transferHospitalId)
      .then((result) => setTransferDepartments(result.items))
      .catch((error) => showToast(error instanceof Error ? error.message : "Unable to load transfer departments.", "danger"));
  }, [isSuper, transferHospitalId, showToast]);

  async function run(action: () => Promise<{ staff: StaffMember }>, message: string) {
    setSaving(true);
    try {
      const result = await action();
      onUpdated(result.staff);
      showToast(message, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Staff update failed.", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function loadAudit() {
    try {
      const result = await getStaffAuditHistory(member.id);
      setAuditRecords(result.items);
      setShowAudit(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load audit history.", "danger");
    }
  }

  return <Modal title={`Manage ${member.fullName}`} onClose={onClose} wide><div className="space-y-5">
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="font-bold">{member.employeeNo}</p><p className="text-sm text-slate-300">{member.email}</p><p className="mt-2 text-sm">{member.hospitalName} · {member.departmentName || "Unassigned"}</p></div>

    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Full name"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} /></Field>
      <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
      <Field label="Phone"><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
      <Field label="Job title"><Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /></Field>
      <Field label="Employment type"><Select value={employmentType} onChange={(event) => setEmploymentType(event.target.value as CreateStaffInput["employmentType"])}><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="temporary">Temporary</option><option value="visiting">Visiting</option></Select></Field>
      <Field label="Address"><Input value={address} onChange={(event) => setAddress(event.target.value)} /></Field>
    </div>
    <Button disabled={saving || !fullName.trim() || !email.trim()} onClick={() => void run(() => updateStaff(member.id, { fullName, email, phone, address, jobTitle, employmentType }), "Staff details updated successfully.")}><Pencil className="h-4 w-4" /> Save Staff Details</Button>

    <div className="grid gap-4 border-t border-slate-800 pt-5 md:grid-cols-2">
      <Field label="Change role"><div className="flex gap-2"><Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>{roles.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</Select><Button disabled={saving || role === member.role} onClick={() => { if (window.confirm("Change this staff member's role? They may lose access immediately.")) void run(() => changeStaffRole(member.id, role), "Role changed successfully."); }}>Save</Button></div></Field>
      <Field label="Change department"><div className="flex gap-2"><Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">Unassigned</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Button disabled={saving || departmentId === (member.departmentId ?? "")} onClick={() => void run(() => changeStaffDepartment(member.id, departmentId || null), "Department changed successfully.")}>Save</Button></div></Field>
    </div>

    {isSuper && <div className="space-y-3 rounded-lg border border-amber-800 bg-amber-950/20 p-4"><p className="font-bold text-amber-200">Transfer hospital — Super Admin only</p><div className="grid gap-3 md:grid-cols-2"><Select value={transferHospitalId} onChange={(event) => { setTransferHospitalId(event.target.value); setTransferDepartmentId(""); }}>{hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</Select><Select value={transferDepartmentId} onChange={(event) => setTransferDepartmentId(event.target.value)}><option value="">Unassigned department</option>{transferDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select></div><Button variant="outline" disabled={saving || transferHospitalId === member.hospitalId} onClick={() => { if (window.confirm("Transfer this staff member to another hospital? Their current access will change immediately.")) void run(() => transferStaff(member.id, transferHospitalId, transferDepartmentId || null), "Staff hospital transferred successfully."); }}>Transfer Hospital</Button></div>}

    <div className="space-y-3 border-t border-slate-800 pt-5"><Field label="Reset temporary password"><div className="flex gap-2"><Input value={password} onChange={(e) => setPassword(e.target.value)} /><Button variant="outline" onClick={() => setPassword(generatePassword())}>Generate</Button></div></Field><Button className="w-full" disabled={saving || password.length < 8} onClick={async () => { if (!window.confirm("Reset this staff member's password?")) return; setSaving(true); try { const result = await resetStaffPassword(member.id, password); await navigator.clipboard.writeText(result.temporaryPassword); showToast("Password reset. Temporary password copied to clipboard.", "success"); } catch (error) { showToast(error instanceof Error ? error.message : "Password reset failed.", "danger"); } finally { setSaving(false); } }}><KeyRound className="h-4 w-4" /> Reset Password</Button></div>

    <div className="border-t border-slate-800 pt-5"><Button variant="outline" onClick={() => void loadAudit()}>View Audit History</Button>{showAudit && <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-slate-800"><table className="w-full text-left text-xs"><thead className="bg-slate-900"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">IP</th></tr></thead><tbody className="divide-y divide-slate-800">{auditRecords.length ? auditRecords.map((record) => <tr key={record.id}><td className="px-3 py-2">{new Date(record.created_at).toLocaleString()}</td><td className="px-3 py-2 font-semibold">{record.action}</td><td className="px-3 py-2">{record.actor_name || "System"}</td><td className="px-3 py-2">{record.ip_address || "—"}</td></tr>) : <tr><td className="px-3 py-4 text-center" colSpan={4}>No staff audit records.</td></tr>}</tbody></table></div>}</div>
  </div></Modal>;
}

function CreatedSummary({ member, onClose, showToast }: { member: StaffMember; onClose: () => void; showToast: (message: string, tone?: "success" | "info" | "warning" | "danger") => void }) {
  const details = `GovCare EHR Staff Login\nEmployee No: ${member.employeeNo}\nName: ${member.fullName}\nEmail: ${member.email}\nRole: ${roleLabels[member.role]}\nHospital: ${member.hospitalName ?? ""}\nDepartment: ${member.departmentName ?? "Unassigned"}\nTemporary Password: ${member.temporaryPassword ?? ""}`;
  return <Modal title="Staff account created successfully" onClose={onClose}><div className="space-y-4"><div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-sm"><p className="font-bold text-emerald-200">The temporary password is shown only once.</p><p className="mt-1 text-emerald-100">The staff member must change it during the first login.</p></div><dl className="grid gap-3 rounded-lg border border-slate-800 p-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-400">Employee number</dt><dd className="font-bold">{member.employeeNo}</dd></div><div><dt className="text-xs text-slate-400">Staff name</dt><dd className="font-bold">{member.fullName}</dd></div><div><dt className="text-xs text-slate-400">Login email</dt><dd>{member.email}</dd></div><div><dt className="text-xs text-slate-400">Assigned role</dt><dd>{roleLabels[member.role]}</dd></div><div><dt className="text-xs text-slate-400">Hospital</dt><dd>{member.hospitalName}</dd></div><div><dt className="text-xs text-slate-400">Department</dt><dd>{member.departmentName || "Unassigned"}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-slate-400">Temporary password</dt><dd className="mt-1 rounded bg-slate-900 p-3 font-mono text-lg text-cyan-300">{member.temporaryPassword}</dd></div></dl><div className="flex flex-wrap gap-2"><Button onClick={async () => { await navigator.clipboard.writeText(details); showToast("Login details copied.", "success"); }}>Copy Login Details</Button><Button variant="outline" onClick={() => window.print()}>Print Login Details</Button><Button variant="outline" onClick={onClose}>Close</Button></div></div></Modal>;
}
