import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BatteryCharging, Bike, Briefcase, CheckCircle2, Coins, Fuel, Store } from "lucide-react";
import { JoinForm } from "@/components/JoinForm";
import { PageHero } from "@/components/PageHero";
import { Art } from "@/components/Art";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { joinFaqs } from "@/lib/faq";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Become a Dispatch Rider, Vendor or Bike Owner",
  description: "Become a Vendo dispatch rider, sell your food or goods on Vendo, or own a fuel or electric delivery motorcycle and earn a fixed daily payment.",
  path: "/join/",
  keywords: ["dispatch rider jobs", "become a delivery rider", "sell food online Nigeria", "motorcycle investment Nigeria", "Spiro Ekon 450", "bike investment daily payment"],
});

const riderPerks = [
  "Go online when it suits you — you choose your hours",
  "See the fare and distance before you accept an order",
  "Earnings go to your Vendo wallet; withdraw to any Nigerian bank",
  "Turn-by-turn navigation via Google Maps",
  "One-tap WhatsApp line to the Vendo operations team",
];
const riderNeeds = ["Valid government-issued ID", "Motorcycle registration papers (or ride a Vendo bike)", "A clear profile photo", "An Android smartphone with data"];

const vendorPerks = [
  "Reach customers across your city in the Vendo app",
  "We handle riders, delivery and customer payments",
  "Our team uploads and updates your menu for you",
  "Order history, ratings and revenue summaries",
];

const investSteps = [
  { title: "Invest", text: "Purchase a fuel or electric commercial motorcycle." },
  { title: "Receive your asset", text: "Every unit comes with a helmet, Vendo delivery box and tracking." },
  { title: "Deploy for commercial use", text: "Your bike works daily in Vendo's delivery and dispatch operations." },
  { title: "Earn daily payments", text: "Receive a fixed daily payment for your motorcycle." },
];

