import { BedDouble, RefreshCw, ShieldAlert, Sparkles, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, StatusBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select } from "../../components/ui/select";
import { useToast } from "../../components/ui/toast-context";
import { PageTransition } from "../../components/motion/PageTransition";
import { changeBedStatus, getBeds, getWards } from "../../services/wardService";
import type { WardBed, WardSummary } from "../../types/ward";

export function BedBoard() {
  const { showToast } = useToast();
  const [wards, setWards] = useState<WardSummary[]>([]);
  const [beds, setBeds] = useState<WardBed[]>([]);
  const [wardId, setWardId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [wardItems, bedItems] = await Promise.all([getWards(), getBeds({ wardId: wardId || undefined, status: status || undefined })]);
      setWards(wardItems); setBeds(bedItems);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load bed board.", "danger");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [wardId, status]);

  const counts = useMemo(() => beds.reduce<Record<string, number>>((acc, bed) => { acc[bed.status] = (acc[bed.status] ?? 0) + 1; return acc; }, {}), [beds]);

  async function updateStatus(bed: WardBed, next: string) {
    try { await changeBedStatus(bed.id, next, next === "BLOCKED" ? "Operational block" : undefined); showToast(`${bed.bedCode} marked ${next.toLowerCase()}.`, "success"); await load(); }
    catch (error) { showToast(error instanceof Error ? error.message : "Unable to update bed.", "danger"); }
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <header className="page-hero flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Live inpatient capacity</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Bed Board</h1><p className="mt-2 text-sm text-muted-foreground">Current status is always revalidated by Spring Boot before reservation or allocation.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" />Refresh</Button></header>
        <Card><CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Select value={wardId} onChange={(event) => setWardId(event.target.value)}><option value="">All wards</option>{wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.wardName}</option>)}</Select><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["AVAILABLE","RESERVED","OCCUPIED","CLEANING","BLOCKED","MAINTENANCE","INFECTION_CONTROL"].map((item) => <option key={item}>{item}</option>)}</Select><div className="rounded-md border border-border p-3 text-sm"><span className="font-bold">Available:</span> {counts.AVAILABLE ?? 0}</div><div className="rounded-md border border-border p-3 text-sm"><span className="font-bold">Occupied:</span> {counts.OCCUPIED ?? 0}</div></CardContent></Card>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {beds.map((bed) => (
            <Card key={bed.id} className={bed.status === "OCCUPIED" ? "border-rose-300" : bed.status === "AVAILABLE" ? "border-emerald-300" : ""}>
              <CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><BedDouble className="h-5 w-5" />{bed.bedCode}</span><StatusBadge status={bed.status} /></CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm"><div><p className="font-bold text-slate-950">{bed.wardName} · Room {bed.roomNumber ?? "—"}</p><p className="text-muted-foreground">{bed.bedType.replaceAll("_", " ")}</p></div>{bed.patientName ? <div className="rounded-md bg-rose-50 p-3"><p className="font-bold text-rose-900">{bed.patientName}</p><p className="text-xs text-rose-700">{bed.patientNumber} · {bed.admissionNumber}</p></div> : <div className="rounded-md bg-emerald-50 p-3 text-emerald-800">Ready for allocation</div>}<div className="flex flex-wrap gap-2">{bed.isolationSupport && <Badge tone="warning"><ShieldAlert className="h-3 w-3" />Isolation</Badge>}{bed.oxygenSupport && <Badge tone="info"><Wind className="h-3 w-3" />Oxygen</Badge>}{bed.ventilatorSupport && <Badge tone="danger"><Sparkles className="h-3 w-3" />Ventilator</Badge>}</div><div className="flex flex-wrap gap-2">{bed.status === "AVAILABLE" && <Button className="min-h-9 px-3 py-1" variant="outline" onClick={() => void updateStatus(bed, "BLOCKED")}>Block</Button>}{["BLOCKED","CLEANING","MAINTENANCE"].includes(bed.status) && <Button className="min-h-9 px-3 py-1" onClick={() => void updateStatus(bed, "AVAILABLE")}>Mark available</Button>}{bed.status === "OCCUPIED" && <Button className="min-h-9 px-3 py-1" variant="outline" onClick={() => void updateStatus(bed, "PENDING_DISCHARGE")}>Pending discharge</Button>}</div></CardContent>
            </Card>
          ))}
          {!loading && beds.length === 0 && <Card><CardContent>No beds match the selected filters.</CardContent></Card>}
        </section>
      </div>
    </PageTransition>
  );
}
