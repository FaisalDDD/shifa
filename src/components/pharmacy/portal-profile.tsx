"use client";

import React, { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Clock3, LockKeyhole } from "lucide-react";
import type { OpeningHour, Pharmacy } from "@/types";
import type { Language } from "@/lib/i18n";
import { portalProfileSchema } from "@/services/pharmacy-portal/validation";
import { savePortalChange } from "./portal-request";

const action = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50";
const input = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50";

export function PortalProfile({ pharmacy: p, owner, lang, onSaved }: { pharmacy: Pharmacy; owner: boolean; lang: Language; onSaved: (p: Pharmacy) => void }) {
  const l = (en: string, ar: string) => lang === "ar" ? ar : en;
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(p.phone ?? "");
  const [website, setWebsite] = useState(p.website ?? "");
  const [description, setDescription] = useState(p.description ?? "");
  const [hours, setHours] = useState<OpeningHour[]>(p.opening_hours ?? []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"saved" | "error" | "invalid" | null>(null);
  const days = lang === "ar" ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function beginEdit() {
    setPhone(p.phone ?? ""); setWebsite(p.website ?? ""); setDescription(p.description ?? ""); setHours(p.opening_hours ?? []); setStatus(null); setEditing(true);
  }
  function changeHour(day: number, value: Partial<OpeningHour> | null) {
    setHours((previous) => value === null ? previous.filter((h) => h.day !== day) : [...previous.filter((h) => h.day !== day), { day, open: null, close: null, closed: false, ...previous.find((h) => h.day === day), ...value }].sort((a, b) => a.day - b.day));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!owner) return;
    const result = portalProfileSchema.safeParse({ pharmacy_id: p.id, changes: { phone: phone.trim() || null, website: website.trim() || null, description: description.trim() || null, opening_hours: hours.length ? hours : null } });
    if (!result.success) { setStatus("invalid"); return; }
    setBusy(true); setStatus(null);
    try { onSaved(await savePortalChange("profile", result.data)); setEditing(false); setStatus("saved"); }
    catch { setStatus("error"); }
    finally { setBusy(false); }
  }

  return <section id="profile" className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="profile-heading">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-sky-700">{l("LISTING DETAILS", "معلومات الصفحة")}</p><h2 id="profile-heading" className="mt-2 text-lg font-bold text-slate-900">{l("Pharmacy profile", "ملف الصيدلية")}</h2></div>{owner && !editing && <button type="button" onClick={beginEdit} className={`${action} bg-sky-50 text-sky-800 hover:bg-sky-100`}>{l("Edit profile", "تعديل الملف")}</button>}</div>
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><LockKeyhole size={14} aria-hidden />{l("Protected identity · read-only", "الهوية المحمية · للقراءة فقط")}</p><p className="mt-2 font-semibold text-slate-900">{p.name}</p><p className="mt-1 text-sm leading-6 text-slate-600">{[p.address, p.city, p.postal_code, p.country_code].filter(Boolean).join(", ")}</p><p className="mt-3 text-xs leading-5 text-slate-500">{l("Name, address and map location changes require identity review. Self-service re-verification is not available yet; contact support before a move or identity change.", "تغيير الاسم أو العنوان أو الموقع يتطلب مراجعة الهوية. إعادة التوثيق الذاتي غير متاحة بعد؛ تواصل مع الدعم قبل النقل أو تغيير الهوية.")}</p><Link href="/contact" className="mt-2 inline-block text-xs font-semibold text-sky-700 hover:underline">{l("Request an identity correction", "طلب تصحيح الهوية")}</Link></div>
    {editing && owner ? <form onSubmit={submit} className="mt-5 space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">{l("Phone", "الهاتف")}<input type="tel" maxLength={50} value={phone} onChange={(e) => setPhone(e.target.value)} className={`${input} mt-1.5`} dir="ltr" /></label>
        <label className="block text-sm font-medium text-slate-700">{l("Website", "الموقع الإلكتروني")}<input type="url" maxLength={500} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className={`${input} mt-1.5`} dir="ltr" /></label>
        <label className="block text-sm font-medium text-slate-700">{l("Public description", "الوصف العام")}<textarea maxLength={2000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${input} mt-1.5`} /></label>
        <div><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Clock3 size={16} aria-hidden />{l("Opening hours", "ساعات العمل")}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{l("One window per day, in the pharmacy’s local time. Overnight windows are supported. Unknown days remain unspecified.", "فترة واحدة يومياً بالتوقيت المحلي للصيدلية. يمكن إدخال فترة ليلية. الأيام غير المعروفة تبقى دون تحديد.")}</p>
          <div className="mt-3 space-y-3">{days.map((day, index) => {
            const hour = hours.find((h) => h.day === index);
            return <div key={day} className="rounded-xl border border-slate-200 p-3">
              <label className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">{day}<select aria-label={`${day} ${l("status", "الحالة")}`} value={!hour ? "unknown" : hour.closed ? "closed" : "open"} onChange={(e) => changeHour(index, e.target.value === "unknown" ? null : { closed: e.target.value === "closed", ...(e.target.value === "closed" ? { open: null, close: null } : {}) })} className="min-h-10 rounded-lg border border-slate-300 bg-white px-2"><option value="unknown">{l("Not specified", "غير محدد")}</option><option value="open">{l("Open", "مفتوحة")}</option><option value="closed">{l("Closed", "مغلقة")}</option></select></label>
              {hour && !hour.closed && <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">{l("Opens", "الفتح")}<input aria-label={`${day} ${l("opens", "الفتح")}`} type="time" required value={hour.open ?? ""} onChange={(e) => changeHour(index, { open: e.target.value || null })} className={`${input} mt-1`} /></label><label className="text-xs text-slate-500">{l("Closes", "الإغلاق")}<input aria-label={`${day} ${l("closes", "الإغلاق")}`} type="time" required value={hour.close ?? ""} onChange={(e) => changeHour(index, { close: e.target.value || null })} className={`${input} mt-1`} /></label></div>}
            </div>;
          })}</div>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className={`${action} bg-sky-600 text-white hover:bg-sky-700`}><Check size={16} aria-hidden />{busy ? l("Saving…", "جارٍ الحفظ…") : l("Save changes", "حفظ التغييرات")}</button><button type="button" disabled={busy} onClick={() => { setEditing(false); setStatus(null); }} className={`${action} border border-slate-300 text-slate-700`}>{l("Cancel", "إلغاء")}</button></div>
    </form> : <div className="mt-5"><dl className="space-y-4 text-sm">
      <div><dt className="text-xs font-semibold text-slate-500">{l("Phone", "الهاتف")}</dt><dd className="mt-1 text-slate-800"><bdi>{p.phone || l("Not added", "غير مضاف")}</bdi></dd></div>
      <div><dt className="text-xs font-semibold text-slate-500">{l("Website", "الموقع الإلكتروني")}</dt><dd className="mt-1 break-words text-slate-800"><bdi>{p.website || l("Not added", "غير مضاف")}</bdi></dd></div>
      <div><dt className="text-xs font-semibold text-slate-500">{l("Public description", "الوصف العام")}</dt><dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-800">{p.description || l("Not added", "غير مضاف")}</dd></div>
    </dl><h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-800"><Clock3 size={16} aria-hidden />{l("Opening hours", "ساعات العمل")}</h3><dl className="mt-3 divide-y divide-slate-100">{days.map((day, index) => { const hour = p.opening_hours?.find((h) => h.day === index); return <div key={day} className="flex items-center justify-between gap-2 py-2 text-xs"><dt className="text-slate-600">{day}</dt><dd className="font-medium text-slate-800">{!hour ? l("Not specified", "غير محدد") : hour.closed ? l("Closed", "مغلقة") : hour.open && hour.close ? <bdi>{hour.open}–{hour.close}</bdi> : l("Not specified", "غير محدد")}</dd></div>; })}</dl></div>}
    {status && <p role={status === "saved" ? "status" : "alert"} className={`mt-3 text-sm leading-6 ${status === "saved" ? "text-sky-800" : "text-rose-700"}`}>{status === "saved" ? l("Changes saved.", "تم حفظ التغييرات.") : status === "invalid" ? l("Check your website URL and opening times. Use HTTP(S) and set both times for every open day.", "تحقق من رابط الموقع وساعات العمل. استخدم HTTP(S) وحدد وقتي الفتح والإغلاق لكل يوم عمل.") : l("Could not save. Your saved details have not changed here. Check your connection and owner access, then try again.", "تعذر الحفظ. لم تتغير المعلومات المحفوظة المعروضة هنا. تحقق من الاتصال وصلاحية المالك ثم حاول مجدداً.")}</p>}
  </section>;
}
