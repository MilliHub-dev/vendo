import type { ReactNode } from "react";

/** One bar per item. Bars are plain blocks sized in pixels, so the chart needs no charting library. */
export function Bars({ data, format, height = 150, label }: { data: { key: string; label: string; value: number; highlight?: boolean }[]; format: (n: number) => string; height?: number; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  // with many bars only every other (or every third…) label fits; counted from the end so the latest day is always named
  const every = Math.ceil(data.length / 7);
  return (
    <div className="bars" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}`} style={{ height: height + 26 }}>
      {data.map((d, i) => (
        <div key={d.key} className="bars__col" data-highlight={d.highlight || undefined} title={`${d.label}: ${format(d.value)}`}>
          <div className="bars__bar" style={{ height: d.value > 0 ? Math.max(4, Math.round((d.value / max) * height)) : 2 }} />
          <span className="bars__label">{(data.length - 1 - i) % every === 0 ? d.label : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** A headline number with a label, an icon and an optional line underneath. */
export function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; tone?: "primary" | "success" | "warning" | "danger" }) {
  return (
    <section className="kpi" data-tone={tone}>
      <span className="kpi__icon">{icon}</span>
      <div className="kpi__body">
        <span className="kpi__label">{label}</span>
        <span className="kpi__value">{value}</span>
        {hint ? <span className="kpi__hint">{hint}</span> : null}
      </div>
    </section>
  );
}

/** A labelled share-of-total row: name, bar, figure. */
export function ShareRow({ label, value, total, detail }: { label: string; value: number; total: number; detail: string }) {
  const share = total > 0 ? value / total : 0;
  return (
    <div className="share">
      <div className="between">
        <span className="strong">{label}</span>
        <span className="small muted">{detail}</span>
      </div>
      <div className="meter" role="img" aria-label={`${Math.round(share * 100)}% of the total`}>
        <span style={{ width: `${Math.max(share * 100, value > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}
