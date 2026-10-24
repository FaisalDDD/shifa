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

function AppleIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export function DownloadSection() {
  const { t } = useLanguage();

  return (
    <section id="download" className="border-t border-slate-200 bg-gradient-to-b from-teal-50/70 to-white py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
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

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/shifa.apk"
              download
              className="inline-flex h-14 items-center gap-3 rounded-full bg-slate-900 px-8 text-base font-medium text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <AndroidIcon className="h-5 w-5 text-[#3ddc84]" />
              {t("landing.download.cta")}
            </a>
            <button
              disabled
              className="inline-flex h-14 cursor-not-allowed items-center gap-3 rounded-full border border-slate-300 bg-white px-6 text-base font-medium text-slate-400"
              title={t("landing.download.ios")}
            >
              <AppleIcon className="h-5 w-5" />
              {t("landing.download.ios")}
            </button>
          </div>
        </motion.div>

        {/* 3D phone mockups */}
        <div className="phones-scene">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="phone-frame phone-android"
          >
            <span className="phone-camera" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
            className="phone-frame phone-ios"
          >
            <span className="phone-notch" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
