import { PageShell } from "@/components/layout/page-shell";
import { T } from "@/lib/i18n";

export const metadata = { title: "About Shifa" };

export default function AboutPage() {
  return (
    <PageShell title={<T k="about.title" />} intro={<T k="about.intro" />}>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="about.problem.title" /></h2>
        <p className="mt-2">
          <T k="about.problem.body" />
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="about.not.title" /></h2>
        <p className="mt-2">
          <T k="about.not.body" />
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="about.transparency.title" /></h2>
        <p className="mt-2">
          <T k="about.transparency.body" />
        </p>
      </section>
    </PageShell>
  );
}
