"use client";

import { Banknote, CircleX, ClipboardList, Download, PackageCheck, RotateCcw, Timer } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { request } from "@/api/client";
import { useCities } from "@/api/queries";
import type { Row } from "@/api/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDuration } from "@/lib/format";
import { formatNaira } from "@/lib/money";

import { Bars, Kpi, ShareRow } from "./Charts";
import { Button, Input, Spinner } from "./ui";

const DAY = 86_400_000;
const n = (v: unknown) => Number(v ?? 0) || 0;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const presets = [7, 14, 30, 90];
type Totals = { orders: number; paid_orders: number; delivered: number; cancelled: number; paid_kobo: number; refunded_kobo: number; delivery_seconds: number };
const empty = (): Totals => ({ orders: 0, paid_orders: 0, delivered: 0, cancelled: 0, paid_kobo: 0, refunded_kobo: 0, delivery_seconds: 0 });
function add(t: Totals, r: Row): Totals {
  t.orders += n(r.orders); t.paid_orders += n(r.paid_orders); t.delivered += n(r.delivered); t.cancelled += n(r.cancelled); t.paid_kobo += n(r.paid_kobo); t.refunded_kobo += n(r.refunded_kobo);
  t.delivery_seconds += n(r.avg_delivery_seconds) * n(r.delivered); // weighted, so busy days count for more
  return t;
}
const group = (rows: Row[], key: (r: Row) => string) => {
  const map = new Map<string, Totals>();
  for (const r of rows) map.set(key(r), add(map.get(key(r)) ?? empty(), r));
  return map;
};

