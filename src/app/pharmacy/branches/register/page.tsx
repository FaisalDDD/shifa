"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterBranchPage() {
  const router = useRouter();
  const [businessId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("business_id") ?? "");
  const [form, setForm] = useState({
    branch_name: "",
    branch_code: "",
    name: "",
    address: "",
    city: "",
    phone: "",
    website: "",
    latitude: "",
    longitude: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessId) {
      setError("Open branch registration from a business-owned pharmacy portal.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/pharmacy/branches/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          branch_name: form.branch_name,
          branch_code: form.branch_code,
          name: form.name,
          address: form.address,
          city: form.city || null,
          phone: form.phone || null,
          website: form.website || null,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message || "The branch could not be registered.");
      }
      router.push("/pharmacy");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The branch could not be registered.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-sky-700">SHIFA / BRANCH REGISTRATION</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Register a new branch</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        The branch will remain pending until the same verification process as a new pharmacy is completed.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium text-slate-700">Branch name</span><Input required value={form.branch_name} onChange={(event) => update("branch_name", event.target.value)} className="mt-1" /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700">Branch code</span><Input required placeholder="KHARTOUM-01" value={form.branch_code} onChange={(event) => update("branch_code", event.target.value)} className="mt-1" /></label>
        </div>
        <label className="block"><span className="text-sm font-medium text-slate-700">Public listing name</span><Input required value={form.name} onChange={(event) => update("name", event.target.value)} className="mt-1" /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Address</span><Input required value={form.address} onChange={(event) => update("address", event.target.value)} className="mt-1" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium text-slate-700">City</span><Input value={form.city} onChange={(event) => update("city", event.target.value)} className="mt-1" /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700">Phone</span><Input value={form.phone} onChange={(event) => update("phone", event.target.value)} className="mt-1" /></label>
        </div>
        <label className="block"><span className="text-sm font-medium text-slate-700">Website</span><Input type="url" value={form.website} onChange={(event) => update("website", event.target.value)} className="mt-1" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium text-slate-700">Latitude</span><Input required type="number" step="any" value={form.latitude} onChange={(event) => update("latitude", event.target.value)} className="mt-1" /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700">Longitude</span><Input required type="number" step="any" value={form.longitude} onChange={(event) => update("longitude", event.target.value)} className="mt-1" /></label>
        </div>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={loading || !businessId} className="w-full">{loading ? "Submitting…" : "Submit branch for verification"}</Button>
        <p className="text-center text-sm text-slate-500"><Link href="/pharmacy" className="text-sky-700 hover:underline">Cancel</Link></p>
      </form>
    </main>
  );
}
