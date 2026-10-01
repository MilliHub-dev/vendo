import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { whatsappLink } from "@/lib/site";

export function CtaBanner({
  eyebrow = "Ready to send?",
  title = <>Let&apos;s Move Your City Forward.</>,
  text = "Join the customers, vendors and riders building a faster way to deliver across Nigeria.",
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  text?: string;
}) {
  return (
    <section className="container">
      <div className="cta">
        <img className="cta__art" src="/illustrations/cta-scene.svg" alt="" />
        <div className="cta__content">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="h-2">{title}</h2>
          <p>{text}</p>
          <div className="cta__actions">
            <a href={whatsappLink("Hi Vendo, I'd like to book a delivery.")} className="btn btn--primary" target="_blank" rel="noopener">
              Book us now <ArrowRight className="arrow" />
            </a>
            <Link href="/download/" className="btn btn--white">
              Get the app
            </Link>
          </div>
        </div>
        <span className="cta__script script">More than delivery.</span>
      </div>
    </section>
  );
}
