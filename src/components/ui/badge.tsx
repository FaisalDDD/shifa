import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "teal" | "amber" | "rose" | "slate" | "navy";

const tones: Record<Tone, string> = {
  teal: "bg-teal-50 text-teal-800 border-teal-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  rose: "bg-rose-50 text-rose-800 border-rose-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  navy: "bg-slate-800 text-white border-slate-700",
};

export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
