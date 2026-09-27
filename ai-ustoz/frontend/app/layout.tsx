import type { Metadata, Viewport } from "next";

import PwaRegister from "@/components/PwaRegister";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Ustoz — DTM va Milliy Sertifikat repetitori",
  description: "Kimyo va Biologiyadan 0 dan 189 ballgacha olib chiqadigan AI repetitor.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#a855f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
