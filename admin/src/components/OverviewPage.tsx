"use client";

import { AlertTriangle, ArrowRight, Banknote, Bike, CheckCircle2, CircleCheck, ClipboardList, PackageCheck, Store, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { request } from "@/api/client";
import type { Row } from "@/api/types";
import { formatDate, labelOf } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import { useSession } from "@/store/session";

import { Bars, Kpi } from "./Charts";
import { Badge, Button, Spinner } from "./ui";

type Overview = { today: Row; queues: Row; days: Row[] };
const n = (v: unknown) => Number(v ?? 0) || 0;
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

/** The four queues staff work through, each linking to where it is handled. */
const queues: { key: string; label: string; waiting: string; href: string; icon: typeof Bike }[] = [
  { key: "rider_applications", label: "Rider applications", waiting: "waiting for review", href: "/riders/", icon: Bike },
  { key: "vendor_applications", label: "Vendor applications", waiting: "waiting for review", href: "/vendors/", icon: Store },
  { key: "withdrawals", label: "Withdrawals", waiting: "waiting for approval", href: "/payments/", icon: Wallet },
  { key: "disputes", label: "Disputed orders", waiting: "need a decision", href: "/orders/", icon: AlertTriangle },
];
/** Health figures where anything above zero deserves a look. */
const worrying = ["notifications_failed", "withdrawals_review", "unsettled_orders", "unsettled", "failed"];

export function OverviewPage() {
  const admin = useSession((s) => s.admin);
  const [metric, setMetric] = useState<"orders" | "paid_kobo">("orders");
  const q = useQuery({ queryKey: ["overview"], queryFn: () => request<Overview>("/v1/admin/portal/overview"), refetchInterval: 15000 });
  const health = useQuery({ queryKey: ["health"], queryFn: () => request<Row>("/v1/admin/operations/health"), refetchInterval: 30000 });

  if (q.isError)
    return (
      <div className="card stack">
        <p role="alert" className="text-danger">
          {q.error.message}
        </p>
        <div>
          <Button onClick={() => q.refetch()}>Try again</Button>
        </div>
      </div>
    );
  if (!q.data) return <Spinner />;

  const { today, days } = q.data;
  const orders = n(today.orders), delivered = n(today.delivered);
  // every one of the last 14 days, including days with no orders, so the chart doesn't skip gaps
  const byDay = new Map(days.map((d) => [String(d.day).slice(0, 10), d]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(Date.now() - (13 - i) * 86_400_000);
    const key = date.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
    const row = byDay.get(key);
    return { key, label: date.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }), orders: n(row?.orders), delivered: n(row?.delivered), paid_kobo: n(row?.paid_kobo), highlight: i === 13 };
  });
  const total = { orders: series.reduce((s, d) => s + d.orders, 0), delivered: series.reduce((s, d) => s + d.delivered, 0), paid: series.reduce((s, d) => s + d.paid_kobo, 0) };
  const attention = queues.reduce((s, item) => s + n(q.data.queues[item.key]), 0);

  return (
    <div className="stack-lg">
      <div className="between wrap">
        <div>
          <h2 className="page-title">
            {greeting()}
            {admin?.name ? `, ${admin.name.split(" ")[0]}` : ""}
          </h2>
          <p className="muted">{new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" })} · Today’s figures use Lagos time and refresh every 15 seconds.</p>
        </div>
        <Link href="/analytics/" className="btn btn--secondary btn--sm">
          Open analytics <ArrowRight />
        </Link>
      </div>

      <div className="kpis">
        <Kpi icon={<ClipboardList />} label="Orders today" value={orders.toLocaleString("en-NG")} hint={orders ? `${delivered} delivered so far` : "None placed yet"} tone="primary" />
        <Kpi icon={<PackageCheck />} label="Delivered today" value={delivered.toLocaleString("en-NG")} hint={orders ? `${Math.round((delivered / orders) * 100)}% of today’s orders` : "—"} tone="success" />
        <Kpi icon={<Banknote />} label="Paid today" value={formatNaira(n(today.paid_kobo))} hint="Customer payments, not Vendo’s revenue" tone="primary" />
        <Kpi icon={<Bike />} label="Riders online" value={n(q.data.queues.online_riders).toLocaleString("en-NG")} hint="Approved and sharing location now" tone={n(q.data.queues.online_riders) ? "success" : "warning"} />
      </div>

      <section className="stack-sm">
        <div className="between">
          <h3 className="section-title">Needs attention</h3>
          {attention === 0 ? (
            <span className="small text-success row">
              <CircleCheck size={16} /> All clear
            </span>
          ) : (
            <Badge tone="warning">{attention} waiting</Badge>
          )}
        </div>
        <div className="queue">
          {queues.map((item) => {
            const count = n(q.data.queues[item.key]);
            return (
              <Link key={item.key} href={item.href} data-waiting={count > 0}>
                <span className="queue__n">{count}</span>
                <span className="grow">
                  <span className="strong">{item.label}</span>
                  <br />
                  <span className="small muted">{count > 0 ? item.waiting : "all clear"}</span>
                </span>
                <item.icon className="queue__icon" />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid-2 grid-2--wide">
        <section className="card stack">
          <div className="between wrap">
            <div>
              <h3 className="section-title">Last 14 days</h3>
              <p className="small muted">
                {total.orders.toLocaleString("en-NG")} orders · {total.delivered.toLocaleString("en-NG")} delivered · {formatNaira(total.paid)} paid
              </p>
            </div>
            <div className="segmented" role="tablist" aria-label="Chart figure">
              <button type="button" role="tab" aria-selected={metric === "orders"} onClick={() => setMetric("orders")}>
                Orders
              </button>
              <button type="button" role="tab" aria-selected={metric === "paid_kobo"} onClick={() => setMetric("paid_kobo")}>
                Paid
              </button>
            </div>
          </div>
          {total.orders === 0 ? <p className="muted empty-chart">No orders in the last 14 days yet. The chart fills in as orders come through.</p> : <Bars label={metric === "orders" ? "Orders per day" : "Paid per day"} data={series.map((d) => ({ key: d.key, label: d.label, value: d[metric], highlight: d.highlight }))} format={metric === "orders" ? (v) => `${v} orders` : formatNaira} />}
        </section>

        <section className="card stack">
          <div className="between">
            <h3 className="section-title">System health</h3>
            {health.data ? <span className="small muted">Checked {formatDate(new Date().toISOString())}</span> : null}
          </div>
          {health.isError ? (
            <p className="text-danger">{health.error.message}</p>
          ) : !health.data ? (
            <Spinner />
          ) : (
            <div className="health">
              {Object.entries(health.data).map(([key, value]) => {
                if (typeof value === "object" && value !== null) {
                  const list = Array.isArray(value) ? (value as Row[]) : [value as Row];
                  return list.map((w, i) => (
                    <div key={`${key}-${i}`} className="health__row">
                      <span className="grow">{w.kind ? `${labelOf(String(w.kind))} worker` : labelOf(key)}</span>
                      <span className="small muted">{w.last_success_at ? `ran ${formatDate(String(w.last_success_at))}` : "has not run yet"}</span>
                    </div>
                  ));
                }
                const count = n(value);
                const bad = worrying.some((w) => key.includes(w)) && count > 0;
                return (
                  <div key={key} className="health__row">
                    <span className="grow">{labelOf(key)}</span>
                    <span className="strong">{typeof value === "boolean" ? (value ? "Yes" : "No") : count.toLocaleString("en-NG")}</span>
                    {bad ? <AlertTriangle size={16} className="text-danger" aria-label="Needs a look" /> : <CheckCircle2 size={16} className="text-success" aria-hidden />}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
