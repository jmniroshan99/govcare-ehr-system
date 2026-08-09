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
import { FormFieldLabel } from "../components/ui/form-field-label";
import { MultiSelectChips } from "../components/forms";
import { Select } from "../components/ui/select";
import { SriLankaDistrictSelect, SriLankaProvinceSelect } from "../components/location/SriLankaLocationSelects";
import { useToast } from "../components/ui/toast-context";
import { submitPatientSelfRegistration, verifyRegistrationToken, type RegistrationTokenInfo } from "../services/selfRegistrationService";
import { isDistrictInProvince, isSriLankaDistrict, isSriLankaProvince, provinceForDistrict } from "../data/sriLankaLocations";
import { BLOOD_GROUP_OPTIONS, COMMON_ALLERGY_OPTIONS, COMMON_CHRONIC_DISEASE_OPTIONS } from "../data/referenceOptions";

const optionalText = (max: number) => z.string().max(max).optional();

const formSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  nic: optionalText(32),
  passportNo: optionalText(32),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional().or(z.literal("")),
  phone: optionalText(20),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: optionalText(240),
  district: optionalText(80),
  province: optionalText(80),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(20),
  bloodGroup: optionalText(20),
  allergies: optionalText(1000),
  chronicDiseases: optionalText(1000),
  languagePreference: z.enum(["en", "si", "ta"]),
}).superRefine((value, ctx) => {
  const dob = new Date(`${value.dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a valid date of birth that is not in the future." });
  }
  const phonePattern = /^(?:\+94|0)?[0-9]{9}$/;
  const normalizePhone = (phone?: string) => (phone ?? "").replace(/[-()\s]/g, "");
  if (value.phone && !phonePattern.test(normalizePhone(value.phone))) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid phone number or leave it blank." });
  }
  if (value.emergencyContactPhone && !phonePattern.test(normalizePhone(value.emergencyContactPhone))) {
    ctx.addIssue({ code: "custom", path: ["emergencyContactPhone"], message: "Enter a valid emergency phone number or leave it blank." });
  }
  if (value.province && !isSriLankaProvince(value.province)) {
    ctx.addIssue({ code: "custom", path: ["province"], message: "Select a valid Sri Lankan province." });
  }
  if (value.district && !isSriLankaDistrict(value.district)) {
    ctx.addIssue({ code: "custom", path: ["district"], message: "Select a valid Sri Lankan district." });
  }
  if (value.province && value.district && !isDistrictInProvince(value.district, value.province)) {
    ctx.addIssue({ code: "custom", path: ["district"], message: "The selected district does not belong to the selected province." });
  }
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
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<PatientSelfRegistrationForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { gender: "", languagePreference: "en" },
  });

  const selectedProvince = watch("province") ?? "";
  const selectedDistrict = watch("district") ?? "";
  const selectedBloodGroup = watch("bloodGroup") ?? "";
  const selectedAllergies = watch("allergies") ?? "";
  const selectedChronicDiseases = watch("chronicDiseases") ?? "";

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
          <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-50">
            Only fields marked with <strong>*</strong> are required. Other details may be completed later by hospital staff.
          </div>
          <Card>
            <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" required error={errors.fullName?.message}><Input {...register("fullName")} /></Field>
              <Field label="NIC number"><Input {...register("nic")} placeholder="Adults can enter NIC" /></Field>
              <Field label="Passport number"><Input {...register("passportNo")} /></Field>
              <Field label="Date of birth" required error={errors.dateOfBirth?.message}><Input type="date" max={new Date().toISOString().slice(0, 10)} {...register("dateOfBirth")} /></Field>
              <label className="block text-sm font-medium"><FormFieldLabel optional>Gender</FormFieldLabel><Select {...register("gender")}><option value="">Not stated</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></Select></label>
              <label className="block text-sm font-medium"><FormFieldLabel optional>Language</FormFieldLabel><Select {...register("languagePreference")}><option value="en">English</option><option value="si">Sinhala</option><option value="ta">Tamil</option></Select></label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contact and medical details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Phone number" error={errors.phone?.message}><Input type="tel" inputMode="tel" placeholder="07XXXXXXXX or +947XXXXXXXX" {...register("phone")} /></Field>
              <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
              <Field label="Address" error={errors.address?.message}><Input {...register("address")} /></Field>
              <label className="block text-sm font-medium">
                <FormFieldLabel>Province</FormFieldLabel>
                {(() => { const field = register("province"); return <SriLankaProvinceSelect {...field} value={selectedProvince} onChange={(event) => { field.onChange(event); const nextProvince = event.target.value; if (selectedDistrict && !isDistrictInProvince(selectedDistrict, nextProvince)) setValue("district", "", { shouldDirty: true, shouldValidate: true }); }} />; })()}
              </label>
              <label className="block text-sm font-medium">
                <FormFieldLabel>District</FormFieldLabel>
                {(() => { const field = register("district"); return <SriLankaDistrictSelect {...field} province={selectedProvince} value={selectedDistrict} onChange={(event) => { field.onChange(event); const inferredProvince = provinceForDistrict(event.target.value); if (inferredProvince && inferredProvince !== selectedProvince) setValue("province", inferredProvince, { shouldDirty: true, shouldValidate: true }); }} />; })()}
              </label>
              <label className="block text-sm font-medium"><FormFieldLabel>Blood group</FormFieldLabel><Select value={selectedBloodGroup} onChange={(event) => setValue("bloodGroup", event.target.value, { shouldDirty: true })}><option value="">Not recorded</option>{BLOOD_GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
              <label className="block text-sm font-medium"><FormFieldLabel>Allergies</FormFieldLabel><MultiSelectChips values={selectedAllergies.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean)} options={COMMON_ALLERGY_OPTIONS} allowCustom onChange={(values) => setValue("allergies", values.join(", "), { shouldDirty: true })} noValueLabel="No allergy information recorded" /></label>
              <label className="block text-sm font-medium"><FormFieldLabel>Chronic diseases</FormFieldLabel><MultiSelectChips values={selectedChronicDiseases.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean)} options={COMMON_CHRONIC_DISEASE_OPTIONS} allowCustom onChange={(values) => setValue("chronicDiseases", values.join(", "), { shouldDirty: true })} noValueLabel="No chronic diseases recorded" /></label>
              <Field label="Emergency contact name" error={errors.emergencyContactName?.message}><Input {...register("emergencyContactName")} /></Field>
              <Field label="Emergency contact phone" error={errors.emergencyContactPhone?.message}><Input type="tel" inputMode="tel" {...register("emergencyContactPhone")} /></Field>
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

function Field({ label, required = false, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      <FormFieldLabel required={required} optional={!required}>{label}</FormFieldLabel>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
