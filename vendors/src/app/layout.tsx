import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";

import { Providers } from "@/components/Providers";
import { themeScript } from "@/components/ThemeToggle";

import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Vendo Vendor", template: "%s · Vendo Vendor" },
  description: "Manage your store on Vendo: take orders, update your menu and track your payouts.",
  icons: { icon: [{ url: "/favicon.png", type: "image/png" }], apple: "/apple-touch-icon.png" },
  robots: { index: false, follow: false }, // a private dashboard, not for search engines
};

export const viewport: Viewport = { themeColor: "#0064FF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={outfit.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
