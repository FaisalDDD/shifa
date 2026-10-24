"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, RefreshCw, Package, Truck, Building2 } from "lucide-react";
import type { Pharmacy, ProductSearchHit } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/inventory/stock-badge";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { buildStockDisplay } from "@/services/inventory/stock";
import { useLanguage, type MessageKey } from "@/lib/i18n";

type Tab = "overview" | "inventory" | "suppliers" | "requests";

const TABS: { key: Tab; labelKey: MessageKey; icon: typeof Package }[] = [
  { key: "overview", labelKey: "pd.tab.overview", icon: Building2 },
  { key: "inventory", labelKey: "pd.tab.inventory", icon: Package },
  { key: "suppliers", labelKey: "pd.tab.suppliers", icon: Search },
  { key: "requests", labelKey: "pd.tab.requests", icon: Truck },
];

interface InventoryRow {
  id: string;
  product_id: string;
  availability_status: "AVAILABLE" | "OUT_OF_STOCK" | "UNKNOWN";
  quantity: number | null;
  price: number | null;
  currency: string | null;
  last_verified_at: string | null;
  products: { canonical_name: string; brand_name: string | null; strength: string | null };
}

interface PurchaseRow {
  id: string;
  buyer_pharmacy_id: string;
  seller_pharmacy_id: string;
  product_id: string;
  quantity: number;
  status: "REQUESTED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  notes: string | null;
  created_at: string;
  products: { canonical_name: string; brand_name: string | null; strength: string | null } | null;
}

