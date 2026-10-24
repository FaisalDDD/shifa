import type { ReactNode } from "react";

/** Shared shell for static/legal content pages. */
export function PageShell({
  title,
  intro,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      {intro ? <p className="mt-3 text-slate-600">{intro}</p> : null}
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        {children}
      </div>
    </div>
  );
}
