import { PageShell } from "@/components/layout/page-shell";
import { T } from "@/lib/i18n";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <PageShell title={<T k="privacy.title" />} intro={<T k="privacy.intro" />}>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="privacy.collect.title" /></h2>
        <p className="mt-2">
          <T k="privacy.collect.body" />
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="privacy.location.title" /></h2>
        <p className="mt-2">
          <T k="privacy.location.body" />
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="privacy.health.title" /></h2>
        <p className="mt-2">
          <T k="privacy.health.body" />
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="privacy.delete.title" /></h2>
        <p className="mt-2">
          <T k="privacy.delete.body" />
        </p>
      </section>
    </PageShell>
  );
}