type Api<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export function PharmacyDashboard({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("overview");
  const [activeId, setActiveId] = useState<string>(pharmacies[0]?.id ?? "");

  if (pharmacies.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{t("pd.yourPharmacy")}</h1>
        <p className="mt-2 text-slate-600">
          {t("pd.noPharmacyDesc")}
        </p>
        <Link
          href="/pharmacy/register"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" aria-hidden /> {t("pd.registerCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t("pd.title")}</h1>
        {pharmacies.length > 1 ? (
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            aria-label={t("pd.selectPharmacy")}
          >
            {pharmacies.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === item.key
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <item.icon className="h-4 w-4" aria-hidden /> {t(item.labelKey)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" ? <Overview pharmacies={pharmacies} /> : null}
        {tab === "inventory" && activeId ? <InventoryPanel pharmacyId={activeId} /> : null}
        {tab === "suppliers" && activeId ? <SuppliersPanel pharmacyId={activeId} /> : null}
        {tab === "requests" && activeId ? <RequestsPanel pharmacyId={activeId} /> : null}
      </div>
    </div>
  );
}

function Overview({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const { t } = useLanguage();
  const [availability, setAvailability] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(pharmacies.map((p) => [p.id, p.is_available !== false])),
  );

  async function toggleAvailability(p: Pharmacy) {
    const next = !(availability[p.id] ?? true);
    setAvailability((prev) => ({ ...prev, [p.id]: next }));
    await fetch("/api/pharmacy/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pharmacy_id: p.id, is_available: next }),
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {pharmacies.map((p) => {
        const available = availability[p.id] ?? true;
        return (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p className="mt-1 text-sm text-slate-500">{p.address}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {p.verification_status === "verified" ? (
                  <Badge tone="teal">{t("pd.verified")}</Badge>
                ) : p.verification_status === "pending" ? (
                  <Badge tone="amber">{t("pd.pending")}</Badge>
                ) : (
                  <Badge tone="rose">{p.verification_status}</Badge>
                )}
                <Badge tone={available ? "teal" : "rose"}>
                  {available ? t("pd.available") : t("pd.notAvailable")}
                </Badge>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/pharmacies/${p.slug}`}
                className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("pd.viewPublic")}
              </Link>
              <button
                onClick={() => toggleAvailability(p)}
                className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {available ? t("pd.setUnavailable") : t("pd.setAvailable")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InventoryPanel({ pharmacyId }: { pharmacyId: string }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/pharmacies/${pharmacyId}/inventory`);
    const json = (await res.json()) as Api<InventoryRow[]>;
    setRows(json.ok ? json.data : []);
    setLoading(false);
  }, [pharmacyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount loading state
    load();
  }, [load]);

  async function searchProducts() {
    if (!q.trim()) return;
    setSearching(true);
    const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
    const json = (await res.json()) as Api<ProductSearchHit[]>;
    setResults(json.ok ? json.data : []);
    setSearching(false);
  }

  async function addProduct(productId: string) {
    const res = await fetch("/api/pharmacy/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pharmacy_id: pharmacyId,
        product_id: productId,
        availability_status: "AVAILABLE",
        quantity: 10,
        currency: null,
      }),
    });
    if (res.ok) {
      setResults([]);
      setQ("");
      load();
    }
  }

  async function setStatus(rowId: string, status: "AVAILABLE" | "OUT_OF_STOCK") {
    await fetch(`/api/pharmacy/inventory/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "", availability_status: status }),
    });
    load();
  }

  const filteredRows = rows.filter(
    (r) =>
      filter.trim() === "" ||
      r.products.canonical_name.toLowerCase().includes(filter.trim().toLowerCase()) ||
      (r.products.brand_name ?? "").toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("pd.searchProductPlaceholder")}
        />
        <Button onClick={searchProducts} disabled={searching}>{t("common.search")}</Button>
      </div>

      {results.length > 0 ? (
        <ul className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          {results.slice(0, 8).map((hit) => (
            <li key={hit.product.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-800">
                {hit.product.canonical_name}
                {hit.product.strength ? ` ${hit.product.strength}` : ""}
              </span>
              <Button size="sm" variant="secondary" onClick={() => addProduct(hit.product.id)}>
                <Plus className="h-3.5 w-3.5" /> {t("common.add")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{t("pd.yourInventory")}</h2>
          <button onClick={load} className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> {t("common.refresh")}
          </button>
        </div>
        <div className="mt-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("pd.searchInventory")}
          />
        </div>

        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title={t("pd.noInventory.title")} description={t("pd.noInventory.desc")} />
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {filteredRows.map((row) => {
              const stock = buildStockDisplay(row.availability_status, row.last_verified_at);
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">
                      {row.products.canonical_name}
                      {row.products.strength ? ` ${row.products.strength}` : ""}
                    </p>
                    <StockBadge stock={stock} showFreshness />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStatus(row.id, "AVAILABLE")}
                      className="inline-flex h-9 items-center rounded-lg bg-teal-600 px-3 text-xs font-medium text-white hover:bg-teal-700"
                    >
                      {t("pd.inStock")}
                    </button>
                    <button
                      onClick={() => setStatus(row.id, "OUT_OF_STOCK")}
                      className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t("pd.outOfStock")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SuppliersPanel({ pharmacyId }: { pharmacyId: string }) {
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    const res = await fetch(`/api/pharmacy/suppliers/search?q=${encodeURIComponent(q)}`);
    const json = (await res.json()) as Api<ProductSearchHit[]>;
    if (json.ok) setHits(json.data);
    else setError(json.error.message);
    setLoading(false);
  }

  async function requestBulk(productId: string, sellerPharmacyId: string) {
    const quantity = Number(prompt(t("pd.quantityPrompt")) ?? "0");
    if (!quantity || quantity <= 0) return;
    await fetch("/api/pharmacy/purchase-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_pharmacy_id: pharmacyId,
        seller_pharmacy_id: sellerPharmacyId,
        product_id: productId,
        quantity,
      }),
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder={t("pd.searchSupplierPlaceholder")}
        />
        <Button onClick={search} disabled={loading}>{t("common.search")}</Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !searched || q.trim() === "" ? (
          <EmptyState title={t("pd.findSuppliers")} description={t("pd.findSuppliersDesc")} />
        ) : hits.length === 0 ? (
          <EmptyState title={t("pd.noSuppliers")} description={t("pd.noOtherPharmacy")} />
        ) : (
          <ul className="space-y-4">
            {hits.map((hit) => (
              <li key={hit.product.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">
                  {hit.product.canonical_name}
                  {hit.product.strength ? ` ${hit.product.strength}` : ""}
                </p>
                {hit.pharmacies.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">{t("pd.noOtherPharmacy")}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {hit.pharmacies.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3">
                        <div>
                          <Link href={`/pharmacies/${p.slug}`} className="font-medium text-teal-700 hover:underline">
                            {p.name}
                          </Link>
                          {p.stock ? <div className="mt-0.5"><StockBadge stock={p.stock} showFreshness /></div> : null}
                        </div>
                        <Button size="sm" onClick={() => requestBulk(hit.product.id, p.id)}>
                          {t("pd.requestBulk")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RequestsPanel({ pharmacyId }: { pharmacyId: string }) {
  const { t } = useLanguage();
  const [incoming, setIncoming] = useState<PurchaseRow[]>([]);
  const [outgoing, setOutgoing] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [inc, out] = await Promise.all([
      fetch(
        `/api/pharmacy/purchase-requests?pharmacy_id=${pharmacyId}&direction=incoming`,
      ).then((r) => r.json()) as Promise<Api<PurchaseRow[]>>,
      fetch(
        `/api/pharmacy/purchase-requests?pharmacy_id=${pharmacyId}&direction=outgoing`,
      ).then((r) => r.json()) as Promise<Api<PurchaseRow[]>>,
    ]);
    setIncoming(inc.ok ? inc.data : []);
    setOutgoing(out.ok ? out.data : []);
    setLoading(false);
  }, [pharmacyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount loading state
    load();
  }, [load]);

  async function act(id: string, action: "accept" | "reject" | "cancel") {
    await fetch(`/api/pharmacy/purchase-requests/${id}/${action}`, { method: "POST" });
    load();
  }

  const statusTone = (s: PurchaseRow["status"]) =>
    s === "ACCEPTED" ? "teal" : s === "REJECTED" || s === "CANCELLED" ? "rose" : "amber";

  function Row({ r, kind }: { r: PurchaseRow; kind: "incoming" | "outgoing" }) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-medium text-slate-800">
            {r.products?.canonical_name ?? t("pd.product")}
            {r.products?.strength ? ` ${r.products.strength}` : ""} × {r.quantity}
          </p>
          <p className="text-xs text-slate-500">
            {kind === "incoming"
              ? t("pd.fromBuyer", { id: r.buyer_pharmacy_id.slice(0, 8) })
              : t("pd.toSeller", { id: r.seller_pharmacy_id.slice(0, 8) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(r.status) as "teal" | "amber" | "rose"}>{r.status}</Badge>
          {kind === "incoming" && r.status === "REQUESTED" ? (
            <>
              <Button size="sm" onClick={() => act(r.id, "accept")}>{t("common.accept")}</Button>
              <Button size="sm" variant="secondary" onClick={() => act(r.id, "reject")}>{t("common.reject")}</Button>
            </>
          ) : null}
          {kind === "outgoing" && r.status === "REQUESTED" ? (
            <Button size="sm" variant="secondary" onClick={() => act(r.id, "cancel")}>{t("common.cancel")}</Button>
          ) : null}
        </div>
      </li>
    );
  }

  if (loading) return <LoadingState />;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h2 className="text-sm font-semibold text-slate-900">{t("pd.incomingTitle")}</h2>
        {incoming.length === 0 ? (
          <EmptyState title={t("pd.noIncoming")} />
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {incoming.map((r) => <Row key={r.id} r={r} kind="incoming" />)}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-sm font-semibold text-slate-900">{t("pd.outgoingTitle")}</h2>
        {outgoing.length === 0 ? (
          <EmptyState title={t("pd.noOutgoing")} />
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {outgoing.map((r) => <Row key={r.id} r={r} kind="outgoing" />)}
          </ul>
        )}
      </section>
    </div>
  );
}
