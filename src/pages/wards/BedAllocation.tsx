import { CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast-context";
import { PageTransition } from "../../components/motion/PageTransition";
import { SearchableSelect } from "../../components/forms";
import { AdmissionSearchSelector } from "../../components/selectors";
import type { SelectOption } from "../../data/referenceOptions";
import { allocateAdmissionBed, getBedSuggestions, reserveAdmissionBed } from "../../services/wardService";
import type { BedSuggestion } from "../../types/ward";

const WARD_TYPE_OPTIONS: SelectOption[] = [
  ["", "Any suitable ward"], ["GENERAL_MEDICAL_WARD", "General medical ward"], ["SURGICAL_WARD", "Surgical ward"], ["PAEDIATRIC_WARD", "Paediatric ward"], ["INTENSIVE_CARE_UNIT", "Intensive care unit"], ["HIGH_DEPENDENCY_UNIT", "High dependency unit"], ["ISOLATION_WARD", "Isolation ward"],
].map(([value, label]) => ({ value, label }));
const TRANSFER_PRIORITY_OPTIONS: SelectOption[] = [
  ["ROUTINE", "Routine"], ["URGENT", "Urgent"], ["EMERGENCY", "Emergency"], ["ICU_PRIORITY", "ICU priority"], ["ISOLATION_PRIORITY", "Isolation priority"],
].map(([value, label]) => ({ value, label }));

export function BedAllocation() {
  const { showToast } = useToast();
  const [admissionId, setAdmissionId] = useState("");
  const [wardType, setWardType] = useState("");
  const [priority, setPriority] = useState("ROUTINE");
  const [isolation, setIsolation] = useState(false);
  const [oxygen, setOxygen] = useState(false);
  const [ventilator, setVentilator] = useState(false);
  const [suggestions, setSuggestions] = useState<BedSuggestion[]>([]);
  const [busy, setBusy] = useState(false);

  async function findBeds() {
    if (!admissionId.trim()) { showToast("Enter an admission UUID.", "warning"); return; }
    setBusy(true);
    try { setSuggestions(await getBedSuggestions(admissionId.trim(), { requiredWardType: wardType || undefined, isolationRequired: isolation, oxygenRequired: oxygen, ventilatorRequired: ventilator, accessibleRequired: false })); }
    catch (error) { showToast(error instanceof Error ? error.message : "Unable to find beds.", "danger"); }
    finally { setBusy(false); }
  }

  async function act(bed: BedSuggestion, action: "reserve" | "allocate") {
    setBusy(true);
    try { if (action === "reserve") await reserveAdmissionBed(admissionId, bed.id, priority); else await allocateAdmissionBed(admissionId, bed.id); showToast(`${bed.bedCode} ${action === "reserve" ? "reserved" : "allocated"} successfully.`, "success"); await findBeds(); }
    catch (error) { showToast(error instanceof Error ? error.message : "Bed operation failed.", "danger"); }
    finally { setBusy(false); }
  }

  return (
    <PageTransition><div className="space-y-5"><header className="page-hero"><p className="text-sm font-semibold text-primary">Admission workflow</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Suitable Bed Allocation</h1><p className="mt-2 text-sm text-muted-foreground">The backend ranks compatible beds and locks the selected row before reservation or allocation.</p></header>
      <Card><CardHeader><CardTitle>Patient admission requirements</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm font-semibold">Active admission *<AdmissionSearchSelector required value={admissionId} onChange={setAdmissionId} /></label>
        <label className="space-y-1 text-sm font-semibold">Required ward type<SearchableSelect value={wardType} options={WARD_TYPE_OPTIONS} onChange={setWardType} clearable={false} /></label>
        <label className="space-y-1 text-sm font-semibold">Priority<SearchableSelect value={priority} options={TRANSFER_PRIORITY_OPTIONS} onChange={setPriority} clearable={false} /></label>
        <div className="flex flex-wrap items-end gap-4 rounded-md border border-border p-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={isolation} onChange={(event) => setIsolation(event.target.checked)} /> Isolation required</label><label className="flex items-center gap-2"><input type="checkbox" checked={oxygen} onChange={(event) => setOxygen(event.target.checked)} /> Oxygen required</label><label className="flex items-center gap-2"><input type="checkbox" checked={ventilator} onChange={(event) => setVentilator(event.target.checked)} /> Ventilator required</label></div>
        <Button onClick={() => void findBeds()} disabled={busy}><Search className="h-4 w-4" />Find suitable beds</Button>
      </CardContent></Card>
      <section className="grid gap-4 lg:grid-cols-2">{suggestions.map((bed) => <Card key={bed.id} className={bed.suitable ? "border-emerald-300" : "border-amber-300"}><CardHeader><CardTitle className="flex items-center justify-between"><span>{bed.bedCode} · {bed.wardName}</span><Badge tone={bed.suitable ? "success" : "warning"}>Score {bed.score}</Badge></CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Room {bed.roomNumber ?? "—"} · {bed.bedType}</p><div className="space-y-1 text-sm">{bed.reasons.map((reason) => <p key={reason} className="flex gap-2 text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4" />{reason}</p>)}{bed.warnings.map((warning) => <p key={warning} className="text-amber-800">⚠ {warning}</p>)}</div><div className="flex gap-2"><Button variant="outline" disabled={busy || !bed.suitable} onClick={() => void act(bed, "reserve")}><ShieldCheck className="h-4 w-4" />Reserve</Button><Button disabled={busy || !bed.suitable} onClick={() => void act(bed, "allocate")}>Confirm Allocation</Button></div></CardContent></Card>)}{suggestions.length === 0 && <Card><CardContent className="text-sm text-muted-foreground">Search for a valid active admission to view ranked bed suggestions.</CardContent></Card>}</section>
    </div></PageTransition>
  );
}
