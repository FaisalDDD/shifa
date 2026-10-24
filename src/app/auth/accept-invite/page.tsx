"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export default function AcceptInvitePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError(t("auth.passwordHint")); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.replace("/pharmacy");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Set your Shifa employee password</h1>
        <p className="mt-2 text-sm text-slate-600">Choose a password to activate your pharmacy employee account.</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">New password
            <Input type="password" minLength={8} autoComplete="new-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} className="mt-1" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Confirm password
            <Input type="password" minLength={8} autoComplete="new-password" required value={confirm}
              onChange={(e) => setConfirm(e.target.value)} className="mt-1" />
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Saving…" : "Activate account"}</Button>
        </form>
      </div>
    </div>
  );
}
