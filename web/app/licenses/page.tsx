import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { site } from "@/lib/site";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Licenses",
  description: "Trademarks, content ownership and the open-source software used by the Vendo website.",
  path: "/licenses/",
  keywords: [],
});

const software = [
  { name: "Next.js", license: "MIT", url: "https://github.com/vercel/next.js" },
  { name: "React / React DOM", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "Lucide icons (lucide-react)", license: "ISC", url: "https://github.com/lucide-icons/lucide" },
  { name: "React Icons", license: "MIT", url: "https://github.com/react-icons/react-icons" },
  { name: "Simple Icons (brand icons via React Icons)", license: "CC0 1.0", url: "https://simpleicons.org" },
  { name: "Outfit typeface", license: "SIL Open Font License 1.1", url: "https://fonts.google.com/specimen/Outfit" },
  { name: "Caveat typeface", license: "SIL Open Font License 1.1", url: "https://fonts.google.com/specimen/Caveat" },
];

const sections: LegalSection[] = [
  {
    id: "trademarks",
    title: "Vendo trademarks",
    body: (
      <p>
        &quot;Vendo&quot;, the Vendo logo and the Vendo arrow mark are trademarks of {site.legalName}. You may not use them without our written
        permission, except to refer to our services accurately.
      </p>
    ),
  },
  {
    id: "content",
    title: "Website content",
    body: (
      <p>
        Text, illustrations and graphics on this website are © {site.legalName} unless stated otherwise. You may share links to our pages, but
        please do not copy or reuse the content or illustrations without permission.
      </p>
    ),
  },
  {
    id: "third-party",
    title: "Third-party marks",
    body: (
      <p>
        Apple and App Store are trademarks of Apple Inc. Google Play and Google Maps are trademarks of Google LLC. WhatsApp, Instagram and Facebook
        are trademarks of Meta Platforms, Inc. TikTok is a trademark of ByteDance Ltd. Paystack is a trademark of Paystack Payments Limited. Their
        use here does not imply endorsement.
      </p>
    ),
  },
  {
    id: "open-source",
    title: "Open-source software",
    body: (
      <>
        <p>This website is built with the following open-source software and fonts. We&apos;re grateful to their authors.</p>
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>License</th>
            </tr>
          </thead>
          <tbody>
            {software.map((s) => (
              <tr key={s.name}>
                <td>
                  <a href={s.url} target="_blank" rel="noopener">{s.name}</a>
                </td>
                <td>{s.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Full license texts are available at the linked project pages.</p>
      </>
    ),
  },
];

export default function LicensesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Licenses", path: "/licenses/" }])} />
      <LegalPage eyebrow="Legal" title="Licenses" lead="Trademarks, content ownership and the open-source software behind this site." sections={sections} />
    </>
  );
}
