import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Share2, Trash2, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { getDocumentShares, getShareableDepartments, revokeDepartmentShare } from "../../services/documentService";
import type { DepartmentDocumentAccess, PatientDocument } from "../../types/document";

export function DocumentShareModal({
  document,
  onClose,
  onShare,
}: {
  document: PatientDocument;
  onClose: () => void;
  onShare: (departmentId: string, accessType: string, expiresAt?: string) => Promise<void>;
}) {
  const [departments, setDepartments] = useState<Array<{ id: string; code: string; name: string; type?: string }>>([]);
  const [shares, setShares] = useState<DepartmentDocumentAccess[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [accessType, setAccessType] = useState("VIEW");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingShares, setLoadingShares] = useState(true);
  const [error, setError] = useState("");

  const loadShares = useCallback(async () => {
    setLoadingShares(true);
    try {
      setShares(await getDocumentShares(document.patientId, document.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load current department access.");
    } finally {
      setLoadingShares(false);
    }
  }, [document.id, document.patientId]);

  useEffect(() => {
    void getShareableDepartments()
      .then(setDepartments)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load departments."));
    void loadShares();
  }, [loadShares]);

  async function submit() {
    if (!departmentId) return;
    setSaving(true);
    setError("");
    try {
      const expiry = expiresAt ? new Date(expiresAt).toISOString() : undefined;
      await onShare(departmentId, accessType, expiry);
      setDepartmentId("");
      setExpiresAt("");
      await loadShares();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to share document.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(department: DepartmentDocumentAccess) {
    if (!window.confirm(`Revoke access for ${department.departmentName}?`)) return;
    setSaving(true);
    setError("");
    try {
      await revokeDepartmentShare(document.patientId, document.id, department.departmentId);
      await loadShares();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to revoke department access.");
    } finally {
      setSaving(false);
    }
  }

  const activeShares = shares.filter((share) => !share.revokedAt);

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Share2 className="h-5 w-5" />Share with department</h2>
          <Button variant="ghost" className="text-white" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <p className="mt-2 text-sm text-slate-400">{document.title} · {document.patientNo}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold sm:col-span-2">Receiving department
            <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">Select department</option>
              {departments
                .filter((department) => department.id !== document.sourceDepartmentId)
                .map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-semibold">Access level
            <Select value={accessType} onChange={(event) => setAccessType(event.target.value)}>
              <option value="VIEW">View</option>
              <option value="DOWNLOAD">View and download</option>
              <option value="PRINT">View and print</option>
            </Select>
          </label>
          <label className="space-y-1 text-sm font-semibold">Expiry date and time — optional
            <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-400">Only verified documents can be shared. The backend checks hospital, department, role and document status before granting access.</p>
        {error && <p className="mt-3 rounded-md bg-rose-950 p-3 text-sm text-rose-200">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={submit} disabled={!departmentId || saving}>{saving ? "Saving..." : "Share document"}</Button>
        </div>

        <section className="mt-6 border-t border-slate-800 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-bold">Active department access</h3><p className="text-xs text-slate-400">Revoke access when the receiving department no longer requires this report.</p></div>
            <Button variant="outline" onClick={() => void loadShares()} disabled={loadingShares}><RefreshCw className={`h-4 w-4 ${loadingShares ? "animate-spin" : ""}`} /></Button>
          </div>
          <div className="mt-3 space-y-2">
            {activeShares.map((share) => (
              <div key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                <div>
                  <p className="font-semibold">{share.departmentName}</p>
                  <p className="text-xs text-slate-400">{share.accessType} · granted {new Date(share.grantedAt).toLocaleString()}{share.expiresAt ? ` · expires ${new Date(share.expiresAt).toLocaleString()}` : ""}</p>
                </div>
                <Button variant="destructive" onClick={() => void revoke(share)} disabled={saving}><Trash2 className="h-4 w-4" />Revoke</Button>
              </div>
            ))}
            {!loadingShares && !activeShares.length && <p className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-400">This document is not currently shared with another department.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
