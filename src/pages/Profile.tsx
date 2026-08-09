import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LogOut, Save, ShieldCheck, UserCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { AsyncSearchableSelect, PhoneNumberField, SearchableSelect } from "../components/forms";
import { SriLankaDistrictSelect, SriLankaProvinceSelect } from "../components/location/SriLankaLocationSelects";
import { useToast } from "../components/ui/toast-context";
import { roleLabels } from "../lib/rbac";
import { changeCurrentUserPassword, logout, recordPasswordChanged, requestEmailOtp, verifyEmailOtp } from "../services/authService";
import { updateProfile } from "../services/profileService";
import { searchHospitals } from "../services/referenceDataService";
import { LANGUAGE_OPTIONS } from "../data/referenceOptions";
import { saveProfileOverride, useAuthStore } from "../stores/authStore";
import { friendlyAuthError } from "../utils/authErrors";
import { refreshAndRedirectToMainMenu } from "../utils/navigation";
import { addNotification } from "../utils/notifications";
import { isDistrictInProvince, normaliseSriLankaProvince, provinceForDistrict } from "../data/sriLankaLocations";
import { fieldPolicy } from "../utils/patientFieldPolicy";
import { createChangePasswordSchema } from "../validations/auth";
import type { ChangePasswordInput } from "../validations/auth";

