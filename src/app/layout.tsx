import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: {
    default: "Shifa — Find your pharmacy. Know before you go.",
    template: "%s · Shifa",
  },
  description:
    "Search nearby pharmacies, check reported availability, and contact the pharmacy before you travel.",
  applicationName: "Shifa",
};

export const viewport: Viewport = {
  themeColor: "#002a68",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <LanguageProvider>
          <OfflineBanner />
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
