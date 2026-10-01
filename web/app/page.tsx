import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Building2,
  CalendarClock,
  Coins,
  FileText,
  MapPin,
  Navigation,
  Package,
  PackageOpen,
  Play,
  ShieldCheck,
  Store,
  Timer,
  Truck,
  UtensilsCrossed,
  Wallet,
  Zap,
} from "lucide-react";
import { BookingBar } from "@/components/BookingBar";
import { CtaBanner } from "@/components/CtaBanner";
import { PhoneMockup } from "@/components/PhoneMockup";
import { StoreBadges } from "@/components/StoreBadges";
import { site, whatsappLink } from "@/lib/site";
import { Art } from "@/components/Art";

const services = [
  { img: "service-food", icon: UtensilsCrossed, title: "Food Court", text: "Order from restaurants, fast food spots, drinks and groceries near you." },
  { img: "service-parcel", icon: Package, title: "Send a Package", text: "Documents and parcels picked up and delivered across town by bike." },
  { img: "service-scheduled", icon: CalendarClock, title: "Scheduled Delivery", text: "Pick a date and time. We line up a rider 15 minutes before pickup." },
  { img: "service-business", icon: Building2, title: "Business Delivery", text: "Reliable dispatch for shops, offices and online sellers, every day." },
];

const audiences = [
  { href: "/join/#riders", img: "join-rider", icon: Bike, title: "Riders", text: "Earn on your own schedule and get paid to your bank." },
  { href: "/join/#vendors", img: "join-vendor", icon: Store, title: "Vendors", text: "Put your menu in front of hungry customers across your city." },
  { href: "/join/#invest", img: "join-invest", icon: Coins, title: "Bike Owners", text: "Own a fuel or electric Vendo bike and earn daily payments." },
];

const sizes = [
  { icon: FileText, name: "Document", fits: "Envelopes, letters, contracts and small flat items.", points: ["Fits in a sleeve", "Same-day across the city", "OTP-confirmed handover"] },
  { icon: Package, name: "Small Parcel", fits: "Shoe boxes, phones, clothing and online orders.", points: ["Up to a shoe-box size", "Most popular for sellers", "Live rider tracking"], featured: true },
  { icon: PackageOpen, name: "Large Parcel", fits: "Bulky boxes that still fit safely on a bike.", points: ["Fits the Vendo delivery box", "Careful handling", "Receiver confirmation"] },
];

