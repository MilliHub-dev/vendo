import type { Metadata } from "next";
import { AtSign, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { PageHero } from "@/components/PageHero";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/BrandIcons";
import { site, telLink, whatsappLink } from "@/lib/site";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us — WhatsApp, Phone & Kaduna Office",
  description: "Book a delivery or get support on WhatsApp (08144461726), call 08140454988, email Vendoltdnig@gmail.com, or visit No. 15 Kawo Road, Kaduna.",
  path: "/contact/",
  keywords: ["Vendo contact", "Vendo WhatsApp", "dispatch rider Kaduna phone number", "Kawo Road Kaduna"],
});

export default function ContactPage() {
  const mapQuery = encodeURIComponent(site.address);
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Contact", path: "/contact/" }])} />
      <PageHero
        eyebrow="Contact"
        title={
          <>
            We&apos;re Here to <span className="text-blue">Help.</span>
          </>
        }
        lead="Questions about an order, a partnership or joining the fleet? Message us — WhatsApp is the fastest way to reach the team."
      />

      <section className="section-tight">
        <div className="container contact-grid">
          <div className="contact-cards">
            <a className="contact-card" href={whatsappLink("Hi Vendo, I have a question.")} target="_blank" rel="noopener">
              <span className="contact-card__icon"><WhatsAppIcon /></span>
              <div>
                <h3>Chat on WhatsApp</h3>
                <p>Bookings, order updates and support.</p>
              </div>
            </a>
            <div className="contact-card">
              <span className="contact-card__icon"><Phone /></span>
              <div>
                <h3>Call us</h3>
                <p>
                  {site.phones.map((p, i) => (
                    <span key={p}>
                      {i > 0 && " · "}
                      <a href={telLink(p)}>{p}</a>
                    </span>
                  ))}
                </p>
              </div>
            </div>
            <a className="contact-card" href={`mailto:${site.email}`}>
              <span className="contact-card__icon"><Mail /></span>
              <div>
                <h3>Email</h3>
                <p>{site.email}</p>
              </div>
            </a>
            <div className="contact-card">
              <span className="contact-card__icon"><MapPin /></span>
              <div>
                <h3>Head office</h3>
                <p>{site.address}</p>
              </div>
            </div>
            <div className="contact-card">
              <span className="contact-card__icon"><AtSign /></span>
              <div>
                <h3>Follow {site.handle}</h3>
                <div className="socials" style={{ marginTop: 10 }}>
                  <a href={site.socials.instagram} aria-label="Instagram" target="_blank" rel="noopener"><InstagramIcon /></a>
                  <a href={site.socials.tiktok} aria-label="TikTok" target="_blank" rel="noopener"><TikTokIcon /></a>
                  <a href={site.socials.facebook} aria-label="Facebook" target="_blank" rel="noopener"><FacebookIcon /></a>
                </div>
              </div>
            </div>
            <div className="qr-card">
              <img src="/brand/whatsapp-qr.png" alt="QR code to chat with Vendo on WhatsApp" />
              <div>
                <h3>Scan to chat</h3>
                <p>Point your phone camera at the code to open a WhatsApp chat with Vendo.</p>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2 className="h-3" style={{ fontSize: 28 }}>Send us a message</h2>
            <p>We usually reply within a few hours during working hours.</p>
            <ContactForm />
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <iframe
            className="map-embed"
            title={`Map showing ${site.address}`}
            src={`https://maps.google.com/maps?q=${mapQuery}&z=15&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </>
  );
}
