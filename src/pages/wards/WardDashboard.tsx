import { BedDouble, Building2, ClipboardPlus, Hospital, RefreshCw, Repeat2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast-context";
import { PageTransition } from "../../components/motion/PageTransition";
import { getWardDashboard } from "../../services/wardService";
import type { WardDashboardResponse } from "../../types/ward";

const shortcuts = [
  { href: "/wards/bed-board", label: "Live Bed Board", description: "View real-time bed availability and clinical occupancy.", icon: BedDouble },
  { href: "/admissions/bed-allocation", label: "Bed Allocation", description: "Find, reserve and allocate a suitable bed.", icon: ClipboardPlus },
  { href: "/transfers/internal", label: "Internal Transfers", description: "Coordinate bed, room, ward and department transfers.", icon: Repeat2 },
  { href: "/transfers/inter-hospital", label: "Hospital Transfers", description: "Manage incoming and outgoing inter-hospital transfers.", icon: Hospital },
  { href: "/admin/wards", label: "Ward Configuration", description: "Create wards, rooms and beds.", icon: Building2 },
];

export function WardDashboard() {
  const { showToast } = useToast();
  const [data, setData] = useState<WardDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setData(await getWardDashboard());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load ward dashboard.", "danger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const summary = data?.summary;
  return (
    <PageTransition>
      <div className="space-y-5">
        <header className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Inpatient operations</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Ward Management and Patient Transfers</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Manage wards, reserve and allocate beds, and coordinate safe internal and inter-hospital patient movement.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total beds", summary?.totalBeds ?? 0, "neutral"],
            ["Available", summary?.availableBeds ?? 0, "success"],
            ["Occupied", summary?.occupiedBeds ?? 0, "danger"],
            ["Reserved", summary?.reservedBeds ?? 0, "info"],
            ["Cleaning", summary?.cleaningBeds ?? 0, "warning"],
            ["Blocked", summary?.blockedBeds ?? 0, "danger"],
            ["Maintenance", summary?.maintenanceBeds ?? 0, "warning"],
            ["Occupancy", `${summary?.occupancyPercent ?? 0}%`, "info"],
          ].map(([label, value, tone]) => (
            <Card key={String(label)}><CardContent><p className="text-xs font-bold uppercase text-muted-foreground">{label}</p><div className="mt-2 flex items-end justify-between"><p className="text-3xl font-bold text-slate-950">{value}</p><Badge tone={tone as "neutral" | "success" | "danger" | "info" | "warning"}>{label}</Badge></div></CardContent></Card>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => (
            <Link key={item.href} to={item.href} className="block">
              <Card className="h-full"><CardContent className="flex gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cyan-100 text-cyan-800"><item.icon className="h-6 w-6" /></div><div><h2 className="font-bold text-slate-950">{item.label}</h2><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></div></CardContent></Card>
            </Link>
          ))}
        </section>

        <Card>
          <CardHeader><CardTitle>Ward occupancy</CardTitle></CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {(data?.wards ?? []).map((ward) => (
              <div key={ward.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{ward.wardName}</p><p className="text-xs text-muted-foreground">{ward.wardCode} · {ward.wardType.replaceAll("_", " ")}</p></div><Badge tone={ward.availableBeds > 0 ? "success" : "danger"}>{ward.availableBeds} available</Badge></div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-primary" style={{ width: `${Math.min(100, Number(ward.occupancyPercent))}%` }} /></div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{ward.occupiedBeds}/{ward.totalBeds} occupied</span><span>{ward.occupancyPercent}%</span></div>
              </div>
            ))}
            {!loading && !data?.wards.length && <p className="text-sm text-muted-foreground">No wards are configured for this hospital.</p>}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
