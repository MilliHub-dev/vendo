import { Art } from "./Art";

export function PageHero({
  eyebrow,
  title,
  lead,
  art,
  artAlt = "",
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead: React.ReactNode;
  art?: string;
  artAlt?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className="container">
        <div className={art ? "page-hero__grid" : undefined}>
          <div>
            <span className="eyebrow eyebrow--blue">{eyebrow}</span>
            <h1 className="h-1">{title}</h1>
            <p className="lead">{lead}</p>
            {children && <div className="page-hero__actions">{children}</div>}
          </div>
          {art && (
            <div className="page-hero__art">
              <Art src={art} alt={artAlt} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
