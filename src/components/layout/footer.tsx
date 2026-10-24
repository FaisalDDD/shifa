"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { useLanguage } from "@/lib/i18n";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-3 text-sm text-slate-500">{t("footer.tagline")}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-800">{t("footer.product")}</p>
              <ul className="mt-2 space-y-2 text-slate-500">
                <li><Link className="hover:text-teal-700" href="/search">{t("nav.search")}</Link></li>
                <li><Link className="hover:text-teal-700" href="/about">{t("nav.about")}</Link></li>
                <li><Link className="hover:text-teal-700" href="/help">{t("nav.help")}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-800">{t("footer.forPharmacies")}</p>
              <ul className="mt-2 space-y-2 text-slate-500">
                <li><Link className="hover:text-teal-700" href="/about#pharmacies">{t("footer.listPharmacy")}</Link></li>
                <li><Link className="hover:text-teal-700" href="/contact">{t("footer.contact")}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-800">{t("footer.legal")}</p>
              <ul className="mt-2 space-y-2 text-slate-500">
                <li><Link className="hover:text-teal-700" href="/privacy">{t("footer.privacy")}</Link></li>
                <li><Link className="hover:text-teal-700" href="/terms">{t("footer.terms")}</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-8 border-t border-slate-100 pt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
