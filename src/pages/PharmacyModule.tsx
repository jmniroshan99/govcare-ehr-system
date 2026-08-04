import { CheckCircle2, PackageCheck, RefreshCcw, ShieldCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, StatusBadge } from "../components/ui/badge";
import { PdfActionButtons } from "../components/reports/PdfActionButtons";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { dispensePharmacyPrescription, getPharmacyPrescriptions, verifyPharmacyPrescription, type PrescriptionRecord } from "../services/workflowService";
import { formatStringList, normalizeJsonArray } from "../utils/dataNormalization";

export function PharmacyModule() {
  const { showToast } = useToast();
  const [items, setItems] = useState<PrescriptionRecord[]>([]);
  const [selected, setSelected] = useState<PrescriptionRecord | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPharmacyPrescriptions(status || undefined);
      setItems(result.items);
      setSelected((current) => result.items.find((item) => item.id === current?.id) ?? result.items[0] ?? null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load pharmacy prescriptions.", "danger");
    } finally {
      setLoading(false);
    }
  }, [showToast, status]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(timer);
  }, [load]);

  const displayed = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => `${item.prescription_no} ${item.patient_name} ${item.patient_no} ${item.doctor_name}`.toLowerCase().includes(term)) : items;
  }, [items, search]);

  async function perform(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      showToast(message, "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Pharmacy action failed.", "danger");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">Pharmacy Verification</h1><p className="text-sm text-muted-foreground">Doctor prescriptions, pharmacist verification, stock issue, and dispensing.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCcw className="h-4 w-4" />Refresh</Button></div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Prescription queue</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search prescription, patient, doctor..." /><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["pending", "pending_verification", "verified", "rejected", "dispensed", "partially_dispensed"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select></div>
            <div className="overflow-x-auto"><Table><thead><tr><Th>Prescription</Th><Th>Patient</Th><Th>Doctor</Th><Th>Status</Th><Th>Open</Th></tr></thead><tbody>{displayed.map((item) => <tr key={item.id}><Td className="font-semibold">{item.prescription_no}<br /><span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span></Td><Td><strong>{item.patient_name}</strong><br /><span className="text-xs text-muted-foreground">{item.patient_no} · {item.age_years ?? "N/A"} years</span></Td><Td>{item.doctor_name}</Td><Td><StatusBadge status={item.pharmacy_status} /></Td><Td><div className="flex items-center gap-1.5"><Button variant="outline" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => setSelected(item)}>Preview</Button><PdfActionButtons kind="pharmacy" recordId={item.id} /></div></Td></tr>)}{!loading && displayed.length === 0 && <tr><Td colSpan={5} className="text-center">No prescriptions found.</Td></tr>}{loading && <tr><Td colSpan={5} className="text-center">Loading pharmacy queue...</Td></tr>}</tbody></Table></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>Prescription Preview</CardTitle><PdfActionButtons kind="pharmacy" recordId={selected?.id} /></CardHeader>
          <CardContent className="space-y-4">
            {!selected ? <p className="text-sm text-muted-foreground">Select a prescription to verify.</p> : <>
              <div className="grid gap-2 text-sm sm:grid-cols-2"><div><strong>Prescription</strong><br />{selected.prescription_no}</div><div><strong>Status</strong><br /><StatusBadge status={selected.pharmacy_status} /></div><div><strong>Patient</strong><br />{selected.patient_name}</div><div><strong>Patient ID</strong><br />{selected.patient_no}</div><div><strong>Age / Gender</strong><br />{selected.age_years ?? "N/A"} / {selected.gender || "N/A"}</div><div><strong>Blood group</strong><br />{selected.blood_group || "N/A"}</div><div><strong>Allergies</strong><br />{formatStringList(selected.allergies)}</div><div><strong>Doctor</strong><br />{selected.doctor_name}</div><div><strong>Diagnosis</strong><br />{selected.diagnosis || "Not recorded"}</div><div><strong>Digital signature</strong><br />{selected.digital_signature || "Not signed"}</div></div>
              <div className="overflow-x-auto"><Table><thead><tr><Th>Medicine</Th><Th>Dose</Th><Th>Frequency</Th><Th>Duration</Th><Th>Quantity</Th></tr></thead><tbody>{normalizeJsonArray<PrescriptionRecord["lines"][number]>(selected.lines).map((line) => <tr key={line.id}><Td><strong>{line.medicineName}</strong><br /><span className="text-xs text-muted-foreground">{line.strength || ""} · {line.route || ""}</span></Td><Td>{line.dosage}</Td><Td>{line.frequency}</Td><Td>{line.duration}</Td><Td>{line.quantity ?? 1}</Td></tr>)}</tbody></Table></div>
              <label className="block space-y-1 text-sm font-semibold text-slate-700">Pharmacist notes<Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Verification or dispensing notes" /></label>
              <div className="flex flex-wrap gap-2">
                {!["verified", "dispensed", "rejected"].includes(selected.pharmacy_status) && <Button onClick={() => void perform(() => verifyPharmacyPrescription(selected.id, "verified", notes), "Prescription verified by Pharmacy.")}><ShieldCheck className="h-4 w-4" />Verify</Button>}
                {!["dispensed", "rejected"].includes(selected.pharmacy_status) && <Button variant="destructive" onClick={() => void perform(() => verifyPharmacyPrescription(selected.id, "rejected", notes || "Rejected by pharmacist"), "Prescription rejected.")}><XCircle className="h-4 w-4" />Reject</Button>}
                {selected.pharmacy_status === "verified" && <Button onClick={() => void perform(() => dispensePharmacyPrescription(selected.id, normalizeJsonArray<PrescriptionRecord["lines"][number]>(selected.lines).map((line) => ({ prescriptionItemUuid: line.id, medicineUuid: line.medicineId ?? null, quantity: line.quantity ?? 1 })), notes), "Medicines dispensed and stock updated.")}><PackageCheck className="h-4 w-4" />Dispense all</Button>}
              </div>
              <div className="rounded-lg border border-border bg-muted p-3 text-sm"><div className="flex flex-wrap gap-2"><Badge tone={selected.pharmacist_name ? "success" : "warning"}><CheckCircle2 className="h-3.5 w-3.5" />Verified by: {selected.pharmacist_name || "Pending"}</Badge><Badge tone={selected.dispensed_at ? "success" : "info"}>Dispensed: {selected.dispensed_at ? new Date(selected.dispensed_at).toLocaleString() : "Pending"}</Badge></div></div>
            </>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
