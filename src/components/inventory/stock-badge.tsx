"use client";

import { CheckCircle2, HelpCircle, XCircle, AlertTriangle } from "lucide-react";
import type { StockDisplay } from "@/types";
import { cn } from "@/lib/cn";
import { relativeTimeLocalized, useLanguage, type MessageKey } from "@/lib/i18n";
import { customerStockLabelKey } from "@/services/inventory/stock";

/**
 * Stock availability badge. Uses icon + text (never color alone) per the
 * accessibility requirement, and shows a warning when data may be stale.
 */
export function StockBadge({
  stock,
  showFreshness = false,
  className,
}: {
  stock: StockDisplay;
  showFreshness?: boolean;
  className?: string;
}) {
  const { t, lang } = useLanguage();

  function labelKey(): MessageKey {
    if (!showFreshness) return customerStockLabelKey(stock) as MessageKey;
    return (stock.labelKey as MessageKey) ?? "stock.unknown";
  }

  function hint(): string | null {
    if (!showFreshness) return null;
    if (!stock.hintKey) return stock.hint;
    const age = stock.hintTimestamp
      ? relativeTimeLocalized(stock.hintTimestamp, lang)
      : null;
    return t(stock.hintKey as MessageKey, { age: age ?? "" });
  }

  if (!stock.hasUsableData) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-slate-500",
          className,
        )}
      >
        <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">{t("stock.unknown")}</span>
          {hint() ? (
            <span className="text-slate-400"> — {hint()}</span>
          ) : null}
        </span>
      </span>
    );
  }

  const isAvailable = stock.availability === "AVAILABLE";
  const isLow = stock.availability === "LOW_STOCK";
  const Icon = isLow ? AlertTriangle : isAvailable ? CheckCircle2 : XCircle;

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm",
        isAvailable ? "text-teal-700" : isLow ? "text-amber-700" : "text-rose-700",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-medium">{t(labelKey())}</span>
      {hint() ? (
        <span className="text-slate-400"> · {hint()}</span>
      ) : null}
      {showFreshness && stock.callToConfirm ? (
        <span className="inline-flex items-center gap-1 text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {t("stock.callToConfirm")}
        </span>
      ) : null}
    </span>
  );
}

/** Compact dot + text marker used on map popups / list rows. */
export function StockDot({ stock }: { stock: StockDisplay }) {
  const tone = !stock.hasUsableData
    ? "bg-slate-300"
    : stock.availability === "AVAILABLE"
      ? "bg-teal-500"
      : stock.availability === "LOW_STOCK"
        ? "bg-amber-400"
        : "bg-rose-500";
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", tone)} aria-hidden />;
}
