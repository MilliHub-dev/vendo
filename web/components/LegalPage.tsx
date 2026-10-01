import { TriangleAlert } from "lucide-react";
import { LEGAL_DRAFT, LEGAL_UPDATED } from "@/lib/site";
import { PageHero } from "./PageHero";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

export function LegalPage({ eyebrow, title, lead, sections }: { eyebrow: string; title: string; lead: string; sections: LegalSection[] }) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} lead={<>{lead} Last updated {LEGAL_UPDATED}.</>} />
      <section className="section-tight">
        <div className="container legal">
          <aside className="legal__toc">
            <h4>On this page</h4>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </aside>
          <article className="prose">
            {LEGAL_DRAFT && (
              <div className="notice" role="note">
                <TriangleAlert />
                <span>Draft for review. This document has not yet been approved by Vendo&apos;s legal counsel and may change before launch.</span>
              </div>
            )}
            {sections.map((s) => (
              <section key={s.id}>
                <h2 id={s.id}>{s.title}</h2>
                {s.body}
              </section>
            ))}
          </article>
        </div>
      </section>
    </>
  );
}
