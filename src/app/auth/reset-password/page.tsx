"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useLanguage } from "@/lib/i18n";

function ResetPasswordForm() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage(t("auth.resetSent"));
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">{t("auth.resetTitle")}</h1>
        {message ? (
          <p className="mt-4 text-sm text-teal-700">{message}</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t("auth.email")}</span>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-1"
              />
            </label>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t("auth.sending") : t("auth.sendResetLink")}
            </Button>
          </form>
        )}
        <p className="mt-4 text-sm text-slate-600">
          <Link href="/auth/login" className="text-teal-700 hover:underline">
            {t("auth.backToSignIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
