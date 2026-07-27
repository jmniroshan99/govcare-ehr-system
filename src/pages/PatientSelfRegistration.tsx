import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Camera, CheckCircle2, Hospital, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { submitPatientSelfRegistration, verifyRegistrationToken, type RegistrationTokenInfo } from "../services/selfRegistrationService";

const formSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  nic: z.string().optional(),
  passportNo: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  phone: z.string().min(7, "Contact number is required"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().min(3, "Address is required"),
  district: z.string().optional(),
  province: z.string().optional(),
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(7, "Emergency contact phone is required"),
  bloodGroup: z.string().optional(),
  allergies: z.string().optional(),
  chronicDiseases: z.string().optional(),
  languagePreference: z.enum(["en", "si", "ta"]),
});

type PatientSelfRegistrationForm = z.infer<typeof formSchema>;

function tokenFromScannedValue(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] === "self-register" ? parts[1] : value;
  } catch {
    return value.includes("/self-register/") ? value.split("/self-register/")[1]?.split(/[?#]/)[0] ?? value : value;
  }
}

export function PatientSelfRegistration() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [scannerOpen, setScannerOpen] = useState(!token);
  const [tokenInfo, setTokenInfo] = useState<Omit<RegistrationTokenInfo, "registrationUrl"> | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [loadingToken, setLoadingToken] = useState(Boolean(token));
  const [successMessage, setSuccessMessage] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PatientSelfRegistrationForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { gender: "female", languagePreference: "en" },
  });

  useEffect(() => {
    if (!token) return;
    setLoadingToken(true);
    setTokenError("");
    void verifyRegistrationToken(token)
      .then(setTokenInfo)
      .catch((error) => setTokenError(error instanceof Error ? error.message : "Invalid or expired registration QR code."))
      .finally(() => setLoadingToken(false));
  }, [token]);

  async function onSubmit(values: PatientSelfRegistrationForm) {
    if (!token) {
      setTokenError("Scan a valid hospital registration QR code first.");
      return;
    }
    const result = await submitPatientSelfRegistration(token, values);
    const patientNo = result.patient.patient_no ?? result.patient.patientNo ?? "pending patient number";
    if (result.duplicate) {
      showToast(`Existing patient found: ${patientNo}. Duplicate registration was blocked.`, "warning");
      setSuccessMessage(`Existing patient record found: ${patientNo}. Hospital staff will review it.`);
      return;
    }
    showToast(`Registration submitted. Patient ID: ${patientNo}`, "success");
    setSuccessMessage(`Registration successful. Your patient number is ${patientNo}. Hospital staff will review and approve your record.`);
  }

  function handleScanned(value: string) {
    const scannedToken = tokenFromScannedValue(value);
    if (!scannedToken || scannedToken === value && !value.includes("self-register") && value.length < 12) {
      showToast("Invalid QR code. Please scan a GovCare registration QR.", "danger");
      return;
    }
    navigate(`/self-register/${encodeURIComponent(scannedToken)}`, { replace: true });
    setScannerOpen(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 px-4 py-6 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950 dark:text-slate-50">
      <PatientCodeScanner open={scannerOpen} mode="qr" onClose={() => setScannerOpen(false)} onDetected={handleScanned} />
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-teal-100 bg-white p-4 shadow-sm dark:border-teal-900 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <img className="h-12 w-12 rounded-md bg-white object-contain p-1 ring-1 ring-border" src="/ministry-health-logo.png" alt="Ministry of Health logo" />
            <div>
              <p className="text-sm font-semibold text-primary">GovCare EHR</p>
              <h1 className="text-xl font-bold">Patient self-registration</h1>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}><Camera className="h-4 w-4" />Scan QR</Button>
        </header>

        <Card>
          <CardContent className="space-y-3">
            {loadingToken ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Verifying registration QR...</div>
            ) : tokenError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-50">
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{tokenError}</div>
                <p className="mt-2 font-medium">Use the Scan QR button again, or ask the hospital counter to generate a new registration QR code.</p>
              </div>
            ) : tokenInfo ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-bold"><Hospital className="h-5 w-5 text-primary" />{tokenInfo.hospitalName}</p>
                  <p className="text-sm text-muted-foreground">{tokenInfo.hospitalCity ?? "Sri Lanka"} | QR expires {new Date(tokenInfo.expiresAt).toLocaleDateString()}</p>
                </div>
                <Badge tone="success"><ShieldCheck className="h-4 w-4" />Verified hospital QR</Badge>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-muted-foreground">Scan the hospital QR code to open the secure registration form.</p>
                <Button type="button" onClick={() => setScannerOpen(true)}><QrCode className="h-4 w-4" />Scan now</Button>
              </div>
            )}
            <p className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-50">
              Camera works on localhost/127.0.0.1 in modern browsers. If blocked, click the lock icon in the browser address bar, allow Camera, then reload the page.
            </p>
          </CardContent>
        </Card>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" error={errors.fullName?.message}><Input {...register("fullName")} /></Field>
              <Field label="NIC number"><Input {...register("nic")} placeholder="Adults can enter NIC" /></Field>
              <Field label="Passport number"><Input {...register("passportNo")} /></Field>
              <Field label="Date of birth" error={errors.dateOfBirth?.message}><Input type="date" {...register("dateOfBirth")} /></Field>
              <label className="block text-sm font-medium">Gender<Select {...register("gender")}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></Select></label>
              <label className="block text-sm font-medium">Language<Select {...register("languagePreference")}><option value="en">English</option><option value="si">Sinhala</option><option value="ta">Tamil</option></Select></label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contact and medical details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Phone number" error={errors.phone?.message}><Input {...register("phone")} /></Field>
              <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
              <Field label="Address" error={errors.address?.message}><Input {...register("address")} /></Field>
              <Field label="District"><Input {...register("district")} /></Field>
              <Field label="Province"><Input {...register("province")} /></Field>
              <Field label="Blood group"><Input {...register("bloodGroup")} placeholder="A+, B-, O+" /></Field>
              <Field label="Allergies"><Input {...register("allergies")} placeholder="Separate with commas" /></Field>
              <Field label="Chronic diseases"><Input {...register("chronicDiseases")} placeholder="Separate with commas" /></Field>
              <Field label="Emergency contact name" error={errors.emergencyContactName?.message}><Input {...register("emergencyContactName")} /></Field>
              <Field label="Emergency contact phone" error={errors.emergencyContactPhone?.message}><Input {...register("emergencyContactPhone")} /></Field>
            </CardContent>
          </Card>

          {successMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-50">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />{successMessage}</div>
            </div>
          ) : null}

          <div className="sticky bottom-3 rounded-md border border-border bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-slate-950/90">
            <Button className="w-full" disabled={isSubmitting || Boolean(tokenError) || loadingToken || !token} type="submit">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Submit secure registration
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
