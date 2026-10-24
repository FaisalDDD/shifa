"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AvailabilityPanel } from "@/components/pharmacy/availability-panel";
import { useLanguage } from "@/lib/i18n";
import type { Product } from "@/types";

function NotifyButton({ productId }: { productId: string }) {
  const { t } = useLanguage();
  const [state, setState] = useState<"idle" | "loading" | "done" | "signin">(
    "idle",
  );

  async function notify() {
    setState("loading");
    try {
      const res = await fetch(`/api/products/${productId}/notify`, {
        method: "POST",
      });
      if (res.status === 401) {
        setState("signin");
        return;
      }
      if (res.ok) {
        setState("done");
        return;
      }
      setState("idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-teal-700">
        <BellRing className="h-4 w-4" aria-hidden />
        {t("product.notifyDone")}
      </span>
    );
  }

  if (state === "signin") {
    return (
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {t("product.notifySignIn")}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={notify}
      disabled={state === "loading"}
      className="inline-flex items-center gap-2 rounded-lg border border-teal-300 px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50"
    >
      <Bell className="h-4 w-4" aria-hidden />
      {state === "loading" ? "…" : t("product.notifyMe")}
    </button>
  );
}

export function ProductDetailContent({ product }: { product: Product }) {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {product.canonical_name}
              {product.strength ? ` ${product.strength}` : ""}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {product.brand_name ? `${product.brand_name} · ` : ""}
              {product.dosage_form ?? t("product.dosageFormFallback")}
            </p>
          </div>
          {product.prescription_classification === "prescription" ? (
            <Badge tone="navy">{t("product.prescription")}</Badge>
          ) : product.prescription_classification === "otc" ? (
            <Badge tone="teal">{t("product.otc")}</Badge>
          ) : null}
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {product.active_ingredients.length > 0 ? (
            <div>
              <dt className="font-medium text-slate-500">{t("product.activeIngredients")}</dt>
              <dd className="text-slate-800">{product.active_ingredients.join(", ")}</dd>
            </div>
          ) : null}
          {product.product_identifier ? (
            <div>
              <dt className="font-medium text-slate-500">{t("product.productIdentifier")}</dt>
              <dd className="text-slate-800">{product.product_identifier}</dd>
            </div>
          ) : null}
          {product.barcode ? (
            <div>
              <dt className="font-medium text-slate-500">{t("product.barcode")}</dt>
              <dd className="text-slate-800">{product.barcode}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-5">
          <NotifyButton productId={product.id} />
        </div>

        <p className="mt-5 text-xs text-slate-400">
          {t("product.disclaimer")}
        </p>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("product.nearbyAvailability")}</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          {t("product.nearbyIntro")}
        </p>
        <AvailabilityPanel productId={product.id} />
      </div>
    </div>
  );
}
