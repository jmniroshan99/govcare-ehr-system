import { QRCodeSVG } from "qrcode.react";
import { Copy, Loader2, Printer, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useToast } from "../ui/toast-context";
import { approveSelfRegisteredPatient, createRegistrationQrToken, getRegistrationQrTokens, getSelfRegisteredPatients, SELF_REGISTRATION_UPDATED_EVENT, type RegistrationTokenInfo, type SelfRegisteredPatient } from "../../services/selfRegistrationService";

export function SelfRegistrationQrCenter() {
  const { showToast } = useToast();
  const [label, setLabel] = useState("Main counter patient registration");
  const [currentToken, setCurrentToken] = useState<RegistrationTokenInfo | null>(null);
  const [recentTokens, setRecentTokens] = useState<RegistrationTokenInfo[]>([]);
  const [patients, setPatients] = useState<SelfRegisteredPatient[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadRecent() {
    const tokens = await getRegistrationQrTokens();
    const registrations = await getSelfRegisteredPatients();
    setRecentTokens(tokens);
    setPatients(registrations);
    setCurrentToken((current) => current ?? tokens[0] ?? null);
  }

  useEffect(() => {
    void loadRecent();
    window.addEventListener(SELF_REGISTRATION_UPDATED_EVENT, loadRecent);
    return () => window.removeEventListener(SELF_REGISTRATION_UPDATED_EVENT, loadRecent);
  }, []);

  async function generateQr() {
    setLoading(true);
    try {
      const token = await createRegistrationQrToken(label);
      setCurrentToken(token);
      await loadRecent();
      showToast("Patient registration QR generated.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "QR generation failed.", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!currentToken?.registrationUrl) return;
    await navigator.clipboard.writeText(currentToken.registrationUrl);
    showToast("Registration URL copied.", "success");
  }

  function printQr() {
    if (!currentToken?.registrationUrl) return;
    const win = window.open("", "_blank", "width=520,height=720");
    if (!win) {
      showToast("Popup blocked. Allow popups to print the QR.", "warning");
      return;
    }
    win.document.write(`
      <html>
        <head><title>GovCare Patient Registration QR</title></head>
        <body style="font-family:Arial,sans-serif;text-align:center;padding:32px">
          <h1>GovCare EHR</h1>
          <h2>Patient Self-Registration</h2>
          <p>${currentToken.hospitalName}</p>
          <p>Scan this QR using your mobile camera.</p>
          <div id="qr"></div>
          <p style="word-break:break-all;font-size:12px">${currentToken.registrationUrl}</p>
          <button onclick="window.print()" style="padding:12px 18px">Print QR</button>
        </body>
      </html>
    `);
    win.document.close();
    showToast("QR print page opened.", "success");
  }

  async function approvePatient(patient: SelfRegisteredPatient) {
    const patientId = patient.id ?? "";
    if (!patientId) return;
    await approveSelfRegisteredPatient(patientId);
    await loadRecent();
    showToast(`${patient.patient_no ?? patient.patientNo} approved.`, "success");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" />QR patient self-registration</span>
            <Badge tone="success"><ShieldCheck className="h-4 w-4" />PostgreSQL token workflow</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            QR label
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Main counter, OPD entrance, clinic desk..." />
          </label>
          <Button className="w-full" onClick={generateQr} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Generate new registration QR
          </Button>
          <p className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-50">
            Patients scan this code with a phone camera and open the mobile registration form. During development use <strong>http://127.0.0.1:5173</strong> or <strong>localhost</strong> for camera permission support.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="grid place-items-center rounded-md border border-border bg-white p-4 dark:bg-slate-950">
            {currentToken?.registrationUrl ? <QRCodeSVG value={currentToken.registrationUrl} size={210} /> : <div className="grid h-52 w-52 place-items-center rounded-md bg-muted text-center text-sm text-muted-foreground">Generate a QR code</div>}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Registration URL</p>
              <p className="break-all rounded-md border border-border bg-muted p-3 text-sm font-semibold">{currentToken?.registrationUrl ?? "No QR generated yet"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyUrl} disabled={!currentToken?.registrationUrl}><Copy className="h-4 w-4" />Copy URL</Button>
              <Button variant="outline" onClick={printQr} disabled={!currentToken?.registrationUrl}><Printer className="h-4 w-4" />Print QR</Button>
              {currentToken?.registrationUrl ? <a className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted" href={currentToken.registrationUrl} target="_blank" rel="noreferrer">Open form</a> : null}
            </div>
            <div className="grid gap-2">
              {recentTokens.slice(0, 5).map((token, index) => (
                <button key={`${token.registrationUrl}-${index}`} type="button" onClick={() => setCurrentToken(token)} className="rounded-md border border-border bg-card p-3 text-left text-sm hover:bg-muted">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground">{token.label ?? "Registration QR"}</span>
                    <Badge tone={token.status === "active" ? "success" : "warning"}>{token.status ?? "active"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Expires {new Date(token.expiresAt).toLocaleDateString()} | Uses {token.usesCount ?? 0}/{token.maxUses ?? 100}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>New self-registered patients</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {patients.length ? patients.slice(0, 10).map((patient) => {
            const patientNo = patient.patient_no ?? patient.patientNo ?? "Pending ID";
            const name = patient.full_name ?? patient.fullName ?? "Unnamed patient";
            return (
              <div key={patient.id ?? patientNo} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
                <div>
                  <p className="font-bold text-foreground">{patientNo} - {name}</p>
                  <p className="text-xs text-muted-foreground">{patient.nic ?? patient.passport_no ?? "No NIC/passport"} | {patient.phone ?? "No phone"} | {patient.created_at ? new Date(patient.created_at).toLocaleString() : "Just now"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={patient.status === "active" ? "success" : "warning"}>{patient.status ?? "pending"}</Badge>
                  <Button className="min-h-9 px-3 py-1.5" variant="outline" disabled={patient.status === "active"} onClick={() => approvePatient(patient)}>Approve</Button>
                  <a className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm font-semibold hover:bg-muted" href={`/patients/${patientNo}`}>Review</a>
                </div>
              </div>
            );
          }) : <p className="text-sm text-muted-foreground">No self-registered patients yet. Generated QR submissions will appear here for review and approval.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