const steps = [
  { title: "Book", text: "Tell us what to deliver and where. See the price before you confirm." },
  { title: "Get matched", text: "The nearest available rider is offered your order within seconds." },
  { title: "Track live", text: "Follow your rider on the map from pickup to your door." },
  { title: "Confirm with a code", text: "Share your one-time code with the rider only when it's in your hands." },
];

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero__art-wrap">
          <Art className="hero__art" src="/illustrations/hero-scene.svg" alt="" fetchPriority="high" />
        </div>
        <div className="container hero__content">
          <div className="hero__copy">
            <div className="hero__intro">
              {/* phones: the scene sits behind the headline block (desktop uses .hero__art) */}
              <div className="hero__intro-art" aria-hidden>
                <Art src="/illustrations/hero-scene.svg" alt="" loading="lazy" />
              </div>
              <span className="eyebrow">{site.tagline}</span>
              <h1 className="h-display hero__title">
                <span>Send Anything.</span>
                <span>Order Anything.</span>
                <span className="text-blue">Anywhere.</span>
              </h1>
              <p className="lead">
                Food from your favourite local vendors and same-day bike dispatch for your packages — for individuals and businesses in{" "}
                {site.cities.join(", ").replace(/, ([^,]*)$/, " and $1")}.
              </p>
            </div>
            <BookingBar />
            <div className="stats">
              <div className="stat">
                <div className="stat__value">{site.cities.length}</div>
                <div className="stat__label">Cities served</div>
              </div>
              <div className="stat">
                <div className="stat__value">2-in-1</div>
                <div className="stat__label">Food &amp; dispatch</div>
              </div>
              <div className="stat">
                <div className="stat__value">Live</div>
                <div className="stat__label">Rider tracking</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRACKING */}
      <section className="section-tight">
        <div className="container track">
          <div>
            <span className="eyebrow">Track in real time</span>
            <h2 className="h-2">
              Every Package
              <br />
              In Your Hands.
            </h2>
            <p className="lead mt-24">
              Follow your rider on a live map from pickup to delivery. Know exactly where your order is — and who&apos;s bringing it.
            </p>
            <div className="page-hero__actions">
              <Link href="/download/" className="btn btn--primary">
                Track an order <ArrowRight className="arrow" />
              </Link>
              <a href="#how" className="btn btn--outline">
                <Play /> How it works
              </a>
            </div>
          </div>
          <div className="track__art">
            <Art src="/illustrations/tracking-scene.svg" width={960} height={620} alt="Map showing a Vendo rider's live route to the delivery address" />
            <span className="chip track__chip">
              <Timer /> 12 min away
            </span>
            <div className="status-card">
              <div className="status-card__head">
                <span className="status-card__icon"><Truck /></span>
                <div>
                  <div className="status-card__title">On the way</div>
                  <div className="status-card__sub">Arriving today by 6:00 PM</div>
                </div>
              </div>
              <ul className="timeline">
                <li className="done">Picked up <time>10:24 AM</time></li>
                <li className="done">In transit <time>10:42 AM</time></li>
                <li>Out for delivery</li>
                <li>Delivered</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="section band" id="services">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Our services</span>
              <h2 className="h-2">Delivery for Every Need.</h2>
              <p className="lead">Hot meals, urgent documents or a day&apos;s worth of orders — one app for all of it.</p>
            </div>
            <a href={whatsappLink("Hi Vendo, I'd like to know more about your services.")} className="btn btn--outline" target="_blank" rel="noopener">
              Talk to us <ArrowRight className="arrow" />
            </a>
          </div>
          <div className="card-grid card-grid--4">
            {services.map((s) => (
              <article key={s.title} className="card card--hover">
                <div className="card__media">
                  <Art src={`/illustrations/${s.img}.svg`} alt="" loading="lazy" />
                </div>
                <div className="card__body">
                  <span className="card__icon"><s.icon /></span>
                  <h3 className="card__title">{s.title}</h3>
                  <p className="card__text">{s.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="section">
        <div className="container split">
          <div className="split__intro">
            <span className="eyebrow">Built for everyone</span>
            <h2 className="h-2">
              Grow With
              <br />
              Vendo.
            </h2>
            <p>Whether you ride, cook or invest — there&apos;s a place for you in the Vendo network.</p>
            <Link href="/join/" className="btn btn--outline">
              See how it works <ArrowRight className="arrow" />
            </Link>
          </div>
          <div className="card-grid card-grid--3">
            {audiences.map((a) => (
              <Link key={a.title} href={a.href} className="card">
                <div className="card__media">
                  <Art src={`/illustrations/${a.img}.svg`} alt="" loading="lazy" />
                </div>
                <div className="card__body">
                  <span className="card__icon"><a.icon /></span>
                  <h3 className="card__title">{a.title}</h3>
                  <p className="card__text">{a.text}</p>
                  <span className="card__foot"><ArrowRight /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* APP */}
      <section className="section band">
        <div className="container app-block">
          <div>
            <span className="eyebrow">Built for your phone</span>
            <h2 className="h-2">Track Every Mile.</h2>
            <p className="lead mt-24">
              Order food, book a dispatch, top up your wallet and follow every delivery live — all from the Vendo app.
            </p>
            <StoreBadges />
          </div>
          <PhoneMockup />
          <div className="app-block__aside">
            <span className="script" style={{ fontSize: 34, transform: "rotate(-5deg)" }}>
              Real people.
              <br />
              Real deliveries.
            </span>
            <div className="float-card">
              <span className="float-card__icon"><ShieldCheck /></span>
              <div>
                <strong>Code-protected</strong>
                <span>Your rider only completes delivery with your one-time code.</span>
              </div>
            </div>
            <div className="float-card">
              <span className="float-card__icon"><Wallet /></span>
              <div>
                <strong>Vendo Wallet</strong>
                <span>Top up by card, transfer or USSD with Paystack.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="section">
        <div className="container pricing">
          <div>
            <span className="eyebrow">Simple pricing</span>
            <h2 className="h-2">
              Pricing That
              <br />
              Moves With You.
            </h2>
            <p className="lead mt-24">Priced by distance and package size. You always see the full price before you book — no hidden fees.</p>
            <div className="pricing__art art-frame">
              <Art src="/illustrations/parcel-big.svg" width={520} height={460} alt="" loading="lazy" />
            </div>
          </div>
          <div className="plans">
            {sizes.map((p) => (
              <div key={p.name} className={`plan${p.featured ? " plan--featured" : ""}`}>
                {p.featured && <span className="plan__badge">Most popular</span>}
                <div className="plan__name"><p.icon /> {p.name}</div>
                <p className="plan__fits">{p.fits}</p>
                <ul>
                  {p.points.map((pt) => (
                    <li key={pt}><Zap /> {pt}</li>
                  ))}
                </ul>
                <a
                  href={whatsappLink(`Hi Vendo, I'd like a quote for a ${p.name.toLowerCase()} delivery.`)}
                  className={`btn btn--sm btn--block ${p.featured ? "btn--primary" : "btn--outline"}`}
                  target="_blank"
                  rel="noopener"
                >
                  Get a quote
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section band" id="how">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">How it works</span>
              <h2 className="h-2">From Booking to Doorstep.</h2>
            </div>
            <p className="lead">Four simple steps, built around speed and trust.</p>
          </div>
          <div className="steps">
            {steps.map((s, i) => (
              <div key={s.title} className="step">
                <span className="step__num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
          <div className="cities-strip">
            <span className="label">Now delivering in</span>
            {site.cities.map((c) => (
              <span key={c}>
                <MapPin /> {c}
              </span>
            ))}
            <span>
              <Navigation /> More soon
            </span>
          </div>
        </div>
      </section>

      <div className="section-tight" />
      <CtaBanner />
    </>
  );
}