export default function JoinPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Join Us", path: "/join/" }])} />
      <PageHero
        eyebrow="Join Us"
        title={
          <>
            Grow With <span className="text-blue">Vendo.</span>
          </>
        }
        lead="Ride with us, bring your kitchen online, or own a commercial motorcycle that works for you every day. Pick your path below."
        art="/illustrations/cta-scene.svg"
        artAlt="Vendo delivery motorcycle leaving the Vendo hub at night"
      >
        <a href="#apply" className="btn btn--primary">
          Apply now <ArrowRight className="arrow" />
        </a>
        <Link href="/careers/" className="btn btn--outline">
          <Briefcase size={18} /> Office careers
        </Link>
      </PageHero>

      <nav className="tabs-nav" aria-label="Ways to join">
        <div className="tabs-nav__inner">
          <a href="#riders"><Bike /> Riders</a>
          <a href="#vendors"><Store /> Vendors</a>
          <a href="#invest"><Coins /> Bike owners</a>
        </div>
      </nav>

      {/* RIDERS */}
      <section className="section join-block" id="riders">
        <div className="container join-block__grid">
          <div>
            <span className="eyebrow eyebrow--blue">For riders</span>
            <h2 className="h-2">Ride With Vendo.</h2>
            <p className="lead">Deliver food and packages in your city and get paid for every trip. Clear fares, fast payouts and a team that has your back.</p>
            <ul className="check-list">
              {riderPerks.map((p) => (
                <li key={p}><CheckCircle2 /> {p}</li>
              ))}
            </ul>
            <h3 className="sub-title">What you&apos;ll need</h3>
            <ul className="check-list">
              {riderNeeds.map((p) => (
                <li key={p}><CheckCircle2 /> {p}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="art-frame">
              <Art src="/illustrations/join-rider.svg" width={520} height={360} alt="" loading="lazy" />
            </div>
            <div className="steps steps--2 mt-24">
              {["Apply", "Upload documents", "Get approved", "Go online"].map((s, i) => (
                <div key={s} className="step" style={{ padding: 20 }}>
                  <span className="step__num" style={{ marginBottom: 10 }}>{i + 1}</span>
                  <h3 style={{ marginBottom: 0 }}>{s}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VENDORS */}
      <section className="section band join-block" id="vendors">
        <div className="container join-block__grid join-block__grid--flip">
          <div>
            <span className="eyebrow eyebrow--blue">For vendors</span>
            <h2 className="h-2">Sell on Vendo.</h2>
            <p className="lead">Restaurants, fast food spots, drink shops, grocers and pharmacies — reach more customers without hiring your own riders.</p>
            <ul className="check-list">
              {vendorPerks.map((p) => (
                <li key={p}><CheckCircle2 /> {p}</li>
              ))}
            </ul>
            <h3 className="sub-title">Membership tiers</h3>
            <div className="tier-row">
              <div className="tier"><strong>Basic</strong><span>Get listed and start taking orders.</span></div>
              <div className="tier"><strong>Standard</strong><span>Better placement in search and categories.</span></div>
              <div className="tier"><strong>Premium</strong><span>Top placement and promotional banners.</span></div>
            </div>
            <p className="fine-print">Commission rates depend on your tier and city — our partnerships team will share the details.</p>
          </div>
          <div className="art-frame">
            <Art src="/illustrations/join-vendor.svg" width={520} height={360} alt="" loading="lazy" />
          </div>
        </div>
      </section>

      {/* INVEST */}
      <section className="section join-block" id="invest">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow eyebrow--blue">Ride. Own. Profit.</span>
              <h2 className="h-2">Own a Vendo Commercial Motorcycle.</h2>
              <p className="lead">
                Buy a high-demand commercial motorcycle and earn a structured daily income while it works in Vendo&apos;s delivery fleet.
              </p>
            </div>
          </div>

          <div className="card-grid card-grid--2">
            <div className="bike-card">
              <span className="bike-card__tag"><Fuel /> Fuel</span>
              <h3>Fuel Motorcycle</h3>
              <p className="bike-card__model">QLINK XP / Champion 200</p>
              <div className="bike-card__numbers">
                <div><small>Investment</small><b>Contact us</b></div>
                <div><small>Daily payment</small><b>Contact us</b></div>
              </div>
              <ul className="spec-list">
                <li>200cc engine</li>
                <li>15 L fuel tank</li>
                <li>~300–400 km per tank</li>
                <li>~4–6 hrs continuous riding</li>
                <li>Top speed ~110 km/h+</li>
                <li>Built for delivery &amp; dispatch</li>
              </ul>
            </div>
            <div className="bike-card bike-card--electric">
              <span className="bike-card__tag"><BatteryCharging /> Electric</span>
              <h3>Electric Motorcycle</h3>
              <p className="bike-card__model">Spiro Ekon 450</p>
              <div className="bike-card__numbers">
                <div><small>Investment</small><b>Contact us</b></div>
                <div><small>Daily payment</small><b>Contact us</b></div>
              </div>
              <ul className="spec-list">
                <li>4.5 kW rated / 9 kW peak</li>
                <li>80–100 km/h top speed</li>
                <li>100–120+ km per charge</li>
                <li>Removable lithium-ion battery</li>
                <li>GPS-trackable</li>
                <li>Next-generation commercial EV</li>
              </ul>
            </div>
          </div>
          <p className="fine-print">
            Every unit includes a helmet, a Vendo-branded delivery box, fleet deployment and branding. Contact our team for current
            prices and daily payment amounts; the full terms are set out in your investment agreement.
          </p>

          <div className="two-col mt-48">
            <div className="steps steps--2">
              {investSteps.map((s, i) => (
                <div key={s.title} className="step">
                  <span className="step__num">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
            <div className="art-frame">
              <Art src="/illustrations/join-invest.svg" width={520} height={360} alt="" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* APPLY */}
      <section className="section-tight join-block" id="apply">
        <div className="container two-col" style={{ alignItems: "start" }}>
          <div>
            <span className="eyebrow eyebrow--blue">Apply</span>
            <h2 className="h-2">Let&apos;s Get You Started.</h2>
            <p className="lead mt-24">Tell us a little about yourself and we&apos;ll reach out on WhatsApp with the next steps for your city.</p>
          </div>
          <div className="panel">
            <JoinForm />
          </div>
        </div>
      </section>

      <FaqSection eyebrow="Good to know" title="Riders, Vendors & Bike Owners: FAQ" faqs={joinFaqs} />
    </>
  );
}
