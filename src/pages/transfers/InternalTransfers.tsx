import { ArrowRightLeft, CheckCircle2, Play, Plus, RefreshCw, XCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { StatusBadge } from "../../components/ui/badge";
import { useToast } from "../../components/ui/toast-context";
import { PageTransition } from "../../components/motion/PageTransition";
import { SearchableSelect } from "../../components/forms";
import { AdmissionSearchSelector } from "../../components/selectors";
import type { SelectOption } from "../../data/referenceOptions";
import { cancelInternalTransfer, createInternalTransfer, getBeds, getInternalTransfers, getWards, internalTransferAction, reserveInternalTransferBed } from "../../services/wardService";
import type { InternalTransfer, WardBed, WardSummary } from "../../types/ward";

export function InternalTransfers() {
  const { showToast } = useToast();
  const [items, setItems] = useState<InternalTransfer[]>([]);
  const [wards, setWards] = useState<WardSummary[]>([]);
  const [beds, setBeds] = useState<WardBed[]>([]);
  const [admissionId, setAdmissionId] = useState("");
  const [destinationWardId, setDestinationWardId] = useState("");
  const [destinationBedId, setDestinationBedId] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("ROUTINE");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [transfers, wardItems] = await Promise.all([getInternalTransfers(), getWards()]);
      setItems(transfers); setWards(wardItems);
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to load internal transfers.", "danger"); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!destinationWardId) { setBeds([]); setDestinationBedId(""); return; }
    void getBeds({ wardId: destinationWardId, availableOnly: true }).then(setBeds).catch(() => setBeds([]));
  }, [destinationWardId]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      await createInternalTransfer({ admissionId, destinationWardId, destinationBedId: destinationBedId || undefined, transferReason: reason, priority, isolationRequired: false, transportAssistanceRequired: false });
      showToast("Internal transfer request created.", "success"); setAdmissionId(""); setDestinationWardId(""); setDestinationBedId(""); setReason(""); await load();
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to create transfer.", "danger"); }
    finally { setBusy(false); }
  }

  async function action(item: InternalTransfer, next: "approve" | "accept" | "reserve" | "start" | "complete" | "cancel") {
    setBusy(true);
    try {
      if (next === "reserve") {
        const selected = item.destinationBedId || window.prompt("Enter destination bed UUID");
        if (!selected) return;
        await reserveInternalTransferBed(item.id, selected);
      } else if (next === "cancel") {
        const cancellation = window.prompt("Cancellation reason") ?? "Cancelled by authorized staff";
        await cancelInternalTransfer(item.id, cancellation);
      } else {
        await internalTransferAction(item.id, next);
      }
      showToast(`Transfer ${next} action completed.`, "success"); await load();
    } catch (error) { showToast(error instanceof Error ? error.message : "Transfer action failed.", "danger"); }
    finally { setBusy(false); }
  }

  const wardOptions: SelectOption[] = wards.map((ward) => ({ value: ward.id, label: ward.wardName, description: `${ward.wardCode ?? "Ward"} · ${ward.availableBeds ?? 0} beds available`, disabled: ward.status !== "ACTIVE" || Number(ward.availableBeds ?? 0) < 1 }));
  const bedOptions: SelectOption[] = beds.map((bed) => ({ value: bed.id, label: bed.bedCode, description: [bed.roomNumber && `Room ${bed.roomNumber}`, bed.bedType, bed.status].filter(Boolean).join(" · ") }));
  const priorityOptions: SelectOption[] = [
    ["ROUTINE", "Routine"], ["URGENT", "Urgent"], ["EMERGENCY", "Emergency"], ["ICU_PRIORITY", "ICU priority"], ["ISOLATION_PRIORITY", "Isolation priority"],
  ].map(([value, label]) => ({ value, label }));

  return <PageTransition><div className="space-y-5"><header className="page-hero flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Ward-to-ward coordination</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Internal Patient Transfers</h1><p className="mt-2 text-sm text-muted-foreground">The source bed remains occupied until the destination ward confirms completion.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh</Button></header>
    <Card><CardHeader><CardTitle>Request internal transfer</CardTitle></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => void submit(event)}>
      <label className="text-sm font-medium">Active admission *<AdmissionSearchSelector required value={admissionId} onChange={setAdmissionId} /></label>
      <label className="text-sm font-medium">Destination ward *<SearchableSelect required value={destinationWardId} options={wardOptions} onChange={setDestinationWardId} placeholder="Select active ward" /></label>
      <label className="text-sm font-medium">Destination bed<SearchableSelect value={destinationBedId} options={bedOptions} onChange={setDestinationBedId} placeholder={destinationWardId ? "Select available bed or reserve later" : "Select ward first"} disabled={!destinationWardId} /></label>
      <label className="text-sm font-medium">Priority<SearchableSelect value={priority} options={priorityOptions} onChange={setPriority} clearable={false} /></label>
      <label className="text-sm font-medium">Transfer reason *<Input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Clinical or operational reason" /></label>
      <Button type="submit" disabled={busy}><Plus className="h-4 w-4" />Request</Button>
    </form></CardContent></Card>
    <div className="space-y-3">{items.map((item) => <Card key={item.id}><CardContent className="grid gap-4 lg:grid-cols-[1.4fr_1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-950">{item.patientName} · {item.patientNumber}</p><StatusBadge status={item.status} /></div><p className="mt-1 text-sm text-muted-foreground">{item.admissionNumber} · {item.priority}</p><p className="mt-2 text-sm">{item.transferReason}</p></div><div className="flex items-center gap-3 text-sm"><div><p className="font-bold">{item.sourceWardName}</p><p className="text-muted-foreground">{item.sourceBedCode}</p></div><ArrowRightLeft className="h-5 w-5 text-primary" /><div><p className="font-bold">{item.destinationWardName}</p><p className="text-muted-foreground">{item.destinationBedCode ?? "Bed pending"}</p></div></div><div className="flex flex-wrap items-center gap-2">{item.status === "REQUESTED" && <Button className="min-h-9" onClick={() => void action(item, "approve")} disabled={busy}><CheckCircle2 className="h-4 w-4" />Approve</Button>}{["REQUESTED","APPROVED"].includes(item.status) && <Button className="min-h-9" variant="outline" onClick={() => void action(item, "accept")} disabled={busy}>Accept</Button>}{["APPROVED","ACCEPTED"].includes(item.status) && <Button className="min-h-9" variant="outline" onClick={() => void action(item, "reserve")} disabled={busy}>Reserve bed</Button>}{["BED_RESERVED","READY_FOR_TRANSFER"].includes(item.status) && <Button className="min-h-9" onClick={() => void action(item, "start")} disabled={busy}><Play className="h-4 w-4" />Start</Button>}{item.status === "IN_TRANSIT" && <Button className="min-h-9" onClick={() => void action(item, "complete")} disabled={busy}>Complete</Button>}{!["COMPLETED","CANCELLED"].includes(item.status) && <Button className="min-h-9" variant="destructive" onClick={() => void action(item, "cancel")} disabled={busy}><XCircle className="h-4 w-4" /></Button>}</div></CardContent></Card>)}{items.length === 0 && <Card><CardContent className="text-sm text-muted-foreground">No internal transfer requests are available.</CardContent></Card>}</div>
  </div></PageTransition>;
}
