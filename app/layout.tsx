/**
 * [F006][S001]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Root layout: fonts and global providers shell.
 */

import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import Providers from "../components/providers";
import PwaRegister from "../components/pwa-register";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zomate Fitness",
  description: "Zomate PT 管理系統 — 學員登記、報課、簽到與後台管理。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Zomate" },
  icons: { icon: "/zomate-icon.svg", apple: "/zomate-icon.svg" }
};

/** [F006][S005] Mobile viewport and PWA theme chrome. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e8a598"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-HK">
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
