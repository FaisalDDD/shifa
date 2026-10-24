"use client";

import { motion } from "motion/react";
import { useLanguage } from "@/lib/i18n";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

function AndroidIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396" />
    </svg>
  );
}

export function DownloadSection() {
  const { t } = useLanguage();

  return (
    <section
      id="download"
      className="border-t border-slate-200 bg-gradient-to-b from-teal-50/70 to-white py-24 md:py-28"
    >
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
            {t("landing.download.eyebrow")}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            {t("landing.download.title")}
          </h2>
          <p className="mt-5 text-lg text-slate-600">{t("landing.download.body")}</p>

          <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
            <a
              href="/shifa.apk"
              download
              className="group flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-[#3ddc84]">
                <AndroidIcon className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-lg font-semibold text-slate-900">Shifa</span>
                <span className="mt-1 block text-sm text-slate-500">{t("landing.download.note")}</span>
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-teal-600">
                {t("landing.download.cta")} →
              </span>
            </a>

            <a
              href="/shifa-pro.apk"
              download
              className="group flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-[#3ddc84]">
                <AndroidIcon className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-lg font-semibold text-slate-900">Shifa Pro</span>
                <span className="mt-1 block text-sm text-slate-500">{t("landing.download.pro.desc")}</span>
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-teal-600">
                {t("landing.download.pro.cta")} →
              </span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
