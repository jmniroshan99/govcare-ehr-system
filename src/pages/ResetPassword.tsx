import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CheckCircle2, KeyRound, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { confirmSecurePasswordReset, verifyPasswordResetLink } from "../services/authService";
import { friendlyAuthError } from "../utils/authErrors";
import { createPasswordResetConfirmSchema } from "../validations/auth";
import type { PasswordResetConfirmInput } from "../validations/auth";

export function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode") ?? "";
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [status, setStatus] = useState<"checking" | "ready" | "success" | "error">(oobCode ? "checking" : "error");
  const [message, setMessage] = useState(oobCode ? "" : t("authErrors.expiredResetLink"));
  const schema = useMemo(() => createPasswordResetConfirmSchema(t), [t]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PasswordResetConfirmInput>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!oobCode) return;
    verifyPasswordResetLink(oobCode)
      .then((email) => {
        setVerifiedEmail(email);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        setStatus("error");
        setMessage(friendlyAuthError(error, t));
      });
  }, [oobCode, t]);

  async function submit(values: PasswordResetConfirmInput) {
    try {
      await confirmSecurePasswordReset(oobCode, values.password);
      setStatus("success");
      setMessage(t("passwordReset.resetSuccess"));
    } catch (error) {
      setStatus("error");
      setMessage(friendlyAuthError(error, t));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.32 }}>
        <Card className="professional-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {status === "success" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : status === "error" ? <ShieldAlert className="h-5 w-5 text-rose-600" /> : <KeyRound className="h-5 w-5 text-primary" />}
              {t("passwordReset.createNewPassword")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "checking" && <p className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-950">{t("passwordReset.verifyingLink")}</p>}

            {status === "ready" && (
              <form className="space-y-4" onSubmit={handleSubmit(submit)}>
                <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">{t("passwordReset.resetFor", { email: verifiedEmail })}</p>
                <label className="block text-sm font-medium">
                  {t("passwordReset.newPassword")}
                  <Input type="password" autoComplete="new-password" {...register("password")} />
                  {errors.password && <span className="text-xs text-destructive">{errors.password.message}</span>}
                </label>
                <label className="block text-sm font-medium">
                  {t("passwordReset.confirmNewPassword")}
                  <Input type="password" autoComplete="new-password" {...register("confirmPassword")} />
                  {errors.confirmPassword && <span className="text-xs text-destructive">{errors.confirmPassword.message}</span>}
                </label>
                <p className="text-xs text-muted-foreground">{t("passwordReset.passwordRules")}</p>
                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? t("loading") : t("passwordReset.updatePassword")}</Button>
              </form>
            )}

            {(status === "success" || status === "error") && (
              <div className="space-y-3">
                <p className={`rounded-md border px-3 py-2 text-sm ${status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-rose-200 bg-rose-50 text-rose-950"}`}>{message}</p>
                <Link className="interactive-control inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-teal-800" to="/login">{t("passwordReset.backToLogin")}</Link>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
