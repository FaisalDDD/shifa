"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useLanguage } from "@/lib/i18n";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const next = searchParams.get("next") ?? "/dashboard";
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (searchParams.has("next")) {
      router.push(next.startsWith("/") ? next : "/dashboard");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">{t("auth.signIn")}</h1>
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
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("auth.password")}</span>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1"
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </form>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>
            <Link href="/auth/reset-password" className="text-teal-700 hover:underline">
              {t("auth.forgotPassword")}
            </Link>
          </p>
          <p>
            {t("auth.noAccount")}{" "}
            <Link href="/auth/signup" className="text-teal-700 hover:underline">
              {t("auth.signUp")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
