import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { footerLinks, site, telLink } from "@/lib/site";
import { Art } from "./Art";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "./BrandIcons";
import { whatsappLink } from "@/lib/site";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Art src="/brand/logo-blue.png" darkSrc="/brand/logo-white.png" alt="Vendo" width={140} height={34} />
            <p>{site.tagline}. Food, parcels and possibilities — delivered across {site.cities.join(", ").replace(/, ([^,]*)$/, " and $1")}.</p>
            <div className="socials">
              <a href={site.socials.instagram} aria-label="Vendo on Instagram" target="_blank" rel="noopener"><InstagramIcon /></a>
              <a href={site.socials.tiktok} aria-label="Vendo on TikTok" target="_blank" rel="noopener"><TikTokIcon /></a>
              <a href={site.socials.facebook} aria-label="Vendo on Facebook" target="_blank" rel="noopener"><FacebookIcon /></a>
              <a href={whatsappLink()} aria-label="Chat with Vendo on WhatsApp" target="_blank" rel="noopener"><WhatsAppIcon /></a>
            </div>
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4>{title}</h4>
              <ul>
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="footer__contact-col">
            <h4>Contact</h4>
            <ul className="footer__contact">
              <li><Phone /><span>{site.phones.map((p, i) => <a key={p} href={telLink(p)}>{i > 0 && " · "}{p}</a>)}</span></li>
              <li><Mail /><a href={`mailto:${site.email}`}>{site.email}</a></li>
              <li><MapPin /><span>{site.address}</span></li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} {site.legalName}. All rights reserved.</span>
          <nav aria-label="Legal">
            <Link href="/terms/">Terms</Link>
            <Link href="/privacy/">Privacy</Link>
            <Link href="/licenses/">Licenses</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
