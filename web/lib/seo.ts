import type { Metadata } from "next";
import { site } from "./site";
import type { Faq } from "./faq";

export const OG_IMAGE = { url: "/og/vendo-og.jpg", width: 1200, height: 630, alt: "Vendo — fast, reliable food delivery and bike dispatch in Nigeria" };

/** Per-page metadata with canonical URL, Open Graph and Twitter card. `path` like "/about/". */
export function pageMetadata({ title, description, path, keywords = [] }: { title: string; description: string; path: string; keywords?: string[] }): Metadata {
  return {
    title,
    description,
    keywords: [...keywords, ...baseKeywords],
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, siteName: site.name, title: `${title} | ${site.name}`, description, locale: "en_NG", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: `${title} | ${site.name}`, description, images: [OG_IMAGE.url] },
  };
}

export const baseKeywords = [
  "Vendo",
  "delivery service Nigeria",
  "food delivery",
  "dispatch rider",
  "bike delivery",
  "same-day delivery",
  "send a package",
  ...site.cities.flatMap((c) => [`food delivery ${c}`, `dispatch rider ${c}`, `delivery service ${c}`]),
];

const abs = (path: string) => `${site.url}${path}`;
const ORG_ID = `${site.url}/#organization`;

/** Organization + LocalBusiness (head office) + WebSite — emitted on every page. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "LocalBusiness"],
        "@id": ORG_ID,
        name: site.legalName,
        alternateName: site.name,
        slogan: site.tagline,
        description: site.description,
        url: abs("/"),
        logo: abs("/brand/app-icon.png"),
        image: abs(OG_IMAGE.url),
        email: site.email,
        telephone: site.phones.map((p) => `+234${p.replace(/^0/, "")}`),
        address: {
          "@type": "PostalAddress",
          streetAddress: "No. 15 Kawo Road",
          addressLocality: "Kaduna",
          addressRegion: "Kaduna State",
          addressCountry: "NG",
        },
        areaServed: site.cities.map((c) => ({ "@type": "City", name: c, containedInPlace: { "@type": "Country", name: "Nigeria" } })),
        sameAs: Object.values(site.socials),
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer service",
            telephone: `+${site.whatsapp}`,
            email: site.email,
            areaServed: "NG",
            availableLanguage: ["English"],
          },
        ],
        knowsAbout: ["Food delivery", "Courier services", "Motorcycle dispatch", "Last-mile logistics"],
      },
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        url: abs("/"),
        name: site.name,
        description: site.description,
        inLanguage: "en-NG",
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

/** The two services, with where they're offered. */
export function servicesSchema() {
  const areaServed = site.cities.map((c) => ({ "@type": "City", name: c }));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Vendo Food Court — food delivery",
        serviceType: "Food delivery",
        description: "Order from local restaurants, fast food, drinks, groceries and pharmacies, delivered by a nearby Vendo rider with live tracking.",
        provider: { "@id": ORG_ID },
        areaServed,
      },
      {
        "@type": "Service",
        name: "Vendo Dispatch — same-day bike delivery",
        serviceType: "Courier service",
        description:
          "Same-day motorcycle dispatch for documents and parcels. Priced by distance and package size, with one-time-code delivery confirmation. Scheduled deliveries available.",
        provider: { "@id": ORG_ID },
        areaServed,
        offers: { "@type": "Offer", priceCurrency: "NGN", description: "Price by distance and package size, shown before booking." },
      },
    ],
  };
}

export function faqSchema(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}
