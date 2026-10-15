import type { Metadata, Viewport } from "next";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export const metadata: Metadata = {
  title: "Benim Payım — Yapay zekâyla çalış. Öğrendiklerini görünür kıl.",
  description:
    "Yapay zekâ desteğiyle kod öğrenenlerin ilk denemesini, aldığı desteği ve çalışma sonunda gösterdiği somut becerileri görünür kılan öğrenme takip platformu.",
  keywords: [
    "kod öğrenme",
    "yapay zeka",
    "öğrenme takibi",
    "öğrenme kartı",
    "kodlama",
    "yazılım eğitimi",
    "pedagojik yapay zeka",
  ],
  authors: [{ name: "Benim Payım" }],
  openGraph: {
    title: "Benim Payım — Yapay zekâyla çalış. Öğrendiklerini görünür kıl.",
    description:
      "İlk denemeni, aldığın desteği ve çalışma sonunda gösterebildiklerini tek yerde kaydet.",
    url: "https://benim-payim.vercel.app",
    siteName: "Benim Payım",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Benim Payım — Yapay zekâyla çalış. Öğrendiklerini görünür kıl.",
    description:
      "İlk denemeni, aldığın desteği ve çalışma sonunda gösterebildiklerini tek yerde kaydet.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="scroll-smooth">
      <body className="min-h-screen flex flex-col bg-[#FAF9F6] text-stone-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
        <Navbar />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-stone-200 bg-white/70 py-6 text-center text-xs text-stone-500">
          <p>Benim Payım — Yardım almak öğrenmenin doğal ve geçerli bir parçasıdır.</p>
        </footer>
      </body>
    </html>
  );
}
