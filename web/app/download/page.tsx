import type { Metadata } from "next";
import { Bell, CalendarClock, CheckCircle2, MapPinned, ShieldCheck, Wallet } from "lucide-react";
import { PhoneMockup } from "@/components/PhoneMockup";
import { StoreBadges } from "@/components/StoreBadges";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Download",
  description: "The Vendo and Vendo Rider apps are coming soon to iOS and Android. Book on WhatsApp today.",
};

const features = [
  { icon: MapPinned, title: "Live tracking", text: "Watch your rider move on the map in real time." },
  { icon: ShieldCheck, title: "Delivery codes", text: "Dispatch orders close only with your one-time code." },
  { icon: Wallet, title: "Vendo Wallet", text: "Top up by card, bank transfer or USSD via Paystack." },
  { icon: CalendarClock, title: "Schedule ahead", text: "Book a pickup for later — we remind you 30 minutes before." },
  { icon: Bell, title: "Instant updates", text: "Push alerts at every step, plus optional WhatsApp confirmations." },
];

export default function DownloadPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container page-hero__grid">
          <div>
            <span className="eyebrow eyebrow--blue">Download</span>
            <h1 className="h-1">
              Vendo in Your <span className="text-blue">Pocket.</span>
            </h1>
            <p className="lead">
              Order food, send packages and track every delivery live. The Vendo app is coming soon to iPhone and Android.
            </p>
            <StoreBadges />
            <div className="page-hero__actions">
              <a href={whatsappLink("Hi Vendo, please notify me when the app launches.")} className="btn btn--dark" target="_blank" rel="noopener">
                <WhatsAppIcon /> Notify me at launch
              </a>
            </div>
          </div>
          <PhoneMockup />
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Inside the app</span>
              <h2 className="h-2">Everything in One Place.</h2>
            </div>
          </div>
          <div className="card-grid card-grid--3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {features.map((f) => (
              <div key={f.title} className="feature">
                <span className="feature__icon"><f.icon /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="container app-cards">
          <div className="app-card">
            <img className="app-card__icon" src="/brand/app-icon.png" alt="" />
            <h3>Vendo</h3>
            <p className="muted">For customers — iOS &amp; Android</p>
            <ul className="check-list">
              <li><CheckCircle2 /> Browse local vendors and order food</li>
              <li><CheckCircle2 /> Send documents and parcels by bike</li>
              <li><CheckCircle2 /> Pay with wallet, card or transfer</li>
              <li><CheckCircle2 /> Track, rate and re-order</li>
            </ul>
            <StoreBadges />
          </div>
          <div className="app-card app-card--dark">
            <img className="app-card__icon" src="/brand/app-icon.png" alt="" />
            <h3>Vendo Rider</h3>
            <p>For riders — Android first</p>
            <ul className="check-list">
              <li><CheckCircle2 /> Go online and receive nearby orders</li>
              <li><CheckCircle2 /> Navigate with Google Maps</li>
              <li><CheckCircle2 /> Confirm deliveries with the customer&apos;s code</li>
              <li><CheckCircle2 /> Track earnings and withdraw to your bank</li>
            </ul>
            <a href="/join/#riders" className="btn btn--primary" style={{ alignSelf: "flex-start", marginTop: 12 }}>
              Apply to ride
            </a>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="qr-card" style={{ maxWidth: 720, margin: "0 auto" }}>
            <img src="/brand/whatsapp-qr.png" alt="QR code to chat with Vendo on WhatsApp" />
            <div>
              <h3>Need a delivery today?</h3>
              <p>While the app is on its way, scan the code or tap below to book on WhatsApp.</p>
              <a href={whatsappLink("Hi Vendo, I'd like to book a delivery.")} className="btn btn--white btn--sm mt-24" target="_blank" rel="noopener">
                <WhatsAppIcon /> Book on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
