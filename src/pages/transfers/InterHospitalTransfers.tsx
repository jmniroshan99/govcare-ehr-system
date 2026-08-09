import { Ambulance, CheckCircle2, Download, Hospital, Plus, RefreshCw, Send, XCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { saveAs } from "file-saver";
import { apiRequest } from "../../services/apiClient";
import { cancelInterHospitalTransfer, createInterHospitalTransfer, downloadTransferPackage, getInterHospitalTransfers, interHospitalTransferAction, rejectInterHospitalTransfer, requestTransferInformation, reserveInterHospitalBed, scheduleTransferTransport } from "../../services/transferService";
import { getBeds } from "../../services/wardService";
import type { InterHospitalTransfer } from "../../types/transfer";
import type { WardBed } from "../../types/ward";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { StatusBadge } from "../../components/ui/badge";
import { useToast } from "../../components/ui/toast-context";
import { PageTransition } from "../../components/motion/PageTransition";
import { SearchableSelect } from "../../components/forms";
import { AdmissionSearchSelector } from "../../components/selectors";
import type { SelectOption } from "../../data/referenceOptions";

type Direction = "all" | "incoming" | "outgoing";
type HospitalOption = { id: string; code: string; name: string; city?: string; district?: string };

export function InterHospitalTransfers({ direction = "all" }: { direction?: Direction }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<InterHospitalTransfer[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [availableBeds, setAvailableBeds] = useState<WardBed[]>([]);
  const [sourceAdmissionId, setSourceAdmissionId] = useState("");
  const [destinationHospitalId, setDestinationHospitalId] = useState("");
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState("ROUTINE");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [transferItems, options] = await Promise.all([
        getInterHospitalTransfers(direction),
        apiRequest<{ currentHospitalId?: string; hospitals: HospitalOption[] }>("/api/transfers/inter-hospital/options"),
      ]);
      setItems(transferItems); setHospitals(options.hospitals.filter((hospital) => hospital.id !== options.currentHospitalId));
      if (direction === "incoming") setAvailableBeds(await getBeds({ availableOnly: true }));
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to load transfers.", "danger"); }
  }
  useEffect(() => { void load(); }, [direction]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      await createInterHospitalTransfer({ sourceAdmissionId, destinationHospitalId, transferReason: reason, clinicalSummary: summary, priority, isolationRequired: false, oxygenRequired: false, ventilatorRequired: false, documentIds: [] });
      showToast("Inter-hospital transfer draft created.", "success"); setSourceAdmissionId(""); setDestinationHospitalId(""); setReason(""); setSummary(""); await load();
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to create transfer.", "danger"); }
    finally { setBusy(false); }
  }

  async function action(item: InterHospitalTransfer, next: "submit" | "accept" | "reserve" | "schedule" | "depart" | "arrive" | "confirm-admission" | "complete" | "reject" | "request-info" | "cancel" | "download") {
    setBusy(true);
    try {
      if (next === "reserve") {
        const bedId = window.prompt("Destination bed UUID", availableBeds[0]?.id ?? ""); if (!bedId) return; await reserveInterHospitalBed(item.id, bedId);
      } else if (next === "schedule") {
        await scheduleTransferTransport(item.id, { transportType: "Hospital Ambulance", estimatedDeparture: new Date(Date.now() + 60 * 60 * 1000).toISOString(), estimatedArrival: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() });
      } else if (next === "reject") {
        const rejection = window.prompt("Rejection reason"); if (!rejection) return; await rejectInterHospitalTransfer(item.id, rejection);
      } else if (next === "request-info") {
        const information = window.prompt("Information or documents required"); if (!information) return; await requestTransferInformation(item.id, information);
      } else if (next === "cancel") {
        const cancellation = window.prompt("Cancellation reason"); if (!cancellation) return; await cancelInterHospitalTransfer(item.id, cancellation);
      } else if (next === "download") {
        const file = await downloadTransferPackage(item.id); saveAs(file.blob, file.filename); return;
      } else {
        await interHospitalTransferAction(item.id, next);
      }
      showToast(`Transfer ${next} action completed.`, "success"); await load();
    } catch (error) { showToast(error instanceof Error ? error.message : "Transfer action failed.", "danger"); }
    finally { setBusy(false); }
  }

  const title = direction === "incoming" ? "Incoming Hospital Transfers" : direction === "outgoing" ? "Outgoing Hospital Transfers" : "Inter-Hospital Patient Transfers";
  const canUseSendingActions = direction !== "incoming";
  const canUseReceivingActions = direction !== "outgoing";
  const hospitalOptions: SelectOption[] = hospitals.map((hospital) => ({ value: hospital.id, label: hospital.name, description: [hospital.code, hospital.city, hospital.district].filter(Boolean).join(" · ") }));
  const priorityOptions: SelectOption[] = [
    ["ROUTINE", "Routine"], ["URGENT", "Urgent"], ["EMERGENCY", "Emergency"], ["ICU_PRIORITY", "ICU priority"], ["ISOLATION_PRIORITY", "Isolation priority"],
  ].map(([value, label]) => ({ value, label }));
  return <PageTransition><div className="space-y-5"><header className="page-hero flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">GovCare hospital network</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1><p className="mt-2 text-sm text-muted-foreground">Coordinate acceptance, receiving-bed reservation, secure document sharing, transport, departure and arrival.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh</Button></header>
    {direction !== "incoming" && <Card><CardHeader><CardTitle>Create transfer draft</CardTitle></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => void submit(event)}>
      <label className="text-sm font-medium">Source admission *<AdmissionSearchSelector required value={sourceAdmissionId} onChange={setSourceAdmissionId} /></label>
      <label className="text-sm font-medium">Receiving hospital *<SearchableSelect required value={destinationHospitalId} options={hospitalOptions} onChange={setDestinationHospitalId} placeholder="Search receiving hospital" /></label>
      <label className="text-sm font-medium">Priority<SearchableSelect value={priority} options={priorityOptions} onChange={setPriority} clearable={false} /></label>
      <label className="text-sm font-medium">Transfer reason *<Input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Clinical or operational reason" /></label>
      <label className="text-sm font-medium">Clinical summary *<Input required value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Narrative transfer summary" /></label>
      <Button type="submit" disabled={busy}><Plus className="h-4 w-4" />Create draft</Button>
    </form></CardContent></Card>}
    <div className="space-y-3">{items.map((item) => <Card key={item.id}><CardContent className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-950">{item.transferNumber} · {item.patientName}</p><StatusBadge status={item.status} /></div><p className="mt-1 text-sm text-muted-foreground">{item.patientNumber} · {item.priority}</p></div><Button className="min-h-9" variant="outline" onClick={() => void action(item, "download")}><Download className="h-4 w-4" />Transfer PDF</Button></div><div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]"><div className="rounded-md border border-border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Sending</p><p className="mt-1 font-bold">{item.sourceHospitalName}</p><p className="text-sm text-muted-foreground">{item.sourceWardName ?? "Ward pending"} · {item.sourceBedCode ?? "Bed pending"}</p></div><div className="grid place-items-center"><Ambulance className="h-6 w-6 text-primary" /></div><div className="rounded-md border border-border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Receiving</p><p className="mt-1 font-bold">{item.destinationHospitalName}</p><p className="text-sm text-muted-foreground">{item.destinationWardName ?? item.requestedWardType ?? "Ward pending"} · {item.destinationBedCode ?? "Bed pending"}</p></div></div><div className="rounded-md bg-slate-50 p-3 text-sm"><p className="font-bold">{item.transferReason}</p><p className="mt-1 text-muted-foreground">{item.clinicalSummary}</p></div><div className="flex flex-wrap gap-2">{canUseSendingActions && item.status === "DRAFT" && <Button className="min-h-9" onClick={() => void action(item, "submit")} disabled={busy}><Send className="h-4 w-4" />Submit</Button>}{canUseReceivingActions && ["SUBMITTED","UNDER_REVIEW"].includes(item.status) && <><Button className="min-h-9" onClick={() => void action(item, "accept")} disabled={busy}><CheckCircle2 className="h-4 w-4" />Accept</Button><Button className="min-h-9" variant="outline" onClick={() => void action(item, "request-info")} disabled={busy}>Request info</Button><Button className="min-h-9" variant="destructive" onClick={() => void action(item, "reject")} disabled={busy}><XCircle className="h-4 w-4" />Reject</Button></>}{canUseReceivingActions && item.status === "ACCEPTED" && <Button className="min-h-9" onClick={() => void action(item, "reserve")} disabled={busy}><Hospital className="h-4 w-4" />Reserve receiving bed</Button>}{canUseSendingActions && ["BED_RESERVED","ACCEPTED"].includes(item.status) && <Button className="min-h-9" variant="outline" onClick={() => void action(item, "schedule")} disabled={busy}>Schedule transport</Button>}{canUseSendingActions && ["TRANSPORT_SCHEDULED","READY_FOR_DEPARTURE","BED_RESERVED"].includes(item.status) && <Button className="min-h-9" onClick={() => void action(item, "depart")} disabled={busy}>Confirm departure</Button>}{canUseReceivingActions && ["DEPARTED","IN_TRANSIT"].includes(item.status) && <Button className="min-h-9" onClick={() => void action(item, "arrive")} disabled={busy}>Confirm arrival</Button>}{canUseReceivingActions && item.status === "ARRIVED" && <Button className="min-h-9" onClick={() => void action(item, "confirm-admission")} disabled={busy}>Create receiving admission</Button>}{canUseReceivingActions && item.status === "ADMISSION_CONFIRMED" && <Button className="min-h-9" onClick={() => void action(item, "complete")} disabled={busy}>Complete transfer</Button>}{canUseSendingActions && !["DEPARTED","IN_TRANSIT","ARRIVED","ADMISSION_CONFIRMED","COMPLETED","CANCELLED","REJECTED"].includes(item.status) && <Button className="min-h-9" variant="destructive" onClick={() => void action(item, "cancel")} disabled={busy}>Cancel</Button>}</div></CardContent></Card>)}{items.length === 0 && <Card><CardContent className="text-sm text-muted-foreground">No transfers are available in this queue.</CardContent></Card>}</div>
  </div></PageTransition>;
}

export function IncomingTransfers() { return <InterHospitalTransfers direction="incoming" />; }
export function OutgoingTransfers() { return <InterHospitalTransfers direction="outgoing" />; }
