import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { defaultHomeForProfile } from "../lib/accessControl";
import { changeTemporaryPassword } from "../services/authService";
import { useAuthStore } from "../stores/authStore";

export function ChangeTemporaryPassword() {
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!profile) return;
    if (newPassword.length < 8) {
      setMessage("The new password must contain at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("The new passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setMessage("The new password must be different from the temporary password.");
      return;
    }
    setSaving(true);
    try {
      await changeTemporaryPassword(currentPassword, newPassword);
      const updated = { ...profile, mustChangePassword: false };
      setProfile(updated);
      navigate(defaultHomeForProfile(updated), { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-5">
      <Card className="w-full max-w-lg border-slate-700 bg-slate-900 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><ShieldCheck className="h-5 w-5 text-cyan-400" /> Secure your staff account</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="rounded-md border border-cyan-800 bg-cyan-950/50 p-3 text-sm text-cyan-100">
              Your administrator created this account with a temporary password. Change it before accessing GovCare EHR.
            </div>
            <label className="block space-y-1 text-sm font-semibold"><span>Temporary password</span><Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label className="block space-y-1 text-sm font-semibold"><span>New password</span><Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
            <label className="block space-y-1 text-sm font-semibold"><span>Confirm new password</span><Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
            <p className="text-xs text-slate-400">Use at least 8 characters. A longer passphrase with letters, numbers and symbols is recommended.</p>
            {message && <p className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-100">{message}</p>}
            <Button className="w-full" type="submit" disabled={saving}><KeyRound className="h-4 w-4" />{saving ? "Changing password..." : "Change Password and Continue"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
