"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useLanguage } from "@/lib/i18n";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const next = searchParams.get("next") ?? "/dashboard";
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"customer" | "pharmacy">("customer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || undefined, account_type: accountType },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${accountType === "pharmacy" ? "%2Fpharmacy%2Fregister" : "%2Fdashboard"}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      // Email confirmation required.
      setConfirmMessage(t("auth.checkEmail"));
      setLoading(false);
      return;
    }
    router.push(accountType === "pharmacy" ? "/pharmacy/register" : next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">{t("auth.signUp")}</h1>
        {confirmMessage ? (
          <div className="mt-4">
            <p className="text-sm text-teal-700">{confirmMessage}</p>
            <Link href="/auth/login" className="mt-3 inline-flex h-11 items-center rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700">
              {t("auth.goToSignIn")}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("auth.accountType")}>
              {(["customer", "pharmacy"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  aria-pressed={accountType === type}
                  className={`h-11 rounded-lg border text-sm font-medium ${
                    accountType === type
                      ? "border-teal-600 bg-teal-50 text-teal-800"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {type === "customer" ? t("auth.customer") : t("auth.business")}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t("auth.name")}</span>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                className="mt-1"
              />
            </label>
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
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t("auth.password")}</span>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1"
              />
              <span className="mt-1 block text-xs text-slate-400">
                {t("auth.passwordHint")}
              </span>
            </label>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t("auth.creatingAccount") : t("auth.signUp")}
            </Button>
          </form>
        )}
        <p className="mt-4 text-sm text-slate-600">
          {t("auth.haveAccount")}{" "}
          <Link href="/auth/login" className="text-teal-700 hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
