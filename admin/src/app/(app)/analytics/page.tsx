"use client";

import { useOverview } from "@/api/queries";
import { ExportButton } from "@/components/admin";
import { Spinner } from "@/components/ui";
import { formatNaira } from "@/lib/money";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Bars({ title, total, values, format }: { title: string; total: string; values: { date: string; n: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...values.map((v) => v.n));
  return (
    <section className="card">
      <div className="card__head">
        <h2>{title}</h2>
        <span className="small strong text-primary">{total}</span>
      </div>
      <div className="chart chart--14" role="img" aria-label={`${title}: ${values.map((v) => format(v.n)).join(", ")}`}>
        {values.map((v, i) => (
          <div key={v.date} className="chart__col" data-today={i === values.length - 1} title={`${new Date(v.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}: ${format(v.n)}`}>
            <div className="chart__bar" style={{ height: Math.max(4, Math.round((v.n / max) * 130)) }} />
            <span className="chart__day">{DAYS[new Date(v.date).getDay()]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AnalyticsPage() {
  const { data: d } = useOverview();
  if (!d) return <Spinner />;
  const orders = d.days.reduce((n, x) => n + x.orders, 0);
  const revenue = d.days.reduce((n, x) => n + x.revenueKobo, 0);
  const customers = d.retention.newCustomers + d.retention.returningCustomers;
  const returning = customers ? d.retention.returningCustomers / customers : 0;
  const topCity = Math.max(1, ...d.cities.map((c) => c.orders));

  return (
    <>
      <div className="toolbar">
        <p className="muted grow">The last 14 days, across all cities.</p>
        <ExportButton rows={d.days} filename="vendo-daily.csv" columns={[["Date", (x) => x.date.slice(0, 10)], ["Orders", (x) => x.orders], ["Revenue (NGN)", (x) => x.revenueKobo / 100]]} />
      </div>

      <section className="stats">
        <div className="card stat"><span className="stat__label">Orders</span><span className="stat__value">{orders}</span><span className="small muted">{Math.round(orders / 14)} a day on average</span></div>
        <div className="card stat"><span className="stat__label">Revenue</span><span className="stat__value">{formatNaira(revenue)}</span><span className="small muted">from delivered orders</span></div>
        <div className="card stat"><span className="stat__label">Average order</span><span className="stat__value">{formatNaira(orders ? Math.round(revenue / orders / 100) * 100 : 0)}</span></div>
        <div className="card stat"><span className="stat__label">Returning customers</span><span className="stat__value stat__value--accent">{pct(returning)}</span><span className="small muted">{d.retention.returningCustomers} of {customers} ordered more than once</span></div>
      </section>

      <div className="grid-2">
        <Bars title="Orders per day" total={`${orders} orders`} values={d.days.map((x) => ({ date: x.date, n: x.orders }))} format={(n) => `${n} orders`} />
        <Bars title="Revenue per day" total={formatNaira(revenue)} values={d.days.map((x) => ({ date: x.date, n: x.revenueKobo }))} format={formatNaira} />
      </div>

      <section className="card card--flush">
        <div className="card__head" style={{ padding: "18px 20px 0" }}>
          <h2>City performance</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>City</th>
                <th style={{ width: "30%" }}>Share of orders</th>
                <th className="num">Orders</th>
                <th className="num">Revenue</th>
                <th className="num">Fulfilment</th>
                <th className="num">Riders online</th>
              </tr>
            </thead>
            <tbody>
              {d.cities.map((c) => (
                <tr key={c.cityId}>
                  <td className="strong">{c.name}</td>
                  <td><div className="meter"><span style={{ width: `${(c.orders / topCity) * 100}%` }} /></div></td>
                  <td className="num" data-label="Orders">{c.orders}</td>
                  <td className="num" data-label="Revenue">{formatNaira(c.revenueKobo)}</td>
                  <td className="num" data-label="Fulfilment">{c.orders ? pct(c.fulfilmentRate) : "—"}</td>
                  <td className="num" data-label="Riders online">{c.onlineRiders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card__head"><h2>Top vendors</h2><span className="small muted">by delivered orders</span></div>
          <div className="list">
            {d.topVendors.map((v, i) => (
              <div key={v.name} className="list__row">
                <span className="rank">{i + 1}</span>
                <span className="grow truncate">{v.name}</span>
                <span className="small muted">{v.orders} orders</span>
                <span className="strong">{formatNaira(v.revenueKobo)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card__head"><h2>Top riders</h2><span className="small muted">by completed trips</span></div>
          <div className="list">
            {d.topRiders.map((r, i) => (
              <div key={r.name} className="list__row">
                <span className="rank">{i + 1}</span>
                <span className="grow truncate">{r.name}</span>
                <span className="small muted">{r.rating.toFixed(1)} ★</span>
                <span className="strong">{r.trips} trips</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
