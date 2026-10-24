"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export default function PharmacyRegisterPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    postal_code: "",
    country_code: "",
    latitude: "",
    longitude: "",
    phone: "",
    website: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/pharmacy/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        city: form.city || null,
        postal_code: form.postal_code || null,
        country_code: form.country_code || null,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        phone: form.phone || null,
        website: form.website || null,
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error?.message ?? t("pr.errorFallback"));
      setLoading(false);
      return;
    }
    router.push("/pharmacy");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">{t("pr.title")}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {t("pr.introBefore")} <strong>{t("pr.introPending")}</strong> {t("pr.introAfter")}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t("pr.name")}</span>
          <Input required value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t("pr.address")}</span>
          <Input required value={form.address} onChange={(e) => update("address", e.target.value)} className="mt-1" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("pr.city")}</span>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("pr.postalCode")}</span>
            <Input value={form.postal_code} onChange={(e) => update("postal_code", e.target.value)} className="mt-1" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("pr.latitude")}</span>
            <Input required type="number" step="any" value={form.latitude} onChange={(e) => update("latitude", e.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("pr.longitude")}</span>
            <Input required type="number" step="any" value={form.longitude} onChange={(e) => update("longitude", e.target.value)} className="mt-1" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t("pr.phone")}</span>
          <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t("pr.website")}</span>
          <Input value={form.website} onChange={(e) => update("website", e.target.value)} className="mt-1" />
        </label>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t("pr.submitting") : t("pr.submit")}
        </Button>
        <p className="text-center text-sm text-slate-500">
          <Link href="/pharmacy" className="text-teal-700 hover:underline">{t("common.cancel")}</Link>
        </p>
      </form>
    </div>
  );
}
