"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-teal-600">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{t("notFound.title")}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {t("notFound.body")}
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-lg bg-teal-600 px-5 text-sm font-medium text-white hover:bg-teal-700"
      >
        {t("notFound.back")}
      </Link>
    </div>
  );
}
