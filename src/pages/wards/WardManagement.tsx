import { Building2, Plus, RefreshCw } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../../services/apiClient";
import { getWards } from "../../services/wardService";
import type { WardSummary } from "../../types/ward";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { StatusBadge } from "../../components/ui/badge";
import { useToast } from "../../components/ui/toast-context";
import { PageTransition } from "../../components/motion/PageTransition";

export function WardManagement() {
  const { showToast } = useToast();
  const [wards, setWards] = useState<WardSummary[]>([]);
  const [wardCode, setWardCode] = useState("");
  const [wardName, setWardName] = useState("");
  const [wardType, setWardType] = useState("GENERAL_MEDICAL_WARD");
  const [floor, setFloor] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() { try { setWards(await getWards()); } catch (error) { showToast(error instanceof Error ? error.message : "Unable to load wards.", "danger"); } }
  useEffect(() => { void load(); }, []);

  async function createWard(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      await apiRequest("/api/wards", { method: "POST", body: JSON.stringify({ wardCode, wardName, wardType, floor, genderRestriction: "ANY", ageRestriction: "ANY", isolationCapable: wardType === "ISOLATION_WARD", status: "ACTIVE" }) });
      setWardCode(""); setWardName(""); setFloor(""); showToast("Ward created successfully.", "success"); await load();
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to create ward.", "danger"); }
    finally { setBusy(false); }
  }

  return <PageTransition><div className="space-y-5"><header className="page-hero flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Hospital configuration</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Ward, Room and Bed Management</h1><p className="mt-2 text-sm text-muted-foreground">Create operational ward structures without changing existing patient or admission records.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh</Button></header>
    <Card><CardHeader><CardTitle>Create ward</CardTitle></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={(event) => void createWard(event)}><Input required value={wardCode} onChange={(event) => setWardCode(event.target.value)} placeholder="Ward code" /><Input required value={wardName} onChange={(event) => setWardName(event.target.value)} placeholder="Ward name" /><Select value={wardType} onChange={(event) => setWardType(event.target.value)}>{["GENERAL_MEDICAL_WARD","SURGICAL_WARD","PAEDIATRIC_WARD","MATERNITY_WARD","INTENSIVE_CARE_UNIT","HIGH_DEPENDENCY_UNIT","ISOLATION_WARD","EMERGENCY_OBSERVATION_WARD"].map((item) => <option key={item}>{item}</option>)}</Select><Input value={floor} onChange={(event) => setFloor(event.target.value)} placeholder="Floor" /><Button type="submit" disabled={busy}><Plus className="h-4 w-4" />Create ward</Button></form></CardContent></Card>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{wards.map((ward) => <Card key={ward.id}><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><Building2 className="h-5 w-5" />{ward.wardName}</span><StatusBadge status={ward.status} /></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="font-bold">Code:</span> {ward.wardCode}</p><p><span className="font-bold">Type:</span> {ward.wardType.replaceAll("_", " ")}</p><p><span className="font-bold">Beds:</span> {ward.totalBeds} total · {ward.availableBeds} available</p><p><span className="font-bold">Occupancy:</span> {ward.occupancyPercent}%</p></CardContent></Card>)}</section>
  </div></PageTransition>;
}
