"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const reason = searchParams.get("reason") ?? "invalid_code";
  const message =
    reason === "invalid_code" ? t("auth.invalidLink") : t("auth.wentWrong");

  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-slate-900">{t("auth.signInFailed")}</h1>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <Link
        href="/auth/login"
        className="mt-5 inline-flex h-11 items-center rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700"
      >
        {t("auth.tryAgain")}
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
