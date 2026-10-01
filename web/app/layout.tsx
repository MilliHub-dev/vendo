import type { Metadata, Viewport } from "next";
import { Caveat, Outfit } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScrollReveal } from "@/components/ScrollReveal";
import { JsonLd } from "@/components/JsonLd";
import { site } from "@/lib/site";
import { OG_IMAGE, baseKeywords, organizationSchema } from "@/lib/seo";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: ["600"], variable: "--font-caveat", display: "swap" });

// Search-result snippet (≤160 chars); the longer site.description feeds structured data and llms.txt.
const metaDescription =
  "Food delivery and same-day bike dispatch in Abuja, Kaduna, Kano and Lagos. Book on WhatsApp in minutes with the price upfront. Vendo app coming soon.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_SITE_URL to the production domain so social previews use absolute URLs.
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — Food Delivery & Dispatch in Abuja, Kaduna, Kano, Lagos`, template: `%s | ${site.name}` },
  description: metaDescription,
  applicationName: site.name,
  keywords: baseKeywords,
  authors: [{ name: site.legalName, url: site.url }],
  creator: site.legalName,
  publisher: site.legalName,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  category: "Delivery & Logistics",
  formatDetection: { telephone: true, email: true, address: true },
  icons: { icon: [{ url: "/favicon.png", type: "image/png" }], apple: "/apple-touch-icon.png" },
  openGraph: {
    title: `${site.name} — ${site.tagline}`,
    description: metaDescription,
    url: "/",
    siteName: site.name,
    images: [OG_IMAGE],
    locale: "en_NG",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: `${site.name} — ${site.tagline}`, description: metaDescription, images: [OG_IMAGE.url] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1830" },
  ],
};

// Runs before first paint so the page never flashes the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem("vendo-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${outfit.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable summary" />
      </head>
      <body>
        <JsonLd data={organizationSchema()} />
        <Header />
        <main>{children}</main>
        <Footer />
        <ScrollReveal />
      </body>
    </html>
  );
}
