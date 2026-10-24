"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, Download, Globe2, HelpCircle, MapPin, MonitorDown, Phone, ShieldCheck, Unplug, UserRound } from "lucide-react";
import type { Pharmacy } from "@/types";
import { useLanguage, type Language } from "@/lib/i18n";
import type { ProRelease } from "@/services/pharmacy-portal/pro-release";
import { savePortalChange } from "./portal-request";
import { PortalProfile } from "./portal-profile";

const card = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6";
const action = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50";
const local = (lang: Language) => (en: string, ar: string) => lang === "ar" ? ar : en;

interface PortalProps {
  pharmacies: Pharmacy[];
  ownerPharmacyIds?: string[];
  release?: ProRelease | null;
}

export function PharmacyDashboard({ pharmacies, ownerPharmacyIds = [], release = null }: PortalProps) {
  const { lang } = useLanguage();
  const l = local(lang);
  const [activeId, setActiveId] = useState(pharmacies[0]?.id ?? "");
  const [updates, setUpdates] = useState<Record<string, Pharmacy>>({});
  const selected = pharmacies.find((p) => p.id === activeId) ?? pharmacies[0];
  const pharmacy = selected ? updates[selected.id] ?? selected : null;
  const owner = pharmacy ? ownerPharmacyIds.includes(pharmacy.id) : false;
  const onSaved = (updated: Pharmacy) => setUpdates((previous) => ({ ...previous, [updated.id]: updated }));
  const navigation = [
    { href: "#overview", title: l("Overview", "نظرة عامة"), icon: Building2 },
    { href: "#profile", title: l("Pharmacy profile", "ملف الصيدلية"), icon: Globe2 },
    ...(owner && pharmacy?.business_id ? [{ href: `/pharmacy/branches/register?business_id=${encodeURIComponent(pharmacy.business_id)}`, title: l("Register branch", "تسجيل فرع"), icon: MapPin }] : []),
    { href: "#pro", title: "Shifa Pro", icon: MonitorDown },
    { href: "/dashboard", title: l("My account", "حسابي"), icon: UserRound },
    { href: "/help", title: l("Help centre", "مركز المساعدة"), icon: HelpCircle },
  ];

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="flex flex-col bg-[#10243b] p-6 text-white lg:p-7">
          <Link href="/pharmacy" className="flex items-center gap-3 text-xl font-bold tracking-tight"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-[#10243b]"><Building2 size={22} aria-hidden /></span> Shifa <span className="text-xs font-medium text-sky-200">WEB</span></Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-sky-200">{l("Pharmacy portal", "بوابة الصيدلية")}</p>
          <nav aria-label={l("Portal navigation", "التنقل في البوابة")} className="mt-3 flex flex-wrap gap-1 lg:flex-col">
            {navigation.filter((item) => pharmacy || item.href !== "#profile").map((item) => <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"><item.icon size={18} aria-hidden />{item.title}</Link>)}
          </nav>
          <div className="mt-8 hidden rounded-xl border border-white/10 bg-white/5 p-4 lg:mt-auto lg:block"><p className="text-sm font-semibold text-sky-100">{l("A lighter way to stay visible.", "حضور أوضح بخطوات أبسط.")}</p><p className="mt-2 text-xs leading-5 text-slate-300">{l("Your public presence lives here. Day-to-day pharmacy work belongs in Pro.", "أدر حضور صيدليتك هنا، واستخدم Pro للعمل اليومي.")}</p></div>
        </aside>
        <main className="min-w-0 p-4 sm:p-7 lg:p-8">
          <header id="overview" className="scroll-mt-24 border-b border-slate-200 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-widest text-sky-700">SHIFA / {l("WORKSPACE", "مساحة العمل")}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{l("Your pharmacy, at a glance.", "صيدليتك في لمحة.")}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{l("Keep your listing clear, help people find you, and get started with Shifa Pro.", "حدّث معلومات صيدليتك وساعد الناس في العثور عليك وابدأ مع Shifa Pro.")}</p></div>
              {pharmacy && <div className="w-full sm:w-60"><label htmlFor="portal-branch" className="mb-1.5 block text-xs font-semibold text-slate-500">{l("Branch / public listing", "الفرع / الصفحة العامة")}</label><select id="portal-branch" value={pharmacy.id} onChange={(event) => setActiveId(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-sky-500">{pharmacies.map((p) => <option value={p.id} key={p.id}>{p.branch_name || p.name}{p.branch_code ? ` · ${p.branch_code}` : ""}</option>)}</select></div>}
            </div>
          </header>
          {!pharmacy ? <section className={`${card} mt-6 text-center`}><Building2 className="mx-auto text-sky-600" size={36} aria-hidden /><h2 className="mt-4 text-xl font-bold text-slate-900">{l("Your first listing starts here", "ابدأ بصفحة صيدليتك الأولى")}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{l("Register a pharmacy to create a public listing. Our team will review it before verification.", "سجّل صيدليتك لإنشاء صفحة عامة. سيراجع فريقنا المعلومات قبل التوثيق.")}</p><Link href="/pharmacy/register" className={`${action} mt-5 bg-sky-600 text-white hover:bg-sky-700`}>{l("Register a pharmacy", "تسجيل صيدلية")}</Link></section> : <>
            {!owner && <p className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{l("Read-only access. Only a listing owner can change its profile or availability.", "صلاحية عرض فقط. يمكن لمالك الصيدلية وحده تعديل الملف أو حالة التوفر.")}</p>}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <VerificationCard pharmacy={pharmacy} lang={lang} />
              <section className={card}><div className="flex items-center gap-3"><span className="rounded-xl bg-slate-100 p-2.5 text-slate-500"><Unplug size={20} aria-hidden /></span><div><p className="text-xs font-semibold text-slate-500">{l("Pro connection", "اتصال Pro")}</p><h2 className="mt-0.5 font-bold text-slate-900">{l("Connection unknown", "حالة الاتصال غير معروفة")}</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{l("No verified device heartbeat is available. Installing Pro does not confirm a connection or a successful sync.", "لا تتوفر إشارة اتصال موثوقة من الجهاز. تثبيت Pro لا يؤكد الاتصال أو نجاح المزامنة.")}</p><a href="#pro" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline">{l("Get the desktop app", "الحصول على تطبيق الكمبيوتر")}<ArrowUpRight size={15} aria-hidden /></a></section>
            </div>
            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <PortalProfile key={pharmacy.id} pharmacy={pharmacy} owner={owner} lang={lang} onSaved={onSaved} />
              <div className="space-y-6"><ListingCard pharmacy={pharmacy} lang={lang} /><AvailabilityCard key={pharmacy.id} pharmacy={pharmacy} owner={owner} lang={lang} onSaved={onSaved} /></div>
            </div>
          </>}
          <section id="pro" className="relative mt-6 scroll-mt-24 overflow-hidden rounded-2xl bg-[#10243b] p-6 text-white sm:p-8">
            <div className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full border-[36px] border-sky-400/10" aria-hidden />
            <div className="relative flex flex-wrap items-start justify-between gap-6"><div className="max-w-lg"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-200"><MonitorDown size={14} aria-hidden /> SHIFA PRO · WINDOWS</div><h2 className="text-2xl font-bold tracking-tight">{l("The desktop for your daily work.", "تطبيق الكمبيوتر لعملك اليومي.")}</h2><p className="mt-3 text-sm leading-6 text-slate-300">{l("Download Shifa Pro for pharmacy operations. This web portal stays focused on your listing, verification and account.", "حمّل Shifa Pro لإدارة عمليات الصيدلية. تركز هذه البوابة على الصفحة العامة والتوثيق والحساب.")}</p><p className="mt-3 text-xs leading-5 text-sky-200">{l("Next: install on your Windows computer, sign in, and follow the setup in Pro. Live connection reporting is not available here yet.", "التالي: ثبّت التطبيق على Windows وسجّل الدخول واتبع خطوات الإعداد في Pro. متابعة الاتصال المباشر غير متاحة هنا بعد.")}</p></div><div className="relative w-full sm:w-auto sm:min-w-52">{release ? <><a href={release.downloadUrl} className={`${action} w-full bg-sky-400 text-slate-950 hover:bg-sky-300`}><Download size={18} aria-hidden />{l("Download for Windows", "تنزيل لـ Windows")}</a><p className="mt-3 text-xs text-slate-300" dir="ltr">v{release.version}{release.sizeBytes > 0 ? ` · ${(release.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ""} · .exe</p><p className="mt-1 text-xs text-slate-400">{l("Installer ready to download", "ملف التثبيت جاهز للتنزيل")}</p></> : <div className="rounded-xl border border-white/15 bg-white/5 p-4"><p className="text-sm font-semibold">{l("Installer unavailable", "ملف التثبيت غير متاح")}</p><p className="mt-1 max-w-60 text-xs leading-5 text-slate-300">{l("No Windows release is available on this server. Contact support for installation help.", "لا يوجد إصدار Windows على هذا الخادم. تواصل مع الدعم للمساعدة في التثبيت.")}</p><Link href="/contact" className="mt-3 inline-block text-sm font-semibold text-sky-200 hover:underline">{l("Contact support", "التواصل مع الدعم")}</Link></div>}</div></div>
          </section>
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs leading-5 text-slate-500"><p>{l("Delivery and notification settings are not available in this portal yet.", "إعدادات التوصيل والإشعارات غير متاحة في هذه البوابة بعد.")}</p><div className="flex gap-4"><Link href="/dashboard" className="hover:text-sky-700">{l("My account", "حسابي")}</Link><Link href="/contact" className="hover:text-sky-700">{l("Contact support", "التواصل مع الدعم")}</Link></div></footer>
        </main>
      </div>
    </div>
  );
}

function VerificationCard({ pharmacy, lang }: { pharmacy: Pharmacy; lang: Language }) {
  const l = local(lang);
  const statuses = {
    pending: [l("Pending review", "قيد المراجعة"), l("Your listing is awaiting review. Contact support if your details need correcting; verification cannot be completed from this portal.", "صفحتك بانتظار المراجعة. تواصل مع الدعم لتصحيح المعلومات؛ لا يمكن إتمام التوثيق من هذه البوابة.")],
    verified: [l("Verified listing", "صفحة موثقة"), l("Your pharmacy identity has been verified. Keep contact details and opening hours current.", "تم توثيق هوية صيدليتك. احرص على تحديث معلومات التواصل وساعات العمل.")],
    rejected: [l("Review needed", "تحتاج إلى مراجعة"), l("Your listing was not verified. Contact support to review the required information before another review.", "لم يتم توثيق صفحتك. تواصل مع الدعم لمراجعة المعلومات المطلوبة قبل إعادة المراجعة.")],
    suspended: [l("Listing suspended", "الصفحة موقوفة"), l("Contact support to resolve your listing status. Profile edits do not restore verification.", "تواصل مع الدعم لمعالجة حالة الصفحة. تعديل الملف لا يعيد التوثيق.")],
  };
  const status = statuses[pharmacy.verification_status];
  return <section className={card}><div className="flex items-center gap-3"><span className={`rounded-xl p-2.5 ${pharmacy.verification_status === "verified" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}><ShieldCheck size={20} aria-hidden /></span><div><p className="text-xs font-semibold text-slate-500">{l("Verification", "التوثيق")}</p><h2 className="mt-0.5 font-bold text-slate-900">{status[0]}</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{status[1]}</p><Link href="/contact" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline">{l("Verification support", "دعم التوثيق")}<ArrowUpRight size={15} aria-hidden /></Link></section>;
}

function ListingCard({ pharmacy: p, lang }: { pharmacy: Pharmacy; lang: Language }) {
  const l = local(lang);
  return <section className={card} aria-labelledby="listing-heading"><p className="text-xs font-bold uppercase tracking-widest text-sky-700">{l("PUBLIC PRESENCE", "حضورك العام")}</p><h2 id="listing-heading" className="mt-2 text-lg font-bold text-slate-900">{l("Your listing preview", "معاينة صفحتك")}</h2><div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-sky-100 p-3 text-sky-700"><Building2 size={22} aria-hidden /></span><h3 className="font-bold text-slate-900">{p.name}</h3></div><p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600"><MapPin className="mt-1 shrink-0" size={15} aria-hidden />{[p.address, p.city].filter(Boolean).join(", ")}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Phone size={15} aria-hidden /><bdi>{p.phone || l("Phone not added", "لم يُضف رقم هاتف")}</bdi></p>{p.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">{p.description}</p>}</div><p className="mt-3 text-xs leading-5 text-slate-500">{l("Preview of saved details, not a guarantee of public visibility or medicine stock.", "معاينة للمعلومات المحفوظة، وليست ضماناً للظهور العام أو لتوفر الأدوية.")}</p>{!p.is_active && <p className="mt-2 text-xs font-semibold text-amber-700">{l("This listing is inactive. Contact support.", "هذه الصفحة غير نشطة. تواصل مع الدعم.")}</p>}<Link href={`/pharmacies/${p.slug}`} className={`${action} mt-4 w-full border border-slate-300 text-slate-700 hover:bg-slate-50`}>{l("Open public listing", "فتح الصفحة العامة")}<ArrowUpRight size={16} aria-hidden /></Link></section>;
}

function AvailabilityCard({ pharmacy, owner, lang, onSaved }: { pharmacy: Pharmacy; owner: boolean; lang: Language; onSaved: (p: Pharmacy) => void }) {
  const l = local(lang);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"saved" | "error" | null>(null);
  async function toggle() {
    setBusy(true); setStatus(null);
    try { onSaved(await savePortalChange("availability", { pharmacy_id: pharmacy.id, is_available: !pharmacy.is_available })); setStatus("saved"); }
    catch { setStatus("error"); }
    finally { setBusy(false); }
  }
  return <section className={card}><div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">{l("Temporary availability", "حالة التوفر المؤقتة")}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pharmacy.is_available ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800"}`}>{pharmacy.is_available ? l("Available", "متاحة") : l("Unavailable", "غير متاحة")}</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{l("Pause your pharmacy’s availability when needed. This stays in effect until the owner changes it back; it does not change opening hours or medicine stock.", "أوقف توفر صيدليتك عند الحاجة. تبقى الحالة حتى يغيّرها المالك؛ لا تتغير ساعات العمل أو مخزون الأدوية.")}</p><button type="button" disabled={!owner || busy} onClick={toggle} className={`${action} mt-4 w-full border border-slate-300 text-slate-700 hover:bg-slate-50`}>{busy ? l("Saving…", "جارٍ الحفظ…") : pharmacy.is_available ? l("Set temporarily unavailable", "ضبط كغير متاحة مؤقتاً") : l("Restore availability", "استعادة التوفر")}</button>{!owner && <p className="mt-2 text-xs text-slate-500">{l("Owner access required", "تتطلب صلاحية المالك")}</p>}{status && <p role={status === "saved" ? "status" : "alert"} className={`mt-3 text-sm leading-6 ${status === "saved" ? "text-sky-800" : "text-rose-700"}`}>{status === "saved" ? l("Changes saved.", "تم حفظ التغييرات.") : l("Could not save. The displayed availability has not changed. Check your connection and owner access, then try again.", "تعذر الحفظ. لم تتغير حالة التوفر المعروضة. تحقق من الاتصال وصلاحية المالك ثم حاول مجدداً.")}</p>}</section>;
}
