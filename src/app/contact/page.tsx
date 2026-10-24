import { PageShell } from "@/components/layout/page-shell";
import { T } from "@/lib/i18n";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <PageShell title={<T k="contact.title" />} intro={<T k="contact.intro" />}>
      <p>
        <T k="contact.body" />
      </p>
      <section>
        <h2 className="text-lg font-semibold text-slate-900"><T k="contact.pharmacies.title" /></h2>
        <p className="mt-2">
          <T k="contact.pharmacies.body" />
        </p>
      </section>
    </PageShell>
  );
}
