"use client";

import { useEffect } from "react";
import Link from "next/link";
import Lenis from "lenis";
import { motion, useScroll, useTransform } from "motion/react";
import { Search, Cross } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { FloatingTablets } from "./tablets";
import { DownloadSection } from "./download";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

function AnimatedWords({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block"
          initial={{ opacity: 0, y: "0.6em", filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: delay + i * 0.07, ease: EASE }}
        >
          {w}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}

export function Landing() {
  const { t } = useLanguage();

  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true, lerp: 0.09 });
    return () => {
      lenis.destroy();
    };
  }, []);

  const heroParallax = useTransform(useScroll().scrollY, [0, 800], [0, 120]);

  return (
    <div className="overflow-x-clip bg-white text-slate-900">
      {/* ============ HERO ============ */}
      <section className="relative flex min-h-[92svh] items-center justify-center overflow-hidden bg-gradient-to-b from-teal-50/60 via-white to-white">
        <FloatingTablets />

        <motion.div
          style={{ y: heroParallax }}
          className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/70 px-4 py-1.5 text-sm font-medium text-teal-700 backdrop-blur"
          >
            <Cross className="h-4 w-4" aria-hidden />
            {t("landing.hero.overline")}
          </motion.div>

          <h1 className="mt-7 text-5xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl md:text-7xl">
            <AnimatedWords text={t("landing.hero.titleA")} delay={0.15} />
            <br />
            <AnimatedWords
              text={t("landing.hero.titleB")}
              delay={0.35}
              className="text-gradient"
            />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: EASE }}
            className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 md:text-xl"
          >
            {t("landing.hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85, ease: EASE }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/search"
              className="inline-flex h-[3.25rem] items-center gap-2 rounded-full bg-teal-600 px-8 text-base font-medium text-white shadow-lg shadow-teal-600/25 transition hover:-translate-y-0.5 hover:bg-teal-700"
            >
              <Search className="h-5 w-5" aria-hidden />
              {t("landing.hero.ctaPrimary")}
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.8 }}
            className="mt-8 text-xs font-medium uppercase tracking-widest text-slate-400"
          >
            {t("landing.hero.badge")}
          </motion.p>
        </motion.div>
      </section>

      <DownloadSection />
    </div>
  );
}
