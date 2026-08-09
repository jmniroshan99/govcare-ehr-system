import { CheckCircle2, PackageCheck, RefreshCcw, ShieldCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PdfActionButtons } from "../components/reports/PdfActionButtons";
import { Badge, StatusBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import {
  dispensePharmacyPrescription,
  getPharmacyPrescriptions,
  verifyPharmacyPrescription,
  type PrescriptionRecord,
} from "../services/workflowService";
import { formatStringList, normalizeJsonArray } from "../utils/dataNormalization";

const REVIEWABLE_STATUSES = new Set(["pending", "pending_verification"]);

function normalizedStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function canReviewPrescription(item: PrescriptionRecord | null | undefined) {
  return Boolean(item && REVIEWABLE_STATUSES.has(normalizedStatus(item.pharmacy_status)));
}

function reviewStateMessage(status: string) {
  switch (normalizedStatus(status)) {
    case "verified":
      return "This prescription has been verified. It can now be dispensed.";
    case "rejected":
      return "This prescription has been rejected and is locked from dispensing.";
    case "dispensed":
      return "This prescription has already been fully dispensed.";
    case "partially_dispensed":
      return "This prescription has already been partially dispensed.";
    default:
      return "Verify or reject this prescription after reviewing the patient and medicine details.";
  }
}

export function PharmacyModule() {
  const { showToast } = useToast();
  const [items, setItems] = useState<PrescriptionRecord[]>([]);
  const [selected, setSelected] = useState<PrescriptionRecord | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);

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
    return term
      ? items.filter((item) => `${item.prescription_no} ${item.patient_name} ${item.patient_no} ${item.doctor_name}`.toLowerCase().includes(term))
      : items;
  }, [items, search]);

  function openPrescription(item: PrescriptionRecord) {
    setSelected(item);
    setNotes(item.pharmacy_verification_notes ?? "");
  }

  async function perform(actionName: string, item: PrescriptionRecord, action: () => Promise<unknown>, message: string) {
    const key = `${item.id}:${actionName}`;
    setActionKey(key);
    try {
      await action();
      showToast(message, "success");
      setNotes("");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Pharmacy action failed.", "danger");
    } finally {
      setActionKey(null);
    }
  }

  function verify(item: PrescriptionRecord) {
    if (!canReviewPrescription(item)) {
      showToast(`Only pending prescriptions can be verified. Current status: ${item.pharmacy_status}.`, "warning");
      return;
    }
    const verificationNotes = selected?.id === item.id ? notes.trim() : "";
    void perform(
      "verify",
      item,
      () => verifyPharmacyPrescription(item.id, "verified", verificationNotes || undefined),
      "Prescription verified by Pharmacy.",
    );
  }

  function reject(item: PrescriptionRecord) {
    if (!canReviewPrescription(item)) {
      showToast(`Only pending prescriptions can be rejected. Current status: ${item.pharmacy_status}.`, "warning");
      return;
    }

    const enteredNotes = selected?.id === item.id ? notes.trim() : "";
    const rejectionReason = enteredNotes || window.prompt("Enter the pharmacy rejection reason:", "")?.trim();
    if (!rejectionReason) {
      showToast("A rejection reason is required.", "warning");
      openPrescription(item);
      return;
    }

    void perform(
      "reject",
      item,
      () => verifyPharmacyPrescription(item.id, "rejected", rejectionReason),
      "Prescription rejected by Pharmacy.",
    );
  }

  const selectedReviewable = canReviewPrescription(selected);
  const selectedStatus = normalizedStatus(selected?.pharmacy_status);
  const reviewActorLabel = selectedStatus === "rejected" ? "Rejected by" : "Verified by";
  const reviewerRecorded = Boolean(selected?.pharmacist_name);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Pharmacy Verification</h1>
          <p className="text-sm text-muted-foreground">Doctor prescriptions, pharmacist verification, stock issue, and dispensing.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className="h-4 w-4" />Refresh
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Prescription queue</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search prescription, patient, doctor..." />
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {["pending", "pending_verification", "verified", "rejected", "dispensed", "partially_dispensed"].map((item) => (
                  <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
                ))}
              </Select>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <thead><tr><Th>Prescription</Th><Th>Patient</Th><Th>Doctor</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
                <tbody>
                  {displayed.map((item) => {
                    const reviewable = canReviewPrescription(item);
                    const verifying = actionKey === `${item.id}:verify`;
                    const rejecting = actionKey === `${item.id}:reject`;
                    return (
                      <tr key={item.id}>
                        <Td className="font-semibold">{item.prescription_no}<br /><span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span></Td>
                        <Td><strong>{item.patient_name}</strong><br /><span className="text-xs text-muted-foreground">{item.patient_no} · {item.age_years ?? "N/A"} years</span></Td>
                        <Td>{item.doctor_name}</Td>
                        <Td><StatusBadge status={item.pharmacy_status} /></Td>
                        <Td>
                          <div className="flex min-w-max items-center gap-1.5">
                            <Button variant="outline" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => openPrescription(item)}>Preview</Button>
                            {reviewable && (
                              <>
                                <Button className="min-h-8 px-2.5 py-1 text-xs" disabled={Boolean(actionKey)} onClick={() => verify(item)}>
                                  <ShieldCheck className="h-3.5 w-3.5" />{verifying ? "Verifying..." : "Verify"}
                                </Button>
                                <Button variant="destructive" className="min-h-8 px-2.5 py-1 text-xs" disabled={Boolean(actionKey)} onClick={() => reject(item)}>
                                  <XCircle className="h-3.5 w-3.5" />{rejecting ? "Rejecting..." : "Reject"}
                                </Button>
                              </>
                            )}
                            <PdfActionButtons kind="pharmacy" recordId={item.id} />
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                  {!loading && displayed.length === 0 && <tr><Td colSpan={5} className="text-center">No prescriptions found.</Td></tr>}
                  {loading && <tr><Td colSpan={5} className="text-center">Loading pharmacy queue...</Td></tr>}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Prescription Preview</CardTitle>
            <PdfActionButtons kind="pharmacy" recordId={selected?.id} />
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? <p className="text-sm text-muted-foreground">Select a prescription to verify.</p> : <>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div><strong>Prescription</strong><br />{selected.prescription_no}</div>
                <div><strong>Status</strong><br /><StatusBadge status={selected.pharmacy_status} /></div>
                <div><strong>Patient</strong><br />{selected.patient_name}</div>
                <div><strong>Patient ID</strong><br />{selected.patient_no}</div>
                <div><strong>Age / Gender</strong><br />{selected.age_years ?? "N/A"} / {selected.gender || "N/A"}</div>
                <div><strong>Blood group</strong><br />{selected.blood_group || "N/A"}</div>
                <div><strong>Allergies</strong><br />{formatStringList(selected.allergies)}</div>
                <div><strong>Doctor</strong><br />{selected.doctor_name}</div>
                <div><strong>Diagnosis</strong><br />{selected.diagnosis || "Not recorded"}</div>
                <div><strong>Digital signature</strong><br />{selected.digital_signature || "Not signed"}</div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <thead><tr><Th>Medicine</Th><Th>Dose</Th><Th>Frequency</Th><Th>Duration</Th><Th>Quantity</Th></tr></thead>
                  <tbody>
                    {normalizeJsonArray<PrescriptionRecord["lines"][number]>(selected.lines).map((line) => (
                      <tr key={line.id}>
                        <Td><strong>{line.medicineName}</strong><br /><span className="text-xs text-muted-foreground">{line.strength || ""} · {line.route || ""}</span></Td>
                        <Td>{line.dosage}</Td><Td>{line.frequency}</Td><Td>{line.duration}</Td><Td>{line.quantity ?? 1}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <label className="block space-y-1 text-sm font-semibold text-slate-700">
                Pharmacist notes
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={selectedReviewable ? "Add verification notes or a required rejection reason" : "Review notes"}
                  disabled={!selectedReviewable}
                />
              </label>

              <div className="rounded-lg border border-border bg-slate-50 p-3">
                <p className="mb-3 text-sm text-muted-foreground">{reviewStateMessage(selected.pharmacy_status)}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!selectedReviewable || Boolean(actionKey)}
                    onClick={() => verify(selected)}
                    title={selectedReviewable ? "Verify prescription" : "Only pending prescriptions can be verified"}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {actionKey === `${selected.id}:verify` ? "Verifying..." : "Verify"}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!selectedReviewable || Boolean(actionKey)}
                    onClick={() => reject(selected)}
                    title={selectedReviewable ? "Reject prescription" : "Only pending prescriptions can be rejected"}
                  >
                    <XCircle className="h-4 w-4" />
                    {actionKey === `${selected.id}:reject` ? "Rejecting..." : "Reject"}
                  </Button>
                  {selectedStatus === "verified" && (
                    <Button
                      disabled={Boolean(actionKey)}
                      onClick={() => void perform(
                        "dispense",
                        selected,
                        () => dispensePharmacyPrescription(
                          selected.id,
                          normalizeJsonArray<PrescriptionRecord["lines"][number]>(selected.lines).map((line) => ({
                            prescriptionItemUuid: line.id,
                            medicineUuid: line.medicineId ?? null,
                            quantity: line.quantity ?? 1,
                          })),
                          notes,
                        ),
                        "Medicines dispensed and stock updated.",
                      )}
                    >
                      <PackageCheck className="h-4 w-4" />
                      {actionKey === `${selected.id}:dispense` ? "Dispensing..." : "Dispense all"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={reviewerRecorded ? (selectedStatus === "rejected" ? "danger" : "success") : "warning"}>
                    {selectedStatus === "rejected" ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {reviewActorLabel}: {selected.pharmacist_name || "Pending"}
                  </Badge>
                  <Badge tone={selected.dispensed_at ? "success" : "info"}>Dispensed: {selected.dispensed_at ? new Date(selected.dispensed_at).toLocaleString() : "Pending"}</Badge>
                </div>
                {selected.pharmacy_verification_notes && <p className="mt-2 text-xs text-muted-foreground">Review notes: {selected.pharmacy_verification_notes}</p>}
              </div>
            </>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
