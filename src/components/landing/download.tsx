"use client";

import Image from "next/image";
import { motion } from "motion/react";
import {
  Bell,
  Battery,
  Check,
  Download,
  Heart,
  MapPin,
  Navigation,
  Package,
  Phone,
  Search,
  Store,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/*
 * Self-contained keyframes for the looping phone demo.
 * The whole cycle runs on a shared 14s timeline; each screen fades in/out
 * over its own slice so the four states crossfade seamlessly:
 *   s1 (menu) 0-25% · s2 (typing) 25-50% · s3 (product) 50-75% · s4 (+ pharmacy) 75-100%.
 */
const PHONE_CSS = `
@keyframes shifa-s1 {
  0% { opacity: 0; transform: translateY(14px) scale(0.985); }
  3% { opacity: 1; transform: translateY(0) scale(1); }
  19% { opacity: 1; transform: translateY(0) scale(1); }
  25% { opacity: 0; transform: translateY(-12px) scale(0.99); }
  100% { opacity: 0; transform: translateY(-12px) scale(0.99); }
}
@keyframes shifa-s2 {
  0%, 24% { opacity: 0; transform: translateY(14px) scale(0.985); }
  28% { opacity: 1; transform: translateY(0) scale(1); }
  44% { opacity: 1; transform: translateY(0) scale(1); }
  50% { opacity: 0; transform: translateY(-12px) scale(0.99); }
  100% { opacity: 0; transform: translateY(-12px) scale(0.99); }
}
@keyframes shifa-s3 {
  0%, 49% { opacity: 0; transform: translateY(14px) scale(0.985); }
  53% { opacity: 1; transform: translateY(0) scale(1); }
  69% { opacity: 1; transform: translateY(0) scale(1); }
  75% { opacity: 0; transform: translateY(-12px) scale(0.99); }
  100% { opacity: 0; transform: translateY(-12px) scale(0.99); }
}
@keyframes shifa-s4 {
  0%, 74% { opacity: 0; transform: translateY(14px) scale(0.985); }
  78% { opacity: 1; transform: translateY(0) scale(1); }
  95% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-12px) scale(0.99); }
}
@keyframes shifa-type {
  from { width: 0; }
  to { width: 8ch; }
}
@keyframes shifa-caret {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes shifa-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.shifa-screen { position: absolute; inset: 0; }
.shifa-s1 { animation: shifa-s1 14s linear infinite; }
.shifa-s2 { animation: shifa-s2 14s linear infinite; }
.shifa-s3 { animation: shifa-s3 14s linear infinite; }
.shifa-s4 { animation: shifa-s4 14s linear infinite; }
.shifa-type {
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  vertical-align: bottom;
  width: 0;
  animation: shifa-type 1.5s steps(8, end) 3.8s both;
}
.shifa-caret { animation: shifa-caret 0.9s linear infinite; }
.shifa-pop { opacity: 0; animation: shifa-pop 0.5s ease-out forwards; }
@media (prefers-reduced-motion: reduce) {
  .shifa-s1, .shifa-s2, .shifa-s3, .shifa-s4, .shifa-type, .shifa-caret, .shifa-pop { animation: none !important; }
  .shifa-s4 { opacity: 1; transform: none; }
  .shifa-s1, .shifa-s2, .shifa-s3 { opacity: 0; transform: none; }
  .shifa-pop { opacity: 1; transform: none; }
}
`;

const MENU_TILES: { label: string; icon: LucideIcon; tint: string }[] = [
  { label: "بحث", icon: Search, tint: "bg-teal-50 text-teal-600" },
  { label: "الخريطة", icon: MapPin, tint: "bg-teal-100 text-teal-700" },
  { label: "المفضلة", icon: Heart, tint: "bg-teal-200/70 text-teal-800" },
  { label: "الصيدليات", icon: Store, tint: "bg-teal-600 text-teal-100" },
];

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-slate-900">
      <span className="tabular-nums">9:41</span>
      <span className="flex items-center gap-1 text-slate-500">
        <Wifi className="h-3 w-3" />
        <Battery className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function AppHeader() {
  return (
    <div className="flex items-center gap-1.5">
      <Image
        src="/shifa-logo.png"
        alt=""
        width={22}
        height={22}
        className="h-[22px] w-[22px] rounded-md object-contain ring-1 ring-slate-900/10"
      />
      <span className="text-[13px] font-bold text-teal-600">Shifa</span>
      <span className="ms-auto text-slate-300">
        <Bell className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function SearchBar({ value, placeholder }: { value?: string; placeholder?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      {value ? (
        <>
          <span dir="ltr" className="text-[11px] font-semibold tracking-wide text-slate-900">
            {value}
          </span>
          <span className="ms-auto text-slate-300">
            <X className="h-3.5 w-3.5" />
          </span>
        </>
      ) : (
        <span className="text-[10px] text-slate-400">{placeholder}</span>
      )}
    </div>
  );
}

function ProductCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_10px_28px_-14px_rgba(2,20,50,0.28)]">
      <div className="flex items-start gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600">
          <Package className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p dir="ltr" className="text-[13px] font-bold tracking-wide text-slate-900">
            REMIDINE
          </p>
          <p className="text-[10px] text-slate-500">باراسيتامول 500 مغ · أقراص</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-600">
          <Check className="h-3 w-3" />
          متوفر
        </span>
        <span className="text-[10px] font-semibold text-teal-600">3 صيدليات قريبة</span>
      </div>
    </div>
  );
}

