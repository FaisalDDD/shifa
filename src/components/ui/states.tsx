"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {description ? <p className="max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-base font-semibold text-rose-700">{title ?? t("common.error")}</p>
      {description ? <p className="max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
