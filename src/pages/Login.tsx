import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { KeyRound, Languages, ShieldCheck, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { languageOptions } from "../i18n";
import { loginDestinationForProfile, isActiveAccount } from "../lib/accessControl";
import { getGoogleRedirectUser, identifyAuthenticatedUser, loginWithEmail, logout, requestEmailOtp, resetPasswordWithEmailOtp, sendSecurePasswordReset, verifyEmailOtp } from "../services/authService";
import { ensurePatientPortalProfile } from "../services/profileService";
import { recordLoginActivity } from "../services/loginActivityService";
import { useAuthStore } from "../stores/authStore";
import { createLoginSchema, createPasswordResetRequestSchema, strongPasswordRegex } from "../validations/auth";
import type { LoginInput, PasswordResetRequestInput } from "../validations/auth";
import { friendlyAuthError } from "../utils/authErrors";
import type { AppUser } from "../types/ehr";

type AccountMode = "login" | "staff" | "reset" | "otp";

export function Login() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const setProfile = useAuthStore((state) => state.setProfile);
  const clearAuth = useAuthStore((state) => state.clear);
  const [loginError, setLoginError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [accountMode, setAccountMode] = useState<AccountMode>("login");
  const [signupMessage, setSignupMessage] = useState("");
  const [pendingProfile, setPendingProfile] = useState<AppUser | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [otpResendAt, setOtpResendAt] = useState(0);
  const [otpBusy, setOtpBusy] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "otp">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPasswordValues, setResetPasswordValues] = useState({ password: "", confirmPassword: "" });
  const [nowTick, setNowTick] = useState(() => Date.now());
  const loginSchema = useMemo(() => createLoginSchema(t), [t]);
  const passwordResetSchema = useMemo(() => createPasswordResetRequestSchema(t), [t]);
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", mfaCode: "" } });
  const {
    register: registerReset,
    handleSubmit: handlePasswordResetSubmit,
    formState: { errors: resetErrors, isSubmitting: isResetSubmitting },
    reset: resetPasswordForm,
  } = useForm<PasswordResetRequestInput>({ resolver: zodResolver(passwordResetSchema), defaultValues: { email: "" } });

  const startLoginOtp = useCallback(async (profile: AppUser, method: "email_password" | "google" = "email_password") => {
    window.sessionStorage.setItem("govcare-auth-mode", "postgresql");
    setProfile(profile);
    if (method !== "email_password") void recordLoginActivity({ email: profile.email, loginStatus: "success", authenticationMethod: method, profile });
    window.sessionStorage.removeItem("govcare-login-intent");
    navigate(loginDestinationForProfile(profile), { replace: true });
  }, [navigate, setProfile]);

  const finishGooglePatientLogin = useCallback(async (user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => {
    const profile = await ensurePatientPortalProfile({
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? "Patient User",
      photoURL: user.photoURL,
    });
    if (!isActiveAccount(profile)) throw new Error(`This account is ${profile.status}. Access has been disabled.`);
    await startLoginOtp(profile, "google");
  }, [startLoginOtp]);

  useEffect(() => {
    getGoogleRedirectUser()
      .then((user) => {
        if (user) void finishGooglePatientLogin(user);
      })
      .catch((error: unknown) => setGoogleError(postgresqlGoogleErrorMessage(error)));
  }, [finishGooglePatientLogin]);

  useEffect(() => {
    if (accountMode !== "otp" && resetStep !== "otp") return;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [accountMode, resetStep]);

  function changeAccountMode(mode: AccountMode) {
    setLoginError("");
    setGoogleError("");
    setSignupMessage("");
    setAccountMode(mode);
  }

  async function onSubmit(values: LoginInput) {
    setLoginError("");
    setGoogleError("");
    clearAuth();
    window.sessionStorage.setItem("govcare-login-intent", "staff");
    try {
      const user = await loginWithEmail(values.email, values.password);
      const profile = await identifyAuthenticatedUser(user);
      await startLoginOtp(profile, "email_password");
    } catch (error) {
      window.sessionStorage.removeItem("govcare-login-intent");
      window.sessionStorage.removeItem("govcare-auth-mode");
      clearAuth();
      setLoginError(friendlyAuthError(error, t));
    }
  }

  function selectSeedAccount(email: string) {
    setLoginError("");
    setValue("email", email);
    setValue("password", "");
    setFocus("password");
  }


  async function verifyLoginOtp() {
    if (!pendingProfile) return;
    setOtpBusy(true);
    setOtpMessage("");
    try {
      if (import.meta.env.DEV && otpCode === "000000") {
        setOtpMessage(t("otp.devVerified", "Development OTP accepted."));
      } else {
        await verifyEmailOtp({ purpose: "login_verification", otp: otpCode });
      }
      window.sessionStorage.setItem("govcare-auth-mode", "keycloak");
      setProfile(pendingProfile);
      window.sessionStorage.removeItem("govcare-login-intent");
      navigate(loginDestinationForProfile(pendingProfile), { replace: true });
    } catch (error) {
      setOtpMessage(friendlyAuthError(error, t));
    } finally {
      setOtpBusy(false);
    }
  }

  async function resendLoginOtp() {
    if (!pendingProfile) return;
    setOtpBusy(true);
    try {
      const result = await requestEmailOtp({
        purpose: "login_verification",
        metadata: { userAgent: navigator.userAgent, action: "login_resend" },
      });
      setOtpMessage(t("otp.sentTo", { email: result.maskedEmail }));
      setOtpExpiresAt(nowTick + result.expiresInSeconds * 1000);
      setOtpResendAt(nowTick + result.resendAfterSeconds * 1000);
    } catch (error) {
      setOtpMessage(friendlyAuthError(error, t));
    } finally {
      setOtpBusy(false);
    }
  }

  async function cancelOtpLogin() {
    setPendingProfile(null);
    setOtpCode("");
    setOtpMessage("");
    window.sessionStorage.removeItem("govcare-login-intent");
    await logout();
    clearAuth();
    setAccountMode("login");
  }

  async function requestPasswordReset(values: PasswordResetRequestInput) {
    setLoginError("");
    setGoogleError("");
    setSignupMessage("");
    try {
      const result = await requestEmailOtp({ purpose: "forgot_password", email: values.email, metadata: { userAgent: navigator.userAgent, action: "forgot_password" } });
      setResetEmail(values.email);
      setResetStep("otp");
      setOtpExpiresAt(nowTick + result.expiresInSeconds * 1000);
      setOtpResendAt(nowTick + result.resendAfterSeconds * 1000);
      setSignupMessage(t("otp.sentTo", { email: result.maskedEmail }));
    } catch (error) {
      const code = getPostgresCode(error);
      if (code === "functions/internal" || code === "functions/unavailable" || code === "functions/failed-precondition") {
        try {
          await sendSecurePasswordReset(values.email);
          setSignupMessage(`${t("passwordReset.emailSent")} ${t("otp.gmailFallback", "OTP email service is not ready, so PostgreSQL API sent a secure reset link instead.")}`);
          return;
        } catch (fallbackError) {
          setSignupMessage(friendlyAuthError(fallbackError, t));
          return;
        }
      }
      setSignupMessage(friendlyAuthError(error, t));
    }
  }

  async function completeOtpPasswordReset() {
    setSignupMessage("");
    if (!/^\d{6}$/.test(resetOtp)) {
      setSignupMessage(t("otp.enterCode"));
      return;
    }
    if (!strongPasswordRegex.test(resetPasswordValues.password)) {
      setSignupMessage(t("validation.strongPassword"));
      return;
    }
    if (resetPasswordValues.password !== resetPasswordValues.confirmPassword) {
      setSignupMessage(t("validation.passwordMismatch"));
      return;
    }
    try {
      await resetPasswordWithEmailOtp({ email: resetEmail, otp: resetOtp, password: resetPasswordValues.password });
      resetPasswordForm();
      setResetEmail("");
      setResetOtp("");
      setResetPasswordValues({ password: "", confirmPassword: "" });
      setResetStep("email");
      setSignupMessage(t("passwordReset.resetSuccess"));
      window.setTimeout(() => setAccountMode("login"), 900);
    } catch (error) {
      setSignupMessage(friendlyAuthError(error, t));
    }
  }

  async function resendForgotPasswordOtp() {
    setSignupMessage("");
    try {
      const result = await requestEmailOtp({ purpose: "forgot_password", email: resetEmail, metadata: { userAgent: navigator.userAgent, action: "forgot_password_resend" } });
      setOtpExpiresAt(nowTick + result.expiresInSeconds * 1000);
      setOtpResendAt(nowTick + result.resendAfterSeconds * 1000);
      setSignupMessage(t("otp.sentTo", { email: result.maskedEmail }));
    } catch (error) {
      setSignupMessage(friendlyAuthError(error, t));
    }
  }

  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-[1.1fr_0.9fr]">
      <section className="brand-panel clinical-grid relative flex flex-col justify-between overflow-hidden p-8 text-on-solid">
        <div className="absolute inset-0 brand-gradient" />
        <motion.div className="relative flex items-center gap-3" initial={{ opacity: 0, y: -14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
          <img className="h-14 w-14 rounded-md bg-paper object-contain p-1 shadow-sm" src="/ministry-health-logo.png" alt="Ministry of Health logo" />
          <div>
            <h1 className="text-2xl font-bold">{t("appName")}</h1>
            <p className="text-sm text-on-solid">{t("login.securePlatform")}</p>
          </div>
        </motion.div>
        <motion.div className="relative max-w-2xl py-16" initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.08, duration: 0.52, ease: [0.16, 1, 0.3, 1] }}>
          <p className="mb-4 inline-flex rounded-full bg-inverse-chip px-3 py-1 text-sm font-semibold">{t("login.postgresqlCoordination")}</p>
          <h2 className="text-4xl font-bold leading-tight sm:text-5xl">{t("login.heroTitle")}</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-on-solid">{t("login.heroText")}</p>
        </motion.div>
        <motion.p className="relative text-sm text-on-solid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.38 }}>{t("login.securityFootnote")}</motion.p>
      </section>
      <section className="flex items-center justify-center p-5">
        <div className="absolute right-5 top-5 z-10">
          <label className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground shadow-sm" title={t("translate")}>
            <Languages className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="sr-only">{t("translate")}</span>
            <select className="bg-transparent outline-none" value={i18n.language} onChange={(event) => void i18n.changeLanguage(event.target.value)} aria-label={t("translate")}>
              {languageOptions.map((language) => <option key={language.code} value={language.code}>{language.nativeLabel}</option>)}
            </select>
          </label>
        </div>
        <motion.div className="w-full max-w-md" initial={{ opacity: 0, scale: 0.96, y: 18, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.14, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <Card className="professional-surface glass-panel w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {accountMode === "login" ? <ShieldCheck className="h-5 w-5 text-accent" /> : accountMode === "reset" || accountMode === "otp" ? <KeyRound className="h-5 w-5 text-accent" /> : <UserPlus className="h-5 w-5 text-accent" />}
              {accountMode === "login" ? t("login.staffLogin") : accountMode === "reset" ? t("passwordReset.title") : accountMode === "otp" ? t("otp.title") : t("login.requestStaffAccount")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-muted p-1 text-xs font-semibold">
              <button className={`rounded-md px-2 py-2 ${accountMode === "login" ? "bg-surface text-accent shadow-sm" : "text-foreground"}`} type="button" onClick={() => changeAccountMode("login")}>{t("login.loginTab")}</button>
              <button className={`rounded-md px-2 py-2 ${accountMode === "staff" ? "bg-surface text-accent shadow-sm" : "text-foreground"}`} type="button" onClick={() => changeAccountMode("staff")}>{t("login.newStaff")}</button>
            </div>

            {accountMode === "login" && <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <label className="block text-sm font-medium">
                {t("login.email")}
                <Input type="email" autoComplete="email" {...register("email")} />
                {errors.email && <span className="text-xs text-danger">{errors.email.message}</span>}
              </label>
              <label className="block text-sm font-medium">
                {t("login.password")}
                <Input type="password" autoComplete="current-password" {...register("password")} />
                {errors.password && <span className="text-xs text-danger">{errors.password.message}</span>}
              </label>
              <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? t("login.signingIn") : t("login.loginButton")}</Button>
              {import.meta.env.DEV && <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={() => selectSeedAccount("doctor@govcare.gov.lk")}>{t("login.doctorAccount")}</Button>
                <Button type="button" variant="outline" onClick={() => selectSeedAccount("patient@govcare.gov.lk")}>{t("login.patientAccount")}</Button>
              </div>}
              {loginError && <p role="alert" className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">{loginError}</p>}
              {googleError && <p className="rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning">{googleError}</p>}
            </form>}

            {accountMode === "reset" && <form className="space-y-4" onSubmit={handlePasswordResetSubmit(requestPasswordReset)}>
              {resetStep === "email" ? <>
                <p className="rounded-md border border-info-border bg-info-surface px-3 py-2 text-sm text-info">{t("passwordReset.instructions")}</p>
                <label className="block text-sm font-medium">
                  {t("login.email")}
                  <Input type="email" autoComplete="email" {...registerReset("email")} />
                  {resetErrors.email && <span className="text-xs text-danger">{resetErrors.email.message}</span>}
                </label>
                <Button type="submit" className="w-full" disabled={isResetSubmitting}><KeyRound className="h-4 w-4" />{isResetSubmitting ? t("passwordReset.sending") : t("passwordReset.sendLink")}</Button>
              </> : <>
                <OtpCountdown expiresAt={otpExpiresAt} now={nowTick} />
                <label className="block text-sm font-medium">{t("otp.code")}<Input inputMode="numeric" maxLength={6} value={resetOtp} onChange={(event) => setResetOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
                <label className="block text-sm font-medium">{t("passwordReset.newPassword")}<Input type="password" value={resetPasswordValues.password} onChange={(event) => setResetPasswordValues((current) => ({ ...current, password: event.target.value }))} /></label>
                <label className="block text-sm font-medium">{t("passwordReset.confirmNewPassword")}<Input type="password" value={resetPasswordValues.confirmPassword} onChange={(event) => setResetPasswordValues((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
                <p className="text-xs text-muted-foreground">{t("passwordReset.passwordRules")}</p>
                <Button className="w-full" type="button" onClick={completeOtpPasswordReset}>{t("passwordReset.updatePassword")}</Button>
                <Button className="w-full" type="button" variant="outline" disabled={nowTick < otpResendAt} onClick={resendForgotPasswordOtp}>{nowTick < otpResendAt ? t("otp.resendIn", { seconds: Math.ceil((otpResendAt - nowTick) / 1000) }) : t("otp.resend")}</Button>
              </>}
              <Button type="button" variant="outline" className="w-full" onClick={() => changeAccountMode("login")}>{t("passwordReset.backToLogin")}</Button>
              {signupMessage && <p className="rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning">{signupMessage}</p>}
            </form>}

            {accountMode === "otp" && <div className="space-y-4">
              <p className="rounded-md border border-info-border bg-info-surface px-3 py-2 text-sm text-info">{t("otp.loginInstructions")}</p>
              <OtpCountdown expiresAt={otpExpiresAt} now={nowTick} />
              <label className="block text-sm font-medium">
                {t("otp.code")}
                <Input inputMode="numeric" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
              </label>
              <Button className="w-full" disabled={otpBusy || otpCode.length !== 6} onClick={verifyLoginOtp}><KeyRound className="h-4 w-4" />{otpBusy ? t("loading") : t("otp.verify")}</Button>
              <Button className="w-full" type="button" variant="outline" disabled={otpBusy || nowTick < otpResendAt} onClick={resendLoginOtp}>{nowTick < otpResendAt ? t("otp.resendIn", { seconds: Math.ceil((otpResendAt - nowTick) / 1000) }) : t("otp.resend")}</Button>
              <Button className="w-full" type="button" variant="ghost" onClick={cancelOtpLogin}>{t("cancel")}</Button>
              {otpMessage && <p className="rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning">{otpMessage}</p>}
            </div>}

            {accountMode === "staff" && <div className="space-y-3">
              <p className="rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning">{t("login.staffClaimNote")}</p>
              <Button className="w-full" variant="secondary" onClick={() => setSignupMessage(t("login.staffContactAdmin"))}>{t("login.requestStaffAccess")}</Button>
              {signupMessage && <p className="rounded-md border border-info-border bg-info-surface px-3 py-2 text-sm text-info">{signupMessage}</p>}
            </div>}
          </CardContent>
        </Card>
        </motion.div>
      </section>
    </main>
  );
}

function OtpCountdown({ expiresAt, now }: { expiresAt: number; now: number }) {
  const { t } = useTranslation();
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const minutesText = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="rounded-md border border-accent-border bg-accent-surface px-3 py-2 text-sm font-semibold text-accent">
      {t("otp.expiresIn", { time: minutesText })}
    </div>
  );
}

function getPostgresCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
}

function getPostgresMessage(error: unknown) {
  return typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message) : "";
}

function postgresqlGoogleErrorMessage(error: unknown) {
  const code = getPostgresCode(error);
  const message = getPostgresMessage(error);
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Google sign-in was cancelled. Select Patient login with Google to try again.";
  if (code === "auth/unauthorized-domain") return "PostgreSQL API rejected this domain. Add localhost and 127.0.0.1 in PostgreSQL-backed authentication > Settings > Authorized domains.";
  if (code === "auth/operation-not-allowed") return "Google provider is disabled. Enable Google in PostgreSQL-backed authentication > Sign-in method.";
  if (code === "auth/invalid-credential") return "Google sign-in credential expired or was rejected. Close any old Google popup, select Patient login with Google again, and make sure Google provider is enabled in PostgreSQL-backed authentication.";
  if (code === "auth/invalid-api-key") return "PostgreSQL API API key is invalid. Check the values in .env and restart Vite.";
  if (code.startsWith("functions/")) return `Google sign-in worked, but the secure patient setup or email OTP service failed (${code})${message ? `: ${message}` : ". Deploy the latest backend API jobs, configure API request validation/SMTP, and check backend API logs."}`;
  return `Google sign-in failed${code ? ` (${code})` : ""}${message ? `: ${message}` : ". Check Google provider and authorized domains in PostgreSQL API."}`;
}
