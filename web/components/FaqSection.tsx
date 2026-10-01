import { Plus } from "lucide-react";
import type { Faq } from "@/lib/faq";
import { faqSchema } from "@/lib/seo";
import { JsonLd } from "./JsonLd";

/** Visible Q&A (native <details>, works without JS) + matching FAQPage structured data. */
export function FaqSection({ eyebrow = "FAQ", title, faqs, id = "faq" }: { eyebrow?: string; title: string; faqs: Faq[]; id?: string }) {
  return (
    <section className="section" id={id}>
      <div className="container faq">
        <div className="faq__intro">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="h-2">{title}</h2>
        </div>
        <div className="faq__list">
          {faqs.map((f, i) => (
            <details key={f.q} className="faq__item" open={i === 0}>
              <summary>
                <h3>{f.q}</h3>
                <Plus aria-hidden />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
      <JsonLd data={faqSchema(faqs)} />
    </section>
  );
}