/** Orders, payments and delivery performance for a chosen period, from the server's order report. */
export function AnalyticsPage() {
  const [to, setTo] = useState(iso(new Date()));
  const [from, setFrom] = useState(iso(new Date(Date.now() - 13 * DAY)));
  const [city, setCity] = useState("");
  const [metric, setMetric] = useState<"orders" | "paid_kobo" | "delivered">("orders");
  const cities = useCities();
  const span = (Date.parse(to) - Date.parse(from)) / DAY + 1;
  const valid = !!from && !!to && span >= 1 && span <= 90;
  const path = `/v1/admin/reports/orders?from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(Date.parse(to) + DAY).toISOString())}${city ? `&city_id=${encodeURIComponent(city)}` : ""}`;
  const report = useQuery({ queryKey: ["report", path], queryFn: () => request<Row[]>(path), enabled: valid });
  const cityName = (id: string) => String(cities.data?.find((c) => String(c.id) === id)?.name ?? "Unknown city");
  const setLast = (days: number) => (setTo(iso(new Date())), setFrom(iso(new Date(Date.now() - (days - 1) * DAY))));

  const rows = report.data ?? [];
  const total = rows.reduce(add, empty());
  const byDay = group(rows, (r) => String(r.day).slice(0, 10));
  const series = valid
    ? Array.from({ length: span }, (_, i) => {
        const date = new Date(Date.parse(from) + i * DAY);
        const t = byDay.get(iso(date)) ?? empty();
        return { key: iso(date), label: date.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" }), ...t };
      })
    : [];
  const byType = [...group(rows, (r) => String(r.type))].sort((a, b) => b[1].orders - a[1].orders);
  const byCity = [...group(rows, (r) => String(r.city_id))].sort((a, b) => b[1].orders - a[1].orders);
  const best = series.reduce((top, d) => (d.orders > top.orders ? d : top), series[0] ?? { label: "—", orders: 0 });

  const exportCsv = () =>
    downloadCsv(`vendo-analytics-${from}-to-${to}.csv`, toCsv(["Day", "Orders", "Paid orders", "Delivered", "Cancelled", "Paid (NGN)", "Refunded (NGN)"], series.map((d) => [d.key, d.orders, d.paid_orders, d.delivered, d.cancelled, d.paid_kobo / 100, d.refunded_kobo / 100])));

  return (
    <div className="stack-lg">
      <section className="card filters">
        <div className="segmented" role="group" aria-label="Period">
          {presets.map((days) => (
            <button key={days} type="button" aria-pressed={span === days && to === iso(new Date())} onClick={() => setLast(days)}>
              {days} days
            </button>
          ))}
        </div>
        <Input label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} min={from} max={iso(new Date())} onChange={(e) => setTo(e.target.value)} />
        <label className="field">
          <span>City</span>
          <select className="select" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.data?.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.name)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" disabled={!rows.length} onClick={exportCsv}>
          <Download /> Export CSV
        </Button>
      </section>

      {!valid ? (
        <p className="note note--warning">Choose a period of 1 to 90 days, with the end date on or after the start.</p>
      ) : report.isError ? (
        <div className="card stack">
          <p role="alert" className="text-danger">
            {report.error.message}
          </p>
          <div>
            <Button onClick={() => report.refetch()}>Try again</Button>
          </div>
        </div>
      ) : !report.data ? (
        <Spinner />
      ) : (
        <>
          <div className="kpis kpis--6">
            <Kpi icon={<ClipboardList />} label="Orders" value={total.orders.toLocaleString("en-NG")} hint={`${(total.orders / span).toLocaleString("en-NG", { maximumFractionDigits: 1 })} a day on average`} tone="primary" />
            <Kpi icon={<Banknote />} label="Paid by customers" value={formatNaira(total.paid_kobo)} hint={total.paid_orders ? `${formatNaira(Math.round(total.paid_kobo / total.paid_orders / 100) * 100)} average order` : "No paid orders"} tone="primary" />
            <Kpi icon={<PackageCheck />} label="Delivered" value={pct(total.delivered, total.orders)} hint={`${total.delivered.toLocaleString("en-NG")} of ${total.orders.toLocaleString("en-NG")} orders`} tone="success" />
            <Kpi icon={<CircleX />} label="Cancelled" value={pct(total.cancelled, total.orders)} hint={`${total.cancelled.toLocaleString("en-NG")} orders`} tone={total.orders && total.cancelled / total.orders > 0.15 ? "danger" : undefined} />
            <Kpi icon={<RotateCcw />} label="Refunded" value={formatNaira(total.refunded_kobo)} hint={total.paid_kobo ? `${pct(total.refunded_kobo, total.paid_kobo)} of what was paid` : "—"} tone={total.refunded_kobo ? "warning" : undefined} />
            <Kpi icon={<Timer />} label="Average delivery time" value={total.delivered ? formatDuration(total.delivery_seconds / total.delivered) : "—"} hint="From order to delivered" />
          </div>

          <section className="card stack">
            <div className="between wrap">
              <div>
                <h3 className="section-title">Day by day</h3>
                <p className="small muted">{total.orders ? `Busiest day: ${best.label} with ${best.orders} orders.` : "No orders in this period."} Days are grouped by Lagos date.</p>
              </div>
              <div className="segmented" role="tablist" aria-label="Chart figure">
                {([["orders", "Orders"], ["delivered", "Delivered"], ["paid_kobo", "Paid"]] as const).map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={metric === key} onClick={() => setMetric(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {total.orders === 0 ? <p className="muted empty-chart">Nothing to chart yet for this period.</p> : <Bars label="Per day" height={190} data={series.map((d) => ({ key: d.key, label: d.label, value: d[metric] }))} format={metric === "paid_kobo" ? formatNaira : (v) => `${v} ${metric === "orders" ? "orders" : "delivered"}`} />}
          </section>

          <div className="grid-2">
            <section className="card stack">
              <h3 className="section-title">By service</h3>
              {byType.length === 0 ? <p className="muted">No orders in this period.</p> : null}
              {byType.map(([type, t]) => (
                <ShareRow key={type} label={type === "food" ? "Food Court" : type === "dispatch" ? "Dispatch" : type} value={t.orders} total={total.orders} detail={`${t.orders.toLocaleString("en-NG")} orders · ${formatNaira(t.paid_kobo)}`} />
              ))}
            </section>
            <section className="card stack">
              <h3 className="section-title">By city</h3>
              {byCity.length === 0 ? <p className="muted">No orders in this period.</p> : null}
              {byCity.map(([id, t]) => (
                <ShareRow key={id} label={cityName(id)} value={t.orders} total={total.orders} detail={`${t.orders.toLocaleString("en-NG")} orders · ${pct(t.delivered, t.orders)} delivered · ${formatNaira(t.paid_kobo)}`} />
              ))}
            </section>
          </div>

          <section className="card card--flush">
            <div className="card__head card__head--pad">
              <h3 className="section-title">Daily figures</h3>
            </div>
            <div className="table-wrap">
              <table className="table table--data">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th className="num">Orders</th>
                    <th className="num">Delivered</th>
                    <th className="num">Cancelled</th>
                    <th className="num">Paid</th>
                    <th className="num">Refunded</th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().map((d) => (
                    <tr key={d.key}>
                      <td className="lead">{new Date(d.key).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</td>
                      <td className="num" data-label="Orders">{d.orders}</td>
                      <td className="num" data-label="Delivered">{d.delivered}</td>
                      <td className="num" data-label="Cancelled">{d.cancelled}</td>
                      <td className="num" data-label="Paid">{formatNaira(d.paid_kobo)}</td>
                      <td className="num" data-label="Refunded">{formatNaira(d.refunded_kobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="small muted">“Paid” is what customers paid for orders placed in the period. It is not Vendo’s revenue and not what has reached the bank.</p>
        </>
      )}
    </div>
  );
}
