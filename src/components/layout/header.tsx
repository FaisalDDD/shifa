"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { SearchBox } from "@/components/layout/search-box";
import { useLanguage, type Language } from "@/lib/i18n";

export function Header() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [user, setUser] = useState<{ email?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setOpen(false);
    router.refresh();
  }

  const langSelect = (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Language)}
      aria-label="Language"
      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700"
    >
      <option value="en">English</option>
      <option value="ar">العربية</option>
    </select>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4">
        <div className="flex items-center justify-start">
          <div className="hidden md:block">
            <SearchBox />
          </div>
        </div>
        <div className="flex items-center justify-center px-4">
          <Logo />
        </div>

        <div className="flex items-center justify-end gap-3">
          {langSelect}
          <div className="hidden items-center gap-3 md:flex">
            {loading ? null : user ? (
              <>
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <User className="h-4 w-4" aria-hidden />
                  {t("nav.dashboard")}
                </Link>
                <Link
                  href="/pharmacy"
                  className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {t("nav.pharmacy")}
                </Link>
                <button
                  onClick={signOut}
                  className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  {t("nav.signOut")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex h-10 items-center rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700"
                >
                  {t("nav.signUp")}
                </Link>
              </>
            )}
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden" aria-label="Mobile">
          <div className="mt-2 border-t border-slate-200 pt-2">
            {loading ? null : user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {t("nav.dashboard")}
                </Link>
                <Link
                  href="/pharmacy"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {t("nav.pharmacy")}
                </Link>
                <button
                  onClick={signOut}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {t("nav.signOut")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
                >
                  {t("nav.signUp")}
                </Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
