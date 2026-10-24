import { PageShell } from "@/components/layout/page-shell";
import { T, type MessageKey } from "@/lib/i18n";

export const metadata = { title: "Help" };

const FAQ: { q: MessageKey; a: MessageKey }[] = [
  { q: "help.q1", a: "help.a1" },
  { q: "help.q2", a: "help.a2" },
  { q: "help.q3", a: "help.a3" },
  { q: "help.q4", a: "help.a4" },
];

export default function HelpPage() {
  return (
    <PageShell title={<T k="help.title" />} intro={<T k="help.intro" />}>
      {FAQ.map((item) => (
        <section key={item.q}>
          <h2 className="text-base font-semibold text-slate-900"><T k={item.q} /></h2>
          <p className="mt-1"><T k={item.a} /></p>
        </section>
      ))}
    </PageShell>
  );
}
