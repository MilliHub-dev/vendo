"use client";

import Link from "next/link";

import { useOrders, useOverview } from "@/api/queries";
import { OrderBadge, useCityName } from "@/components/admin";
import { Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { orderGroup } from "@/lib/permissions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function OverviewPage() {
  const overview = useOverview();
  const orders = useOrders();
  const cityName = useCityName();
  if (!overview.data) return <Spinner />;
  const d = overview.data;
  const max = Math.max(1, ...d.days.map((x) => x.revenueKobo));
  const live = orders.data?.filter((o) => ["pending", "active", "disputed"].includes(orderGroup(o.status))).slice(0, 8) ?? [];
  const queues = [
    { n: d.queues.riderApprovals, label: "Rider applications", hint: "waiting for review", href: "/riders/" },
    { n: d.queues.vendorApprovals, label: "Vendor applications", hint: "waiting for review", href: "/vendors/" },
    { n: d.queues.withdrawals, label: "Withdrawals", hint: "waiting for approval", href: "/payments/" },
    { n: d.queues.disputes, label: "Disputed orders", hint: "need a decision", href: "/orders/?group=disputed" },
  ];

  return (
    <>
      <section className="stats stats--6" aria-label="Today">
        {[
          ["Orders today", String(d.today.orders)],
          ["Revenue today", formatNaira(d.today.revenueKobo)],
          ["Vendo commission", formatNaira(d.today.commissionKobo), true],
          ["Riders online", String(d.today.activeRiders)],
          ["Customers ordering", String(d.today.activeCustomers)],
          ["Fulfilment rate", pct(d.today.fulfilmentRate)],
        ].map(([label, value, accent]) => (
          <div key={label as string} className="card stat">
            <span className="stat__label">{label}</span>
            <span className={accent ? "stat__value stat__value--accent" : "stat__value"}>{value}</span>
          </div>
        ))}
      </section>

      <section className="stack-sm" aria-label="Needs attention">
        <h2 className="label">Needs attention</h2>
        <div className="queue">
          {queues.map((q) => (
            <Link key={q.label} href={q.href} data-waiting={q.n > 0}>
              <span className="queue__n">{q.n}</span>
              <span>
                <span className="strong">{q.label}</span>
                <br />
                <span className="small muted">{q.n > 0 ? q.hint : "all clear"}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card__head">
            <h2>Revenue, last 14 days</h2>
            <span className="small strong text-primary">{formatNaira(d.days.reduce((n, x) => n + x.revenueKobo, 0))}</span>
          </div>
          <div className="chart chart--14" role="img" aria-label={`Revenue for the last 14 days: ${d.days.map((x) => `${DAYS[new Date(x.date).getDay()]} ${formatNaira(x.revenueKobo)}`).join(", ")}`}>
            {d.days.map((x, i) => (
              <div key={x.date} className="chart__col" data-today={i === d.days.length - 1} title={`${formatNaira(x.revenueKobo)} · ${x.orders} orders`}>
                <div className="chart__bar" style={{ height: Math.max(4, Math.round((x.revenueKobo / max) * 130)) }} />
                <span className="chart__day">{DAYS[new Date(x.date).getDay()].slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card card--flush">
          <div className="card__head" style={{ padding: "18px 20px 0" }}>
            <h2>Cities, last 14 days</h2>
            <Link href="/cities/" className="small strong text-primary">
              Manage
            </Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>City</th>
                  <th className="num">Orders</th>
                  <th className="num">Revenue</th>
                  <th className="num">Riders online</th>
                </tr>
              </thead>
              <tbody>
                {d.cities.map((c) => (
                  <tr key={c.cityId}>
                    <td className="strong">{c.name}</td>
                    <td className="num" data-label="Orders">{c.orders}</td>
                    <td className="num" data-label="Revenue">{formatNaira(c.revenueKobo)}</td>
                    <td className="num" data-label="Riders online">{c.onlineRiders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card card--flush">
        <div className="card__head" style={{ padding: "18px 20px 0" }}>
          <h2>Live orders</h2>
          <Link href="/orders/" className="small strong text-primary">
            All orders
          </Link>
        </div>
        {live.length === 0 ? (
          <p className="muted" style={{ padding: "0 20px 20px" }}>
            {orders.data ? "No orders in progress right now." : "Loading…"}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>City</th>
                  <th>Rider</th>
                  <th>Placed</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {live.map((o) => (
                  <tr key={o.id} data-alert={o.status === "disputed"}>
                    <td>
                      <Link href={`/orders/?open=${o.id}`} className="strong">
                        {o.code}
                      </Link>
                      <div className="small muted">{o.type === "food" ? o.vendorName : "Dispatch"} · {o.customer.name}</div>
                    </td>
                    <td>
                      <OrderBadge status={o.status} />
                    </td>
                    <td data-label="City">{cityName(o.cityId)}</td>
                    <td data-label="Rider">{o.riderName ?? <span className="subtle">None yet</span>}</td>
                    <td className="muted" data-label="Placed">{formatDateTime(o.createdAt)}</td>
                    <td className="num strong" data-label="Total">{formatNaira(o.totalKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
