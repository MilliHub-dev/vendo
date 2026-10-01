import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, HeartHandshake, MapPin, Package, ShieldCheck, Target, UtensilsCrossed, Users, Zap } from "lucide-react";
import { CtaBanner } from "@/components/CtaBanner";
import { PageHero } from "@/components/PageHero";
import { site } from "@/lib/site";
import { Art } from "@/components/Art";

export const metadata: Metadata = {
  title: "About Us",
  description: "Vendo is a Nigerian delivery company connecting customers with local food vendors and on-demand bike dispatch.",
};

const values = [
  { icon: Zap, title: "Speed that's honest", text: "Accurate ETAs and live tracking — no guessing where your order is." },
  { icon: ShieldCheck, title: "Trust at the door", text: "Dispatch deliveries close only with the receiver's one-time code." },
  { icon: MapPin, title: "Local first", text: "Built for Nigerian cities, payments and vendors — starting in the North." },
  { icon: HeartHandshake, title: "Fair to riders", text: "Clear earnings, fast withdrawals and real support for the people on the road." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Vendo"
        title={
          <>
            Moving What Matters,
            <br />
            <span className="text-blue">Closer to You.</span>
          </>
        }
        lead="Vendo is a Nigerian delivery company. We connect customers with the food vendors they love and give every neighbourhood a fast, trusted way to send packages by bike."
        art="/illustrations/hero-scene.svg"
      >
        <Link href="/join/" className="btn btn--primary">
          Join Vendo <ArrowRight className="arrow" />
        </Link>
        <Link href="/contact/" className="btn btn--outline">
          Contact us
        </Link>
      </PageHero>

      <section className="section-tight">
        <div className="container two-col" style={{ alignItems: "start" }}>
          <div>
            <span className="eyebrow">Our story</span>
            <h2 className="h-2">Born in Kaduna. Built for every city.</h2>
          </div>
          <div className="lead" style={{ maxWidth: "none" }}>
            <p>
              Getting food or a package across town in Nigeria too often means unreliable ETAs, informal dispatch and platforms that stop at
              Lagos. Small businesses juggle phone calls to riders; customers switch between apps for food and for parcels.
            </p>
            <p className="mt-24">
              Vendo started at {site.address.replace(", Nigeria", "")} to fix that: one service for food and dispatch, with live tracking,
              wallet payments and delivery you can verify. We&apos;re launching across {site.cities.join(", ").replace(/, ([^,]*)$/, " and $1")} —
              including cities existing platforms underserve.
            </p>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container mv-grid">
          <div className="mv mv--blue">
            <span className="eyebrow">
              <Target size={14} style={{ display: "inline", marginRight: 8, verticalAlign: -2 }} />
              Our mission
            </span>
            <h3>Give every neighbourhood access to food delivery and same-day dispatch within minutes.</h3>
            <p>Reliable, affordable and transparent — for households, riders, vendors and growing businesses.</p>
          </div>
          <div className="mv">
            <span className="eyebrow">
              <Eye size={14} style={{ display: "inline", marginRight: 8, verticalAlign: -2 }} />
              Our vision
            </span>
            <h3>To be the most trusted and fastest on-demand delivery platform in West Africa.</h3>
            <p>Starting with Abuja, Kaduna, Kano and Lagos — and growing city by city.</p>
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">What we do</span>
              <h2 className="h-2">Two Services. One Vendo.</h2>
            </div>
          </div>
          <div className="card-grid card-grid--2">
            <article className="card">
              <div className="card__media">
                <Art src="/illustrations/service-food.svg" width={420} height={300} alt="" loading="lazy" />
              </div>
              <div className="card__body">
                <span className="card__icon"><UtensilsCrossed /></span>
                <h3 className="card__title">Food Court</h3>
                <p className="card__text">
                  Browse restaurants, fast food, drinks, groceries and pharmacies near you. Add to cart, pay by wallet, card or transfer, and a
                  nearby rider brings it straight to you.
                </p>
              </div>
            </article>
            <article className="card">
              <div className="card__media">
                <Art src="/illustrations/service-parcel.svg" width={420} height={300} alt="" loading="lazy" />
              </div>
              <div className="card__body">
                <span className="card__icon"><Package /></span>
                <h3 className="card__title">Dispatch</h3>
                <p className="card__text">
                  Send documents and parcels across town. Enter pickup and drop-off, see the fare up front, and the nearest rider is matched
                  instantly. Delivery closes only with the receiver&apos;s code.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">What we stand for</span>
              <h2 className="h-2">Our Values.</h2>
            </div>
          </div>
          <div className="card-grid card-grid--4">
            {values.map((v) => (
              <div key={v.title} className="feature">
                <span className="feature__icon"><v.icon /></span>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="container two-col">
          <div>
            <span className="eyebrow">Where we deliver</span>
            <h2 className="h-2">Four Cities. One Network.</h2>
            <p className="lead mt-24">
              Our headquarters is in Kaduna, and we&apos;re launching with riders and vendor partners in Abuja, Kaduna, Kano and Lagos. Each city
              has its own pricing and operating hours, so the service fits how that city moves.
            </p>
            <div className="page-hero__actions">
              <Link href="/join/#riders" className="btn btn--primary">
                <Users size={18} /> Ride in your city
              </Link>
            </div>
          </div>
          <div className="art-frame">
            <Art src="/illustrations/cities.svg" width={1200} height={720} alt="Map of Vendo cities: Kano, Kaduna, Abuja and Lagos" loading="lazy" />
          </div>
        </div>
      </section>

      <div className="section-tight" />
      <CtaBanner />
    </>
  );
}
