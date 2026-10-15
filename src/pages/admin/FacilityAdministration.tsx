import { BedDouble, Building2, CheckCircle2, Hospital, Layers3, Plus, RefreshCw, type LucideIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { PageTransition, SectionReveal } from "../../components/motion/PageTransition";
import { SriLankaLocationSelector } from "../../components/selectors/SriLankaLocationSelector";
import { Badge, StatusBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useToast } from "../../components/ui/toast-context";
import {
  createBulkBeds,
  createFacilityWard,
  createHospital,
  getFacilityOverview,
  getWardRooms,
  type BulkBedInput,
  type FacilityOverview,
  type HospitalInput,
  type WardInput,
  type WardRoom,
} from "../../services/facilityService";
import { getHospitalDepartments } from "../../services/referenceDataService";
import { getWards } from "../../services/wardService";
import type { SelectOption } from "../../data/referenceOptions";
import type { WardSummary } from "../../types/ward";

const hospitalTypes = [
  ["government_hospital", "Government hospital"],
  ["national_hospital", "National hospital"],
  ["teaching_hospital", "Teaching hospital"],
  ["district_general_hospital", "District general hospital"],
  ["base_hospital", "Base hospital"],
  ["divisional_hospital", "Divisional hospital"],
  ["specialized_hospital", "Specialized hospital"],
  ["primary_medical_care_unit", "Primary medical care unit"],
  ["clinic", "Clinic"],
] as const;

const wardTypes = [
  "GENERAL_MEDICAL_WARD", "SURGICAL_WARD", "PAEDIATRIC_WARD", "MATERNITY_WARD",
  "INTENSIVE_CARE_UNIT", "HIGH_DEPENDENCY_UNIT", "ISOLATION_WARD", "EMERGENCY_OBSERVATION_WARD",
];
const bedTypes = ["STANDARD", "PAEDIATRIC", "MATERNITY", "ICU", "HDU", "ISOLATION", "BARIATRIC", "OBSERVATION", "EMERGENCY", "COT"];

const emptyHospital: HospitalInput = {
  code: "", name: "", type: "government_hospital", city: "", district: "", province: "",
  address: "", phone: "", email: "", directorName: "", provisionCoreDepartments: true,
};
const emptyWard: Omit<WardInput, "hospitalId"> = {
  departmentId: "", wardCode: "", wardName: "", wardType: "GENERAL_MEDICAL_WARD", building: "", floor: "",
  genderRestriction: "ANY", ageRestriction: "ANY", isolationCapable: false, status: "ACTIVE",
};
const emptyBeds: BulkBedInput = {
  numberPrefix: "B", codePrefix: "", startNumber: 1, count: 10, padding: 3, bedType: "STANDARD",
  genderRestriction: "ANY", ageRestriction: "ANY", isolationSupport: false, oxygenSupport: false,
  ventilatorSupport: false, monitorSupport: false, electricBed: false, accessibleBed: false,
};

function FieldLabel({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block text-sm font-semibold text-foreground"><span>{label}{required && <span className="text-danger"> *</span>}</span><span className="mt-1 block">{children}</span></label>;
}

function FeatureToggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-2 rounded-md border border-control-border bg-surface px-3 text-sm font-semibold text-foreground"><input checked={checked} className="h-4 w-4 accent-primary" onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>;
}

export function FacilityAdministration() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<FacilityOverview | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [wards, setWards] = useState<WardSummary[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [selectedWardId, setSelectedWardId] = useState("");
  const [rooms, setRooms] = useState<WardRoom[]>([]);
  const [hospital, setHospital] = useState<HospitalInput>(emptyHospital);
  const [ward, setWard] = useState(emptyWard);
  const [beds, setBeds] = useState<BulkBedInput>(emptyBeds);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"hospital" | "ward" | "beds" | "">("");

  const selectedHospital = overview?.hospitals.find((item) => item.id === selectedHospitalId);
  const selectedWard = wards.find((item) => item.id === selectedWardId);
  const activeHospitals = useMemo(() => overview?.hospitals.filter((item) => item.status === "active") ?? [], [overview]);
  const totalCards: Array<{ label: string; value: number; icon: LucideIcon }> = overview ? [
    { label: "Active hospitals", value: overview.totals.activeHospitals, icon: Hospital },
    { label: "Active wards", value: overview.totals.activeWards, icon: Layers3 },
    { label: "Registered beds", value: overview.totals.totalBeds, icon: BedDouble },
    { label: "Available beds", value: overview.totals.availableBeds, icon: CheckCircle2 },
  ] : [];

  async function loadOverview(preferredHospitalId?: string) {
    const next = await getFacilityOverview();
    setOverview(next);
    setSelectedHospitalId((current) => {
      const wanted = preferredHospitalId ?? current;
      return next.hospitals.some((item) => item.id === wanted) ? wanted : next.hospitals[0]?.id ?? "";
    });
  }

  useEffect(() => {
    let cancelled = false;
    void getFacilityOverview().then((next) => {
      if (cancelled) return;
      setOverview(next);
      setSelectedHospitalId(next.hospitals[0]?.id ?? "");
    }).catch((error) => {
      if (!cancelled) showToast(error instanceof Error ? error.message : "Unable to load hospital facilities.", "danger");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    if (!selectedHospitalId) { setWards([]); setSelectedWardId(""); return; }
    let cancelled = false;
    void getWards(selectedHospitalId).then((items) => {
      if (cancelled) return;
      setWards(items);
      setSelectedWardId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((error) => {
      if (!cancelled) showToast(error instanceof Error ? error.message : "Unable to load wards.", "danger");
    });
    return () => { cancelled = true; };
  }, [selectedHospitalId, showToast]);

  useEffect(() => {
    if (!selectedHospitalId) { setDepartments([]); return; }
    let cancelled = false;
    void getHospitalDepartments(selectedHospitalId).then((items) => {
      if (cancelled) return;
      setDepartments(items);
      setWard((current) => {
        if (current.departmentId && items.some((item) => item.value === current.departmentId)) return current;
        const inpatient = items.find((item) => String(item.meta?.code ?? "").toUpperCase() === "INPATIENT");
        return { ...current, departmentId: inpatient?.value ?? items[0]?.value ?? "" };
      });
    }).catch(() => { if (!cancelled) setDepartments([]); });
    return () => { cancelled = true; };
  }, [selectedHospitalId]);

  useEffect(() => {
    if (!selectedWardId) { setRooms([]); setBeds((current) => ({ ...current, roomId: undefined })); return; }
    let cancelled = false;
    void getWardRooms(selectedWardId).then((items) => { if (!cancelled) setRooms(items.filter((room) => room.status === "ACTIVE")); })
      .catch(() => { if (!cancelled) setRooms([]); });
    return () => { cancelled = true; };
  }, [selectedWardId]);

  async function submitHospital(event: FormEvent) {
    event.preventDefault(); setBusy("hospital");
    try {
      const result = await createHospital(hospital);
      await loadOverview(result.hospital.id);
      setHospital(emptyHospital);
      showToast(`${result.hospital.name} created with ${result.coreDepartmentsCreated} core departments.`, "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to create hospital.", "danger"); }
    finally { setBusy(""); }
  }

  async function submitWard(event: FormEvent) {
    event.preventDefault();
    if (!selectedHospitalId) { showToast("Select a hospital first.", "warning"); return; }
    setBusy("ward");
    try {
      const result = await createFacilityWard({ ...ward, hospitalId: selectedHospitalId });
      const nextWards = await getWards(selectedHospitalId);
      setWards(nextWards); setSelectedWardId(result.ward.id); setWard(emptyWard);
      await loadOverview(selectedHospitalId);
      showToast(`${result.ward.wardName} created and selected for bed setup.`, "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to create ward.", "danger"); }
    finally { setBusy(""); }
  }

  async function submitBeds(event: FormEvent) {
    event.preventDefault();
    if (!selectedWardId) { showToast("Select or create a ward first.", "warning"); return; }
    setBusy("beds");
    try {
      const result = await createBulkBeds(selectedWardId, { ...beds, roomId: beds.roomId || undefined, codePrefix: beds.codePrefix || undefined });
      const nextWards = await getWards(selectedHospitalId);
      setWards(nextWards); await loadOverview(selectedHospitalId);
      showToast(`${result.createdCount} beds created in ${selectedWard?.wardName ?? "the selected ward"}.`, "success");
      setBeds((current) => ({ ...emptyBeds, startNumber: current.startNumber + result.createdCount }));
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to create beds.", "danger"); }
    finally { setBusy(""); }
  }

  if (loading) return <div className="grid min-h-72 place-items-center text-sm font-semibold text-muted-foreground"><RefreshCw className="mr-2 inline h-5 w-5 animate-spin" />Loading hospital network…</div>;

  return <PageTransition><div className="space-y-5">
    <header className="page-hero flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-accent">Super Admin · Network configuration</p><h1 className="mt-1 text-3xl font-black text-foreground">Hospital, ward and bed command center</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Create network master data in sequence. Every operation uses PostgreSQL, permission checks, hospital scope validation and audit logging.</p></div>
      <Button variant="outline" onClick={() => void loadOverview(selectedHospitalId)}><RefreshCw className="h-4 w-4" />Refresh network</Button>
    </header>

    {overview && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {totalCards.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black text-foreground">{value}</p></div><Icon className="h-8 w-8 text-accent" /></CardContent></Card>)}
    </section>}

    <SectionReveal><Card className="border-accent-border">
      <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-accent" />Current hospital scope</CardTitle></CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><FieldLabel label="Hospital"><Select value={selectedHospitalId} onChange={(event) => setSelectedHospitalId(event.target.value)}>{activeHospitals.length === 0 && <option value="">No hospitals available</option>}{activeHospitals.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</Select></FieldLabel><div className="flex flex-wrap gap-2">{selectedHospital && <><Badge tone="info">{selectedHospital.departmentCount} departments</Badge><Badge tone="info">{selectedHospital.wardCount} wards</Badge><Badge tone="success">{selectedHospital.availableBedCount}/{selectedHospital.bedCount} beds available</Badge></>}</div></CardContent>
    </Card></SectionReveal>

    <section className="grid gap-5 2xl:grid-cols-3">
      <Card className="min-w-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">1</span>Add hospital</CardTitle></CardHeader>
        <CardContent><form className="space-y-3" onSubmit={(event) => void submitHospital(event)}>
          <div className="grid gap-3 sm:grid-cols-2"><FieldLabel label="Hospital code" required><Input required maxLength={20} value={hospital.code} onChange={(event) => setHospital((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="e.g. DGH-MAT" /></FieldLabel><FieldLabel label="Hospital name" required><Input required maxLength={160} value={hospital.name} onChange={(event) => setHospital((current) => ({ ...current, name: event.target.value }))} /></FieldLabel></div>
          <FieldLabel label="Hospital type" required><Select required value={hospital.type} onChange={(event) => setHospital((current) => ({ ...current, type: event.target.value }))}>{hospitalTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FieldLabel>
          <div className="grid gap-3 sm:grid-cols-2"><SriLankaLocationSelector requiredProvince requiredDistrict province={hospital.province} district={hospital.district} onChange={(location) => setHospital((current) => ({ ...current, ...location }))} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><FieldLabel label="City"><Input maxLength={120} value={hospital.city} onChange={(event) => setHospital((current) => ({ ...current, city: event.target.value }))} /></FieldLabel><FieldLabel label="Telephone"><Input maxLength={40} value={hospital.phone} onChange={(event) => setHospital((current) => ({ ...current, phone: event.target.value }))} /></FieldLabel></div>
          <FieldLabel label="Address"><Input maxLength={500} value={hospital.address} onChange={(event) => setHospital((current) => ({ ...current, address: event.target.value }))} /></FieldLabel>
          <div className="grid gap-3 sm:grid-cols-2"><FieldLabel label="Email"><Input type="email" maxLength={180} value={hospital.email} onChange={(event) => setHospital((current) => ({ ...current, email: event.target.value }))} /></FieldLabel><FieldLabel label="Director"><Input maxLength={160} value={hospital.directorName} onChange={(event) => setHospital((current) => ({ ...current, directorName: event.target.value }))} /></FieldLabel></div>
          <FeatureToggle checked={hospital.provisionCoreDepartments} label="Create OPD, Emergency, Inpatient, Lab, Radiology and Pharmacy departments" onChange={(checked) => setHospital((current) => ({ ...current, provisionCoreDepartments: checked }))} />
          <Button className="w-full" disabled={busy === "hospital"} type="submit"><Plus className="h-4 w-4" />{busy === "hospital" ? "Creating hospital…" : "Create hospital"}</Button>
        </form></CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">2</span>Add ward</CardTitle></CardHeader>
        <CardContent><form className="space-y-3" onSubmit={(event) => void submitWard(event)}>
          <p className="rounded-md border border-info-border bg-info-surface p-3 text-sm text-info">Hospital: <strong>{selectedHospital?.name ?? "Select a hospital above"}</strong></p>
          <div className="grid gap-3 sm:grid-cols-2"><FieldLabel label="Ward code" required><Input required maxLength={40} disabled={!selectedHospitalId} value={ward.wardCode} onChange={(event) => setWard((current) => ({ ...current, wardCode: event.target.value.toUpperCase() }))} placeholder="e.g. MED-01" /></FieldLabel><FieldLabel label="Ward name" required><Input required maxLength={160} disabled={!selectedHospitalId} value={ward.wardName} onChange={(event) => setWard((current) => ({ ...current, wardName: event.target.value }))} /></FieldLabel></div>
          <FieldLabel label="Ward type" required><Select disabled={!selectedHospitalId} value={ward.wardType} onChange={(event) => setWard((current) => ({ ...current, wardType: event.target.value }))}>{wardTypes.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select></FieldLabel>
          <FieldLabel label="Department"><Select disabled={!selectedHospitalId || departments.length === 0} value={ward.departmentId ?? ""} onChange={(event) => setWard((current) => ({ ...current, departmentId: event.target.value || undefined }))}><option value="">No department assignment</option>{departments.map((item) => <option key={item.value} value={item.value}>{item.label}{item.description ? ` · ${item.description}` : ""}</option>)}</Select></FieldLabel>
          <div className="grid gap-3 sm:grid-cols-2"><FieldLabel label="Building"><Input disabled={!selectedHospitalId} value={ward.building} onChange={(event) => setWard((current) => ({ ...current, building: event.target.value }))} /></FieldLabel><FieldLabel label="Floor"><Input disabled={!selectedHospitalId} value={ward.floor} onChange={(event) => setWard((current) => ({ ...current, floor: event.target.value }))} /></FieldLabel></div>
          <div className="grid gap-3 sm:grid-cols-2"><FieldLabel label="Gender policy"><Select disabled={!selectedHospitalId} value={ward.genderRestriction} onChange={(event) => setWard((current) => ({ ...current, genderRestriction: event.target.value }))}><option value="ANY">Any</option><option value="MALE">Male</option><option value="FEMALE">Female</option></Select></FieldLabel><FieldLabel label="Age policy"><Select disabled={!selectedHospitalId} value={ward.ageRestriction} onChange={(event) => setWard((current) => ({ ...current, ageRestriction: event.target.value }))}><option value="ANY">Any</option><option value="ADULT">Adult</option><option value="PAEDIATRIC">Paediatric</option></Select></FieldLabel></div>
          <FeatureToggle checked={ward.isolationCapable} label="Isolation capable" onChange={(checked) => setWard((current) => ({ ...current, isolationCapable: checked }))} />
          <Button className="w-full" disabled={!selectedHospitalId || busy === "ward"} type="submit"><Plus className="h-4 w-4" />{busy === "ward" ? "Creating ward…" : "Create ward"}</Button>
        </form></CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">3</span>Add beds in one batch</CardTitle></CardHeader>
        <CardContent><form className="space-y-3" onSubmit={(event) => void submitBeds(event)}>
          <FieldLabel label="Ward" required><Select required disabled={wards.length === 0} value={selectedWardId} onChange={(event) => setSelectedWardId(event.target.value)}>{wards.length === 0 && <option value="">Create a ward first</option>}{wards.map((item) => <option key={item.id} value={item.id}>{item.wardCode} · {item.wardName} · {item.totalBeds} beds</option>)}</Select></FieldLabel>
          <FieldLabel label="Room (optional)"><Select disabled={!selectedWardId || rooms.length === 0} value={beds.roomId ?? ""} onChange={(event) => setBeds((current) => ({ ...current, roomId: event.target.value || undefined }))}><option value="">No room assignment</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber}{room.roomName ? ` · ${room.roomName}` : ""} · {room.bedCount}/{room.maximumBeds}</option>)}</Select></FieldLabel>
          <div className="grid grid-cols-2 gap-3"><FieldLabel label="Number prefix" required><Input required maxLength={12} disabled={!selectedWardId} value={beds.numberPrefix} onChange={(event) => setBeds((current) => ({ ...current, numberPrefix: event.target.value.toUpperCase() }))} /></FieldLabel><FieldLabel label="Code prefix"><Input maxLength={24} disabled={!selectedWardId} value={beds.codePrefix ?? ""} onChange={(event) => setBeds((current) => ({ ...current, codePrefix: event.target.value.toUpperCase() }))} placeholder={`${selectedWard?.wardCode ?? "WARD"}-B`} /></FieldLabel></div>
          <div className="grid grid-cols-3 gap-3"><FieldLabel label="Start" required><Input required min={1} max={999999} type="number" value={beds.startNumber} onChange={(event) => setBeds((current) => ({ ...current, startNumber: Number(event.target.value) }))} /></FieldLabel><FieldLabel label="Count" required><Input required min={1} max={200} type="number" value={beds.count} onChange={(event) => setBeds((current) => ({ ...current, count: Number(event.target.value) }))} /></FieldLabel><FieldLabel label="Digits" required><Input required min={1} max={6} type="number" value={beds.padding} onChange={(event) => setBeds((current) => ({ ...current, padding: Number(event.target.value) }))} /></FieldLabel></div>
          <FieldLabel label="Bed type" required><Select value={beds.bedType} onChange={(event) => setBeds((current) => ({ ...current, bedType: event.target.value }))}>{bedTypes.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select></FieldLabel>
          <div className="grid gap-2 sm:grid-cols-2">{(["oxygenSupport", "monitorSupport", "ventilatorSupport", "isolationSupport", "electricBed", "accessibleBed"] as const).map((key) => <FeatureToggle key={key} checked={beds[key]} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase())} onChange={(checked) => setBeds((current) => ({ ...current, [key]: checked }))} />)}</div>
          <p className="text-xs text-muted-foreground">Preview: {beds.numberPrefix}{String(Math.max(1, beds.startNumber)).padStart(Math.max(1, beds.padding), "0")} through {beds.numberPrefix}{String(Math.max(1, beds.startNumber + Math.max(1, beds.count) - 1)).padStart(Math.max(1, beds.padding), "0")}. Maximum 200 beds per batch.</p>
          <Button className="w-full" disabled={!selectedWardId || busy === "beds"} type="submit"><BedDouble className="h-4 w-4" />{busy === "beds" ? "Creating beds…" : `Create ${beds.count || 0} beds`}</Button>
        </form></CardContent>
      </Card>
    </section>

    {overview && <SectionReveal><Card><CardHeader><CardTitle>Hospital network directory</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{overview.hospitals.map((item) => <button type="button" key={item.id} onClick={() => setSelectedHospitalId(item.id)} className={`rounded-xl border p-4 text-left transition ${item.id === selectedHospitalId ? "border-accent-border bg-accent-surface ring-2 ring-accent-border" : "border-border bg-surface hover:bg-muted"}`}><div className="flex items-start justify-between gap-2"><div><p className="font-black text-foreground">{item.name}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{item.code} · {item.type.replaceAll("_", " ")}</p></div><StatusBadge status={item.status} /></div><p className="mt-3 text-xs text-muted-foreground">{[item.city, item.district, item.province].filter(Boolean).join(" · ") || "Location not recorded"}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded-md bg-muted p-2"><strong className="block text-lg text-foreground">{item.departmentCount}</strong>Departments</span><span className="rounded-md bg-muted p-2"><strong className="block text-lg text-foreground">{item.wardCount}</strong>Wards</span><span className="rounded-md bg-muted p-2"><strong className="block text-lg text-foreground">{item.bedCount}</strong>Beds</span></div></button>)}</div></CardContent></Card></SectionReveal>}
  </div></PageTransition>;
}
