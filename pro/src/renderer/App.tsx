import { useEffect, useState } from "react";
import type { AuthSession } from "../shared/types";
import type { Lang } from "./i18n";
import { Login } from "./screens/Login";
import { Pos } from "./screens/Pos";

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => {
      if (!localStorage.getItem("shifa-theme-v2")) {
        localStorage.setItem("shifa-theme-v2", "1");
        return "dark";
      }
      return (localStorage.getItem("shifa-theme") as "light" | "dark") || "dark";
    },
  );
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem("shifa-lang") as Lang) || "en",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("shifa-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    localStorage.setItem("shifa-lang", lang);
  }, [lang]);

  if (!session) {
    return <Login onSignedIn={setSession} lang={lang} />;
  }
  return (
    <Pos
      session={session}
      onSignOut={() => setSession(null)}
      lang={lang}
      setLang={setLang}
      theme={theme}
      setTheme={setTheme}
    />
  );
}