export function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const profile = useAuthStore((state) => state.profile);
  const role = useAuthStore((state) => state.role);
  const setProfile = useAuthStore((state) => state.setProfile);
  const clearAuth = useAuthStore((state) => state.clear);
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [passwordOtpExpiresAt, setPasswordOtpExpiresAt] = useState(0);
  const [passwordOtpResendAt, setPasswordOtpResendAt] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const passwordSchema = useMemo(() => createChangePasswordSchema(t), [t]);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ChangePasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!passwordOtpSent) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [passwordOtpSent]);
  const [values, setValues] = useState({
    displayName: profile?.displayName ?? "",
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    district: profile?.district ?? "",
    province: normaliseSriLankaProvince(profile?.province) || provinceForDistrict(profile?.district),
    hospitalCity: profile?.hospitalCity ?? "",
    preferredHospital: profile?.preferredHospital ?? "",
    preferredLanguage: profile?.preferredLanguage ?? "English",
    emergencyContactName: profile?.emergencyContactName ?? "",
    emergencyContactPhone: profile?.emergencyContactPhone ?? "",
  });

  async function saveProfile() {
    if (!profile) return;
    const updatedProfile = { ...profile, ...values, updatedAt: new Date().toISOString(), updatedBy: profile.uid };
    saveProfileOverride(profile.uid, updatedProfile);
    setProfile(updatedProfile);
    setMessage("Profile updated.");
    void updateProfile(profile.uid, values).catch((error) => console.warn("Profile background save failed.", error));
    refreshAndRedirectToMainMenu(800, null, profile.role === "patient" ? "/portal" : "/");
  }

  function canShow(field: Parameters<typeof fieldPolicy>[0]) {
    return fieldPolicy(field, role).visible;
  }

  function readOnly(field: Parameters<typeof fieldPolicy>[0]) {
    return fieldPolicy(field, role).readOnly;
  }

  async function changePassword(values: ChangePasswordInput) {
    if (!profile) return;
    setPasswordMessage("");
    if (!/^\d{6}$/.test(passwordOtp)) {
      setPasswordMessage(t("otp.enterCode"));
      return;
    }
    try {
      await verifyEmailOtp({ purpose: "sensitive_action", otp: passwordOtp });
      await changeCurrentUserPassword(values.currentPassword, values.password);
      await recordPasswordChanged();
      addNotification({
        title: t("changePassword.notificationTitle"),
        message: t("changePassword.notificationMessage"),
        module: "Security",
        priority: "warning",
        roles: [profile.role],
        channels: ["in-app", "email"],
        group: "Security",
        actionHref: "/profile",
      });
      reset();
      setPasswordOtp("");
      setPasswordOtpSent(false);
      showToast(t("changePassword.success"), "success");
      setPasswordMessage(t("changePassword.successLogout"));
      window.setTimeout(() => {
        void logout().finally(() => {
          clearAuth();
          navigate("/login", { replace: true });
        });
      }, 1200);
    } catch (error) {
      setPasswordMessage(friendlyAuthError(error, t));
      showToast(friendlyAuthError(error, t), "danger");
    }
  }

  async function sendPasswordOtp() {
    setPasswordMessage("");
    try {
      const result = await requestEmailOtp({ purpose: "sensitive_action", metadata: { userAgent: navigator.userAgent, action: "change_password" } });
      setPasswordOtpSent(true);
      setPasswordOtpExpiresAt(nowTick + result.expiresInSeconds * 1000);
      setPasswordOtpResendAt(nowTick + result.resendAfterSeconds * 1000);
      setPasswordMessage(t("otp.sentTo", { email: result.maskedEmail }));
    } catch (error) {
      setPasswordMessage(friendlyAuthError(error, t));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Dedicated account profile for contact details, role, and secure identity status.</p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="space-y-4">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-teal-50 text-primary">
              <UserCircle className="h-14 w-14" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile?.displayName ?? "User profile"}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
            {profile?.role && <Badge tone="info">{roleLabels[profile.role]}</Badge>}
            {profile?.patientId && <Badge tone="success">Patient ID: {profile.patientId}</Badge>}
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              PostgreSQL API Auth identity protected
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contact details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {canShow("firstName") && <label className="block text-sm font-medium">
              Full name
              <Input disabled={readOnly("firstName")} value={values.displayName} onChange={(event) => setValues((current) => ({ ...current, displayName: event.target.value }))} />
            </label>}
            <label className="block text-sm font-medium">
              Email
              <Input value={profile?.email ?? ""} disabled />
            </label>
            {canShow("phone") && <label className="block text-sm font-medium">
              Phone
              <PhoneNumberField disabled={readOnly("phone")} value={values.phone} onChange={(phone) => setValues((current) => ({ ...current, phone }))} />
            </label>}
            {canShow("address") && <label className="block text-sm font-medium sm:col-span-2">
              Address
              <Input disabled={readOnly("address")} value={values.address} onChange={(event) => setValues((current) => ({ ...current, address: event.target.value }))} />
            </label>}
            {profile?.role === "patient" && (
              <>
                {canShow("district") && <label className="block text-sm font-medium">
                  Your city
                  <Input value={values.city} onChange={(event) => setValues((current) => ({ ...current, city: event.target.value }))} placeholder="Example: Colombo" />
                </label>}
                {canShow("province") && <label className="block text-sm font-medium">
                  Province
                  <SriLankaProvinceSelect value={values.province} onChange={(event) => { const province = normaliseSriLankaProvince(event.target.value); setValues((current) => ({ ...current, province, district: current.district && !isDistrictInProvince(current.district, province) ? "" : current.district })); }} />
                </label>}
                {canShow("district") && <label className="block text-sm font-medium">
                  District
                  <SriLankaDistrictSelect province={values.province} value={values.district} onChange={(event) => { const district = event.target.value; const province = provinceForDistrict(district); setValues((current) => ({ ...current, district, province: province || current.province })); }} />
                </label>}
                <label className="block text-sm font-medium">
                  Preferred hospital city
                  <Input value={values.hospitalCity} onChange={(event) => setValues((current) => ({ ...current, hospitalCity: event.target.value }))} placeholder="Example: Colombo" />
                </label>
                <label className="block text-sm font-medium">
                  Preferred hospital
                  <AsyncSearchableSelect value={values.preferredHospital} selectedOption={values.preferredHospital ? { value: values.preferredHospital, label: values.preferredHospital } : null} loadOptions={searchHospitals} minQueryLength={0} onChange={(value, option) => setValues((current) => ({ ...current, preferredHospital: option?.label ?? value }))} placeholder="Search preferred hospital" />
                </label>
                {canShow("preferredLanguage") && <label className="block text-sm font-medium">
                  Preferred language
                  <SearchableSelect value={values.preferredLanguage} options={LANGUAGE_OPTIONS} onChange={(preferredLanguage) => setValues((current) => ({ ...current, preferredLanguage }))} clearable={false} />
                </label>}
                {canShow("emergencyContactName") && <label className="block text-sm font-medium">
                  Emergency contact name
                  <Input value={values.emergencyContactName} onChange={(event) => setValues((current) => ({ ...current, emergencyContactName: event.target.value }))} />
                </label>}
                {canShow("emergencyContactPhone") && <label className="block text-sm font-medium">
                  Emergency contact phone
                  <PhoneNumberField value={values.emergencyContactPhone} onChange={(emergencyContactPhone) => setValues((current) => ({ ...current, emergencyContactPhone }))} />
                </label>}
              </>
            )}
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button onClick={saveProfile}><Save className="h-4 w-4" />Save profile</Button>
              {message && <span className="text-sm font-medium text-primary">{message}</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-start-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />{t("changePassword.title")}</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(changePassword)}>
              <p className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-950 sm:col-span-2">{t("changePassword.description")}</p>
              <label className="block text-sm font-medium sm:col-span-2">
                {t("changePassword.currentPassword")}
                <Input type="password" autoComplete="current-password" {...register("currentPassword")} />
                {errors.currentPassword && <span className="text-xs text-destructive">{errors.currentPassword.message}</span>}
              </label>
              <label className="block text-sm font-medium">
                {t("changePassword.newPassword")}
                <Input type="password" autoComplete="new-password" {...register("password")} />
                {errors.password && <span className="text-xs text-destructive">{errors.password.message}</span>}
              </label>
              <label className="block text-sm font-medium">
                {t("changePassword.confirmNewPassword")}
                <Input type="password" autoComplete="new-password" {...register("confirmPassword")} />
                {errors.confirmPassword && <span className="text-xs text-destructive">{errors.confirmPassword.message}</span>}
              </label>
              <div className="space-y-2 sm:col-span-2">
                {passwordOtpSent && <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-950">OTP expires in {Math.floor(Math.max(0, Math.ceil((passwordOtpExpiresAt - nowTick) / 1000)) / 60)}:{String(Math.max(0, Math.ceil((passwordOtpExpiresAt - nowTick) / 1000)) % 60).padStart(2, "0")}</div>}
                <label className="block text-sm font-medium">
                  {t("otp.code")}
                  <Input inputMode="numeric" maxLength={6} value={passwordOtp} onChange={(event) => setPasswordOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                </label>
                <Button type="button" variant="outline" disabled={passwordOtpSent && nowTick < passwordOtpResendAt} onClick={sendPasswordOtp}>
                  {passwordOtpSent && nowTick < passwordOtpResendAt ? t("otp.resendIn", { seconds: Math.ceil((passwordOtpResendAt - nowTick) / 1000) }) : t("otp.send")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">{t("passwordReset.passwordRules")}</p>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit" disabled={isSubmitting}><KeyRound className="h-4 w-4" />{isSubmitting ? t("loading") : t("changePassword.updateButton")}</Button>
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><LogOut className="h-4 w-4" />{t("changePassword.logoutNotice")}</span>
              </div>
              {passwordMessage && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 sm:col-span-2">{passwordMessage}</p>}
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
