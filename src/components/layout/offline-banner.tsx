"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

/** Persistent "You are offline" banner shown when the browser is offline. */
export function OfflineBanner() {
  const { t } = useLanguage();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white" role="status">
      <WifiOff className="h-4 w-4" aria-hidden />
      {t("offline.banner")}
    </div>
  );
}
