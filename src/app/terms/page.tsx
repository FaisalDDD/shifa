import { PageShell } from "@/components/layout/page-shell";
import { T } from "@/lib/i18n";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <PageShell title={<T k="terms.title" />} intro={<T k="terms.intro" />}>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="terms.nomedical.title" /></h2>
        <p className="mt-2">
          <T k="terms.nomedical.body" />
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="terms.guarantee.title" /></h2>
        <p className="mt-2">
          <T k="terms.guarantee.body" />
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="terms.prescription.title" /></h2>
        <p className="mt-2">
          <T k="terms.prescription.body" />
        </p>
      </section>
    </PageShell>
  );
}
