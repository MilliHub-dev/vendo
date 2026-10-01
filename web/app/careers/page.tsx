import type { Metadata } from "next";
import { ArrowRight, Bike, Code2, Headphones, MapPin, Megaphone, Rocket, Store, TrendingUp, Users } from "lucide-react";
import { CtaBanner } from "@/components/CtaBanner";
import { PageHero } from "@/components/PageHero";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Careers",
  description: "Help build the fastest, most trusted delivery platform in West Africa. See the teams Vendo hires for.",
};

// Teams we hire for. Add specific openings here as they're approved.
const teams = [
  { icon: Bike, name: "City Operations", text: "Run daily delivery in your city — rider supply, dispatch quality and on-time performance.", where: "Abuja · Kaduna · Kano · Lagos" },
  { icon: Users, name: "Rider Success", text: "Onboard, verify and support our riders, from document review to their first 100 trips.", where: "All cities" },
  { icon: Store, name: "Vendor Partnerships", text: "Bring great local restaurants and shops onto Vendo and help them grow.", where: "All cities" },
  { icon: Headphones, name: "Customer Support", text: "Be the voice of Vendo on WhatsApp and phone — fast, friendly, problem-solving.", where: "Kaduna HQ" },
  { icon: Code2, name: "Engineering & Product", text: "Build the customer app, Rider app, admin dashboard and real-time systems behind them.", where: "Kaduna HQ / Remote" },
  { icon: Megaphone, name: "Marketing & Growth", text: "Tell the Vendo story and grow our community of customers across Nigeria.", where: "Kaduna HQ / Lagos" },
];

const why = [
  { icon: Rocket, title: "Early-stage impact", text: "Join at the start and shape how a whole city gets its deliveries." },
  { icon: TrendingUp, title: "Grow as we grow", text: "New cities mean new roles — and room to lead them." },
  { icon: MapPin, title: "Local, for real", text: "We build for the streets, vendors and people we know." },
];

export default function CareersPage() {
  const mail = (team: string) => `mailto:${site.email}?subject=${encodeURIComponent(`Application — ${team}`)}`;
  return (
    <>
      <PageHero
        eyebrow="Careers"
        title={
          <>
            Build What <span className="text-blue">Moves</span> Nigeria.
          </>
        }
        lead="We're a young team on a big mission: fast, trusted delivery for every neighbourhood. If you care about getting things done well, we'd love to hear from you."
        art="/illustrations/cities.svg"
      >
        <a href="#teams" className="btn btn--primary">
          See our teams <ArrowRight className="arrow" />
        </a>
      </PageHero>

      <section className="section-tight">
        <div className="container card-grid card-grid--3">
          {why.map((w) => (
            <div key={w.title} className="feature">
              <span className="feature__icon"><w.icon /></span>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section band join-block" id="teams">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Teams we hire for</span>
              <h2 className="h-2">Find Your Place.</h2>
              <p className="lead">
                Don&apos;t see an exact role? Send your CV to <a className="text-blue" href={`mailto:${site.email}`}>{site.email}</a> with the team
                you&apos;re interested in.
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {teams.map((t) => (
              <div key={t.name} className="team-row">
                <div>
                  <h3>{t.name}</h3>
                  <p>{t.text}</p>
                  <div className="team-row__meta">
                    <span className="pill"><t.icon /> {t.name}</span>
                    <span className="pill"><MapPin /> {t.where}</span>
                  </div>
                </div>
                <a href={mail(t.name)} className="btn btn--outline btn--sm">
                  Apply <ArrowRight className="arrow" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-tight" />
      <CtaBanner eyebrow="Want to ride instead?" title={<>Earn With Every Trip.</>} text="Riders and bike owners apply through our Join Us page." />
    </>
  );
}