function PharmacyRow() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-teal-200/70 bg-teal-50/60 p-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-600 text-teal-200">
        <Store className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-slate-900">صيدلية</p>
        <p className="text-[10px] text-slate-500">على بعد 0.8 كم · مفتوحة</p>
      </div>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-600 text-white">
        <Phone className="h-3.5 w-3.5" />
      </span>
      <span className="grid h-7 w-7 place-items-center rounded-full border border-teal-200 bg-white text-teal-600">
        <Navigation className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

/** Samsung-style handset whose screen loops through the customer app flow. */
function PhoneMockup() {
  return (
    <div className="relative mx-auto" aria-hidden="true">
      <style>{PHONE_CSS}</style>
      <div
        className="absolute -inset-10 rounded-[3rem] bg-gradient-to-b from-teal-200/60 via-teal-100/40 to-transparent blur-2xl"
        aria-hidden
      />
      <div className="relative rounded-[2.75rem] bg-slate-900 p-[10px] shadow-[0_48px_90px_-28px_rgba(2,20,50,0.55)] ring-1 ring-white/10">
        {/* side keys */}
        <div className="absolute -right-[2px] top-24 h-12 w-[3px] rounded-r-full bg-slate-700" />
        <div className="absolute -left-[2px] top-16 h-16 w-[3px] rounded-l-full bg-slate-700" />

        <div className="relative h-[500px] w-[240px] overflow-hidden rounded-[2.25rem] bg-white sm:h-[560px] sm:w-[270px]">
          {/* punch-hole camera */}
          <div className="absolute left-1/2 top-2 z-20 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-black" />

          {/* 1 - menu / home */}
          <div className="shifa-screen shifa-s1 flex flex-col gap-2.5 px-3.5 pb-3 pt-3">
            <StatusBar />
            <AppHeader />
            <p className="mt-1 text-[12px] font-bold text-slate-800">أهلاً بك 👋</p>
            <p className="-mt-1.5 text-[10px] text-slate-500">ابحث عن دوائك القريب</p>
            <SearchBar placeholder="ابحث عن دواء…" />
            <div className="mt-1 grid grid-cols-2 gap-2">
              {MENU_TILES.map((tile, i) => (
                <div
                  key={tile.label}
                  className="shifa-pop flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2.5"
                  style={{ animationDelay: `${0.25 + i * 0.12}s` }}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tile.tint}`}>
                    <tile.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-semibold text-slate-700">{tile.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2 - search with REMIDINE typed */}
          <div className="shifa-screen shifa-s2 flex flex-col gap-2.5 px-3.5 pb-3 pt-3">
            <StatusBar />
            <AppHeader />
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-teal-600" />
              <span dir="ltr" className="flex items-center text-[11px] font-semibold text-slate-900">
                <span className="shifa-type font-mono tracking-tight">REMIDINE</span>
                <span className="shifa-caret ml-[1px] h-3.5 w-[1.5px] bg-teal-600" />
              </span>
            </div>
            <div className="flex items-center gap-1 px-1 text-[10px] font-medium text-slate-500">
              <span className="h-1 w-1 animate-pulse rounded-full bg-teal-500" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-teal-500 [animation-delay:0.15s]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-teal-500 [animation-delay:0.3s]" />
              <span className="ms-1">جارٍ البحث…</span>
            </div>
            <div className="mt-1 space-y-2">
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-10 animate-pulse rounded-xl bg-slate-100 [animation-delay:0.12s]" />
              <div className="h-10 animate-pulse rounded-xl bg-slate-100 [animation-delay:0.24s]" />
            </div>
          </div>

          {/* 3 - product discovery card */}
          <div className="shifa-screen shifa-s3 flex flex-col gap-2.5 px-3.5 pb-3 pt-3">
            <StatusBar />
            <AppHeader />
            <SearchBar value="REMIDINE" />
            <ProductCard />
          </div>

          {/* 4 - product card + pharmacy name */}
          <div className="shifa-screen shifa-s4 flex flex-col gap-2.5 px-3.5 pb-3 pt-3">
            <StatusBar />
            <AppHeader />
            <SearchBar value="REMIDINE" />
            <ProductCard />
            <PharmacyRow />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A single vertical download card (logo -> name -> note -> button). */
function AppBar({
  href,
  name,
  note,
  cta,
  variant = "light",
}: {
  href: string;
  name: string;
  note: React.ReactNode;
  cta: string;
  variant?: "light" | "navy";
}) {
  if (variant === "navy") {
    return (
      <a
        href={href}
        download
        className="group relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-b from-teal-600 via-teal-700 to-teal-900 p-8 text-center shadow-[0_1px_2px_rgba(0,10,26,0.5),0_28px_56px_-28px_rgba(0,10,26,0.65)] ring-1 ring-teal-800/60 transition duration-300 hover:-translate-y-1"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-200/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-teal-400/10 blur-3xl" />
        <Image
          src="/shifa-logo.png"
          alt=""
          width={64}
          height={64}
          className="relative h-16 w-16 rounded-2xl bg-white p-1.5 object-contain shadow-lg ring-1 ring-white/40"
        />
        <div className="relative">
          <p className="text-2xl font-semibold tracking-tight text-white">{name}</p>
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-teal-200/20 px-3 py-1 text-xs font-semibold text-teal-200 ring-1 ring-teal-200/40">
            <Store className="h-3.5 w-3.5" />
            {note}
          </span>
        </div>
        <span className="relative inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-teal-700 shadow-lg shadow-black/20 transition group-hover:bg-teal-50">
          <Download className="h-4 w-4" />
          {cta}
        </span>
      </a>
    );
  }

  return (
    <a
      href={href}
      download
      className="group relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_1px_2px_rgba(2,20,50,0.04),0_28px_56px_-28px_rgba(2,20,50,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(2,20,50,0.06),0_36px_72px_-28px_rgba(2,20,50,0.3)]"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-teal-100/50 blur-3xl" />
      <Image
        src="/shifa-logo.png"
        alt=""
        width={64}
        height={64}
        className="relative h-16 w-16 rounded-2xl object-contain shadow-sm ring-1 ring-slate-900/5"
      />
      <div className="relative">
        <p className="text-2xl font-semibold tracking-tight text-slate-900">{name}</p>
        <p className="mt-2 text-sm font-medium text-slate-500">{note}</p>
      </div>
      <span className="relative inline-flex h-12 items-center gap-2 rounded-full bg-teal-600 px-7 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition group-hover:bg-teal-700">
        <Download className="h-4 w-4" />
        {cta}
      </span>
    </a>
  );
}

export function DownloadSection() {
  const { t } = useLanguage();

  return (
    <section
      id="download"
      className="border-t border-slate-200 bg-gradient-to-b from-white via-teal-50/50 to-white py-24 md:py-28"
    >
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
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 md:gap-8">
          {/* Customer app - bar + looping phone demo beneath it */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            className="flex flex-col gap-6 md:gap-8"
          >
            <AppBar href="/shifa.apk" name="Shifa" note={t("landing.download.note")} cta={t("landing.download.cta")} />
            <PhoneMockup />
          </motion.div>

          {/* Pro app - for pharmacies */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="flex flex-col"
          >
            <AppBar
              href="/shifa-pro.apk"
              name="Shifa Pro"
              note={t("landing.download.pro.for")}
              cta={t("landing.download.pro.cta")}
              variant="navy"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
