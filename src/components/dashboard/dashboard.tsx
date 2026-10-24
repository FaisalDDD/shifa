"use client";

import Link from "next/link";
import { Search, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import type { Pharmacy } from "@/types";

export function DashboardContent({
  profile,
  pharmacies,
  notifications,
}: {
  profile: {
    email: string | null;
    display_name: string | null;
    role: string;
  };
  pharmacies: Pharmacy[];
  notifications: {
    id: string;
    title: string;
    body: string;
    read_at: string | null;
    created_at: string;
  }[];
}) {
  const { t } = useLanguage();
  const user = profile.email ?? profile.display_name ?? "user";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{t("dash.title")}</h1>
      <p className="mt-1 text-slate-600">
        {t("dash.signedInAs", { user })}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/search"
          className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300"
        >
          <Search className="h-6 w-6 text-teal-600" aria-hidden />
          <h2 className="mt-3 font-semibold text-slate-900">{t("dash.find.title")}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("dash.find.desc")}
          </p>
        </Link>

        {profile.role === "pharmacy_staff" || pharmacies.length > 0 ? (
          <Link
            href="/pharmacy"
            className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300"
          >
            <Building2 className="h-6 w-6 text-teal-600" aria-hidden />
            <h2 className="mt-3 font-semibold text-slate-900">{t("dash.pharmacy.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("dash.pharmacy.desc")}
            </p>
          </Link>
        ) : (
          <Link
            href="/pharmacy/register"
            className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300"
          >
            <Building2 className="h-6 w-6 text-teal-600" aria-hidden />
            <h2 className="mt-3 font-semibold text-slate-900">{t("dash.register.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("dash.register.desc")}
            </p>
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Badge tone="slate">
          {t("dash.role")}: {profile.role.replace("_", " ")}
        </Badge>
        {pharmacies.map((p) => (
          <Badge key={p.id} tone={p.verification_status === "verified" ? "teal" : "amber"}>
            {p.name} · {p.verification_status}
          </Badge>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("dash.notifications")}
        </h2>
        {notifications.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t("dash.noNotifications")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-xl border p-4 ${
                  n.read_at
                    ? "border-slate-200 bg-white"
                    : "border-teal-200 bg-teal-50/50"
                }`}
              >
                <p className="font-medium text-slate-900">{n.title}</p>
                <p className="mt-1 text-sm text-slate-600">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
