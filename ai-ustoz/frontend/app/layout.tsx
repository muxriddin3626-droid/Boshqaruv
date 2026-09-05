import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Ustoz — DTM va Milliy Sertifikat repetitori",
  description: "Kimyo va Biologiyadan 0 dan 189 ballgacha olib chiqadigan AI repetitor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
